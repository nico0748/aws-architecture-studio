import { useEffect, useRef, useState } from 'react';
import type { ModalKind } from '../App';
import { useStore } from '../store/useStore';
import { viewCenterWorld, fitView } from '../lib/viewport';
import { buildSample } from '../lib/docBuilder';
import { exportPptx } from '../lib/export/pptx';
import { exportSvg } from '../lib/export/svg';
import { exportPng } from '../lib/export/png';
import { Checkbox, MenuItem, MenuListBox } from './ui/dads';

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

function ToolGroup({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={'tool-group ' + className} role="group" aria-label={label}>
      {children}
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
          <img className="brand-mark" src="/architecture-studio.svg" alt="" width="40" height="40" />
          <h1 className="brand-name">
            <span className="brand-aws">AWS</span> Architecture Studio
          </h1>
        </div>
        <div className="spacer" />
        <ToolGroup label="編集" className="history">
          <button className="dads-button tbtn" type="button" data-type="text" data-size="sm" title="元に戻す (⌘/Ctrl + Z)" disabled={!canUndo} onClick={undo}><Icon name="undo" /><span className="tbtn-label">戻す</span></button>
          <button className="dads-button tbtn" type="button" data-type="text" data-size="sm" title="やり直し (⌘/Ctrl + Shift + Z)" disabled={!canRedo} onClick={redo}><Icon name="redo" /><span className="tbtn-label">やり直す</span></button>
        </ToolGroup>
        <ToolGroup label="追加">
          <MenuListBox label="追加" icon={<Icon name="add" />}>
            {(close) => (
              <>
                <MenuItem icon="▧" label="セクション枠" hint="説明を添える" onSelect={() => { insert('section'); close(); }} />
                <MenuItem icon="T" label="テキスト" hint="補足を追加" onSelect={() => { insert('text'); close(); }} />
                <MenuItem icon="☷" label="データフロー凡例" hint="色の意味を表示" onSelect={() => { insert('legend'); close(); }} />
              </>
            )}
          </MenuListBox>
        </ToolGroup>
        <ToolGroup label="表示" className="view-group">
          <button className="dads-button tbtn tools-toggle" type="button" data-type="outline" data-size="sm" aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)}>
            <Icon name="tools" /><span className="tbtn-label">操作</span>
          </button>
          <button className="dads-button tbtn sidebar-toggle" type="button" data-type="outline" data-size="sm" data-sidebar-toggle aria-label="素材パネルを表示・非表示" aria-pressed={paletteOpen} onClick={onTogglePalette}>
            <Icon name="components" /><span className="tbtn-label">素材</span>
          </button>
          <button className="dads-button tbtn sidebar-toggle" type="button" data-type="outline" data-size="sm" data-sidebar-toggle aria-label="プロパティパネルを表示・非表示" aria-pressed={inspectorOpen} onClick={onToggleInspector}>
            <Icon name="properties" /><span className="tbtn-label">プロパティ</span>
          </button>
        </ToolGroup>
        <ToolGroup label="出力" className="output-group">
          <ExportMenu onExport={runExport} />
        </ToolGroup>
      </header>
      {toolsOpen && (
        <div className="tools-header" role="toolbar" aria-label="追加操作">
          <ToolGroup label="作成">
            <button className="dads-button tbtn" type="button" data-type="outline" data-size="sm" onClick={() => onOpenModal('import')}><Icon name="import" />インポート</button>
            <button className="dads-button tbtn" type="button" data-type="outline" data-size="sm" onClick={loadSample}><Icon name="template" />テンプレート</button>
          </ToolGroup>
          <ToolGroup label="配置" className="arrange-group">
            <MenuListBox label="レイヤー" icon={<Icon name="layers" />}>
              {(close) => (
                <>
                  <MenuItem icon="⇈" label="最前面へ" hint="いちばん手前" disabled={!canBringForward} onSelect={() => { bringToFront(); close(); }} />
                  <MenuItem icon="↑" label="前面へ" hint="1 つ前へ" disabled={!canBringForward} onSelect={() => { bringForward(); close(); }} />
                  <li role="separator" className="menu-separator"><hr className="dads-divider" data-color="solid-gray-420" /></li>
                  <MenuItem icon="↓" label="背面へ" hint="1 つ後ろへ" disabled={!canSendBackward} onSelect={() => { sendBackward(); close(); }} />
                  <MenuItem icon="⇊" label="最背面へ" hint="いちばん奥" disabled={!canSendBackward} onSelect={() => { sendToBack(); close(); }} />
                </>
              )}
            </MenuListBox>
            <span className="snap-control" title="配置時にグリッドへ揃えます">
              <Checkbox label="グリッドにスナップ" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            </span>
            {!hasSelectedNode && <span className="selection-hint">要素を選択するとレイヤー順を変更できます</span>}
          </ToolGroup>
          <ToolGroup label="データ" className="data-group">
            <button className="dads-button tbtn" type="button" data-type="outline" data-size="sm" onClick={() => onOpenModal('project')}><Icon name="data" />プロジェクト</button>
          </ToolGroup>
        </div>
      )}
    </div>
  );
}

/** 主要アクション「書き出す」。DADS の塗りボタンを開閉ボタンにしたメニュー。 */
function ExportMenu({ onExport }: { onExport: (kind: 'pptx' | 'svg' | 'png') => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('click', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const pick = (kind: 'pptx' | 'svg' | 'png') => {
    setOpen(false);
    void onExport(kind);
  };
  return (
    <div className="dads-menu-list-box" ref={ref}>
      <button
        className="dads-button tbtn"
        type="button"
        data-type="solid-fill"
        data-size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Icon name="export" />書き出す
      </button>
      <div className="dads-menu-list-box__popup" data-align="end" hidden={!open}>
        <ul className="dads-menu-list" role="menu" aria-label="書き出す形式">
          <MenuItem icon="P" label="PowerPoint" hint=".pptx" onSelect={() => pick('pptx')} />
          <MenuItem icon="◇" label="ベクター画像" hint=".svg" onSelect={() => pick('svg')} />
          <MenuItem icon="▣" label="画像" hint=".png" onSelect={() => pick('png')} />
        </ul>
      </div>
    </div>
  );
}
