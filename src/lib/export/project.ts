import type { DiagramDoc } from '../../types';
import { triggerDownload, timestamp } from '../raster';

export function exportProject(doc: DiagramDoc): void {
  const content = JSON.stringify(doc, null, 2);
  triggerDownload('aws-architecture-' + timestamp() + '.json', new Blob([content], { type: 'application/json' }));
}
