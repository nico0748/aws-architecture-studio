import { z } from 'zod';
import type { DiagramNode } from '../../src/types';
import * as ops from '../../src/lib/doc/ops';
import { svcById, grpById, shpById } from '../../src/data/catalog';
import { nodeRect } from '../../src/lib/geometry';
import { parentOf } from '../../src/lib/doc/containment';
import { ok, fail, guard, nodeKindSchema, nodeOptsShape, flowSchema, routingSchema, type Registrar } from './shared';

/** kind に対して catId が妥当かを確かめる。存在しない id は静かに無視されると気づけないため弾く。 */
function validateCatId(kind: string, catId?: string): string | null {
  if (kind === 'text' || kind === 'legend') return null;
  if (!catId) return `kind=${kind} には catId が必要です。search_catalog で探してください。`;
  const table = kind === 'service' ? svcById : kind === 'group' ? grpById : shpById;
  if (!table[catId]) return `${kind} に ${catId} というカタログ項目はありません。search_catalog で探してください。`;
  return null;
}

function summarize(n: DiagramNode) {
  const r = nodeRect(n);
  return {
    id: n.id,
    kind: n.kind,
    catId: n.catId,
    label: n.label ?? n.title ?? n.text,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) },
  };
}

export const registerEditTools: Registrar = (server, { session }) => {
  server.registerTool(
    'add_node',
    {
      title: 'ノードを追加する',
      description:
        '図に要素を 1 つ置く。座標はキャンバス上の絶対値で、group は (x, y) を中心として扱う。枠の中に置きたい場合は、その枠の矩形内に収まる座標を渡す。',
      inputSchema: {
        kind: nodeKindSchema,
        catId: z.string().optional().describe('service / shape / group で必須。search_catalog で得た id'),
        x: z.number().describe('X 座標'),
        y: z.number().describe('Y 座標'),
        snap: z.boolean().default(true).describe('10px グリッドに吸着させる'),
        ...nodeOptsShape,
      },
    },
    async ({ kind, catId, x, y, snap, ...opts }) =>
      guard(() => {
        const err = validateCatId(kind, catId);
        if (err) return fail(err);
        const res = ops.addNode(session.doc, { kind, catId, x, y, snap, opts });
        session.commit(res.doc);
        const parent = parentOf(res.doc, res.node);
        return ok({ added: summarize(res.node), placedIn: parent ? summarize(parent) : null });
      }),
  );

  server.registerTool(
    'update_node',
    {
      title: 'ノードを編集する',
      description: 'ラベル・サイズ・色などを変更する。指定した項目だけが上書きされる。',
      inputSchema: {
        id: z.string().describe('対象のノード id'),
        ...nodeOptsShape,
      },
    },
    async ({ id, ...patch }) =>
      guard(() => {
        if (!ops.findNode(session.doc, id)) return fail(`ノード ${id} がありません。`);
        const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        if (!Object.keys(clean).length) return fail('変更する項目がありません。');
        const next = ops.patchNode(session.doc, id, clean as Partial<DiagramNode>);
        session.commit(next);
        return ok({ updated: summarize(ops.findNode(next, id)!) });
      }),
  );

  server.registerTool(
    'move_node',
    {
      title: 'ノードを移動する',
      description: 'ノードの座標を変更する。枠の中に入れる / 外に出すのもこれで行う。',
      inputSchema: {
        id: z.string(),
        x: z.number(),
        y: z.number(),
      },
    },
    async ({ id, x, y }) =>
      guard(() => {
        if (!ops.findNode(session.doc, id)) return fail(`ノード ${id} がありません。`);
        const next = ops.moveNode(session.doc, id, x, y);
        session.commit(next);
        const node = ops.findNode(next, id)!;
        const parent = parentOf(next, node);
        return ok({ moved: summarize(node), placedIn: parent ? summarize(parent) : null });
      }),
  );

  server.registerTool(
    'delete_node',
    {
      title: 'ノードを削除する',
      description: 'ノードと、それに繋がっている線をまとめて削除する。',
      inputSchema: { id: z.string() },
    },
    async ({ id }) =>
      guard(() => {
        const node = ops.findNode(session.doc, id);
        if (!node) return fail(`ノード ${id} がありません。`);
        const removedEdges = session.doc.edges.filter((e) => e.from === id || e.to === id).map((e) => e.id);
        session.commit(ops.deleteNode(session.doc, id));
        return ok({ deleted: id, removedEdges });
      }),
  );

  server.registerTool(
    'duplicate_node',
    {
      title: 'ノードを複製する',
      description: 'ノードを少しずらした位置に複製する。線は複製されない。',
      inputSchema: {
        id: z.string(),
        offset: z.number().default(24).describe('元の位置からのずらし幅'),
      },
    },
    async ({ id, offset }) =>
      guard(() => {
        const res = ops.duplicateNode(session.doc, id, true, offset);
        if (!res) return fail(`ノード ${id} がありません。`);
        session.commit(res.doc);
        return ok({ created: summarize(res.node) });
      }),
  );

  server.registerTool(
    'set_node_order',
    {
      title: '重なり順を変える',
      description: '枠と要素が重なって隠れる場合に、描画順を前後させる。',
      inputSchema: {
        id: z.string(),
        order: z.enum(['front', 'back', 'forward', 'backward']).describe('front=最前面, back=最背面, forward/backward=1 つ分'),
      },
    },
    async ({ id, order }) =>
      guard(() => {
        if (!ops.findNode(session.doc, id)) return fail(`ノード ${id} がありません。`);
        const next = ops.reorderNode(session.doc, id, order);
        if (next === session.doc) return ok({ changed: false, reason: 'すでに端にあります。' });
        session.commit(next);
        return ok({ changed: true, id, order });
      }),
  );

  server.registerTool(
    'add_edge',
    {
      title: '線をつなぐ',
      description: 'ノード間にデータフローの線を引く。同じ from / to / flow の組は重複して作られない。',
      inputSchema: {
        from: z.string().describe('始点のノード id'),
        to: z.string().describe('終点のノード id'),
        label: z.string().optional().describe('線に添える説明。例: /predict'),
        flow: flowSchema.optional(),
        routing: routingSchema.optional().describe('orthogonal=直角配線, straight=直線'),
        arrow: z.boolean().optional().describe('終点に矢印をつける'),
      },
    },
    async ({ from, to, ...opts }) =>
      guard(() => {
        if (!ops.findNode(session.doc, from)) return fail(`始点 ${from} がありません。`);
        if (!ops.findNode(session.doc, to)) return fail(`終点 ${to} がありません。`);
        if (from === to) return fail('同じノード同士は繋げません。');
        const res = ops.addEdge(session.doc, from, to, opts);
        if (!res) return fail('同じ向き・同じ種類の線がすでにあります。');
        session.commit(res.doc);
        return ok({ added: res.edge });
      }),
  );

  server.registerTool(
    'update_edge',
    {
      title: '線を編集する',
      description: 'ラベル・種類・配線方法・矢印の有無を変更する。',
      inputSchema: {
        id: z.string(),
        label: z.string().optional(),
        flow: flowSchema.optional(),
        routing: routingSchema.optional(),
        arrow: z.boolean().optional(),
      },
    },
    async ({ id, ...patch }) =>
      guard(() => {
        if (!ops.findEdge(session.doc, id)) return fail(`線 ${id} がありません。`);
        const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        if (!Object.keys(clean).length) return fail('変更する項目がありません。');
        const next = ops.patchEdge(session.doc, id, clean);
        session.commit(next);
        return ok({ updated: ops.findEdge(next, id) });
      }),
  );

  server.registerTool(
    'delete_edge',
    {
      title: '線を削除する',
      description: '線を 1 本削除する。',
      inputSchema: { id: z.string() },
    },
    async ({ id }) =>
      guard(() => {
        if (!ops.findEdge(session.doc, id)) return fail(`線 ${id} がありません。`);
        session.commit(ops.deleteEdge(session.doc, id));
        return ok({ deleted: id });
      }),
  );
};
