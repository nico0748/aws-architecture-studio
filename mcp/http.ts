#!/usr/bin/env node
/**
 * Streamable HTTP トランスポートの入口。
 *
 *   node mcp/dist/http.js --port 3333 --root ./diagrams
 *
 * stdio が使えない環境（ブラウザ上の Web アプリから MCP を足す場合など）向け。
 * リクエストごとにサーバを組み立てるステートレス構成だが、編集中の図はプロセスで
 * 共有するため、複数のリクエストにまたがって同じ図を編集できる。
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, createContext } from './server';

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const port = Number(flag('--port', '3333'));
const host = flag('--host', '127.0.0.1');
const ctx = createContext(argv);

/** 既定では同じマシンのブラウザからのみ受け付ける。 */
const allowedOrigin = flag('--allow-origin', '*');

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const httpServer = createHttpServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const path = (req.url ?? '').split('?')[0];

  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, root: ctx.workspace.root, nodes: ctx.session.doc.nodes.length }));
    return;
  }

  if (path !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found', hint: 'MCP のエンドポイントは /mcp です。' }));
    return;
  }

  // ステートレス構成。図そのものは ctx が握っているのでリクエストをまたいで保持される。
  const server = createServer(ctx);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.method === 'POST' ? await readBody(req) : undefined);
  } catch (e) {
    console.error('[aws-architecture-studio] リクエストの処理に失敗しました', e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
  }
});

httpServer.listen(port, host, () => {
  console.error(`[aws-architecture-studio] http://${host}:${port}/mcp で待機中 (root: ${ctx.workspace.root})`);
});
