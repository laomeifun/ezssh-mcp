import { basename, dirname, extname, join, normalize } from "path";
import { uploadFile, downloadFile } from "../ssh/client.js";
import { getConfig } from "../config.js";
import { runWithConcurrency } from "../utils.js";
import type { TransferResult, DirectConnectionOptions } from "../types.js";

// Only allow safe characters in host names to prevent path traversal
const SAFE_HOST_PATTERN = /^[a-zA-Z0-9._-]+$/;

function sanitizeHostName(host: string): string {
  if (SAFE_HOST_PATTERN.test(host)) {
    return host;
  }
  return host.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveLocalPath(localPath: string, host: string): string {
  if (localPath.includes("{host}")) {
    const sanitizedHost = sanitizeHostName(host);
    const resolved = localPath.replace(/\{host\}/g, sanitizedHost);
    const normalized = normalize(resolved);
    if (normalized.includes("..")) {
      throw new Error(`Invalid path after host substitution: ${normalized}`);
    }
    return resolved;
  }
  return localPath;
}

function addHostSuffix(localPath: string, host: string): string {
  const sanitizedHost = sanitizeHostName(host);
  const dir = dirname(localPath);
  const ext = extname(localPath);
  const base = basename(localPath, ext);
  return join(dir, `${base}_${sanitizedHost}${ext}`);
}

/**
 * Transfer files between local and remote hosts
 */
export async function transfer(
  direction: "upload" | "download",
  hosts: string[],
  localPath: string,
  remotePath: string,
  directOptions?: DirectConnectionOptions
): Promise<TransferResult[]> {
  const maxConcurrency = getConfig().maxConcurrency;

  if (direction === "upload") {
    // Upload: same local file to multiple hosts
    return runWithConcurrency(
      hosts,
      (host) => uploadFile(host, localPath, remotePath, directOptions),
      maxConcurrency
    );
  } else {
    // Download: from multiple hosts to local
    const isMultiHost = hosts.length > 1;
    const hasPlaceholder = localPath.includes("{host}");

    return runWithConcurrency(
      hosts,
      (host) => {
        let resolvedLocalPath: string;

        if (hasPlaceholder) {
          // Use {host} placeholder
          resolvedLocalPath = resolveLocalPath(localPath, host);
        } else if (isMultiHost) {
          // Add host suffix for multi-host downloads
          resolvedLocalPath = addHostSuffix(localPath, host);
        } else {
          // Single host, use as-is
          resolvedLocalPath = localPath;
        }

        return downloadFile(host, remotePath, resolvedLocalPath, directOptions);
      },
      maxConcurrency
    );
  }
}

/**
 * Format transfer results for display
 */
export function formatTransferOutput(
  results: TransferResult[],
  direction: "upload" | "download"
): string {
  const lines: string[] = [];
  const action = direction === "upload" ? "Uploaded" : "Downloaded";

  for (const result of results) {
    if (result.success) {
      if (direction === "upload") {
        lines.push(`✓ ${result.host}: ${result.localPath} -> ${result.remotePath}`);
      } else {
        lines.push(`✓ ${result.host}: ${result.remotePath} -> ${result.localPath}`);
      }
    } else {
      lines.push(`✗ ${result.host}: ${result.error}`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  lines.push("");
  lines.push(`${action} ${successCount}/${results.length} successfully`);

  return lines.join("\n");
}
