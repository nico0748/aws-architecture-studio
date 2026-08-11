import type { Catalog, CatalogService, CatalogGroup, CatalogShape } from '../types';
import raw from './catalog.json';

export const CATALOG = raw as unknown as Catalog;

export const svcById: Record<string, CatalogService> = {};
export const grpById: Record<string, CatalogGroup> = {};
export const shpById: Record<string, CatalogShape> = {};

CATALOG.services.forEach((s) => (svcById[s.id] = s));
CATALOG.groups.forEach((g) => (grpById[g.id] = g));
CATALOG.shapes.forEach((s) => (shpById[s.id] = s));

// resource-type → catalog lookups (for IaC import)
export interface CatMap {
  kind: 'service' | 'group';
  id: string;
}
export const TF_MAP: Record<string, CatMap> = {};
export const CFN_MAP: Record<string, CatMap> = {};

CATALOG.services.forEach((s) => {
  s.tf.forEach((t) => (TF_MAP[t] = { kind: 'service', id: s.id }));
  s.cfn.forEach((t) => (CFN_MAP[t] = { kind: 'service', id: s.id }));
});
CATALOG.groups.forEach((g) => {
  g.tf.forEach((t) => (TF_MAP[t] = { kind: 'group', id: g.id }));
  g.cfn.forEach((t) => (CFN_MAP[t] = { kind: 'group', id: g.id }));
});

/** Ensure a standalone SVG string carries the xmlns needed for <img> rasterisation. */
export function ensureXmlns(svg: string): string {
  return svg && !/xmlns=/.test(svg)
    ? svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    : svg;
}
