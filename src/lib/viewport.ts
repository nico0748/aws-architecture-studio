import { useStore } from '../store/useStore';
import { contentBBox } from './geometry';
import type { Point } from '../types';

let stageEl: HTMLElement | null = null;
export function setStageEl(el: HTMLElement | null): void {
  stageEl = el;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function toWorld(clientX: number, clientY: number): Point {
  const { view } = useStore.getState();
  const r = stageEl?.getBoundingClientRect();
  const left = r?.left ?? 0;
  const top = r?.top ?? 0;
  return { x: (clientX - left - view.panX) / view.zoom, y: (clientY - top - view.panY) / view.zoom };
}

export function viewCenterWorld(): Point {
  const r = stageEl?.getBoundingClientRect();
  if (!r) return { x: 200, y: 200 };
  return toWorld(r.left + r.width / 2, r.top + r.height / 2);
}

export function zoomAt(clientX: number, clientY: number, factor: number): void {
  const { view, setView } = useStore.getState();
  const before = toWorld(clientX, clientY);
  const zoom = clamp(view.zoom * factor, 0.2, 2.5);
  const r = stageEl?.getBoundingClientRect();
  const left = r?.left ?? 0;
  const top = r?.top ?? 0;
  setView({ zoom, panX: clientX - left - before.x * zoom, panY: clientY - top - before.y * zoom });
}

export function zoomCenter(factor: number): void {
  const r = stageEl?.getBoundingClientRect();
  if (!r) return;
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
}

export function fitView(): void {
  const { doc, setView } = useStore.getState();
  const r = stageEl?.getBoundingClientRect();
  if (!r) return;
  if (!doc.nodes.length) {
    setView({ zoom: 1, panX: 60, panY: 60 });
    return;
  }
  const bb = contentBBox(doc);
  const pad = 50;
  const zoom = clamp(Math.min((r.width - pad * 2) / bb.w, (r.height - pad * 2) / bb.h), 0.2, 2);
  const panX = pad - bb.x * zoom + (r.width - pad * 2 - bb.w * zoom) / 2;
  const panY = pad - bb.y * zoom + (r.height - pad * 2 - bb.h * zoom) / 2;
  setView({ zoom, panX, panY });
}
