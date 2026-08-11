import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ImportModal } from './components/modals/ImportModal';
import { ProjectModal } from './components/modals/ProjectModal';
import { Toast } from './components/Toast';
import { useStore } from './store/useStore';

export type ModalKind = null | 'import' | 'project';

export function App() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const sel = useStore((s) => s.sel);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '') as string;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        if (editing) return;
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        if (editing) return;
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        if (editing) return;
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !editing) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
        setInspectorOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, deleteSelected, duplicateSelected, undo, redo]);

  useEffect(() => {
    const closeOnOutside = (e: PointerEvent) => {
      const target = e.target as Element;
      if (target.closest('.sidebar') || target.closest('[data-sidebar-toggle]')) return;
      setPaletteOpen(false);
      setInspectorOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutside);
    return () => window.removeEventListener('pointerdown', closeOnOutside);
  }, []);

  return (
    <div className="app">
      <Toolbar
        onOpenModal={setModal}
        paletteOpen={paletteOpen}
        inspectorOpen={inspectorOpen}
        onTogglePalette={() => setPaletteOpen((open) => !open)}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
      />
      <main className="workspace">
        <Canvas />
        {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
        {inspectorOpen && <PropertiesPanel onClose={() => setInspectorOpen(false)} />}
      </main>
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} />}
      {modal === 'project' && <ProjectModal onClose={() => setModal(null)} />}
      <Toast />
    </div>
  );
}
