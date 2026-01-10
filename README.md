# ezssh-mcp

[![npm version](https://img.shields.io/npm/v/ezssh-mcp.svg)](https://www.npmjs.com/package/ezssh-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Easy SSH MCP Server - Execute commands and transfer files via SSH with AI assistance.

## Features

- 🖥️ **Cross-platform**: Linux, macOS, Windows
- 🔑 **SSH Agent support**: System SSH Agent, 1Password, Windows OpenSSH
- 📋 **Auto-discovery**: Reads hosts from `~/.ssh/config`
- ⚡ **Concurrent execution**: Run commands on multiple hosts simultaneously
- 📁 **File transfer**: Upload/download via SFTP
- 🔗 **MCP Resources**: SSH hosts exposed as resources for AI access
- 🤖 **Multi-AI compatible**: Works with Claude, ChatGPT, Gemini and other MCP-compatible clients

## Installation

### From npm (Recommended)

```bash
npm install -g ezssh-mcp
```

### From Source

```bash
git clone https://github.com/laomeifun/ezssh-mcp.git
cd ezssh-mcp
npm install
npm run build
```

## Quick Start

### 1. Run as MCP Server

```bash
ezssh-mcp
# or
npx ezssh-mcp
```

### 2. Configure with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": ["-y", "ezssh-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "ezssh-mcp"
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

### ssh_execute

Execute commands on multiple hosts concurrently:

```json
{
  "hosts": ["web1", "web2", "web3"],
  "command": "uptime"
}
```

Direct connection (without SSH config):

```json
{
  "hosts": ["192.168.1.100"],
  "command": "uptime",
  "username": "root",
  "password": "your-password",
  "port": 22
}
```

### ssh_transfer

Upload files:

```json
{
  "direction": "upload",
  "hosts": ["web1", "web2"],
  "localPath": "./dist/app.zip",
  "remotePath": "/opt/app/app.zip"
}
```

Download files (with `{host}` placeholder for multiple hosts):

```json
{
  "direction": "download",
  "hosts": ["web1", "web2"],
  "localPath": "./logs/{host}.log",
  "remotePath": "/var/log/app.log"
}
```

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

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Run tests
npm test
```

## License

MIT
