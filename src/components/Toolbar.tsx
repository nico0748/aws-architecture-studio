import { useEffect, useRef, useState } from 'react';
import type { ModalKind } from '../App';
import { useStore } from '../store/useStore';
import { viewCenterWorld, fitView } from '../lib/viewport';
import { buildSample } from '../lib/docBuilder';
import { exportPptx } from '../lib/export/pptx';
import { exportSvg } from '../lib/export/svg';
import { exportPng } from '../lib/export/png';

type IconName = 'add' | 'import' | 'template' | 'layers' | 'grid' | 'components' | 'properties' | 'data' | 'export' | 'undo' | 'redo' | 'tools';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    add: <><path d="M12 5v14M5 12h14" /></>,
    import: <><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M4 17v3h16v-3" /></>,
    template: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5M8 17h8" /></>,
    layers: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" /></>,
    grid: <><path d="M4 4h16v16H4zM4 10h16M10 4v16" /></>,
    components: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    properties: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="7" cy="19" r="1.5" /></>,
    data: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    export: <><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M4 13v7h16v-7" /></>,
    undo: <><path d="M9 7 4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 7 5 5-5 5" /><path d="M20 12H10a6 6 0 0 0-6 6" /></>,
    tools: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" /><circle cx="16" cy="12" r="1.5" /><circle cx="11" cy="18" r="1.5" /></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Dropdown({ label, primary, children }: { label: React.ReactNode; primary?: boolean; children: (close: () => void) => React.ReactNode }) {
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
      <button
        className={'tbtn ' + (primary ? 'primary' : 'ghost')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        {label}
      </button>
      {open && <div className={'menu-pop' + (primary ? ' right' : '')} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}

function RibbonGroup({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={'ribbon-group ' + className}>
      <div className="ribbon-actions">{children}</div>
      <span className="ribbon-label">{label}</span>
    </div>
  );
}

interface ToolbarProps {
  onOpenModal: (m: ModalKind) => void;
  paletteOpen: boolean;
  inspectorOpen: boolean;
  onTogglePalette: () => void;
  onToggleInspector: () => void;
}

export function Toolbar({ onOpenModal, paletteOpen, inspectorOpen, onTogglePalette, onToggleInspector }: ToolbarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.undoStack.length > 0);
  const canRedo = useStore((s) => s.redoStack.length > 0);
  const snap = useStore((s) => s.snap);
  const setSnap = useStore((s) => s.setSnap);
  const addNode = useStore((s) => s.addNode);
  const setDoc = useStore((s) => s.setDoc);
  const showToast = useStore((s) => s.showToast);
  const doc = useStore((s) => s.doc);
  const sel = useStore((s) => s.sel);
  const bringForward = useStore((s) => s.bringForward);
  const sendBackward = useStore((s) => s.sendBackward);
  const bringToFront = useStore((s) => s.bringToFront);
  const sendToBack = useStore((s) => s.sendToBack);
  const selectedNodeIndex = sel?.kind === 'node' ? doc.nodes.findIndex((node) => node.id === sel.id) : -1;
  const hasSelectedNode = selectedNodeIndex >= 0;
  const canSendBackward = selectedNodeIndex > 0;
  const canBringForward = selectedNodeIndex >= 0 && selectedNodeIndex < doc.nodes.length - 1;

  useEffect(() => {
    const compactLayout = window.matchMedia('(max-width: 1280px)');
    const revealTools = () => {
      if (compactLayout.matches) setToolsOpen(true);
    };
    revealTools();
    compactLayout.addEventListener('change', revealTools);
    return () => compactLayout.removeEventListener('change', revealTools);
  }, []);

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

  const runExport = async (kind: 'pptx' | 'svg' | 'png') => {
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
      }
    } catch (err) {
      showToast('エクスポート失敗: ' + (err as Error).message);
    }
  };

  return (
    <div className="app-header">
      <header className="primary-header">
        <div className="logo">
          <img className="brand-mark" src="/architecture-studio.svg" alt="" />
          <span className="brand-lockup"><span className="brand-aws">AWS</span><span className="brand-name">Architecture Studio</span></span>
          <span className="beta">Diagram editor</span>
        </div>
        <div className="spacer" />
        <RibbonGroup label="編集" className="history">
          <button className="tbtn ghost" title="元に戻す (⌘/Ctrl + Z)" disabled={!canUndo} onClick={undo}><Icon name="undo" />戻す</button>
          <button className="tbtn ghost" title="やり直し (⌘/Ctrl + Shift + Z)" disabled={!canRedo} onClick={redo}><Icon name="redo" />やり直す</button>
        </RibbonGroup>
        <RibbonGroup label="追加">
          <Dropdown label={<><Icon name="add" />追加</>}>
            {(close) => (
              <>
                <button role="menuitem" onClick={() => { insert('section'); close(); }}><span className="menu-icon">▧</span>セクション枠 <small>説明を添える</small></button>
                <button role="menuitem" onClick={() => { insert('text'); close(); }}><span className="menu-icon">T</span>テキスト <small>補足を追加</small></button>
                <button role="menuitem" onClick={() => { insert('legend'); close(); }}><span className="menu-icon">☷</span>データフロー凡例 <small>色の意味を表示</small></button>
              </>
            )}
          </Dropdown>
        </RibbonGroup>
        <RibbonGroup label="操作" className="tools-group">
          <button className={'tbtn ghost tools-toggle' + (toolsOpen ? ' active' : '')} aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)}>
            <Icon name="tools" />操作
          </button>
        </RibbonGroup>
        <RibbonGroup label="表示" className="view-group">
          <button className={'tbtn ghost sidebar-toggle' + (paletteOpen ? ' active' : '')} data-sidebar-toggle aria-label="コンポーネントを表示・非表示" aria-pressed={paletteOpen} onClick={onTogglePalette}>
            <Icon name="components" /> 素材
          </button>
          <button className={'tbtn ghost sidebar-toggle' + (inspectorOpen ? ' active' : '')} data-sidebar-toggle aria-label="インスペクターを表示・非表示" aria-pressed={inspectorOpen} onClick={onToggleInspector}>
            <Icon name="properties" /> プロパティ
          </button>
        </RibbonGroup>
        <RibbonGroup label="出力" className="output-group">
          <Dropdown label={<><Icon name="export" />書き出す</>} primary>
            {(close) => (
              <>
                <button role="menuitem" onClick={() => { void runExport('pptx'); close(); }}><span className="menu-icon">P</span>PowerPoint <small>.pptx</small></button>
                <button role="menuitem" onClick={() => { void runExport('svg'); close(); }}><span className="menu-icon">◇</span>ベクター画像 <small>.svg</small></button>
                <button role="menuitem" onClick={() => { void runExport('png'); close(); }}><span className="menu-icon">▣</span>画像 <small>.png</small></button>
              </>
            )}
          </Dropdown>
        </RibbonGroup>
      </header>
      {toolsOpen && (
        <header className="tools-header" aria-label="追加操作">
          <RibbonGroup label="作成">
            <button className="tbtn ghost" onClick={() => onOpenModal('import')}><Icon name="import" />インポート</button>
            <button className="tbtn ghost" onClick={loadSample}><Icon name="template" />テンプレート</button>
          </RibbonGroup>
          <RibbonGroup label="配置" className="arrange-group">
            <Dropdown label={<><Icon name="layers" />レイヤー</>}>
              {(close) => (
                <>
                  <button role="menuitem" disabled={!canBringForward} onClick={() => { bringToFront(); close(); }}><span className="menu-icon">⇈</span>最前面へ <small>いちばん手前</small></button>
                  <button role="menuitem" disabled={!canBringForward} onClick={() => { bringForward(); close(); }}><span className="menu-icon">↑</span>前面へ <small>1 つ前へ</small></button>
                  <div className="menu-divider" role="separator" />
                  <button role="menuitem" disabled={!canSendBackward} onClick={() => { sendBackward(); close(); }}><span className="menu-icon">↓</span>背面へ <small>1 つ後ろへ</small></button>
                  <button role="menuitem" disabled={!canSendBackward} onClick={() => { sendToBack(); close(); }}><span className="menu-icon">⇊</span>最背面へ <small>いちばん奥</small></button>
                </>
              )}
            </Dropdown>
            <label className="tbtn setting-control" title="配置時にグリッドへ揃えます">
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              <Icon name="grid" />
              <span>スナップ</span>
            </label>
            {!hasSelectedNode && <span className="selection-hint">要素を選択して配置</span>}
          </RibbonGroup>
          <RibbonGroup label="データ" className="data-group">
            <button className="tbtn ghost" onClick={() => onOpenModal('project')}><Icon name="data" />プロジェクト</button>
          </RibbonGroup>
        </header>
      )}
    </div>
  );
}
