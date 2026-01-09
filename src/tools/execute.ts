import { executeBatch } from "../ssh/client.js";
import type { ExecuteResult, DirectConnectionOptions } from "../types.js";

/**
 * Execute command on multiple hosts
 */
export async function execute(
  hosts: string[],
  command: string,
  timeout?: number,
  directOptions?: DirectConnectionOptions
): Promise<ExecuteResult[]> {
  return executeBatch(hosts, command, timeout, directOptions);
}

/**
 * Format execution results for display
 */
export function formatExecuteOutput(results: ExecuteResult[]): string {
  const lines: string[] = [];

  for (const result of results) {
    lines.push(`=== ${result.host} ===`);

    if (result.success) {
      lines.push(`Exit code: ${result.exitCode}`);
      if (result.stdout) {
        lines.push(`stdout:\n${result.stdout}`);
      }
      if (result.stderr) {
        lines.push(`stderr:\n${result.stderr}`);
      }
    } else {
      lines.push(`Error: ${result.error}`);
    }

    lines.push("");
  }

  const successCount = results.filter((r) => r.success).length;
  lines.push(`Summary: ${successCount}/${results.length} succeeded`);

  return lines.join("\n");
}
