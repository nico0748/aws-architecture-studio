import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DocumentSession } from '../session';
import type { Workspace } from '../workspace';

export interface ToolCtx {
  session: DocumentSession;
  workspace: Workspace;
}

export type Registrar = (server: McpServer, ctx: ToolCtx) => void;

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

/** 構造化データはそのまま JSON で返す。モデルが読む前提なので整形しておく。 */
export function ok(payload: unknown): ToolResult {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }] };
}

export function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** ツール本体を包み、例外を isError の結果に変換する。 */
export function guard(fn: () => ToolResult | Promise<ToolResult>): Promise<ToolResult> {
  return Promise.resolve()
    .then(fn)
    .catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
}

// ===== 共通のスキーマ部品 =====

export const flowSchema = z
  .enum(['inference', 'log', 'training', 'analysis', 'cicd', 'monitor', 'default'])
  .describe('線の種類。凡例の色分けに対応する');

export const nodeKindSchema = z
  .enum(['service', 'shape', 'group', 'text', 'legend'])
  .describe('service=AWS サービス, shape=アクターや外部ロゴ, group=コンテナ枠, text=注釈, legend=凡例');

export const alignSchema = z.enum(['left', 'center', 'right']);
export const routingSchema = z.enum(['orthogonal', 'straight']);

/** add_node / update_node が共通で受け取るノードの見た目まわり。 */
export const nodeOptsShape = {
  label: z.string().optional().describe('表示名。省略時はカタログの既定名'),
  w: z.number().optional().describe('group / text / legend の幅'),
  h: z.number().optional().describe('group の高さ'),
  subtitle: z.string().optional().describe('group の説明文'),
  color: z.string().optional().describe('group の枠線色 (#RRGGBB)'),
  fill: z.string().nullable().optional().describe('group の塗り (#RRGGBB)。null で塗りなし'),
  dashed: z.boolean().optional().describe('group の枠線を破線にする'),
  text: z.string().optional().describe('text ノードの本文。改行可'),
  fontSize: z.number().optional(),
  textColor: z.string().optional(),
  bold: z.boolean().optional(),
  align: alignSchema.optional(),
  boxed: z.boolean().optional().describe('text ノードを枠で囲む'),
  title: z.string().optional().describe('legend の見出し'),
  flows: z.array(flowSchema).optional().describe('legend に並べる線の種類'),
};
