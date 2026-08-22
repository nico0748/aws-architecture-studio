import { create } from 'zustand';
import type { DiagramDoc, DiagramNode, DiagramEdge, NodeKind, Selection } from '../types';
import type { NodeOpts } from '../lib/nodeFactory';
import * as ops from '../lib/doc/ops';
import type { EdgeOpts, ZOrder } from '../lib/doc/ops';

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

interface StoreState {
  doc: DiagramDoc;
  sel: Selection | null;
  view: View;
  snap: boolean;
  toast: string | null;
  undoStack: string[];
  redoStack: string[];

  // history
  beginChange: () => void;
  undo: () => void;
  redo: () => void;

  // selection / view
  setSelection: (sel: Selection | null) => void;
  setView: (v: Partial<View>) => void;
  setSnap: (b: boolean) => void;
  showToast: (msg: string) => void;

  // node/edge ops
  addNode: (kind: NodeKind, catId: string | undefined, x: number, y: number, opts?: NodeOpts) => string;
  patchNode: (id: string, patch: Partial<DiagramNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  addEdge: (from: string, to: string, opts?: EdgeOpts) => string | null;
  patchEdge: (id: string, patch: Partial<DiagramEdge>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  reorder: (order: ZOrder) => void;

  // document ops
  setDoc: (doc: DiagramDoc, commit?: boolean) => void;
}

const snapshot = (doc: DiagramDoc) => JSON.stringify(doc);

export const useStore = create<StoreState>((set, get) => ({
  doc: ops.emptyDoc(),
  sel: null,
  view: { zoom: 1, panX: 60, panY: 60 },
  snap: true,
  toast: null,
  undoStack: [],
  redoStack: [],

  beginChange: () => {
    const { doc, undoStack } = get();
    const next = [...undoStack, snapshot(doc)];
    if (next.length > 100) next.shift();
    set({ undoStack: next, redoStack: [] });
  },

  undo: () => {
    const { undoStack, redoStack, doc } = get();
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      doc: JSON.parse(prev),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, snapshot(doc)],
      sel: null,
    });
  },

  redo: () => {
    const { undoStack, redoStack, doc } = get();
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    set({
      doc: JSON.parse(next),
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, snapshot(doc)],
      sel: null,
    });
  },

  setSelection: (sel) => set({ sel }),
  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
  setSnap: (b) => set({ snap: b }),
  showToast: (msg) => {
    set({ toast: msg });
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2000);
  },

  addNode: (kind, catId, x, y, opts) => {
    get().beginChange();
    const { doc, snap } = get();
    const res = ops.addNode(doc, { kind, catId, x, y, opts, snap });
    set({ doc: res.doc, sel: { kind: 'node', id: res.node.id } });
    return res.node.id;
  },

  patchNode: (id, patch) => set((s) => ({ doc: ops.patchNode(s.doc, id, patch) })),

  moveNode: (id, x, y) => set((s) => ({ doc: ops.moveNode(s.doc, id, x, y) })),

  addEdge: (from, to, opts = {}) => {
    const res = ops.addEdge(get().doc, from, to, opts);
    if (!res) return null;
    get().beginChange();
    set({ doc: res.doc, sel: { kind: 'edge', id: res.edge.id } });
    return res.edge.id;
  },

  patchEdge: (id, patch) => set((s) => ({ doc: ops.patchEdge(s.doc, id, patch) })),

  deleteSelected: () => {
    const { sel, doc } = get();
    if (!sel) return;
    get().beginChange();
    set({ doc: sel.kind === 'node' ? ops.deleteNode(doc, sel.id) : ops.deleteEdge(doc, sel.id), sel: null });
  },

  duplicateSelected: () => {
    const { sel, doc, snap } = get();
    if (!sel || sel.kind !== 'node') return;
    const res = ops.duplicateNode(doc, sel.id, snap);
    if (!res) return;
    get().beginChange();
    set({ doc: res.doc, sel: { kind: 'node', id: res.node.id } });
  },

  bringForward: () => get().reorder('forward'),
  sendBackward: () => get().reorder('backward'),
  bringToFront: () => get().reorder('front'),
  sendToBack: () => get().reorder('back'),

  reorder: (order) => {
    const { sel, doc } = get();
    if (!sel || sel.kind !== 'node') return;
    const next = ops.reorderNode(doc, sel.id, order);
    if (next === doc) return;
    get().beginChange();
    set({ doc: next });
  },

  setDoc: (doc, commit = true) => {
    if (commit) get().beginChange();
    set({ doc, sel: null });
  },
}));
