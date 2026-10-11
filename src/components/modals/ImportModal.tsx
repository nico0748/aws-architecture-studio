import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { parseTerraform, parseCloudFormation } from '../../lib/iac/parse';
import { layoutImported } from '../../lib/docBuilder';
import { fitView } from '../../lib/viewport';
import { Checkbox, ModalDialog, Radio } from '../ui/dads';

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
    <ModalDialog
      title="IaC からインポート"
      onClose={onClose}
      actions={
        <>
          <button className="dads-button" type="button" data-type="outline" data-size="md" onClick={onClose}>キャンセル</button>
          <button className="dads-button" type="button" data-type="solid-fill" data-size="md" onClick={run}>インポート</button>
        </>
      }
    >
      <fieldset className="dads-form-control-label field" data-size="sm">
        <legend className="dads-form-control-label__label">形式</legend>
        <div className="radio-row">
          <Radio name="iac-kind" label="Terraform (HCL)" checked={kind === 'tf'} onChange={() => setKind('tf')} />
          <Radio name="iac-kind" label="CloudFormation" checked={kind === 'cfn'} onChange={() => setKind('cfn')} />
        </div>
      </fieldset>
      <div className="dads-form-control-label field" data-size="sm">
        <label className="dads-form-control-label__label" htmlFor="iac-source">内容</label>
        <p id="iac-source-support" className="dads-form-control-label__support-text">
          {kind === 'tf'
            ? 'Terraform の .tf の内容を貼り付けてください。主要な aws_ リソースを認識して配置します。'
            : 'CloudFormation テンプレート（YAML / JSON）を貼り付けてください。Resources を認識して配置します。'}
        </p>
        <span className="dads-textarea">
          <textarea id="iac-source" className="dads-textarea__textarea code-textarea" aria-describedby="iac-source-support" value={text} onChange={(e) => setText(e.target.value)} />
        </span>
      </div>
      <Checkbox label="既存の図をクリアして読み込む" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
    </ModalDialog>
  );
}
