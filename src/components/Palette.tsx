import { useMemo, useState } from 'react';
import { CATALOG } from '../data/catalog';
import { useStore } from '../store/useStore';
import { viewCenterWorld } from '../lib/viewport';
import type { NodeKind } from '../types';

interface PItem {
  kind: NodeKind;
  id: string;
  label: string;
  svg: string;
}

function groupPlaceholder(color: string): string {
  return `<svg viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="6" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="7 5"/></svg>`;
}

function CategoryBlock({
  name,
  items,
  defaultCollapsed = false,
  forceOpen = false,
}: {
  name: string;
  items: PItem[];
  defaultCollapsed?: boolean;
  /** 検索中は畳んだブロックも開く（結果が隠れないように）。 */
  forceOpen?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const addNode = useStore((s) => s.addNode);
  const open = forceOpen || !collapsed;
  return (
    <section className="palette-category">
      <button className={'pcat' + (open ? '' : ' collapsed')} onClick={() => setCollapsed((v) => !v)} aria-expanded={open}>
        <span className="chev" aria-hidden="true">{open ? '−' : '+'}</span>
        <span>{name}</span>
        <span className="category-count">{items.length}</span>
      </button>
      {open && (
        <div className="pgrid">
          {items.map((it) => (
            <div
              key={it.kind + it.id}
              className="pitem"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ kind: it.kind, id: it.id }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDoubleClick={() => {
                const p = viewCenterWorld();
                addNode(it.kind, it.id, p.x, p.y);
              }}
            >
              <div className="ic" dangerouslySetInnerHTML={{ __html: it.svg }} />
              <div className="nm">{it.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Palette({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState('');

  const blocks = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const match = (label: string, id: string, extra = '') =>
      !f || label.toLowerCase().includes(f) || id.includes(f) || extra.toLowerCase().includes(f);
    const result: { name: string; items: PItem[]; collapsed?: boolean }[] = [];

    const groups = CATALOG.groups.filter((g) => match(g.label, g.id));
    if (groups.length) result.push({ name: 'コンテナ / 枠', items: groups.map((g) => ({ kind: 'group', id: g.id, label: g.label, svg: g.svg || groupPlaceholder(g.color) })) });

    const cats: Record<string, PItem[]> = {};
    CATALOG.services.forEach((s) => {
      if (!match(s.label, s.id, s.cat)) return;
      (cats[s.cat] = cats[s.cat] || []).push({ kind: 'service', id: s.id, label: s.label, svg: s.svg });
    });
    Object.keys(cats)
      .sort()
      .forEach((c) => result.push({ name: c, items: cats[c] }));

    const actors = CATALOG.shapes.filter((s) => s.group === 'Actor' && match(s.label, s.id));
    if (actors.length) result.push({ name: 'アクター / 汎用', items: actors.map((s) => ({ kind: 'shape', id: s.id, label: s.label, svg: s.svg })) });

    // 外部ロゴは AWS サービスの後に、分類ごとに畳んで配置する。
    const logoCats: Record<string, PItem[]> = {};
    CATALOG.shapes.forEach((s) => {
      if (s.group !== 'Logo' || !match(s.label, s.id, s.cat)) return;
      const name = 'ロゴ: ' + (s.cat || 'その他');
      (logoCats[name] = logoCats[name] || []).push({ kind: 'shape', id: s.id, label: s.label, svg: s.svg });
    });
    Object.keys(logoCats).forEach((name) => result.push({ name, items: logoCats[name], collapsed: true }));

    return result;
  }, [filter]);

  return (
    <aside id="palette" className="sidebar sidebar-left" aria-label="コンポーネント">
      <div className="palette-head">
        <div>
          <p className="eyebrow">コンポーネント</p>
          <h2>サービスを追加</h2>
        </div>
        <div className="sidebar-head-actions">
          <span className="palette-tip" title="ドラッグまたはダブルクリックで配置">?</span>
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="コンポーネントを閉じる">×</button>
        </div>
      </div>
      <div className="psearch">
        <label className="sr-only" htmlFor="palette-search">サービスを検索</label>
        <input
          id="palette-search"
          className="s"
          type="text"
          placeholder="サービスを検索 (例: EC2, VPC)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && <button className="clear-search" aria-label="検索をクリア" onClick={() => setFilter('')}>×</button>}
      </div>
      <p className="palette-guide">ドラッグ、またはダブルクリックでキャンバスへ追加</p>
      <div className="plist">
        {blocks.length === 0 && <div className="empty search-empty"><b>見つかりませんでした</b><br />別のサービス名や英字で検索してください。</div>}
        {blocks.map((b) => (
          <CategoryBlock key={b.name} name={b.name} items={b.items} defaultCollapsed={b.collapsed} forceOpen={!!filter.trim()} />
        ))}
      </div>
    </aside>
  );
}
