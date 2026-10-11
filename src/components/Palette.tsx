import { useMemo, useState } from 'react';
import { CATALOG } from '../data/catalog';
import { useStore } from '../store/useStore';
import { viewCenterWorld } from '../lib/viewport';
import type { NodeKind } from '../types';
import { CloseIcon } from './ui/dads';

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
      <h3 className="pcat-heading">
        <button
          className="dads-menu-list__item pcat"
          type="button"
          data-type="box"
          data-size="small"
          data-expanded={open ? '' : undefined}
          aria-expanded={open}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className="dads-menu-list__label">{name}</span>
          <span className="category-count">{items.length}<span className="dads-u-visually-hidden"> 件</span></span>
          <svg className="dads-menu-list__end-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentcolor" aria-hidden="true">
            <path d="m20.5 6.6-8 8-8-8L3.1 8l9.4 9.4L21.9 8l-1.4-1.4Z" />
          </svg>
        </button>
      </h3>
      {open && (
        <div className="pgrid">
          {items.map((it) => (
            <div
              key={it.kind + it.id}
              className="pitem"
              title={it.label}
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
    <aside id="palette" className="sidebar sidebar-left" aria-label="素材">
      <div className="panel-head">
        <h2 className="panel-title">素材を追加</h2>
        <button className="dads-button panel-close" type="button" data-type="text" data-size="xs" onClick={onClose}>
          <CloseIcon className="dads-button__icon" />
          閉じる
        </button>
      </div>
      <div className="psearch">
        <label className="dads-u-visually-hidden" htmlFor="palette-search">サービスを検索</label>
        <span className="dads-input-text search-field">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m21 20.5-6-6a7.4 7.4 0 0 0 1.9-5A7.4 7.4 0 0 0 9.5 2 7.5 7.5 0 1 0 14 15.5l6 6 1-1ZM3.5 9.5a6 6 0 0 1 6-6 6 6 0 0 1 6 6 6 6 0 0 1-6 6 6 6 0 0 1-6-6Z" fill="currentcolor" />
          </svg>
          <input
            id="palette-search"
            className="dads-input-text__input"
            data-size="sm"
            type="search"
            placeholder="例: EC2, VPC"
            aria-describedby="palette-guide"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </span>
        {filter && (
          <button className="dads-button clear-search" type="button" data-type="text" data-size="xs" onClick={() => setFilter('')}>
            クリア
          </button>
        )}
      </div>
      <p id="palette-guide" className="palette-guide">ドラッグ、またはダブルクリックでキャンバスへ追加できます。</p>
      <div className="plist">
        {blocks.length === 0 && (
          <div className="empty search-empty" role="status">
            <p className="empty-title">見つかりませんでした</p>
            <p>別のサービス名や英字で検索してください。</p>
          </div>
        )}
        {blocks.map((b) => (
          <CategoryBlock key={b.name} name={b.name} items={b.items} defaultCollapsed={b.collapsed} forceOpen={!!filter.trim()} />
        ))}
      </div>
    </aside>
  );
}
