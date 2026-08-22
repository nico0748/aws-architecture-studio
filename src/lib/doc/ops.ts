/**
 * DiagramDoc に対する純粋な編集操作。
 *
 * ブラウザの store と MCP サーバの両方がここを経由することで、UI から編集した
 * 場合と Claude が編集した場合で挙動が食い違わないようにしている。すべての関数は
 * 入力を変更せず、新しい doc を返す。
 */
import type { DiagramDoc, DiagramEdge, DiagramNode, EdgeRouting, FlowKey, NodeKind } from '../../types';
import { makeNode, snapVal, type NodeOpts } from '../nodeFactory';

export interface EdgeOpts {
  label?: string;
  flow?: FlowKey;
  routing?: EdgeRouting;
  arrow?: boolean;
}

export type ZOrder = 'front' | 'back' | 'forward' | 'backward';

export const emptyDoc = (): DiagramDoc => ({ nodes: [], edges: [], seq: 1 });

export const cloneDoc = (doc: DiagramDoc): DiagramDoc => JSON.parse(JSON.stringify(doc));

export const findNode = (doc: DiagramDoc, id: string): DiagramNode | undefined =>
  doc.nodes.find((n) => n.id === id);

export const findEdge = (doc: DiagramDoc, id: string): DiagramEdge | undefined =>
  doc.edges.find((e) => e.id === id);

export interface AddNodeInput {
  kind: NodeKind;
  catId?: string;
  x: number;
  y: number;
  opts?: NodeOpts;
  /** グリッドに吸着させる。 */
  snap?: boolean;
  /** group の場合に (x, y) を中心として扱う。 */
  center?: boolean;
}

export function addNode(doc: DiagramDoc, input: AddNodeInput): { doc: DiagramDoc; node: DiagramNode } {
  const snap = input.snap !== false;
  const center = input.center ?? input.kind === 'group';
  const id = 'n' + doc.seq;
  const node = makeNode(id, input.kind, input.catId, snapVal(input.x, snap), snapVal(input.y, snap), input.opts, center);
  if (center && node.w) {
    node.x = snapVal(node.x, snap);
    node.y = snapVal(node.y, snap);
  }
  return { doc: { ...doc, nodes: [...doc.nodes, node], seq: doc.seq + 1 }, node };
}

export function patchNode(doc: DiagramDoc, id: string, patch: Partial<DiagramNode>): DiagramDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch, id: n.id, kind: n.kind } : n)) };
}

export function moveNode(doc: DiagramDoc, id: string, x: number, y: number): DiagramDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) };
}

/** ノードと、それに繋がるエッジをまとめて削除する。 */
export function deleteNode(doc: DiagramDoc, id: string): DiagramDoc {
  return {
    ...doc,
    nodes: doc.nodes.filter((n) => n.id !== id),
    edges: doc.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

export function duplicateNode(
  doc: DiagramDoc,
  id: string,
  snap = true,
  offset = 24,
): { doc: DiagramDoc; node: DiagramNode } | null {
  const src = findNode(doc, id);
  if (!src) return null;
  const copy: DiagramNode = {
    ...JSON.parse(JSON.stringify(src)),
    id: 'n' + doc.seq,
    x: snapVal(src.x + offset, snap),
    y: snapVal(src.y + offset, snap),
  };
  return { doc: { ...doc, nodes: [...doc.nodes, copy], seq: doc.seq + 1 }, node: copy };
}

/** nodes 配列の並びが描画順なので、並べ替えが重なり順になる。 */
export function reorderNode(doc: DiagramDoc, id: string, order: ZOrder): DiagramDoc {
  const index = doc.nodes.findIndex((n) => n.id === id);
  if (index < 0) return doc;
  const last = doc.nodes.length - 1;
  if ((order === 'front' || order === 'forward') && index === last) return doc;
  if ((order === 'back' || order === 'backward') && index === 0) return doc;

  const nodes = [...doc.nodes];
  if (order === 'forward') {
    [nodes[index], nodes[index + 1]] = [nodes[index + 1], nodes[index]];
  } else if (order === 'backward') {
    [nodes[index], nodes[index - 1]] = [nodes[index - 1], nodes[index]];
  } else {
    const [node] = nodes.splice(index, 1);
    if (order === 'front') nodes.push(node);
    else nodes.unshift(node);
  }
  return { ...doc, nodes };
}

/** 同じ from/to/flow の組が既にある場合は null を返して重複を作らない。 */
export function addEdge(
  doc: DiagramDoc,
  from: string,
  to: string,
  opts: EdgeOpts = {},
): { doc: DiagramDoc; edge: DiagramEdge } | null {
  const flow = opts.flow ?? 'default';
  if (doc.edges.some((e) => e.from === from && e.to === to && e.flow === flow)) return null;
  const edge: DiagramEdge = {
    id: 'n' + doc.seq,
    from,
    to,
    label: opts.label ?? '',
    flow,
    routing: opts.routing ?? 'orthogonal',
    arrow: opts.arrow !== false,
  };
  return { doc: { ...doc, edges: [...doc.edges, edge], seq: doc.seq + 1 }, edge };
}

export function patchEdge(doc: DiagramDoc, id: string, patch: Partial<DiagramEdge>): DiagramDoc {
  return { ...doc, edges: doc.edges.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)) };
}

export function deleteEdge(doc: DiagramDoc, id: string): DiagramDoc {
  return { ...doc, edges: doc.edges.filter((e) => e.id !== id) };
}
