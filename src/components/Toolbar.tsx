import { useEffect, useRef, useState } from 'react';
import type { ModalKind } from '../App';
import { useStore } from '../store/useStore';
import { viewCenterWorld, fitView } from '../lib/viewport';
import { buildSample } from '../lib/docBuilder';
import { exportPptx } from '../lib/export/pptx';
import { exportSvg } from '../lib/export/svg';
import { exportPng, exportJson } from '../lib/export/png';

function Dropdown({ label, primary, children }: { label: string; primary?: boolean; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', onDoc);
    return () => window.removeEventListener('click', onDoc);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className={'tbtn ' + (primary ? 'primary' : 'ghost')} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        {label} ▾
      </button>
      {open && <div className={'menu-pop' + (primary ? ' right' : '')}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Toolbar({ onOpenModal }: { onOpenModal: (m: ModalKind) => void }) {
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.undoStack.length > 0);
  const canRedo = useStore((s) => s.redoStack.length > 0);
  const snap = useStore((s) => s.snap);
  const setSnap = useStore((s) => s.setSnap);
  const addNode = useStore((s) => s.addNode);
  const setDoc = useStore((s) => s.setDoc);
  const showToast = useStore((s) => s.showToast);

  const insert = (kind: 'section' | 'text' | 'legend') => {
    const p = viewCenterWorld();
    if (kind === 'section') addNode('group', 'section', p.x, p.y);
    else if (kind === 'text') addNode('text', undefined, p.x, p.y);
    else addNode('legend', undefined, p.x, p.y);
  };

  const loadSample = () => {
    setDoc(buildSample());
    setTimeout(fitView, 0);
    showToast('参考サンプルを読み込みました');
  };

  const runExport = async (kind: 'pptx' | 'svg' | 'png' | 'json') => {
    const doc = useStore.getState().doc;
    if (!doc.nodes.length) {
      showToast('先に図を作成してください');
      return;
    }
    try {
      if (kind === 'pptx') {
        showToast('PPTXを生成中…');
        const fn = await exportPptx(doc);
        showToast('エクスポート完了: ' + fn);
      } else if (kind === 'svg') {
        exportSvg(doc);
        showToast('SVGを書き出しました');
      } else if (kind === 'png') {
        await exportPng(doc);
        showToast('PNGを書き出しました');
      } else {
        exportJson(doc);
        showToast('JSONを書き出しました');
      }
    } catch (err) {
      showToast('エクスポート失敗: ' + (err as Error).message);
    }
  };

  return (
    <header>
      <div className="logo">
        <span className="b">AWS</span> Architecture Studio
      </div>
      <button className="tbtn ghost" title="元に戻す (Ctrl+Z)" disabled={!canUndo} onClick={undo}>↶</button>
      <button className="tbtn ghost" title="やり直し (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>↷</button>
      <span className="sep" />
      <Dropdown label="挿入">
        {(close) => (
          <>
            <button onClick={() => { insert('section'); close(); }}>▧ セクション枠（説明付き）</button>
            <button onClick={() => { insert('text'); close(); }}>🅣 テキスト注釈</button>
            <button onClick={() => { insert('legend'); close(); }}>▤ データフロー凡例</button>
          </>
        )}
      </Dropdown>
      <button className="tbtn ghost" onClick={() => onOpenModal('import')}>IaCインポート</button>
      <button className="tbtn ghost" onClick={loadSample}>参考サンプル</button>
      <span className="sep" />
      <label className="tbtn ghost" style={{ gap: 6 }}>
        <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} style={{ margin: 0 }} /> グリッド吸着
      </label>
      <div className="spacer" />
      <button className="tbtn ghost" onClick={() => onOpenModal('json')}>JSON</button>
      <Dropdown label="エクスポート" primary>
        {(close) => (
          <>
            <button onClick={() => { void runExport('pptx'); close(); }}>📊 PowerPoint (.pptx)</button>
            <button onClick={() => { void runExport('svg'); close(); }}>🖼 ベクター画像 (.svg)</button>
            <button onClick={() => { void runExport('png'); close(); }}>🖼 画像 (.png)</button>
            <button onClick={() => { void runExport('json'); close(); }}>💾 プロジェクト (.json)</button>
          </>
        )}
      </Dropdown>
    </header>
  );
}
