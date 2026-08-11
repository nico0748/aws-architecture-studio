import { ensureXmlns } from '../data/catalog';

const cache: Record<string, string | null> = {};

/** Rasterise an SVG string to a PNG data URL at the given pixel size. */
export function svgToPng(svg: string, size: number): Promise<string | null> {
  const norm = ensureXmlns(svg);
  const key = norm + '@' + size;
  if (key in cache) return Promise.resolve(cache[key]);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      const data = c.toDataURL('image/png');
      cache[key] = data;
      resolve(data);
    };
    img.onerror = () => {
      cache[key] = null;
      resolve(null);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(norm);
  });
}

export function triggerDownload(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 400);
}

export function timestamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    '-' +
    p(d.getHours()) +
    p(d.getMinutes())
  );
}
