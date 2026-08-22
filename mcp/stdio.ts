#!/usr/bin/env node
/**
 * stdio トランスポートの入口。Claude Code / Claude Desktop はこれを子プロセスとして起動する。
 *
 *   node mcp/dist/stdio.js --root /path/to/diagrams
 *
 * stdout は JSON-RPC が流れるため、ログは stderr にしか書けない。
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, createContext } from './server';

const ctx = createContext();
const server = createServer(ctx);

await server.connect(new StdioServerTransport());
console.error(`[aws-architecture-studio] stdio で待機中 (root: ${ctx.workspace.root})`);
