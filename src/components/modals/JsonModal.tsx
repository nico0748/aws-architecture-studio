import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { fitView } from '../../lib/viewport';
import type { DiagramDoc } from '../../types';

export function JsonModal({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const setDoc = useStore((s) => s.setDoc);
  const showToast = useStore((s) => s.showToast);
  const [text, setText] = useState(() => JSON.stringify(doc, null, 2));

  const copy = () => {
    navigator.clipboard?.writeText(text);
    showToast('コピーしました');
  };

  const load = () => {
    try {
      const parsed = JSON.parse(text) as Partial<DiagramDoc>;
      if (!parsed.nodes) throw new Error('nodes がありません');
      const seq =
        parsed.seq ??
        Math.max(0, ...(parsed.nodes ?? []).map((n) => parseInt((n.id ?? '0').replace(/\D/g, '')) || 0)) + 1;
      setDoc({ nodes: parsed.nodes ?? [], edges: parsed.edges ?? [], seq });
      onClose();
      setTimeout(fitView, 0);
      showToast('読み込みました');
    } catch (err) {
      showToast('JSONエラー: ' + (err as Error).message);
    }
  };

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>プロジェクト JSON（保存 / 読み込み）</h3>
        <div className="mbody">
          <div className="hint">コピーして保存、または貼り付けて「読み込む」で復元できます。</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="mfoot">
          <button className="tbtn ghost" style={{ color: '#333' }} onClick={onClose}>閉じる</button>
          <button className="tbtn ghost" style={{ color: '#333' }} onClick={load}>読み込む</button>
          <button className="tbtn primary" onClick={copy}>コピー</button>
        </div>
      </div>
    </div>
  );
}
