// ===== Domain types =====

export type NodeKind = 'service' | 'shape' | 'group' | 'text' | 'legend';

export type FlowKey =
  | 'inference'
  | 'log'
  | 'training'
  | 'analysis'
  | 'cicd'
  | 'monitor'
  | 'default';

export type EdgeRouting = 'orthogonal' | 'straight';

export type TextAlign = 'left' | 'center' | 'right';

/** A node on the canvas. Optional fields depend on `kind`. */
export interface DiagramNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;

  // service | shape
  catId?: string;
  label?: string;

  // group
  w?: number;
  h?: number;
  subtitle?: string;
  color?: string;
  fill?: string | null;
  dashed?: boolean;

  // text
  text?: string;
  fontSize?: number;
  textColor?: string;
  bold?: boolean;
  align?: TextAlign;
  boxed?: boolean;

  // legend
  title?: string;
  flows?: FlowKey[];
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  flow: FlowKey;
  routing: EdgeRouting;
  arrow: boolean;
}

/** The serialisable document. */
export interface DiagramDoc {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  seq: number;
}

// ===== Catalog types =====

export interface CatalogService {
  id: string;
  label: string;
  cat: string;
  svg: string;
  tf: string[];
  cfn: string[];
}

export interface CatalogGroup {
  id: string;
  label: string;
  svg: string | null;
  tf: string[];
  cfn: string[];
  color: string;
  fill: string | null;
}

export interface CatalogShape {
  id: string;
  label: string;
  svg: string;
  group: 'Actor' | 'Logo';
  /** Logo のみ。パレットの小分類（docs/logo-candidates.md の節に対応）。 */
  cat?: string;
}

export interface Catalog {
  services: CatalogService[];
  groups: CatalogGroup[];
  shapes: CatalogShape[];
}

export interface Selection {
  kind: 'node' | 'edge';
  id: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowDef {
  label: string;
  color: string;
  dash: boolean;
}
