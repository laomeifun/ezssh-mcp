import { parseSSHConfig } from "../ssh/config.js";
import type { SSHHost } from "../types.js";

/**
 * List all available SSH hosts from config
 */
export function listHosts(): SSHHost[] {
  return parseSSHConfig();
}

/**
 * Format hosts for display
 */
export function formatHostsOutput(hosts: SSHHost[]): string {
  if (hosts.length === 0) {
    return "No SSH hosts found in ~/.ssh/config";
  }

  const lines = hosts.map((h) => {
    const parts = [`${h.name} -> ${h.user}@${h.hostname}:${h.port}`];
    if (h.identityFile) {
      parts.push(`(key: ${h.identityFile})`);
    }
    return parts.join(" ");
  });

  return `Found ${hosts.length} SSH hosts:\n\n${lines.join("\n")}`;
}
