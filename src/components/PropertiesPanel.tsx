import { useRef } from 'react';
import { useStore } from '../store/useStore';
import { FLOWS, FLOW_KEYS } from '../data/flows';
import { svcById, shpById, grpById } from '../data/catalog';
import type { DiagramEdge, DiagramNode, FlowKey } from '../types';

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
      <div className="empty empty-state">
        <div className="empty-icon">⌘</div>
        <h3>選択した要素を編集</h3>
        <p>キャンバス上の要素や接続線を選択すると、ここで内容を変更できます。</p>
        <div className="quick-start">
          <p className="eyebrow">はじめ方</p>
          <ol>
            <li><b>左の一覧</b>からサービスを追加</li>
            <li><b>オレンジの接続点</b>をドラッグして配線</li>
            <li>接続線を選び、<b>フロー種別</b>を設定</li>
          </ol>
        </div>
        <p className="shortcut-hint">⌘/Ctrl + D 複製　·　Delete 削除　·　⌘/Ctrl + Z 元に戻す</p>
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
    <aside id="props" className="sidebar sidebar-right" aria-label="インスペクター">
      <div className="ph">
        <div>
          <span className="eyebrow">インスペクター</span>
          <div className="panel-title">{head}</div>
        </div>
        <button className="sidebar-close" type="button" onClick={onClose} aria-label="インスペクターを閉じる">×</button>
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
    <button className="danger" onClick={onDelete}>
      {label}
    </button>
  );
}

function IconProps({ n, patchNode, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode }) {
  const meta = n.kind === 'service' ? svcById[n.catId!] : shpById[n.catId!];
  return (
    <>
      <div className="fld">
        <label>種別</label>
        <div style={{ fontSize: 12.5, color: '#33404d' }}>{meta?.label ?? n.catId}</div>
      </div>
      <div className="fld">
        <label>ラベル</label>
        <input type="text" value={n.label ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { label: e.target.value }); }} />
      </div>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function GroupProps({ n, patchNode, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode }) {
  const g = n.catId ? grpById[n.catId] : undefined;
  return (
    <>
      <div className="fld">
        <label>種別</label>
        <div style={{ fontSize: 12.5, color: '#33404d' }}>{g?.label ?? n.catId}</div>
      </div>
      <div className="fld">
        <label>タイトル</label>
        <input type="text" value={n.label ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { label: e.target.value }); }} />
      </div>
      <div className="fld">
        <label>説明文（サブタイトル・任意）</label>
        <textarea rows={2} value={n.subtitle ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { subtitle: e.target.value }); }} />
      </div>
      <div className="fld row">
        <div>
          <label>幅</label>
          <input type="number" value={n.w ?? 0} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { w: Math.max(70, parseInt(e.target.value) || n.w!) }); }} />
        </div>
        <div>
          <label>高さ</label>
          <input type="number" value={n.h ?? 0} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { h: Math.max(56, parseInt(e.target.value) || n.h!) }); }} />
        </div>
      </div>
      <div className="fld row">
        <div>
          <label>枠の色</label>
          <input type="text" value={n.color ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { color: e.target.value }); }} />
        </div>
        <div>
          <label>塗り(任意)</label>
          <input type="text" value={n.fill ?? ''} placeholder="#EAF6E1 / 空欄" onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { fill: e.target.value.trim() || null }); }} />
        </div>
      </div>
      <label className="chk">
        <input type="checkbox" checked={!!n.dashed} onChange={(e) => { commitOnce(); patchNode(n.id, { dashed: e.target.checked }); }} onFocus={startField} /> 点線の枠
      </label>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function TextProps({ n, patchNode, startField, commitOnce, onDelete }: Common & { n: DiagramNode; patchNode: PatchNode }) {
  return (
    <>
      <div className="fld">
        <label>本文</label>
        <textarea rows={3} value={n.text ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { text: e.target.value }); }} />
      </div>
      <div className="fld row">
        <div>
          <label>文字サイズ</label>
          <input type="number" value={n.fontSize ?? 14} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { fontSize: Math.max(8, parseInt(e.target.value) || n.fontSize!) }); }} />
        </div>
        <div>
          <label>幅</label>
          <input type="number" value={n.w ?? 160} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { w: Math.max(24, parseInt(e.target.value) || n.w!) }); }} />
        </div>
      </div>
      <div className="fld row">
        <div>
          <label>文字色</label>
          <input type="text" value={n.textColor ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { textColor: e.target.value }); }} />
        </div>
        <div>
          <label>揃え</label>
          <select value={n.align ?? 'left'} onChange={(e) => { commitOnce(); patchNode(n.id, { align: e.target.value as DiagramNode['align'] }); }} onFocus={startField}>
            <option value="left">左</option>
            <option value="center">中央</option>
            <option value="right">右</option>
          </select>
        </div>
      </div>
      <label className="chk">
        <input type="checkbox" checked={!!n.bold} onChange={(e) => { commitOnce(); patchNode(n.id, { bold: e.target.checked }); }} onFocus={startField} /> 太字
      </label>
      <label className="chk">
        <input type="checkbox" checked={!!n.boxed} onChange={(e) => { commitOnce(); patchNode(n.id, { boxed: e.target.checked }); }} onFocus={startField} /> 背景ボックス
      </label>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
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
      <div className="fld">
        <label>タイトル</label>
        <input type="text" value={n.title ?? ''} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { title: e.target.value }); }} />
      </div>
      <div className="fld">
        <label>表示するフロー</label>
        {FLOW_KEYS.map((k) => {
          const f = FLOWS[k];
          return (
            <label className="chk" key={k}>
              <input type="checkbox" checked={(n.flows ?? []).includes(k)} onChange={() => toggle(k)} />
              <span style={{ display: 'inline-block', width: 26, borderTop: `3px ${f.dash ? 'dashed' : 'solid'} ${f.color}` }} /> {f.label}
            </label>
          );
        })}
      </div>
      <div className="fld">
        <label>幅</label>
        <input type="number" value={n.w ?? 210} onFocus={startField} onChange={(e) => { commitOnce(); patchNode(n.id, { w: Math.max(120, parseInt(e.target.value) || n.w!) }); }} />
      </div>
      <DeleteBtn onDelete={onDelete} />
    </>
  );
}

function EdgeProps({ e, patchEdge, beginChange, startField, commitOnce, onDelete }: Common & { e: DiagramEdge; patchEdge: (id: string, patch: Partial<DiagramEdge>) => void; beginChange: () => void }) {
  return (
    <>
      <div className="fld">
        <label>フロー種別（色）</label>
        <div className="flowsel">
          {FLOW_KEYS.map((k) => {
            const f = FLOWS[k];
            return (
              <div
                key={k}
                className={'flowopt' + (e.flow === k ? ' on' : '')}
                onClick={() => { beginChange(); patchEdge(e.id, { flow: k }); }}
              >
                <span className="sw" style={{ borderTopColor: f.color, borderTopStyle: f.dash ? 'dashed' : 'solid' }} />
                {f.label}
              </div>
            );
          })}
        </div>
      </div>
      <div className="fld">
        <label>ラベル</label>
        <input type="text" value={e.label} placeholder="例: /predict, RunTask" onFocus={startField} onChange={(ev) => { commitOnce(); patchEdge(e.id, { label: ev.target.value }); }} />
      </div>
      <div className="fld">
        <label>配線</label>
        <select value={e.routing} onChange={(ev) => { beginChange(); patchEdge(e.id, { routing: ev.target.value as DiagramEdge['routing'] }); }}>
          <option value="orthogonal">直角（オルソゴナル）</option>
          <option value="straight">直線</option>
        </select>
      </div>
      <label className="chk">
        <input type="checkbox" checked={e.arrow} onChange={(ev) => { beginChange(); patchEdge(e.id, { arrow: ev.target.checked }); }} /> 矢印を表示
      </label>
      <div className="fld">
        <button className="tbtn ghost" style={{ color: '#333', border: '1px solid #ccc' }} onClick={() => { beginChange(); patchEdge(e.id, { from: e.to, to: e.from }); }}>
          ↔ 始点と終点を入れ替え
        </button>
      </div>
      <DeleteBtn onDelete={onDelete} label="この接続を削除" />
    </>
  );
}
