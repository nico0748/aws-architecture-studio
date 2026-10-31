import { useRef } from 'react';
import { useStore } from '../store/useStore';
import { FLOWS, FLOW_KEYS } from '../data/flows';
import { svcById, shpById, grpById } from '../data/catalog';
import type { DiagramEdge, DiagramNode, FlowKey } from '../types';
import { Checkbox, CloseIcon, Field, Select, TextArea, TextInput } from './ui/dads';

export function PropertiesPanel({ onClose }: { onClose: () => void }) {
  const sel = useStore((s) => s.sel);
  const doc = useStore((s) => s.doc);
  const patchNode = useStore((s) => s.patchNode);
  const patchEdge = useStore((s) => s.patchEdge);
  const beginChange = useStore((s) => s.beginChange);
  const deleteSelected = useStore((s) => s.deleteSelected);

  const committed = useRef(false);
  const startField = () => (committed.current = false);
  const commitOnce = () => {
    if (!committed.current) {
      beginChange();
      committed.current = true;
    }
  };

  let head = 'プロパティ';
  let body: React.ReactNode;

  if (!sel) {
    body = (
      <div className="empty-state">
        <p className="empty-title">選択した要素をここで編集します</p>
        <p>キャンバス上の要素や接続線を選択すると、ラベルや色などを変更できます。</p>
        <div className="quick-start">
          <h3 className="quick-start-title">はじめ方</h3>
          <ol>
            <li>左の<b>素材</b>からサービスを追加します。</li>
            <li>要素の右上にある<b>青い接続点</b>をドラッグして配線します。</li>
            <li>接続線を選び、<b>フロー種別</b>を設定します。</li>
          </ol>
        </div>
        <h3 className="quick-start-title">ショートカット</h3>
        <dl className="shortcut-list">
          <div><dt>⌘/Ctrl + D</dt><dd>複製</dd></div>
          <div><dt>Delete</dt><dd>削除</dd></div>
          <div><dt>⌘/Ctrl + Z</dt><dd>元に戻す</dd></div>
        </dl>
      </div>
    );
  } else if (sel.kind === 'edge') {
    const e = doc.edges.find((x) => x.id === sel.id);
    if (e) {
      head = '接続 / データフロー';
      body = <EdgeProps e={e} patchEdge={patchEdge} beginChange={beginChange} startField={startField} commitOnce={commitOnce} onDelete={deleteSelected} />;
    } else body = null;
  } else {
    const n = doc.nodes.find((x) => x.id === sel.id);
    if (!n) body = null;
    else if (n.kind === 'group') {
      head = 'コンテナ / 枠';
      body = <GroupProps n={n} patchNode={patchNode} startField={startField} commitOnce={commitOnce} onDelete={deleteSelected} />;
    } else if (n.kind === 'text') {
      head = 'テキスト注釈';
      body = <TextProps n={n} patchNode={patchNode} startField={startField} commitOnce={commitOnce} onDelete={deleteSelected} />;
    } else if (n.kind === 'legend') {
      head = 'データフロー凡例';
      body = <LegendProps n={n} patchNode={patchNode} beginChange={beginChange} startField={startField} commitOnce={commitOnce} onDelete={deleteSelected} />;
    } else {
      head = n.kind === 'service' ? 'AWSサービス' : '図形 / ロゴ';
      body = <IconProps n={n} patchNode={patchNode} startField={startField} commitOnce={commitOnce} onDelete={deleteSelected} />;
    }
  }

  return (
    <aside id="props" className="sidebar sidebar-right" aria-label="プロパティ">
      <div className="panel-head">
        <h2 className="panel-title">{head}</h2>
        <button className="dads-button panel-close" type="button" data-type="text" data-size="xs" onClick={onClose}>
          <CloseIcon className="dads-button__icon" />
          閉じる
        </button>
      </div>
      <div className="pbody">{body}</div>
    </aside>
  );
}

interface Common {
  startField: () => void;
  commitOnce: () => void;
  onDelete: () => void;
}
type PatchNode = (id: string, patch: Partial<DiagramNode>) => void;

function DeleteBtn({ onDelete, label = '削除' }: { onDelete: () => void; label?: string }) {
  return (
    <button className="dads-button danger-button" type="button" data-type="outline" data-size="sm" onClick={onDelete}>
      {label}
    </button>
  );
}

function KindRow({ value }: { value: string | undefined }) {
  return (
    <dl className="kind-row">
      <dt>種別</dt>
      <dd>{value}</dd>
    </dl>
  );
}

function IconProps({ n, patchNode, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode }) {
  const meta = n.kind === 'service' ? svcById[n.catId!] : shpById[n.catId!];
  return (
    <>
      <KindRow value={meta?.label ?? n.catId} />
      <Field label="ラベル">
        {(id) => <TextInput id={id} type="text" value={n.label ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { label: e.target.value }); }} />}
      </Field>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function GroupProps({ n, patchNode, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode }) {
  const g = n.catId ? grpById[n.catId] : undefined;
  return (
    <>
      <KindRow value={g?.label ?? n.catId} />
      <Field label="タイトル">
        {(id) => <TextInput id={id} type="text" value={n.label ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { label: e.target.value }); }} />}
      </Field>
      <Field label="説明文（任意）">
        {(id) => <TextArea id={id} rows={2} value={n.subtitle ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { subtitle: e.target.value }); }} />}
      </Field>
      <div className="field-row">
        <Field label="幅">
          {(id) => <TextInput id={id} type="number" inputMode="numeric" value={n.w ?? 0} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { w: Math.max(70, parseInt(e.target.value) || n.w!) }); }} />}
        </Field>
        <Field label="高さ">
          {(id) => <TextInput id={id} type="number" inputMode="numeric" value={n.h ?? 0} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { h: Math.max(56, parseInt(e.target.value) || n.h!) }); }} />}
        </Field>
      </div>
      <div className="field-row">
        <Field label="枠の色">
          {(id) => <TextInput id={id} type="text" value={n.color ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { color: e.target.value }); }} />}
        </Field>
        <Field label="塗り（任意）">
          {(id) => <TextInput id={id} type="text" value={n.fill ?? ''} placeholder="#EAF6E1" onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { fill: e.target.value.trim() || null }); }} />}
        </Field>
      </div>
      <Checkbox label="点線の枠" checked={!!n.dashed} onChange={(e) => { commitOnce(); patchNode(n.id, { dashed: e.target.checked }); }} onFocus={startField} />
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function TextProps({ n, patchNode, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode }) {
  return (
    <>
      <Field label="本文">
        {(id) => <TextArea id={id} rows={3} value={n.text ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { text: e.target.value }); }} />}
      </Field>
      <div className="field-row">
        <Field label="文字サイズ">
          {(id) => <TextInput id={id} type="number" inputMode="numeric" value={n.fontSize ?? 14} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { fontSize: Math.max(8, parseInt(e.target.value) || n.fontSize!) }); }} />}
        </Field>
        <Field label="幅">
          {(id) => <TextInput id={id} type="number" inputMode="numeric" value={n.w ?? 160} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { w: Math.max(24, parseInt(e.target.value) || n.w!) }); }} />}
        </Field>
      </div>
      <div className="field-row">
        <Field label="文字色">
          {(id) => <TextInput id={id} type="text" value={n.textColor ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { textColor: e.target.value }); }} />}
        </Field>
        <Field label="揃え">
          {(id) => (
            <Select id={id} value={n.align ?? 'left'} onChange={(e) => { commitOnce(); patchNode(n.id, { align: e.target.value as DiagramNode['align'] }); }} onFocus={startField}>
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="check-group">
        <Checkbox label="太字" checked={!!n.bold} onChange={(e) => { commitOnce(); patchNode(n.id, { bold: e.target.checked }); }} onFocus={startField} />
        <Checkbox label="背景ボックス" checked={!!n.boxed} onChange={(e) => { commitOnce(); patchNode(n.id, { boxed: e.target.checked }); }} onFocus={startField} />
      </div>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function FlowSwatch({ color, dash }: { color: string; dash?: boolean }) {
  return <span className="flow-swatch" style={{ borderTopColor: color, borderTopStyle: dash ? 'dashed' : 'solid' }} aria-hidden="true" />;
}

function LegendProps({ n, patchNode, beginChange, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode; beginChange: () => void }) {
  const toggle = (k: FlowKey) => {
    beginChange();
    const cur = new Set(n.flows ?? []);
    if (cur.has(k)) cur.delete(k);
    else cur.add(k);
    patchNode(n.id, { flows: FLOW_KEYS.filter((x) => cur.has(x)) });
  };
  return (
    <>
      <Field label="タイトル">
        {(id) => <TextInput id={id} type="text" value={n.title ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { title: e.target.value }); }} />}
      </Field>
      <fieldset className="dads-form-control-label field" data-size="sm">
        <legend className="dads-form-control-label__label">表示するフロー</legend>
        <div className="check-group">
          {FLOW_KEYS.map((k) => {
            const f = FLOWS[k];
            return <Checkbox key={k} label={<><FlowSwatch color={f.color} dash={f.dash} />{f.label}</>} checked={(n.flows ?? []).includes(k)} onChange={() => toggle(k)} />;
          })}
        </div>
      </fieldset>
      <Field label="幅">
        {(id) => <TextInput id={id} type="number" inputMode="numeric" value={n.w ?? 210} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { w: Math.max(120, parseInt(e.target.value) || n.w!) }); }} />}
      </Field>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function EdgeProps({ e, patchEdge, beginChange, startField, commitOnce, onDelete }: Common & { e: DiagramEdge; patchEdge: (id: string, patch: Partial<DiagramEdge>) => void; beginChange: () => void }) {
  return (
    <>
      <fieldset className="dads-form-control-label field" data-size="sm">
        <legend className="dads-form-control-label__label">フロー種別（色）</legend>
        <div className="flowsel">
          {FLOW_KEYS.map((k) => {
            const f = FLOWS[k];
            return (
              <label key={k} className={'flowopt' + (e.flow === k ? ' on' : '')}>
                <input
                  className="dads-u-visually-hidden"
                  type="radio"
                  name={'flow-' + e.id}
                  checked={e.flow === k}
                  onChange={() => { beginChange(); patchEdge(e.id, { flow: k }); }}
                />
                <FlowSwatch color={f.color} dash={f.dash} />
                {f.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="ラベル">
        {(id) => <TextInput id={id} type="text" value={e.label} placeholder="例: /predict, RunTask" onFocus={startField} onChange={(ev) => { commitOnce(); patchEdge(e.id, { label: ev.target.value }); }} />}
      </Field>
      <Field label="配線">
        {(id) => (
          <Select id={id} value={e.routing} onChange={(ev) => { beginChange(); patchEdge(e.id, { routing: ev.target.value as DiagramEdge['routing'] }); }}>
            <option value="orthogonal">直角（オルソゴナル）</option>
            <option value="straight">直線</option>
          </Select>
        )}
      </Field>
      <Checkbox label="矢印を表示" checked={e.arrow} onChange={(ev) => { beginChange(); patchEdge(e.id, { arrow: ev.target.checked }); }} />
      <button className="dads-button swap-button" type="button" data-type="outline" data-size="sm" onClick={() => { beginChange(); patchEdge(e.id, { from: e.to, to: e.from }); }}>
        始点と終点を入れ替え
      </button>
      <DeleteBtn onDelete={onDelete} label="この接続を削除" />
    </>
  );
}
