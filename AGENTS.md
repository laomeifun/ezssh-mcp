# AGENTS.md - ezssh-mcp

AI 代理在此代码库中工作的指南。

## 项目概述

基于 MCP (Model Context Protocol) 的 SSH 服务器，用于管理 SSH 连接。可与 Claude Desktop 及其他 MCP 兼容客户端集成，提供 AI 驱动的 SSH 操作。

- **语言**: TypeScript (ES2022, ESM)
- **构建工具**: tsup
- **运行时**: Node.js >= 24.0.0

## 设计原则

> **MCP 适应性原则：「广泛接受，优雅失败，清晰报告」**

本项目优先考虑**广泛兼容性**而非严格安全限制：

- **广泛接受**: 尽可能接受各种输入格式，不做过度验证
- **优雅失败**: 遇到错误时返回结构化错误对象，不崩溃
- **清晰报告**: 错误信息应帮助用户理解问题，同时过滤敏感信息

### 实践指南

| 场景 | 做法 | 原因 |
|------|------|------|
| 输入验证 | 仅验证必要字段，不过度限制 | 保持对多样化 SSH 环境的兼容 |
| 错误处理 | 返回 `{ success: false, error: "..." }` | 让调用方决定如何处理 |
| 敏感信息 | 使用 `sanitizeError()` 过滤密码等 | 安全与适应性的平衡 |
| 超时/限制 | 使用合理默认值，允许覆盖 | 不同环境需求不同 |

## 构建 / 测试 / 检查命令

```bash
# 安装依赖
npm install

# 构建（输出到 dist/）
npm run build          # tsup src/index.ts --format esm --dts --clean

# 开发模式（监听文件变化）
npm run dev            # tsup src/index.ts --format esm --watch

# 类型检查
npm run typecheck      # tsc --noEmit

# 运行测试
npm test               # node test-schema-validation.mjs

# 启动 MCP 服务器
npm start              # node dist/index.js
```

### 运行单个测试

项目使用自定义测试脚本 (`test-schema-validation.mjs`)，验证 MCP 工具 schema 与 OpenAI、Claude、Gemini 的兼容性。没有测试框架，直接运行整个脚本：

```bash
node test-schema-validation.mjs
```

## 代码风格指南

### 导入规范

1. **相对导入必须使用 `.js` 扩展名**（ESM 要求）：
   ```typescript
   // 正确
   import { startServer } from "./server.js";
   import type { SSHHost } from "../types.js";
   
   // 错误
   import { startServer } from "./server";
   ```

2. **导入顺序**：先外部包，后内部模块
   ```typescript
   import { Server } from "@modelcontextprotocol/sdk/server/index.js";
   import { Client } from "ssh2";
   import { getConfig } from "../config.js";
   import type { SSHHost } from "../types.js";
   ```

3. **类型导入使用 `import type`**：
   ```typescript
   import type { SSHHost, ExecuteResult } from "../types.js";
   ```

### 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `list-hosts.ts`, `ssh-client.ts` |
| 函数名 | camelCase | `createConnectConfig`, `formatExecuteOutput` |
| 变量名 | camelCase | `hostName`, `configPath` |
| 类型/接口 | PascalCase | `SSHHost`, `ExecuteResult` |
| 常量 | camelCase 或 UPPER_SNAKE | `SSH_RESOURCE_PREFIX` |

### 导出规范

- **仅使用命名导出**（禁止默认导出）：
  ```typescript
  // 正确
  export function connect(...) { }
  export interface SSHHost { }
  
  // 错误
  export default function connect(...) { }
  ```

### 类型注解

- **公开函数必须显式声明返回类型**：
  ```typescript
  export function createServer(): Server { }
  export async function execute(...): Promise<ExecuteResult[]> { }
  ```

- **Schema 中使用 `as const`** 进行字面量类型推断：
  ```typescript
  type: "object" as const,
  ```

### 错误处理

1. **工具处理器中禁止抛出异常** - 返回结构化错误对象：
   ```typescript
   // 正确
   return {
     host: hostName,
     success: false,
     error: err instanceof Error ? err.message : String(err),
   };
   
   // 错误
   throw new Error("Connection failed");
   ```

2. **MCP 工具执行需要 try/catch 包裹**，返回用户友好的错误：
   ```typescript
   try {
     // 工具逻辑
   } catch (error) {
     return {
       content: [{ type: "text", text: `Error: ${error.message}` }],
       isError: true,
     };
   }
   ```

3. **可选操作允许空 catch 块**（如缓存操作）：
   ```typescript
   try {
     _cachedMtime = statSync(configPath).mtimeMs;
   } catch {
     _cachedMtime = null;
   }
   ```

### 格式规范

- **2 空格**缩进
- **双引号**字符串
- **必须使用分号**
- **多行结构使用尾逗号**

## 架构

```
src/
├── index.ts          # 入口 - 启动服务器
├── server.ts         # MCP 协议层（schema、请求路由）
├── config.ts         # 环境配置
├── types.ts          # 共享类型定义
├── utils.ts          # 工具函数（如 runWithConcurrency）
├── tools/            # 工具实现
│   ├── execute.ts    # ssh_execute 工具
│   ├── transfer.ts   # ssh_transfer 工具
│   └── list-hosts.ts # ssh_list_hosts 工具
├── ssh/              # SSH 核心层
│   ├── client.ts     # SSH 连接、命令执行、SFTP
│   ├── config.ts     # SSH 配置解析（~/.ssh/config）
│   └── agent.ts      # SSH Agent 检测（跨平台）
└── resources/        # MCP 资源
    └── hosts.ts      # SSH 主机作为 MCP 资源
```

### 层级职责

| 层级 | 职责 |
|------|------|
| `server.ts` | MCP 协议处理、工具注册、请求路由 |
| `tools/*.ts` | 业务逻辑、输入验证、输出格式化 |
| `ssh/*.ts` | 底层 SSH 操作（ssh2 封装） |
| `resources/*.ts` | MCP 资源定义 |

### 添加新工具

1. 在 `src/tools/new-tool.ts` 创建工具逻辑：
   ```typescript
   import type { SomeResult } from "../types.js";
   
   export async function newTool(...): Promise<SomeResult[]> { }
   export function formatNewToolOutput(results: SomeResult[]): string { }
   ```

2. 在 `src/server.ts` 注册：
   - 在 `ListToolsRequestSchema` 处理器中添加 schema 定义
   - 在 `CallToolRequestSchema` 处理器中添加执行 case

3. 如需要，在 `src/types.ts` 添加类型定义

## 关键模式

### 并发控制

批量操作使用 `runWithConcurrency`：
```typescript
import { runWithConcurrency } from "../utils.js";

const results = await runWithConcurrency(
  hosts,
  (host) => executeCommand(host, command),
  maxConcurrency
);
```

### 配置访问

通过懒加载单例访问：
```typescript
import { getConfig } from "../config.js";

const config = getConfig();
const timeout = config.timeout;
```

### SSH 主机解析

支持配置名或直接主机名：
```typescript
import { resolveHost } from "./ssh/config.js";

const host = resolveHost("web1");  // 从 ~/.ssh/config
const host = resolveHost("192.168.1.100");  // 直接连接
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SSH_CONFIG_PATH` | SSH 配置文件路径 | `~/.ssh/config` |
| `SSH_KNOWN_HOSTS_PATH` | known_hosts 文件路径 | `~/.ssh/known_hosts` |
| `SSH_AUTH_SOCK` | SSH Agent socket 路径 | 系统默认 |
| `SSH_TIMEOUT` | 连接超时（毫秒） | `30000` |
| `SSH_STRICT_HOST_KEY` | 严格检查主机密钥 | `false` |
| `SSH_MAX_CONCURRENCY` | 最大并发连接数 | `10` |

## 常见任务

### 验证更改

```bash
npm run typecheck && npm test && npm run build
```

### 本地测试 MCP 服务器

```bash
npm run build && npm start
```

## 禁止事项

- 使用 `as any`、`@ts-ignore`、`@ts-expect-error`
- 使用默认导出
- 相对导入省略 `.js` 扩展名
- 在工具处理器中抛出异常（应返回错误对象）
- 提交 `dist/` 或 `node_modules/`
