import { homedir } from "os";
import { join } from "path";

/**
 * Environment configuration with defaults
 */
export interface Config {
  // SSH Config
  sshConfigPath: string;
  sshKnownHostsPath: string;

  // Connection
  timeout: number;
  strictHostKeyChecking: boolean;

  // Concurrency
  maxConcurrency: number;
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Parse number from environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const home = homedir();

  return {
    // SSH Config paths
    sshConfigPath: process.env.SSH_CONFIG_PATH || join(home, ".ssh", "config"),
    sshKnownHostsPath: process.env.SSH_KNOWN_HOSTS_PATH || join(home, ".ssh", "known_hosts"),

    // Connection settings
    timeout: parseNumber(process.env.SSH_TIMEOUT, 30000),
    strictHostKeyChecking: parseBoolean(process.env.SSH_STRICT_HOST_KEY, false),

    // Concurrency
    maxConcurrency: parseNumber(process.env.SSH_MAX_CONCURRENCY, 10),
  };
}

/**
 * Global config instance
 */
let _config: Config | null = null;

/**
 * Get configuration (lazy loaded)
 */
export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Reset config (for testing)
 */
export function resetConfig(): void {
  _config = null;
}
