import { readFileSync, existsSync, statSync } from "fs";
import { homedir } from "os";
import SSHConfigParser from "ssh-config";
import type { SSHHost } from "../types.js";
import { getConfig } from "../config.js";

/**
 * Cache for parsed SSH config
 */
let _cachedHosts: SSHHost[] | null = null;
let _cachedConfigPath: string | null = null;
let _cachedMtime: number | null = null;

/**
 * Get SSH config file path from config
 */
export function getSSHConfigPath(): string {
  return getConfig().sshConfigPath;
}

/**
 * Check if cache is valid (same path and file not modified)
 */
function isCacheValid(configPath: string): boolean {
  if (!_cachedHosts || _cachedConfigPath !== configPath) {
    return false;
  }

  try {
    const stat = statSync(configPath);
    return stat.mtimeMs === _cachedMtime;
  } catch {
    return false;
  }
}

/**
 * Parse SSH config file and return list of hosts (with caching)
 */
export function parseSSHConfig(): SSHHost[] {
  const configPath = getSSHConfigPath();

  if (isCacheValid(configPath)) {
    return _cachedHosts!;
  }

  if (!existsSync(configPath)) {
    _cachedHosts = [];
    _cachedConfigPath = configPath;
    _cachedMtime = null;
    return [];
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = SSHConfigParser.parse(content);
    const hosts: SSHHost[] = [];

    for (const section of config) {
      if (section.type !== 1 || section.param !== "Host") continue;

      const hostValue = section.value;
      if (!hostValue || hostValue === "*") continue;

      const rawHostnames = Array.isArray(hostValue) ? hostValue : [hostValue];
      const hostnames: string[] = rawHostnames.map((h) => 
        typeof h === "string" ? h : h.val
      );

      for (const name of hostnames) {
        if (name.includes("*") || name.includes("?")) continue;

        const computed = config.compute(name);

        const getString = (val: string | string[] | undefined): string | undefined => {
          if (Array.isArray(val)) return val[0];
          return val;
        };

        const identityFileRaw = getString(computed.IdentityFile);
        const identityFile = identityFileRaw?.replace("~", homedir());

        hosts.push({
          name,
          hostname: getString(computed.HostName) || name,
          port: parseInt(getString(computed.Port) || "22", 10),
          user: getString(computed.User) || process.env.USER || process.env.USERNAME || "root",
          identityFile,
        });
      }
    }

    _cachedHosts = hosts;
    _cachedConfigPath = configPath;
    try {
      _cachedMtime = statSync(configPath).mtimeMs;
    } catch {
      _cachedMtime = null;
    }

    return hosts;
  } catch {
    _cachedHosts = [];
    _cachedConfigPath = configPath;
    _cachedMtime = null;
    return [];
  }
}

/**
 * Clear SSH config cache (for testing or when config changes)
 */
export function clearSSHConfigCache(): void {
  _cachedHosts = null;
  _cachedConfigPath = null;
  _cachedMtime = null;
}

/**
 * Find a specific host by name
 */
export function findHost(name: string): SSHHost | undefined {
  const hosts = parseSSHConfig();
  return hosts.find((h) => h.name === name);
}

/**
 * Resolve host - find in config or create from hostname
 */
export function resolveHost(nameOrHostname: string): SSHHost {
  const found = findHost(nameOrHostname);
  if (found) return found;

  // Treat as direct hostname
  return {
    name: nameOrHostname,
    hostname: nameOrHostname,
    port: 22,
    user: process.env.USER || process.env.USERNAME || "root",
  };
}
