import { Client, type ConnectConfig } from "ssh2";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getSSHAgentSocket } from "./agent.js";
import { resolveHost } from "./config.js";
import { getConfig } from "../config.js";
import { runWithConcurrency } from "../utils.js";
import type { SSHHost, ExecuteResult, TransferResult, DirectConnectionOptions } from "../types.js";

/**
 * Sanitize error messages to prevent credential leaks
 * Removes passwords, keys, and other sensitive data from error messages
 */
function sanitizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message
    .replace(/password[=:\s]+\S+/gi, "password: [REDACTED]")
    .replace(/key[=:\s]+\S+/gi, "key: [REDACTED]")
    .replace(/secret[=:\s]+\S+/gi, "secret: [REDACTED]")
    .replace(/token[=:\s]+\S+/gi, "token: [REDACTED]")
    .replace(/auth[=:\s]+\S+/gi, "auth: [REDACTED]");
}

interface KnownHostKey {
  keyType: string;
  keyData: string;
}

function parseKnownHosts(knownHostsPath: string): Map<string, KnownHostKey[]> {
  const hostKeys = new Map<string, KnownHostKey[]>();
  
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
        const existing = hostKeys.get(hostname) || [];
        existing.push({ keyType, keyData });
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
    const keyBase64 = key.toString("base64");
    
    for (const hostVariant of hostVariants) {
      const knownKeys = knownHosts.get(hostVariant);
      if (knownKeys) {
        for (const knownKey of knownKeys) {
          if (knownKey.keyData === keyBase64) {
            return true;
          }
        }
        return false;
      }
    }
    
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
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        client.end();
      }
    };

    client.on("ready", () => {
      if (!settled) {
        settled = true;
        resolve(client);
      }
    });

    client.on("error", (err) => {
      cleanup();
      reject(err);
    });

    client.on("close", () => {
      if (!settled) {
        cleanup();
        reject(new Error("Connection closed unexpectedly"));
      }
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
            error: sanitizeError(err),
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
      error: sanitizeError(err),
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
            error: sanitizeError(err),
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
              error: sanitizeError(err),
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
      error: sanitizeError(err),
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
            error: sanitizeError(err),
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
              error: sanitizeError(err),
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
      error: sanitizeError(err),
    };
  }
}
