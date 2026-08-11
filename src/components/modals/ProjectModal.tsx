import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { exportProject } from '../../lib/export/project';
import { fitView } from '../../lib/viewport';
import type { DiagramDoc } from '../../types';

export function ProjectModal({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const setDoc = useStore((s) => s.setDoc);
  const showToast = useStore((s) => s.showToast);
  const [text, setText] = useState(() => JSON.stringify(doc, null, 2));

  const parseProject = (): DiagramDoc => {
    const parsed = JSON.parse(text) as Partial<DiagramDoc>;
    if (!parsed.nodes) throw new Error('nodes がありません');
    const seq =
      parsed.seq ??
      Math.max(0, ...(parsed.nodes ?? []).map((node) => parseInt((node.id ?? '0').replace(/\D/g, ''), 10) || 0)) + 1;
    return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [], seq };
  };

  const copy = () => {
    navigator.clipboard?.writeText(text);
    showToast('コピーしました');
  };

  const restore = () => {
    try {
      setDoc(parseProject());
      onClose();
      setTimeout(fitView, 0);
      showToast('プロジェクトを復元しました');
    } catch (err) {
      showToast('JSONエラー: ' + (err as Error).message);
    }
  };

  const save = () => {
    try {
      exportProject(parseProject());
      showToast('プロジェクトを保存しました');
    } catch (err) {
      showToast('JSONエラー: ' + (err as Error).message);
    }
  };

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>プロジェクト</h3>
        <div className="mbody">
          <div className="hint">ファイルで保存するか、JSONテキストを貼り付けて既存のプロジェクトを復元できます。</div>
          <label className="sr-only" htmlFor="project-json">プロジェクト JSON</label>
          <textarea id="project-json" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="mfoot">
          <button className="tbtn ghost" style={{ color: '#333' }} onClick={onClose}>閉じる</button>
          <button className="tbtn ghost" style={{ color: '#333' }} onClick={restore}>復元</button>
          <button className="tbtn ghost" style={{ color: '#333' }} onClick={copy}>コピー</button>
          <button className="tbtn primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
