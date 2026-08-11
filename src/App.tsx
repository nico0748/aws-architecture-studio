import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ImportModal } from './components/modals/ImportModal';
import { JsonModal } from './components/modals/JsonModal';
import { Toast } from './components/Toast';
import { useStore } from './store/useStore';

export type ModalKind = null | 'import' | 'json';

export function App() {
  const [modal, setModal] = useState<ModalKind>(null);
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, deleteSelected, duplicateSelected, undo, redo]);

  return (
    <div className="app">
      <Toolbar onOpenModal={setModal} />
      <main>
        <Palette />
        <Canvas />
        <PropertiesPanel />
      </main>
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} />}
      {modal === 'json' && <JsonModal onClose={() => setModal(null)} />}
      <Toast />
    </div>
  );
}
