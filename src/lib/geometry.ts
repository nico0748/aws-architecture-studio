import type { DiagramNode, DiagramEdge, DiagramDoc, Point, Rect } from '../types';
import { BOX, ICON_NODE_W } from '../data/flows';

export function isIcon(n: DiagramNode): boolean {
  return n.kind === 'service' || n.kind === 'shape';
}

/** Deterministic height for a text node (based on explicit line breaks). */
export function textHeight(n: DiagramNode): number {
  const lines = String(n.text ?? '').split('\n').length;
  const fs = n.fontSize ?? 14;
  return Math.ceil(lines * fs * 1.35) + (n.boxed ? 10 : 4);
}

export function legendHeight(n: DiagramNode): number {
  return 32 + (n.flows?.length ?? 0) * 20 + 8;
}

/** The interactive/geometric rectangle of a node in world coordinates. */
export function nodeRect(n: DiagramNode): Rect {
  if (n.kind === 'service') {
    const b = BOX.service;
    return { x: n.x + (ICON_NODE_W - b) / 2, y: n.y, w: b, h: b };
  }
  if (n.kind === 'shape') {
    const b = BOX.shape;
    return { x: n.x + (ICON_NODE_W - b) / 2, y: n.y, w: b, h: b };
  }
  if (n.kind === 'group') {
    return { x: n.x, y: n.y, w: n.w ?? 200, h: n.h ?? 150 };
  }
  if (n.kind === 'text') {
    return { x: n.x, y: n.y, w: n.w ?? 160, h: textHeight(n) };
  }
  if (n.kind === 'legend') {
    return { x: n.x, y: n.y, w: n.w ?? 210, h: legendHeight(n) };
  }
  return { x: n.x, y: n.y, w: 60, h: 60 };
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Intersection of the segment (center → toward) with the rectangle border. */
export function borderPoint(r: Rect, toward: Point): Point {
  const c = rectCenter(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = r.w / 2;
  const hh = r.h / 2;
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(sx, sy);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

type Dir = 'L' | 'R' | 'U' | 'D';

/** The border-midpoint on the side of `r` facing `toward`, plus its direction. */
export function sideAnchor(r: Rect, toward: Point): { pt: Point; dir: Dir } {
  const c = rectCenter(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const hw = r.w / 2;
  const hh = r.h / 2;
  if (Math.abs(dx) * hh >= Math.abs(dy) * hw) {
    const right = dx >= 0;
    return { pt: { x: right ? r.x + r.w : r.x, y: c.y }, dir: right ? 'R' : 'L' };
  }
  const down = dy >= 0;
  return { pt: { x: c.x, y: down ? r.y + r.h : r.y }, dir: down ? 'D' : 'U' };
}

const nodeIndex = (doc: DiagramDoc) => {
  const m: Record<string, DiagramNode> = {};
  doc.nodes.forEach((n) => (m[n.id] = n));
  return m;
};

/** Compute the polyline points for an edge (world coordinates). */
export function edgePoints(doc: DiagramDoc, e: DiagramEdge): Point[] | null {
  const idx = nodeIndex(doc);
  const a = idx[e.from];
  const b = idx[e.to];
  if (!a || !b) return null;
  const ra = nodeRect(a);
  const rb = nodeRect(b);
  const ca = rectCenter(ra);
  const cb = rectCenter(rb);

  if (e.routing === 'orthogonal') {
    const A = sideAnchor(ra, cb);
    const B = sideAnchor(rb, ca);
    const p = A.pt;
    const q = B.pt;
    const hA = A.dir === 'L' || A.dir === 'R';
    const hB = B.dir === 'L' || B.dir === 'R';
    if (hA && hB) {
      const mx = (p.x + q.x) / 2;
      return [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q];
    }
    if (!hA && !hB) {
      const my = (p.y + q.y) / 2;
      return [p, { x: p.x, y: my }, { x: q.x, y: my }, q];
    }
    if (hA && !hB) return [p, { x: q.x, y: p.y }, q];
    return [p, { x: p.x, y: q.y }, q];
  }
  return [borderPoint(ra, cb), borderPoint(rb, ca)];
}

/** Midpoint of a polyline (for placing an edge label). */
export function polylineMid(pts: Point[]): Point {
  const a = pts[Math.floor((pts.length - 1) / 2)];
  const b = pts[Math.ceil((pts.length - 1) / 2)];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Bounding box of all content (world coordinates). */
export function contentBBox(doc: DiagramDoc): Rect {
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  doc.nodes.forEach((n) => {
    const r = nodeRect(n);
    const w = isIcon(n) ? ICON_NODE_W : r.w;
    const extraH = isIcon(n) ? 18 : 0;
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + w);
    y1 = Math.max(y1, n.y + r.h + extraH);
  });
  if (x0 > x1) return { x: 0, y: 0, w: 200, h: 200 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function hexA(hex: string, a: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substr(0, 2), 16);
  const g = parseInt(m.substr(2, 2), 16);
  const b = parseInt(m.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${a})`;
}
