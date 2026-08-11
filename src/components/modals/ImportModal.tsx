import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { parseTerraform, parseCloudFormation } from '../../lib/iac/parse';
import { layoutImported } from '../../lib/docBuilder';
import { fitView } from '../../lib/viewport';

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<'tf' | 'cfn'>('tf');
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(true);
  const setDoc = useStore((s) => s.setDoc);
  const showToast = useStore((s) => s.showToast);

  const run = () => {
    if (!text.trim()) {
      showToast('内容が空です');
      return;
    }
    try {
      const items = kind === 'tf' ? parseTerraform(text) : parseCloudFormation(text);
      if (!items.length) {
        showToast('認識できるリソースが見つかりません');
        return;
      }
      const base = replace ? { nodes: [], edges: [], seq: useStore.getState().doc.seq } : useStore.getState().doc;
      const doc = layoutImported(base, items);
      setDoc(doc);
      onClose();
      setTimeout(fitView, 0);
      showToast(items.length + ' 件を配置しました');
    } catch (err) {
      showToast('解析エラー: ' + (err as Error).message);
    }
  };

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>IaC からインポート</h3>
        <div className="mbody">
          <div className="seg">
            <button className={kind === 'tf' ? 'on' : ''} onClick={() => setKind('tf')}>Terraform (HCL)</button>
            <button className={kind === 'cfn' ? 'on' : ''} onClick={() => setKind('cfn')}>CloudFormation</button>
          </div>
          <div className="hint">
            {kind === 'tf'
              ? 'Terraform の .tf 内容を貼り付けてください。主要な aws_ リソースを認識して配置します。'
              : 'CloudFormation テンプレート(YAML/JSON)を貼り付けてください。Resources を認識して配置します。'}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="ここに貼り付け…" />
          <label className="chk" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> 既存の図をクリアして読み込む
          </label>
        </div>
        <div className="mfoot">
          <button className="tbtn ghost" style={{ color: '#333' }} onClick={onClose}>キャンセル</button>
          <button className="tbtn primary" onClick={run}>インポート</button>
        </div>
      </div>
    </div>
  );
}
