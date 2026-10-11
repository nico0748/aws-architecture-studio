import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { exportProject } from '../../lib/export/project';
import { fitView } from '../../lib/viewport';
import type { DiagramDoc } from '../../types';
import { ModalDialog } from '../ui/dads';

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
    <ModalDialog
      title="プロジェクト"
      onClose={onClose}
      actions={
        <>
          <button className="dads-button" type="button" data-type="text" data-size="md" onClick={copy}>コピー</button>
          <span className="spacer" />
          <button className="dads-button" type="button" data-type="outline" data-size="md" onClick={restore}>復元</button>
          <button className="dads-button" type="button" data-type="solid-fill" data-size="md" onClick={save}>ファイルに保存</button>
        </>
      }
    >
      <div className="dads-form-control-label field" data-size="sm">
        <label className="dads-form-control-label__label" htmlFor="project-json">プロジェクト JSON</label>
        <p id="project-json-support" className="dads-form-control-label__support-text">
          ファイルとして保存するか、JSON テキストを貼り付けて既存のプロジェクトを復元できます。
        </p>
        <span className="dads-textarea">
          <textarea id="project-json" className="dads-textarea__textarea code-textarea" aria-describedby="project-json-support" value={text} onChange={(e) => setText(e.target.value)} />
        </span>
      </div>
    </ModalDialog>
  );
}
