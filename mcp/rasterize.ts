/**
 * ブラウザの canvas に相当する SVG → PNG 変換を Node 側で行う。
 * これがあることで pptx / png のエクスポートをアプリと同じコードで組み立てられる。
 */
import { Resvg } from '@resvg/resvg-js';
import { ensureXmlns } from '../src/data/catalog';

const cache = new Map<string, string | null>();

/** カタログのアイコン（viewBox のみで幅を持たない SVG）を data URL の PNG にする。 */
export async function svgToPngDataUrl(svg: string, size: number): Promise<string | null> {
  const key = svg + '@' + size;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let result: string | null = null;
  try {
    const png = new Resvg(ensureXmlns(svg), { fitTo: { mode: 'width', value: size } }).render().asPng();
    result = 'data:image/png;base64,' + png.toString('base64');
  } catch {
    result = null;
  }
  cache.set(key, result);
  return result;
}

/** 図全体の SVG を PNG バッファにする。scale は等倍を 1 とした拡大率。 */
export function renderPng(svg: string, scale = 2): Buffer {
  const png = new Resvg(ensureXmlns(svg), { fitTo: { mode: 'zoom', value: scale } }).render().asPng();
  return Buffer.from(png);
}
