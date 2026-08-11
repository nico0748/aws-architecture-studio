import { create } from 'zustand';
import type {
  DiagramDoc,
  DiagramNode,
  DiagramEdge,
  NodeKind,
  Selection,
  FlowKey,
  EdgeRouting,
} from '../types';
import { makeNode, snapVal, type NodeOpts } from '../lib/nodeFactory';

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

interface EdgeOpts {
  label?: string;
  flow?: FlowKey;
  routing?: EdgeRouting;
  arrow?: boolean;
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
  canUndo: () => boolean;
  canRedo: () => boolean;

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

  // document ops
  setDoc: (doc: DiagramDoc, commit?: boolean) => void;
  clearAll: () => void;
}

const emptyDoc = (): DiagramDoc => ({ nodes: [], edges: [], seq: 1 });
const snapshot = (doc: DiagramDoc) => JSON.stringify(doc);

export const useStore = create<StoreState>((set, get) => ({
  doc: emptyDoc(),
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

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

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
    const id = 'n' + doc.seq;
    const center = kind === 'group';
    const node = makeNode(id, kind, catId, snapVal(x, snap), snapVal(y, snap), opts, center);
    if (center && node.w) {
      node.x = snapVal(node.x, snap);
      node.y = snapVal(node.y, snap);
    }
    set({
      doc: { ...doc, nodes: [...doc.nodes, node], seq: doc.seq + 1 },
      sel: { kind: 'node', id },
    });
    return id;
  },

  patchNode: (id, patch) =>
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      },
    })),

  moveNode: (id, x, y) =>
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      },
    })),

  addEdge: (from, to, opts = {}) => {
    const { doc } = get();
    const flow = opts.flow ?? 'default';
    if (doc.edges.some((e) => e.from === from && e.to === to && e.flow === flow)) return null;
    get().beginChange();
    const id = 'n' + doc.seq;
    const edge: DiagramEdge = {
      id,
      from,
      to,
      label: opts.label ?? '',
      flow,
      routing: opts.routing ?? 'orthogonal',
      arrow: opts.arrow !== false,
    };
    set((s) => ({ doc: { ...s.doc, edges: [...s.doc.edges, edge], seq: s.doc.seq + 1 }, sel: { kind: 'edge', id } }));
    return id;
  },

  patchEdge: (id, patch) =>
    set((s) => ({
      doc: {
        ...s.doc,
        edges: s.doc.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    })),

  deleteSelected: () => {
    const { sel } = get();
    if (!sel) return;
    get().beginChange();
    set((s) => {
      if (sel.kind === 'node') {
        return {
          doc: {
            ...s.doc,
            nodes: s.doc.nodes.filter((n) => n.id !== sel.id),
            edges: s.doc.edges.filter((e) => e.from !== sel.id && e.to !== sel.id),
          },
          sel: null,
        };
      }
      return { doc: { ...s.doc, edges: s.doc.edges.filter((e) => e.id !== sel.id) }, sel: null };
    });
  },

  duplicateSelected: () => {
    const { sel, doc, snap } = get();
    if (!sel || sel.kind !== 'node') return;
    const n = doc.nodes.find((x) => x.id === sel.id);
    if (!n) return;
    get().beginChange();
    const id = 'n' + doc.seq;
    const copy: DiagramNode = { ...JSON.parse(JSON.stringify(n)), id, x: snapVal(n.x + 24, snap), y: snapVal(n.y + 24, snap) };
    set((s) => ({ doc: { ...s.doc, nodes: [...s.doc.nodes, copy], seq: s.doc.seq + 1 }, sel: { kind: 'node', id } }));
  },

  setDoc: (doc, commit = true) => {
    if (commit) get().beginChange();
    set({ doc, sel: null });
  },

  clearAll: () => {
    get().beginChange();
    set((s) => ({ doc: { ...emptyDoc(), seq: s.doc.seq }, sel: null }));
  },
}));
