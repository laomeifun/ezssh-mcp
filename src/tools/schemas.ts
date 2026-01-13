import { z } from "zod";

export const listHostsSchema = {};

export const executeSchema = {
  hosts: z
    .array(z.string())
    .describe(
      "List of host names (from ssh_list_hosts) or IP addresses/hostnames to execute on"
    ),
  command: z.string().describe("The shell command to execute"),
  timeout: z
    .number()
    .optional()
    .describe("Connection timeout in milliseconds (default: 30000)"),
  username: z
    .string()
    .optional()
    .describe("SSH username for direct connection (overrides config)"),
  password: z
    .string()
    .optional()
    .describe("SSH password for direct connection (use with caution)"),
  port: z
    .number()
    .optional()
    .describe("SSH port for direct connection (default: 22)"),
  privateKeyPath: z
    .string()
    .optional()
    .describe("Path to SSH private key file for direct connection"),
};

export const transferSchema = {
  direction: z
    .enum(["upload", "download"])
    .describe("Transfer direction: upload or download"),
  hosts: z
    .array(z.string())
    .describe("List of host names or IP addresses to transfer files to/from"),
  localPath: z
    .string()
    .describe(
      "Local file path. For multi-host downloads, use {host} placeholder (e.g., ./logs/{host}.log) or files will be auto-suffixed with hostname"
    ),
  remotePath: z.string().describe("Remote file path on the SSH host"),
  username: z
    .string()
    .optional()
    .describe("SSH username for direct connection (overrides config)"),
  password: z
    .string()
    .optional()
    .describe("SSH password for direct connection (use with caution)"),
  port: z
    .number()
    .optional()
    .describe("SSH port for direct connection (default: 22)"),
  privateKeyPath: z
    .string()
    .optional()
    .describe("Path to SSH private key file for direct connection"),
};

export type ExecuteInput = z.infer<z.ZodObject<typeof executeSchema>>;
export type TransferInput = z.infer<z.ZodObject<typeof transferSchema>>;
