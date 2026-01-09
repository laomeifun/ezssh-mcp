import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listHosts, formatHostsOutput } from "./tools/list-hosts.js";
import { execute, formatExecuteOutput } from "./tools/execute.js";
import { transfer, formatTransferOutput } from "./tools/transfer.js";
import {
  getHostResources,
  getHostResourceContent,
  parseHostUri,
} from "./resources/hosts.js";

/**
 * Create and configure MCP Server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: "mcp-ssh",
      version: "3.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "ssh_list_hosts",
          description:
            "List all available SSH hosts from ~/.ssh/config. Returns host names, addresses, users, and connection details.",
          inputSchema: {
            type: "object" as const,
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
        {
          name: "ssh_execute",
          description:
            "Execute a command on one or more SSH hosts. Runs concurrently on multiple hosts and returns results from each.",
          inputSchema: {
            type: "object" as const,
            properties: {
              hosts: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of host names (from ssh_list_hosts) or IP addresses/hostnames to execute on",
              },
              command: {
                type: "string",
                description: "The shell command to execute",
              },
              timeout: {
                type: "number",
                description:
                  "Connection timeout in milliseconds (default: 30000)",
              },
              username: {
                type: "string",
                description:
                  "SSH username for direct connection (overrides config)",
              },
              password: {
                type: "string",
                description:
                  "SSH password for direct connection (use with caution)",
              },
              port: {
                type: "number",
                description: "SSH port for direct connection (default: 22)",
              },
            },
            required: ["hosts", "command"],
            additionalProperties: false,
          },
        },
        {
          name: "ssh_transfer",
          description:
            "Transfer files between local machine and remote SSH hosts. Supports upload to multiple hosts or download from multiple hosts.",
          inputSchema: {
            type: "object" as const,
            properties: {
              direction: {
                type: "string",
                enum: ["upload", "download"],
                description: "Transfer direction: upload or download",
              },
              hosts: {
                type: "array",
                items: { type: "string" },
                description: "List of host names or IP addresses to transfer files to/from",
              },
              localPath: {
                type: "string",
                description:
                  "Local file path. For multi-host downloads, use {host} placeholder (e.g., ./logs/{host}.log) or files will be auto-suffixed with hostname",
              },
              remotePath: {
                type: "string",
                description: "Remote file path on the SSH host",
              },
              username: {
                type: "string",
                description:
                  "SSH username for direct connection (overrides config)",
              },
              password: {
                type: "string",
                description:
                  "SSH password for direct connection (use with caution)",
              },
              port: {
                type: "number",
                description: "SSH port for direct connection (default: 22)",
              },
            },
            required: ["direction", "hosts", "localPath", "remotePath"],
            additionalProperties: false,
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "ssh_list_hosts": {
          const hosts = listHosts();
          return {
            content: [
              {
                type: "text",
                text: formatHostsOutput(hosts),
              },
            ],
          };
        }

        case "ssh_execute": {
          const { hosts, command, timeout, username, password, port } = args as {
            hosts: string[];
            command: string;
            timeout?: number;
            username?: string;
            password?: string;
            port?: number;
          };

          if (!hosts || hosts.length === 0) {
            throw new Error("At least one host is required");
          }
          if (!command) {
            throw new Error("Command is required");
          }

          const directOptions = (username || password || port)
            ? { username, password, port }
            : undefined;

          const results = await execute(hosts, command, timeout, directOptions);
          return {
            content: [
              {
                type: "text",
                text: formatExecuteOutput(results),
              },
            ],
          };
        }

        case "ssh_transfer": {
          const { direction, hosts, localPath, remotePath, username, password, port } = args as {
            direction: "upload" | "download";
            hosts: string[];
            localPath: string;
            remotePath: string;
            username?: string;
            password?: string;
            port?: number;
          };

          if (!direction || !["upload", "download"].includes(direction)) {
            throw new Error("Direction must be 'upload' or 'download'");
          }
          if (!hosts || hosts.length === 0) {
            throw new Error("At least one host is required");
          }
          if (!localPath || !remotePath) {
            throw new Error("Both localPath and remotePath are required");
          }

          const directOptions = (username || password || port)
            ? { username, password, port }
            : undefined;

          const results = await transfer(direction, hosts, localPath, remotePath, directOptions);
          return {
            content: [
              {
                type: "text",
                text: formatTransferOutput(results, direction),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // List available resources (SSH hosts)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = getHostResources();
    return { resources };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const hostName = parseHostUri(uri);

    if (!hostName) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const content = getHostResourceContent(hostName);

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: content,
        },
      ],
    };
  });

  return server;
}

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP SSH Server started");
}
