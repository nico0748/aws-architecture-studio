import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { setStageEl, toWorld, zoomAt, zoomCenter, fitView } from '../lib/viewport';
import { nodeRect, rectCenter } from '../lib/geometry';
import { snapVal } from '../lib/nodeFactory';
import type { Point } from '../types';
import { NodeView } from './NodeView';
import { Edges } from './Edges';

type Link = { fromId: string; fromPt: Point; pt: Point } | null;

export function Canvas() {
  const doc = useStore((s) => s.doc);
  const view = useStore((s) => s.view);
  const sel = useStore((s) => s.sel);

  const stageRef = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState<Link>(null);

  useEffect(() => {
    setStageEl(stageRef.current);
  }, []);

  // ctrl/cmd + wheel zoom
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const getNode = (id: string) => useStore.getState().doc.nodes.find((n) => n.id === id);

  const withDrag = (move: (e: MouseEvent) => void, up?: (e: MouseEvent) => void) => {
    const onMove = (e: MouseEvent) => move(e);
    const onUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      up?.(e);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startPan = (e: React.MouseEvent) => {
    const v0 = useStore.getState().view;
    const sx = e.clientX;
    const sy = e.clientY;
    withDrag((ev) => {
      useStore.getState().setView({ panX: v0.panX + (ev.clientX - sx), panY: v0.panY + (ev.clientY - sy) });
    });
  };

  const startNodeDrag = (e: React.MouseEvent, id: string) => {
    const n0 = getNode(id);
    if (!n0) return;
    const start = toWorld(e.clientX, e.clientY);
    const ox = start.x - n0.x;
    const oy = start.y - n0.y;
    let began = false;
    withDrag((ev) => {
      if (!began) {
        useStore.getState().beginChange();
        began = true;
      }
      const snap = useStore.getState().snap;
      const p = toWorld(ev.clientX, ev.clientY);
      useStore.getState().moveNode(id, snapVal(p.x - ox, snap), snapVal(p.y - oy, snap));
    });
  };

  const startResize = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const n0 = getNode(id);
    if (!n0) return;
    useStore.getState().beginChange();
    withDrag((ev) => {
      const snap = useStore.getState().snap;
      const p = toWorld(ev.clientX, ev.clientY);
      const w = Math.max(70, snapVal(p.x - n0.x, snap));
      const h = Math.max(56, snapVal(p.y - n0.y, snap));
      if (n0.kind === 'group') useStore.getState().patchNode(id, { w, h });
      else useStore.getState().patchNode(id, { w });
    });
  };

  const startConnect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const n0 = getNode(id);
    if (!n0) return;
    const c = rectCenter(nodeRect(n0));
    setLink({ fromId: id, fromPt: c, pt: c });
    withDrag(
      (ev) => {
        const p = toWorld(ev.clientX, ev.clientY);
        setLink((l) => (l ? { ...l, pt: p } : null));
      },
      (ev) => {
        const tgt = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const nodeEl = tgt?.closest('.node') as HTMLElement | null;
        setLink(null);
        if (nodeEl) {
          const tid = nodeEl.dataset.id;
          if (tid && tid !== id) useStore.getState().addEdge(id, tid);
        }
      },
    );
  };

  const onStageMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('#zoombar')) return;
    const nodeEl = target.closest('.node') as HTMLElement | null;
    if (!nodeEl) {
      useStore.getState().setSelection(null);
      startPan(e);
      return;
    }
    const id = nodeEl.dataset.id!;
    if (target.classList.contains('rsz')) {
      startResize(e, id);
      return;
    }
    if (target.classList.contains('chandle')) {
      startConnect(e, id);
      return;
    }
    useStore.getState().setSelection({ kind: 'node', id });
    startNodeDrag(e, id);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    let data: { kind: string; id: string } | null = null;
    try {
      data = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    if (!data) return;
    const p = toWorld(e.clientX, e.clientY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useStore.getState().addNode(data.kind as any, data.id, p.x, p.y);
  };

  return (
    <div
      id="stage"
      ref={stageRef}
      onMouseDown={onStageMouseDown}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDrop}
    >
      <div id="world" style={{ transform: `translate(${view.panX}px,${view.panY}px) scale(${view.zoom})` }}>
        <Edges doc={doc} link={link} />
        {doc.nodes.map((n) => (
          <NodeView key={n.id} node={n} selected={sel?.kind === 'node' && sel.id === n.id} />
        ))}
      </div>

      <div id="statusbar">
        {doc.nodes.length} ノード / {doc.edges.length} 接続 ・ {Math.round(view.zoom * 100)}%
      </div>
      <div id="zoombar">
        <button title="縮小" onClick={() => zoomCenter(0.87)}>−</button>
        <div className="zval">{Math.round(view.zoom * 100)}%</div>
        <button title="拡大" onClick={() => zoomCenter(1.15)}>＋</button>
        <button title="全体表示" onClick={fitView}>⤢</button>
      </div>
    </div>
  );
}
