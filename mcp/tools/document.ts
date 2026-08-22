import { z } from 'zod';
import type { DiagramDoc } from '../../src/types';
import { emptyDoc } from '../../src/lib/doc/ops';
import { containmentTree } from '../../src/lib/doc/containment';
import { buildSample } from '../../src/lib/docBuilder';
import { contentBBox } from '../../src/lib/geometry';
import { FLOWS } from '../../src/data/flows';
import { ok, fail, guard, type Registrar } from './shared';

/** 読み込んだ JSON が図として成立しているかを確認する。 */
function parseDoc(raw: string): DiagramDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON として解釈できませんでした。');
  }
  const doc = parsed as Partial<DiagramDoc>;
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    throw new Error('nodes と edges を持つ図の JSON ではありません。');
  }
  return {
    nodes: doc.nodes,
    edges: doc.edges,
    seq: typeof doc.seq === 'number' ? doc.seq : doc.nodes.length + doc.edges.length + 1,
  };
}

function stats(doc: DiagramDoc) {
  const byKind: Record<string, number> = {};
  doc.nodes.forEach((n) => (byKind[n.kind] = (byKind[n.kind] ?? 0) + 1));
  return { nodes: doc.nodes.length, edges: doc.edges.length, byKind };
}

export const registerDocumentTools: Registrar = (server, { session, workspace }) => {
  server.registerTool(
    'new_diagram',
    {
      title: '新しい図を作る',
      description: '編集中の図を空にする。直前の状態は undo で戻せる。',
      inputSchema: {},
    },
    async () =>
      guard(() => {
        session.replace(emptyDoc(), null);
        return ok('空の図を開きました。');
      }),
  );

  server.registerTool(
    'open_diagram',
    {
      title: '図を開く',
      description: 'アプリの「プロジェクト保存」で書き出した JSON ファイルを読み込んで編集対象にする。',
      inputSchema: {
        path: z.string().describe('作業ディレクトリからの相対パス、またはその配下の絶対パス'),
      },
    },
    async ({ path }) =>
      guard(async () => {
        const abs = workspace.resolve(path);
        const doc = parseDoc(await workspace.read(path));
        session.replace(doc, abs);
        return ok({ opened: workspace.display(abs), ...stats(doc) });
      }),
  );

  server.registerTool(
    'save_diagram',
    {
      title: '図を保存する',
      description: '編集中の図を JSON ファイルに書き出す。path を省略すると直近に開いた / 保存したファイルを上書きする。',
      inputSchema: {
        path: z.string().optional().describe('保存先。省略時は直近のファイル'),
      },
    },
    async ({ path }) =>
      guard(async () => {
        const target = path ?? (session.filePath ? workspace.display(session.filePath) : null);
        if (!target) return fail('保存先がありません。path を指定してください。');
        const abs = await workspace.write(target, JSON.stringify(session.doc, null, 2));
        session.filePath = abs;
        return ok({ saved: workspace.display(abs), ...stats(session.doc) });
      }),
  );

  server.registerTool(
    'get_diagram',
    {
      title: '図の JSON を取得する',
      description: '編集中の図をそのままの JSON で返す。座標や属性を細かく確認したいときに使う。',
      inputSchema: {},
    },
    async () => guard(() => ok(session.doc)),
  );

  server.registerTool(
    'describe_diagram',
    {
      title: '図の構造を読む',
      description:
        '図の中身を要約して返す。どの枠に何が入っているかの入れ子構造と、線の一覧を含む。まずこれを呼ぶと図全体を把握できる。',
      inputSchema: {},
    },
    async () =>
      guard(() => {
        const doc = session.doc;
        if (!doc.nodes.length) return ok('図は空です。');
        const bbox = contentBBox(doc);
        const label = (id: string) => {
          const n = doc.nodes.find((x) => x.id === id);
          return n ? `${n.label ?? n.catId ?? n.id}(${id})` : id;
        };
        return ok({
          ...stats(doc),
          bounds: { x: Math.round(bbox.x), y: Math.round(bbox.y), w: Math.round(bbox.w), h: Math.round(bbox.h) },
          file: session.filePath ? workspace.display(session.filePath) : null,
          history: session.historyDepth,
          containment: containmentTree(doc),
          edges: doc.edges.map((e) => ({
            id: e.id,
            from: label(e.from),
            to: label(e.to),
            label: e.label || undefined,
            flow: `${e.flow} (${FLOWS[e.flow]?.label ?? e.flow})`,
            arrow: e.arrow,
          })),
        });
      }),
  );

  server.registerTool(
    'load_template',
    {
      title: 'テンプレートを読み込む',
      description: '作例の構成図を読み込んで編集対象にする。解析やレイアウトの動作を試すときの出発点になる。',
      inputSchema: {
        name: z.enum(['mlops']).default('mlops').describe('mlops: ALB/ECS/特徴量ストア/訓練パイプラインを含む MLOps 構成'),
      },
    },
    async () =>
      guard(() => {
        const doc = buildSample();
        session.replace(doc, null);
        return ok({ loaded: 'mlops', ...stats(doc) });
      }),
  );

  server.registerTool(
    'undo',
    {
      title: '直前の変更を取り消す',
      description: 'このセッションで行った編集を 1 つ戻す。',
      inputSchema: {},
    },
    async () => guard(() => (session.undo() ? ok({ undone: true, history: session.historyDepth }) : fail('戻せる変更がありません。'))),
  );

  server.registerTool(
    'redo',
    {
      title: '取り消した変更をやり直す',
      description: 'undo で戻した編集を 1 つ進める。',
      inputSchema: {},
    },
    async () => guard(() => (session.redo() ? ok({ redone: true, history: session.historyDepth }) : fail('やり直せる変更がありません。'))),
  );
};
