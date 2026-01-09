import { Client, type ConnectConfig } from "ssh2";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getSSHAgentSocket } from "./agent.js";
import { resolveHost } from "./config.js";
import { getConfig } from "../config.js";
import { runWithConcurrency } from "../utils.js";
import type { SSHHost, ExecuteResult, TransferResult, DirectConnectionOptions } from "../types.js";

/**
 * Parse known_hosts file and return a map of host -> key data
 */
function parseKnownHosts(knownHostsPath: string): Map<string, string[]> {
  const hostKeys = new Map<string, string[]>();
  
  if (!existsSync(knownHostsPath)) {
    return hostKeys;
  }

  try {
    const content = readFileSync(knownHostsPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      // Format: hostname[,hostname2,...] keytype base64key [comment]
      const parts = trimmed.split(/\s+/);
      if (parts.length < 3) continue;
      
      const hostnames = parts[0].split(",");
      const keyType = parts[1];
      const keyData = parts[2];
      
      for (const hostname of hostnames) {
        // Handle hashed hostnames (start with |1|)
        const existing = hostKeys.get(hostname) || [];
        existing.push(`${keyType} ${keyData}`);
        hostKeys.set(hostname, existing);
      }
    }
  } catch {
    // Ignore parse errors
  }

  return hostKeys;
}

/**
 * Create a host verifier function based on config
 */
function createHostVerifier(
  hostname: string,
  port: number
): ((key: Buffer) => boolean) | undefined {
  const config = getConfig();
  
  if (!config.strictHostKeyChecking) {
    // Skip host key verification
    return undefined;
  }

  const knownHosts = parseKnownHosts(config.sshKnownHostsPath);
  
  // Check various hostname formats
  const hostVariants = [
    hostname,
    port !== 22 ? `[${hostname}]:${port}` : null,
  ].filter(Boolean) as string[];

  return (key: Buffer): boolean => {
    // Get the key fingerprint for comparison
    const keyBase64 = key.toString("base64");
    
    for (const hostVariant of hostVariants) {
      const knownKeys = knownHosts.get(hostVariant);
      if (knownKeys) {
        // Check if any known key matches
        for (const knownKey of knownKeys) {
          const parts = knownKey.split(" ");
          if (parts.length >= 2 && parts[1] === keyBase64) {
            return true;
          }
        }
        // Host found but key doesn't match - reject
        return false;
      }
    }
    
    // Host not in known_hosts - reject in strict mode
    return false;
  };
}

/**
 * Create SSH connection config from host
 */
function createConnectConfig(host: SSHHost, timeout?: number): ConnectConfig {
  const config: ConnectConfig = {
    host: host.hostname,
    port: host.port,
    username: host.user,
    readyTimeout: timeout || 30000,
  };

  // Apply host key verification if strict mode is enabled
  const hostVerifier = createHostVerifier(host.hostname, host.port);
  if (hostVerifier) {
    config.hostVerifier = hostVerifier;
  }

  // Use password if provided
  if (host.password) {
    config.password = host.password;
    return config;
  }

  // Try SSH Agent
  const agentSocket = getSSHAgentSocket();
  if (agentSocket) {
    config.agent = agentSocket;
  }

  // Fallback to identity file
  if (host.identityFile && existsSync(host.identityFile)) {
    config.privateKey = readFileSync(host.identityFile);
  }

  return config;
}

/**
 * Merge direct connection options with resolved host
 */
function applyDirectOptions(host: SSHHost, options?: DirectConnectionOptions): SSHHost {
  if (!options) return host;

  return {
    ...host,
    user: options.username || host.user,
    password: options.password,
    port: options.port || host.port,
    identityFile: options.privateKeyPath || host.identityFile,
  };
}

/**
 * Connect to SSH host
 */
export function connect(
  hostName: string,
  timeout?: number,
  directOptions?: DirectConnectionOptions
): Promise<Client> {
  return new Promise((resolve, reject) => {
    let host = resolveHost(hostName);
    host = applyDirectOptions(host, directOptions);
    const config = createConnectConfig(host, timeout);
    const client = new Client();

    client.on("ready", () => {
      resolve(client);
    });

    client.on("error", (err) => {
      reject(err);
    });

    client.connect(config);
  });
}

/**
 * Execute command on a single host
 */
export async function executeCommand(
  hostName: string,
  command: string,
  timeout?: number,
  directOptions?: DirectConnectionOptions
): Promise<ExecuteResult> {
  let client: Client | null = null;

  try {
    client = await connect(hostName, timeout, directOptions);

    return await new Promise<ExecuteResult>((resolve) => {
      let stdout = "";
      let stderr = "";

      client!.exec(command, (err, stream) => {
        if (err) {
          resolve({
            host: hostName,
            success: false,
            error: err.message,
          });
          return;
        }

        stream.on("close", (code: number) => {
          client?.end();
          resolve({
            host: hostName,
            success: code === 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code,
          });
        });

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });
  } catch (err) {
    client?.end();
    return {
      host: hostName,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute command on multiple hosts concurrently with concurrency limit
 */
export async function executeBatch(
  hosts: string[],
  command: string,
  timeout?: number,
  directOptions?: DirectConnectionOptions
): Promise<ExecuteResult[]> {
  const maxConcurrency = getConfig().maxConcurrency;
  
  return runWithConcurrency(
    hosts,
    (host) => executeCommand(host, command, timeout, directOptions),
    maxConcurrency
  );
}

/**
 * Upload file to remote host via SFTP
 */
export async function uploadFile(
  hostName: string,
  localPath: string,
  remotePath: string,
  directOptions?: DirectConnectionOptions
): Promise<TransferResult> {
  let client: Client | null = null;

  try {
    client = await connect(hostName, undefined, directOptions);

    return await new Promise<TransferResult>((resolve) => {
      client!.sftp((err, sftp) => {
        if (err) {
          client?.end();
          resolve({
            host: hostName,
            success: false,
            localPath,
            remotePath,
            error: err.message,
          });
          return;
        }

        sftp.fastPut(localPath, remotePath, (err) => {
          client?.end();
          if (err) {
            resolve({
              host: hostName,
              success: false,
              localPath,
              remotePath,
              error: err.message,
            });
          } else {
            resolve({
              host: hostName,
              success: true,
              localPath,
              remotePath,
            });
          }
        });
      });
    });
  } catch (err) {
    client?.end();
    return {
      host: hostName,
      success: false,
      localPath,
      remotePath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Download file from remote host via SFTP
 */
export async function downloadFile(
  hostName: string,
  remotePath: string,
  localPath: string,
  directOptions?: DirectConnectionOptions
): Promise<TransferResult> {
  let client: Client | null = null;

  try {
    // Ensure local directory exists
    const localDir = dirname(localPath);
    if (localDir && !existsSync(localDir)) {
      mkdirSync(localDir, { recursive: true });
    }

    client = await connect(hostName, undefined, directOptions);

    return await new Promise<TransferResult>((resolve) => {
      client!.sftp((err, sftp) => {
        if (err) {
          client?.end();
          resolve({
            host: hostName,
            success: false,
            localPath,
            remotePath,
            error: err.message,
          });
          return;
        }

        sftp.fastGet(remotePath, localPath, (err) => {
          client?.end();
          if (err) {
            resolve({
              host: hostName,
              success: false,
              localPath,
              remotePath,
              error: err.message,
            });
          } else {
            resolve({
              host: hostName,
              success: true,
              localPath,
              remotePath,
            });
          }
        });
      });
    });
  } catch (err) {
    client?.end();
    return {
      host: hostName,
      success: false,
      localPath,
      remotePath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
