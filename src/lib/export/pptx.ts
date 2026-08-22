import PptxGenJS from 'pptxgenjs';
import type { DiagramDoc, Point } from '../../types';
import { FLOWS } from '../../data/flows';
import { grpById, svcById, shpById } from '../../data/catalog';
import { contentBBox, edgePoints, nodeRect, polylineMid } from '../geometry';
import { svgToPng, timestamp } from '../raster';

const hex = (c: string) => c.replace('#', '');

/**
 * SVG 文字列を PNG の data URL に変換する関数。ブラウザは canvas、
 * MCP サーバ側は resvg と、環境ごとに実装を差し替えるためのもの。
 */
export type Rasterize = (svg: string, size: number) => Promise<string | null>;

/** スライドを組み立てて返す。書き出し方（ダウンロード / ファイル）は呼び出し側に任せる。 */
export async function buildPptx(doc: DiagramDoc, svgToPng: Rasterize): Promise<PptxGenJS> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
  pptx.layout = 'W';
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  const bb = contentBBox(doc);
  const M = 0.35;
  const availW = 13.333 - M * 2;
  const availH = 7.5 - M * 2;
  const sc = Math.min(availW / bb.w, availH / bb.h);
  const offX = M + (availW - bb.w * sc) / 2;
  const offY = M + (availH - bb.h * sc) / 2;
  const X = (x: number) => offX + (x - bb.x) * sc;
  const Y = (y: number) => offY + (y - bb.y) * sc;
  const S = (v: number) => v * sc;

  // groups (largest first)
  const groups = doc.nodes.filter((n) => n.kind === 'group').sort((a, b) => (b.w! * b.h!) - (a.w! * a.h!));
  for (const n of groups) {
    const col = hex(n.color ?? '#8C4FFF');
    slide.addShape('roundRect', {
      x: X(n.x),
      y: Y(n.y),
      w: S(n.w!),
      h: S(n.h!),
      rectRadius: 0.06,
      fill: n.fill ? { color: hex(n.fill) } : { color: col, transparency: 95 },
      line: { color: col, width: 1.3, dashType: n.dashed ? 'dash' : 'solid' },
    });
    const g = n.catId ? grpById[n.catId] : undefined;
    let lx = X(n.x) + 0.06;
    const png = g?.svg ? await svgToPng(g.svg, 64) : null;
    if (png) {
      slide.addImage({ data: png, x: X(n.x) + 0.06, y: Y(n.y) + 0.05, w: 0.19, h: 0.19 });
      lx = X(n.x) + 0.29;
    }
    slide.addText(
      [
        { text: n.label ?? '', options: { bold: true, fontSize: 9, color: col } },
        ...(n.subtitle ? [{ text: '\n' + n.subtitle, options: { fontSize: 7, color: '6B7C8D' } }] : []),
      ],
      { x: lx, y: Y(n.y) + 0.04, w: S(n.w!) - 0.35, h: 0.4, align: 'left', valign: 'top' },
    );
  }

  // legends
  for (const n of doc.nodes.filter((x) => x.kind === 'legend')) {
    const x = X(n.x);
    const y = Y(n.y);
    const w = S(n.w!);
    const rowH = 0.2;
    const flows = n.flows ?? [];
    const h = 0.32 + flows.length * rowH + 0.1;
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.04, fill: { color: 'FFF7DB' }, line: { color: 'E7D9A6', width: 1 } });
    slide.addText(n.title ?? '', { x: x + 0.08, y: y + 0.06, w: w - 0.16, h: 0.2, fontSize: 9, bold: true, color: '5B5320' });
    flows.forEach((k, i) => {
      const f = FLOWS[k];
      const ly = y + 0.32 + i * rowH;
      slide.addShape('line', { x: x + 0.1, y: ly + 0.08, w: 0.4, h: 0.001, line: { color: hex(f.color), width: 2, dashType: f.dash ? 'dash' : 'solid', endArrowType: 'triangle' } });
      slide.addText(f.label, { x: x + 0.56, y: ly, w: w - 0.6, h: rowH, fontSize: 8, color: '3A3A3A', valign: 'middle' });
    });
  }

  // text nodes
  for (const n of doc.nodes.filter((x) => x.kind === 'text')) {
    const r = nodeRect(n);
    slide.addText(n.text ?? ' ', {
      x: X(n.x),
      y: Y(n.y),
      w: S(n.w!),
      h: Math.max(S(r.h), 0.2),
      fontSize: Math.max(6, (n.fontSize ?? 14) * sc * 1.9),
      bold: n.bold,
      color: hex(n.textColor ?? '#16202b'),
      align: n.align ?? 'left',
      valign: 'top',
      fill: n.boxed ? { color: 'FFFFFF' } : undefined,
      line: n.boxed ? { color: 'D5DBE2', width: 0.75 } : undefined,
    });
  }

  // edges
  for (const e of doc.edges) {
    const pts = edgePoints(doc, e);
    if (!pts) continue;
    const f = FLOWS[e.flow];
    const ip = pts.map((p) => ({ x: X(p.x), y: Y(p.y) }));
    drawPolyline(slide, ip, hex(f.color), f.dash, e.arrow);
    if (e.label) {
      const m = polylineMid(pts);
      slide.addText(e.label, { x: X(m.x) - 0.6, y: Y(m.y) - 0.11, w: 1.2, h: 0.22, fontSize: 7.5, color: hex(f.color), align: 'center', valign: 'middle', fill: { color: 'FFFFFF' } });
    }
  }

  // icon nodes
  for (const n of doc.nodes.filter((x) => x.kind === 'service' || x.kind === 'shape')) {
    const meta = n.kind === 'service' ? svcById[n.catId!] : shpById[n.catId!];
    if (!meta) continue;
    const r = nodeRect(n);
    const png = await svgToPng(meta.svg, 110);
    const iw = S(r.w);
    if (png) slide.addImage({ data: png, x: X(r.x), y: Y(r.y), w: iw, h: iw });
    slide.addText(n.label ?? '', { x: X(n.x + 42) - 0.6, y: Y(r.y + r.h + 2), w: 1.2, h: 0.34, fontSize: 7.5, color: '16202B', align: 'center', valign: 'top', wrap: true });
  }

  return pptx;
}

export async function exportPptx(doc: DiagramDoc): Promise<string> {
  const pptx = await buildPptx(doc, svgToPng);
  const fn = 'aws-architecture-' + timestamp() + '.pptx';
  await pptx.writeFile({ fileName: fn });
  return fn;
}

type Slide = ReturnType<PptxGenJS['addSlide']>;

function drawPolyline(slide: Slide, pts: Point[], color: string, dash: boolean, arrow: boolean): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const last = i === pts.length - 2;
    drawSeg(slide, a.x, a.y, b.x, b.y, color, dash, last && arrow);
  }
}

function drawSeg(slide: Slide, x1: number, y1: number, x2: number, y2: number, color: string, dash: boolean, arrow: boolean): void {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 0.001);
  const h = Math.max(Math.abs(y2 - y1), 0.001);
  const mainDiag = (x1 <= x2 && y1 <= y2) || (x1 >= x2 && y1 >= y2);
  const flipV = !mainDiag;
  let targetIsEnd: boolean;
  if (!flipV) targetIsEnd = Math.abs(x2 - (x + w)) < 0.001 && Math.abs(y2 - (y + h)) < 0.001;
  else targetIsEnd = Math.abs(x2 - (x + w)) < 0.001 && Math.abs(y2 - y) < 0.001;
  const line: Record<string, unknown> = { color, width: 1.4, dashType: dash ? 'dash' : 'solid' };
  if (arrow) {
    if (targetIsEnd) line.endArrowType = 'triangle';
    else line.beginArrowType = 'triangle';
  }
  slide.addShape('line', { x, y, w, h, line, flipV } as never);
}
