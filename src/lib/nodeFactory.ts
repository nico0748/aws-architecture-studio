import type { DiagramNode, NodeKind, FlowKey, TextAlign } from '../types';
import { grpById, svcById, shpById } from '../data/catalog';
import { GRID } from '../data/flows';

export interface NodeOpts {
  label?: string;
  w?: number;
  h?: number;
  subtitle?: string;
  color?: string;
  fill?: string | null;
  dashed?: boolean;
  text?: string;
  fontSize?: number;
  textColor?: string;
  bold?: boolean;
  align?: TextAlign;
  boxed?: boolean;
  title?: string;
  flows?: FlowKey[];
}

export function snapVal(v: number, snap: boolean): number {
  return snap ? Math.round(v / GRID) * GRID : Math.round(v);
}

export function defaultLabel(kind: NodeKind, catId?: string): string {
  if (kind === 'service' && catId) return svcById[catId]?.label ?? catId;
  if (kind === 'shape' && catId) return shpById[catId]?.label ?? catId;
  if (kind === 'group' && catId) return grpById[catId]?.label ?? catId;
  return '';
}

/** Build a fully-initialised node. Coordinates are pre-snapped by the caller. */
export function makeNode(
  id: string,
  kind: NodeKind,
  catId: string | undefined,
  x: number,
  y: number,
  opts: NodeOpts = {},
  center = false,
): DiagramNode {
  const n: DiagramNode = { id, kind, x, y };

  if (kind === 'service' || kind === 'shape') {
    n.catId = catId;
    n.label = opts.label ?? defaultLabel(kind, catId);
  } else if (kind === 'group') {
    const g = catId ? grpById[catId] : undefined;
    n.catId = catId;
    n.w = opts.w ?? (catId === 'section' ? 250 : 230);
    n.h = opts.h ?? (catId === 'section' ? 150 : 160);
    n.label = opts.label ?? g?.label ?? '';
    n.subtitle = opts.subtitle ?? (catId === 'section' ? '説明文をここに' : '');
    n.color = opts.color ?? g?.color ?? '#8C4FFF';
    n.fill = opts.fill !== undefined ? opts.fill : g?.fill ?? null;
    n.dashed =
      opts.dashed !== undefined ? opts.dashed : catId === 'az' || catId === 'security_group';
    if (center) {
      n.x = x - (n.w ?? 0) / 2;
      n.y = y - (n.h ?? 0) / 2;
    }
  } else if (kind === 'text') {
    n.text = opts.text ?? 'テキスト';
    n.w = opts.w ?? 160;
    n.fontSize = opts.fontSize ?? 14;
    n.textColor = opts.textColor ?? '#16202b';
    n.bold = !!opts.bold;
    n.align = opts.align ?? 'left';
    n.boxed = !!opts.boxed;
  } else if (kind === 'legend') {
    n.title = opts.title ?? 'データフローについて';
    n.flows = opts.flows ?? ['inference', 'log', 'training', 'analysis', 'cicd', 'monitor'];
    n.w = opts.w ?? 210;
  }
  return n;
}
