import { basename, dirname, extname, join } from "path";
import { uploadFile, downloadFile } from "../ssh/client.js";
import type { TransferResult, DirectConnectionOptions } from "../types.js";

/**
 * Resolve local path with {host} placeholder
 */
function resolveLocalPath(localPath: string, host: string): string {
  if (localPath.includes("{host}")) {
    return localPath.replace(/\{host\}/g, host);
  }
  return localPath;
}

/**
 * Add host suffix to filename for multi-host downloads
 */
function addHostSuffix(localPath: string, host: string): string {
  const dir = dirname(localPath);
  const ext = extname(localPath);
  const base = basename(localPath, ext);
  return join(dir, `${base}_${host}${ext}`);
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
  if (direction === "upload") {
    // Upload: same local file to multiple hosts
    const promises = hosts.map((host) =>
      uploadFile(host, localPath, remotePath, directOptions)
    );
    return Promise.all(promises);
  } else {
    // Download: from multiple hosts to local
    const isMultiHost = hosts.length > 1;
    const hasPlaceholder = localPath.includes("{host}");

    const promises = hosts.map((host) => {
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
    });

    return Promise.all(promises);
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
