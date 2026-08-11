import type { DiagramDoc } from '../../types';
import { FLOWS, FLOW_KEYS } from '../../data/flows';
import { grpById, svcById, shpById } from '../../data/catalog';
import { contentBBox, edgePoints, nodeRect, polylineMid, hexA } from '../geometry';
import { triggerDownload, timestamp } from '../raster';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function embedSvg(svg: string, x: number, y: number, w: number, h: number): string {
  return svg.replace(/^<svg /, `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
}

function wrapLabel(t: string, max: number): string[] {
  t = String(t ?? '');
  if (t.length <= max) return [t];
  const words = t.split(/(\s+)/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + w).trim().length > max && cur.trim()) {
      out.push(cur.trim());
      cur = w;
    } else cur += w;
  }
  if (cur.trim()) out.push(cur.trim());
  const res: string[] = [];
  for (const line of out) {
    if (line.length <= max) res.push(line);
    else for (let i = 0; i < line.length; i += max) res.push(line.slice(i, i + max));
  }
  return res.length ? res.slice(0, 3) : [''];
}

export function buildSvgString(doc: DiagramDoc): string {
  const bb = contentBBox(doc);
  const pad = 24;
  const W = Math.round(bb.w + pad * 2);
  const H = Math.round(bb.h + pad * 2);
  const ox = pad - bb.x;
  const oy = pad - bb.y;

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>`;
  s += '<defs>';
  FLOW_KEYS.forEach((k) => {
    const f = FLOWS[k];
    s += `<marker id="m-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${f.color}"/></marker>`;
  });
  s += '</defs>';
  s += `<g transform="translate(${ox} ${oy})">`;

  // groups
  doc.nodes
    .filter((n) => n.kind === 'group')
    .sort((a, b) => (b.w! * b.h!) - (a.w! * a.h!))
    .forEach((n) => {
      const g = n.catId ? grpById[n.catId] : undefined;
      s += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="9" fill="${n.fill || hexA(n.color ?? '#8C4FFF', 0.05)}" stroke="${n.color}" stroke-width="1.6"${n.dashed ? ' stroke-dasharray="7 5"' : ''}/>`;
      let tx = n.x! + 8;
      if (g?.svg) {
        s += embedSvg(g.svg, n.x! + 6, n.y! + 5, 18, 18);
        tx = n.x! + 28;
      }
      s += `<text x="${tx}" y="${n.y! + 17}" font-size="11.5" font-weight="700" fill="${n.color}">${esc(n.label)}</text>`;
      if (n.subtitle) s += `<text x="${tx}" y="${n.y! + 31}" font-size="10.5" fill="#63748a">${esc(n.subtitle)}</text>`;
    });

  // legends
  doc.nodes
    .filter((n) => n.kind === 'legend')
    .forEach((n) => {
      const flows = n.flows ?? [];
      const h = 32 + flows.length * 20 + 8;
      s += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${h}" rx="8" fill="#FFF7DB" stroke="#E7D9A6"/>`;
      s += `<text x="${n.x! + 10}" y="${n.y! + 20}" font-size="11.5" font-weight="700" fill="#5B5320">${esc(n.title)}</text>`;
      flows.forEach((k, i) => {
        const f = FLOWS[k];
        const ly = n.y! + 34 + i * 20;
        s += `<line x1="${n.x! + 12}" y1="${ly + 6}" x2="${n.x! + 46}" y2="${ly + 6}" stroke="${f.color}" stroke-width="2.5"${f.dash ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#m-${k})"/>`;
        s += `<text x="${n.x! + 56}" y="${ly + 10}" font-size="11" fill="#3a3a3a">${esc(f.label)}</text>`;
      });
    });

  // edges
  doc.edges.forEach((e) => {
    const pts = edgePoints(doc, e);
    if (!pts) return;
    const f = FLOWS[e.flow];
    const ps = pts.map((p) => `${p.x},${p.y}`).join(' ');
    s += `<polyline points="${ps}" fill="none" stroke="${f.color}" stroke-width="2.2" stroke-linejoin="round"${f.dash ? ' stroke-dasharray="7 5"' : ''}${e.arrow ? ` marker-end="url(#m-${e.flow})"` : ''}/>`;
    if (e.label) {
      const m = polylineMid(pts);
      const tw = e.label.length * 6.4 + 8;
      s += `<rect x="${m.x - tw / 2}" y="${m.y - 9}" width="${tw}" height="16" rx="3" fill="#eef1f5"/><text x="${m.x}" y="${m.y + 3}" text-anchor="middle" font-size="11" fill="${f.color}">${esc(e.label)}</text>`;
    }
  });

  // text
  doc.nodes
    .filter((n) => n.kind === 'text')
    .forEach((n) => {
      const lines = String(n.text ?? '').split('\n');
      const fs = n.fontSize ?? 14;
      const anchor = n.align === 'center' ? 'middle' : n.align === 'right' ? 'end' : 'start';
      const tx = n.align === 'center' ? n.x! + n.w! / 2 : n.align === 'right' ? n.x! + n.w! : n.x!;
      if (n.boxed) s += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${lines.length * fs * 1.35 + 8}" rx="6" fill="#fff" stroke="#d5dbe2"/>`;
      lines.forEach((ln, i) => {
        s += `<text x="${tx}" y="${n.y! + fs + 4 + i * fs * 1.35}" font-size="${fs}" font-weight="${n.bold ? 700 : 400}" fill="${n.textColor}" text-anchor="${anchor}">${esc(ln)}</text>`;
      });
    });

  // icons
  doc.nodes
    .filter((n) => n.kind === 'service' || n.kind === 'shape')
    .forEach((n) => {
      const meta = n.kind === 'service' ? svcById[n.catId!] : shpById[n.catId!];
      if (!meta) return;
      const r = nodeRect(n);
      s += embedSvg(meta.svg, r.x, r.y, r.w, r.h);
      wrapLabel(n.label ?? '', 12).forEach((ln, i) => {
        s += `<text x="${n.x! + 42}" y="${r.y + r.h + 12 + i * 12}" text-anchor="middle" font-size="10" fill="#16202b">${esc(ln)}</text>`;
      });
    });

  s += '</g></svg>';
  return s;
}

export function exportSvg(doc: DiagramDoc): void {
  const s = buildSvgString(doc);
  triggerDownload('aws-architecture-' + timestamp() + '.svg', new Blob([s], { type: 'image/svg+xml' }));
}
