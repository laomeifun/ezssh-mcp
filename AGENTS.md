# ezssh-mcp

[![npm version](https://img.shields.io/npm/v/ezssh-mcp.svg)](https://www.npmjs.com/package/ezssh-mcp)

## 项目概述

这是一个基于 Model Context Protocol (MCP) 的 SSH 服务器，用于管理和控制 SSH 连接。它可以与 Claude Desktop 和其他 MCP 兼容的客户端无缝集成，提供 AI 驱动的 SSH 操作。

**npm 包**: https://www.npmjs.com/package/ezssh-mcp

**GitHub**: https://github.com/laomeifun/ezssh-mcp

## 功能特性

### 跨平台支持
- ✅ Linux
- ✅ macOS
- ✅ Windows

### SSH Agent 支持
- ✅ 系统 SSH Agent (`SSH_AUTH_SOCK`)
- ✅ 1Password SSH Agent
- ✅ Windows OpenSSH Agent

### 自动配置发现
- 自动读取 `~/.ssh/config` 配置
- 支持自定义配置路径 (`SSH_CONFIG_PATH` 环境变量)

### MCP Resources
- SSH 主机作为 MCP 资源暴露
- 资源 URI 格式: `ssh://host-name`
- AI 可直接读取主机配置信息

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SSH_CONFIG_PATH` | SSH 配置文件路径 | `~/.ssh/config` |
| `SSH_KNOWN_HOSTS_PATH` | known_hosts 文件路径 | `~/.ssh/known_hosts` |
| `SSH_AUTH_SOCK` | SSH Agent socket 路径 | 系统默认 |
| `SSH_TIMEOUT` | 连接超时（毫秒） | `30000` |
| `SSH_STRICT_HOST_KEY` | 严格检查主机密钥 | `false` |
| `SSH_MAX_CONCURRENCY` | 最大并发连接数 | `10` |

## 资源列表

### SSH 主机资源
- **URI 格式**: `ssh://<host-name>`
- **MIME 类型**: `application/json`
- **内容**: 主机配置详情（hostname, port, user, identityFile 等）

## 工具列表

### 1. `ssh_list_hosts`
列出所有可用的 SSH 主机。

**参数**: 无

**返回**: 主机列表，包含名称、地址、用户、端口等信息

---

### 2. `ssh_execute`
在一个或多个 SSH 主机上执行命令。

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `hosts` | `string[]` | ✅ | 主机名列表或 IP 地址 |
| `command` | `string` | ✅ | 要执行的命令 |
| `timeout` | `number` | ❌ | 连接超时（毫秒，默认 30000） |
| `username` | `string` | ❌ | SSH 用户名（直接连接时使用） |
| `password` | `string` | ❌ | SSH 密码（直接连接时使用，注意安全） |
| `port` | `number` | ❌ | SSH 端口（默认 22） |

**示例（使用配置文件）**:
```json
{
  "hosts": ["web1", "web2", "web3"],
  "command": "uptime"
}
```

**示例（直接连接）**:
```json
{
  "hosts": ["192.168.1.100"],
  "command": "uptime",
  "username": "root",
  "password": "your-password",
  "port": 22
}
```

---

### 3. `ssh_transfer`
在本地和远程主机之间传输文件。

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `direction` | `"upload" \| "download"` | ✅ | 传输方向 |
| `hosts` | `string[]` | ✅ | 主机名列表 |
| `localPath` | `string` | ✅ | 本地文件路径 |
| `remotePath` | `string` | ✅ | 远程文件路径 |

**上传示例**:
```json
{
  "direction": "upload",
  "hosts": ["web1", "web2"],
  "localPath": "./dist/app.zip",
  "remotePath": "/opt/app/app.zip"
}
```

**下载示例**（多主机）:
```json
{
  "direction": "download",
  "hosts": ["web1", "web2"],
  "localPath": "./logs/{host}.log",
  "remotePath": "/var/log/app.log"
}
```

**下载规则**:
- 单主机：`localPath` 原样使用
- 多主机 + `{host}` 占位符：替换为主机名
- 多主机 + 无占位符：自动添加 `_主机名` 后缀

## 安装

### 从 npm 安装（推荐）

```bash
npm install -g ezssh-mcp
```

### 从源码安装

```bash
git clone https://github.com/laomeifun/ezssh-mcp.git
cd ezssh-mcp
npm install
npm run build
```

## 使用

### 作为 MCP 服务器运行

```bash
ezssh-mcp
# 或
npx ezssh-mcp
```

### Claude Desktop 配置

在 `claude_desktop_config.json` 中添加：

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

或者全局安装后：

```json
{
  "mcpServers": {
    "ssh": {
      "command": "ezssh-mcp"
    }
  }
}
```

### 自定义 SSH 配置路径

```bash
SSH_CONFIG_PATH=/path/to/ssh_config ezssh-mcp
```

## 开发

```bash
# 开发模式（监听文件变化）
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build
```

## 技术栈

- **语言**: TypeScript
- **SSH 库**: ssh2 (纯 JavaScript，跨平台)
- **MCP SDK**: @modelcontextprotocol/sdk
- **构建工具**: tsup

## 许可证

MIT
