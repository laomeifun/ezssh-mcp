import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listHosts, formatHostsOutput } from "./tools/list-hosts.js";
import { execute, formatExecuteOutput } from "./tools/execute.js";
import { transfer, formatTransferOutput } from "./tools/transfer.js";
import {
  getHostResources,
  getHostResourceContent,
  createHostUri,
  parseHostUri,
} from "./resources/hosts.js";
import { executeSchema, transferSchema } from "./tools/schemas.js";
import type { DirectConnectionOptions } from "./types.js";

const MAX_COMMAND_LENGTH = 100000;

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "mcp-ssh",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  server.registerTool(
    "ssh_list_hosts",
    {
      description:
        "List all available SSH hosts from ~/.ssh/config. Returns host names, addresses, users, and connection details.",
    },
    async () => {
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
  );

  server.registerTool(
    "ssh_execute",
    {
      description:
        "Execute a command on one or more SSH hosts. Runs concurrently on multiple hosts and returns results from each.",
      inputSchema: executeSchema,
    },
    async (args) => {
      const { hosts, command, timeout, username, password, port, privateKeyPath } = args;

      if (!hosts || hosts.length === 0) {
        return {
          content: [{ type: "text", text: "Error: At least one host is required" }],
          isError: true,
        };
      }
      if (!command) {
        return {
          content: [{ type: "text", text: "Error: Command is required" }],
          isError: true,
        };
      }
      if (command.length > MAX_COMMAND_LENGTH) {
        return {
          content: [{ type: "text", text: `Error: Command too long (max ${MAX_COMMAND_LENGTH} characters)` }],
          isError: true,
        };
      }

      const directOptions: DirectConnectionOptions | undefined =
        username || password || port || privateKeyPath
          ? { username, password, port, privateKeyPath }
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
  );

  server.registerTool(
    "ssh_transfer",
    {
      description:
        "Transfer files between local machine and remote SSH hosts. Supports upload to multiple hosts or download from multiple hosts.",
      inputSchema: transferSchema,
    },
    async (args) => {
      const { direction, hosts, localPath, remotePath, username, password, port, privateKeyPath } = args;

      if (!hosts || hosts.length === 0) {
        return {
          content: [{ type: "text", text: "Error: At least one host is required" }],
          isError: true,
        };
      }
      if (!localPath || !remotePath) {
        return {
          content: [{ type: "text", text: "Error: Both localPath and remotePath are required" }],
          isError: true,
        };
      }

      const directOptions: DirectConnectionOptions | undefined =
        username || password || port || privateKeyPath
          ? { username, password, port, privateKeyPath }
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
  );

  const hostResources = getHostResources();
  for (const resource of hostResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async () => {
        const content = getHostResourceContent(resource.name);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: "application/json",
              text: content,
            },
          ],
        };
      }
    );
  }

  // Ensure resources handlers are set even when no hosts are configured
  if (hostResources.length === 0) {
    server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const hostName = parseHostUri(uri);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ error: `Host '${hostName}' not found` }, null, 2),
          },
        ],
      };
    });
  }

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP SSH Server started");

  const shutdown = async (): Promise<void> => {
    console.error("Shutting down...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
