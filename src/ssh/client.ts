import { Client, type ConnectConfig } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { getSSHAgentSocket } from "./agent.js";
import { resolveHost } from "./config.js";
import type { SSHHost, ExecuteResult, TransferResult, DirectConnectionOptions } from "../types.js";

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
    identityFile: options.privateKey || host.identityFile,
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
 * Execute command on multiple hosts concurrently
 */
export async function executeBatch(
  hosts: string[],
  command: string,
  timeout?: number,
  directOptions?: DirectConnectionOptions
): Promise<ExecuteResult[]> {
  const promises = hosts.map((host) => executeCommand(host, command, timeout, directOptions));
  return Promise.all(promises);
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
