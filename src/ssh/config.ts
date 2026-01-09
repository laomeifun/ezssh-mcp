import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import SSHConfigParser from "ssh-config";
import type { SSHHost } from "../types.js";
import { getConfig } from "../config.js";

/**
 * Get SSH config file path from config
 */
export function getSSHConfigPath(): string {
  return getConfig().sshConfigPath;
}

/**
 * Parse SSH config file and return list of hosts
 */
export function parseSSHConfig(): SSHHost[] {
  const configPath = getSSHConfigPath();

  if (!existsSync(configPath)) {
    return [];
  }

  const content = readFileSync(configPath, "utf-8");
  const config = SSHConfigParser.parse(content);
  const hosts: SSHHost[] = [];

  for (const section of config) {
    // Only process Host sections (type 1)
    if (section.type !== 1) continue;

    const hostParam = section.param;
    if (!hostParam || hostParam === "*") continue;

    const hostnames = Array.isArray(hostParam) ? hostParam : [hostParam];

    for (const name of hostnames) {
      // Skip wildcard patterns
      if (name.includes("*") || name.includes("?")) continue;

      const computed = config.compute(name);

      // Helper to get first value from string | string[]
      const getString = (val: string | string[] | undefined): string | undefined => {
        if (Array.isArray(val)) return val[0];
        return val;
      };

      hosts.push({
        name,
        hostname: getString(computed.HostName) || name,
        port: parseInt(getString(computed.Port) || "22", 10),
        user: getString(computed.User) || process.env.USER || "root",
        identityFile: computed.IdentityFile?.[0]?.replace("~", homedir()),
        proxyJump: getString(computed.ProxyJump),
      });
    }
  }

  return hosts;
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
    user: process.env.USER || "root",
  };
}
