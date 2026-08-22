/**
 * 図の親子関係は明示的な参照ではなく矩形の包含で表現されているため、
 * 「この RDS はどの Subnet の中か」を知るにはここで解決する必要がある。
 */
import type { DiagramDoc, DiagramNode, Rect } from '../../types';
import { nodeRect } from '../geometry';

const area = (r: Rect) => r.w * r.h;

/** 中心が入っていれば内側とみなす。端が少しはみ出した配置でも意図どおり拾える。 */
function centerInside(child: Rect, parent: Rect): boolean {
  const cx = child.x + child.w / 2;
  const cy = child.y + child.h / 2;
  return cx >= parent.x && cx <= parent.x + parent.w && cy >= parent.y && cy <= parent.y + parent.h;
}

/**
 * 親は必ず子より広い、という条件を課している。中心が入っているかだけで判定すると、
 * VPC の中心がその中の Subnet に入るような入れ子で「VPC の親は Subnet」という
 * 逆転が起き、親子が循環してツリーが壊れる。
 */
function isParentOf(parent: DiagramNode, child: DiagramNode): boolean {
  if (parent.kind !== 'group' || parent.id === child.id) return false;
  const pr = nodeRect(parent);
  const cr = nodeRect(child);
  return area(pr) > area(cr) && centerInside(cr, pr);
}

/**
 * node を含んでいる group を、内側（面積が小さい順）から並べて返す。
 * 例: [Private Subnet, VPC, AWS Cloud]
 */
export function ancestorsOf(doc: DiagramDoc, node: DiagramNode): DiagramNode[] {
  return doc.nodes
    .filter((g) => isParentOf(g, node))
    .sort((a, b) => area(nodeRect(a)) - area(nodeRect(b)));
}

/** 直近の親（最も内側の group）。どこにも入っていなければ undefined。 */
export function parentOf(doc: DiagramDoc, node: DiagramNode): DiagramNode | undefined {
  return ancestorsOf(doc, node)[0];
}

/** group の中に直接入っているノード（孫は含まない）。 */
export function childrenOf(doc: DiagramDoc, group: DiagramNode): DiagramNode[] {
  return doc.nodes.filter((n) => n.id !== group.id && parentOf(doc, n)?.id === group.id);
}

/** group の中にあるノードを、入れ子の深さに関係なくすべて返す。 */
export function descendantsOf(doc: DiagramDoc, group: DiagramNode): DiagramNode[] {
  return doc.nodes.filter((n) => isParentOf(group, n));
}

/** node の祖先に、指定した catId の group があるか。 */
export function isInside(doc: DiagramDoc, node: DiagramNode, groupCatId: string): boolean {
  return ancestorsOf(doc, node).some((g) => g.catId === groupCatId);
}

export interface ContainmentNode {
  id: string;
  kind: DiagramNode['kind'];
  catId?: string;
  label: string;
  children: ContainmentNode[];
}

function labelOf(n: DiagramNode): string {
  return n.label ?? n.title ?? n.text ?? n.catId ?? n.id;
}

/** ドキュメント全体の入れ子構造。どの group にも属さないノードが根に並ぶ。 */
export function containmentTree(doc: DiagramDoc): ContainmentNode[] {
  const parentId = new Map<string, string | undefined>();
  doc.nodes.forEach((n) => parentId.set(n.id, parentOf(doc, n)?.id));

  const build = (n: DiagramNode): ContainmentNode => ({
    id: n.id,
    kind: n.kind,
    catId: n.catId,
    label: labelOf(n),
    children: doc.nodes.filter((c) => parentId.get(c.id) === n.id).map(build),
  });

  return doc.nodes.filter((n) => !parentId.get(n.id)).map(build);
}
