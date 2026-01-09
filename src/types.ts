/**
 * SSH Host configuration from ~/.ssh/config
 */
export interface SSHHost {
  name: string;
  hostname: string;
  port: number;
  user: string;
  password?: string;
  identityFile?: string;
}

/**
 * Direct connection options (for ad-hoc connections)
 */
export interface DirectConnectionOptions {
  username?: string;
  password?: string;
  port?: number;
  /** Path to private key file (will be read and used for authentication) */
  privateKeyPath?: string;
}

/**
 * Result of command execution on a host
 */
export interface ExecuteResult {
  host: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  exitCode?: number;
}

/**
 * Result of file transfer operation
 */
export interface TransferResult {
  host: string;
  success: boolean;
  localPath: string;
  remotePath: string;
  bytesTransferred?: number;
  error?: string;
}

/**
 * SSH connection options
 */
export interface SSHConnectionOptions {
  host: string;
  hostname: string;
  port: number;
  username: string;
  privateKey?: Buffer;
  agent?: string;
  timeout?: number;
}
