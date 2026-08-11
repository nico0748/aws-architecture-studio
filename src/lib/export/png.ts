import type { DiagramDoc } from '../../types';
import { buildSvgString } from './svg';
import { triggerDownload, timestamp } from '../raster';

export function exportPng(doc: DiagramDoc, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const svg = buildSvgString(doc);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * scale;
      c.height = img.height * scale;
      const ctx = c.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas context'));
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((bl) => {
        if (bl) triggerDownload('aws-architecture-' + timestamp() + '.png', bl);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('svg load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
