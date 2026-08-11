import { memo } from 'react';
import type { DiagramNode } from '../types';
import { FLOWS } from '../data/flows';
import { grpById, svcById, shpById } from '../data/catalog';
import { hexA } from '../lib/geometry';

/** Presentational node. Interaction is handled via event delegation on the canvas. */
function NodeViewInner({ node, selected }: { node: DiagramNode; selected: boolean }) {
  const selCls = selected ? ' selected' : '';

  if (node.kind === 'group') {
    const g = node.catId ? grpById[node.catId] : undefined;
    return (
      <div
        className={'node grp' + (node.dashed ? ' dashed' : '') + selCls}
        data-id={node.id}
        style={{
          left: node.x,
          top: node.y,
          width: node.w,
          height: node.h,
          borderColor: node.color,
          background: node.fill || hexA(node.color ?? '#8C4FFF', 0.05),
        }}
      >
        <div className="ghd">
          <span style={{ color: node.color, display: 'inline-flex', gap: 5, alignItems: 'flex-start' }}>
            {g?.svg && <span className="gic" dangerouslySetInnerHTML={{ __html: g.svg }} />}
            <span>
              <span className="t">{node.label}</span>
              {node.subtitle && <span className="st" style={{ display: 'block' }}>{node.subtitle}</span>}
            </span>
          </span>
        </div>
        <div className="chandle" />
        <div className="rsz" />
      </div>
    );
  }

  if (node.kind === 'service' || node.kind === 'shape') {
    const meta = node.kind === 'service' ? svcById[node.catId!] : shpById[node.catId!];
    const b = node.kind === 'service' ? 54 : 60;
    return (
      <div className={'node iconnode' + selCls} data-id={node.id} style={{ left: node.x, top: node.y, width: 84 }}>
        <div className="box" style={{ width: b, height: b }} dangerouslySetInnerHTML={{ __html: meta?.svg ?? '' }} />
        <div className="lbl">{node.label}</div>
        <div className="chandle" />
      </div>
    );
  }

  if (node.kind === 'text') {
    return (
      <div
        className={'node txt' + (node.boxed ? ' boxed' : '') + selCls}
        data-id={node.id}
        style={{
          left: node.x,
          top: node.y,
          width: node.w,
          fontSize: node.fontSize,
          color: node.textColor,
          fontWeight: node.bold ? 700 : 400,
          textAlign: node.align,
        }}
      >
        {node.text || ' '}
        <div className="rsz" />
      </div>
    );
  }

  if (node.kind === 'legend') {
    return (
      <div className={'node legend' + selCls} data-id={node.id} style={{ left: node.x, top: node.y, width: node.w }}>
        <div className="lgt">{node.title}</div>
        {(node.flows ?? []).map((k) => {
          const f = FLOWS[k];
          return (
            <div className="lgr" key={k}>
              <span className="ln" style={{ borderTopColor: f.color, borderTopStyle: f.dash ? 'dashed' : 'solid' }} />
              {f.label}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

export const NodeView = memo(NodeViewInner);
