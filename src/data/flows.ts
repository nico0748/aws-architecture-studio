import type { FlowKey, FlowDef } from '../types';

export const FLOWS: Record<FlowKey, FlowDef> = {
  inference: { label: '推論フロー', color: '#1E88E5', dash: false },
  log: { label: 'ログフロー', color: '#F5A623', dash: false },
  training: { label: '訓練フロー', color: '#2E9E4F', dash: false },
  analysis: { label: '分析フロー', color: '#8C4FFF', dash: false },
  cicd: { label: 'CI/CDフロー', color: '#E53935', dash: true },
  monitor: { label: '監視フロー', color: '#9AA7B4', dash: true },
  default: { label: 'データフロー', color: '#5A6B7B', dash: false },
};

export const FLOW_KEYS: FlowKey[] = [
  'inference',
  'log',
  'training',
  'analysis',
  'cicd',
  'monitor',
  'default',
];

/** Icon box pixel sizes by node kind. */
export const BOX = { service: 54, shape: 60 } as const;
/** Full width reserved for an icon node (icon + caption). */
export const ICON_NODE_W = 84;
export const GRID = 10;
