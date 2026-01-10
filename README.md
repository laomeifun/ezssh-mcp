# ezssh-mcp

Easy SSH MCP Server - Execute commands and transfer files via SSH with AI assistance.

## Features

- 🖥️ **Cross-platform**: Linux, macOS, Windows
- 🔑 **SSH Agent support**: System SSH Agent, 1Password, Windows OpenSSH
- 📋 **Auto-discovery**: Reads hosts from `~/.ssh/config`
- ⚡ **Concurrent execution**: Run commands on multiple hosts simultaneously
- 📁 **File transfer**: Upload/download via SFTP
- 🔗 **MCP Resources**: SSH hosts exposed as resources for AI access
- 🤖 **Multi-AI compatible**: OpenAI, Claude, Gemini

## Installation

### From GitHub Packages

```bash
# Configure npm to use GitHub Packages for @laomeifun scope
echo "@laomeifun:registry=https://npm.pkg.github.com" >> ~/.npmrc

# Install globally
npm install -g @laomeifun/ezssh-mcp
```

### From Source

```bash
git clone https://github.com/laomeifun/ezssh-mcp.git
cd ezssh-mcp
npm install
npm run build
```

## Usage

### As MCP Server

```bash
npm start
```

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/path/to/ezssh-mcp/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `ssh_list_hosts` | List available SSH hosts from config |
| `ssh_execute` | Execute commands on one or more hosts |
| `ssh_transfer` | Upload/download files via SFTP |

## Resources

SSH hosts are exposed as MCP resources with URI format `ssh://<host-name>`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SSH_CONFIG_PATH` | SSH config file path | `~/.ssh/config` |
| `SSH_KNOWN_HOSTS_PATH` | known_hosts file path | `~/.ssh/known_hosts` |
| `SSH_AUTH_SOCK` | SSH Agent socket path | System default |
| `SSH_TIMEOUT` | Connection timeout (ms) | `30000` |
| `SSH_STRICT_HOST_KEY` | Strict host key checking | `false` |
| `SSH_MAX_CONCURRENCY` | Max concurrent connections | `10` |

## License

MIT
