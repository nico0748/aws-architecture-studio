import type { DiagramDoc, Point } from '../types';
import { FLOWS, FLOW_KEYS } from '../data/flows';
import { edgePoints, polylineMid } from '../lib/geometry';
import { useStore } from '../store/useStore';

export function Edges({ doc, link }: { doc: DiagramDoc; link: { fromPt: Point; pt: Point } | null }) {
  const sel = useStore((s) => s.sel);
  const setSelection = useStore((s) => s.setSelection);

  return (
    <svg id="edges">
      <defs>
        {FLOW_KEYS.map((k) => {
          const f = FLOWS[k];
          return (
            <marker key={k} id={'arw-' + k} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill={f.color} />
            </marker>
          );
        })}
      </defs>

      {doc.edges.map((e) => {
        const pts = edgePoints(doc, e);
        if (!pts) return null;
        const f = FLOWS[e.flow];
        const selected = sel?.kind === 'edge' && sel.id === e.id;
        const ptStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
        const mid = polylineMid(pts);
        const tw = e.label.length * 6.4 + 8;
        return (
          <g key={e.id}>
            <polyline
              className="edge-hit"
              points={ptStr}
              onMouseDown={(ev) => {
                ev.stopPropagation();
                setSelection({ kind: 'edge', id: e.id });
              }}
            />
            <polyline
              points={ptStr}
              fill="none"
              stroke={f.color}
              strokeWidth={selected ? 3 : 2.2}
              strokeLinejoin="round"
              strokeDasharray={f.dash ? '7 5' : undefined}
              markerEnd={e.arrow ? `url(#arw-${e.flow})` : undefined}
            />
            {e.label && (
              <>
                <rect x={mid.x - tw / 2} y={mid.y - 9} width={tw} height={16} rx={3} fill="#eef1f5" />
                <text x={mid.x} y={mid.y + 3} textAnchor="middle" fontSize={11} fill={f.color}>
                  {e.label}
                </text>
              </>
            )}
          </g>
        );
      })}

      {link && (
        <polyline
          points={`${link.fromPt.x},${link.fromPt.y} ${link.pt.x},${link.pt.y}`}
          fill="none"
          stroke="#0017c1"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      )}
    </svg>
  );
}
