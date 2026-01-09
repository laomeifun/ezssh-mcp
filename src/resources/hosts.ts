import { parseSSHConfig } from "../ssh/config.js";
import type { SSHHost } from "../types.js";

/**
 * Resource URI prefix for SSH hosts
 */
export const SSH_RESOURCE_PREFIX = "ssh://";

/**
 * Create resource URI for a host
 */
export function createHostUri(hostName: string): string {
  return `${SSH_RESOURCE_PREFIX}${hostName}`;
}

/**
 * Parse host name from resource URI
 */
export function parseHostUri(uri: string): string | null {
  if (!uri.startsWith(SSH_RESOURCE_PREFIX)) {
    return null;
  }
  return uri.slice(SSH_RESOURCE_PREFIX.length);
}

/**
 * Resource representation for MCP
 */
export interface SSHResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Get all SSH hosts as MCP resources
 */
export function getHostResources(): SSHResource[] {
  const hosts = parseSSHConfig();

  return hosts.map((host) => ({
    uri: createHostUri(host.name),
    name: host.name,
    description: `${host.user}@${host.hostname}:${host.port}`,
    mimeType: "application/json",
  }));
}

/**
 * Get resource content for a specific host
 */
export function getHostResourceContent(hostName: string): string {
  const hosts = parseSSHConfig();
  const host = hosts.find((h) => h.name === hostName);

  if (!host) {
    return JSON.stringify({ error: `Host '${hostName}' not found` }, null, 2);
  }

  return JSON.stringify(
    {
      name: host.name,
      hostname: host.hostname,
      port: host.port,
      user: host.user,
      identityFile: host.identityFile,
    },
    null,
    2
  );
}
