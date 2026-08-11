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

function CategoryBlock({ name, items }: { name: string; items: PItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const addNode = useStore((s) => s.addNode);
  return (
    <>
      <div className={'pcat' + (collapsed ? ' collapsed' : '')} onClick={() => setCollapsed((v) => !v)}>
        <span className="chev">▾</span>
        {name}
      </div>
      {!collapsed && (
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
    </>
  );
}

export function Palette() {
  const [filter, setFilter] = useState('');

  const blocks = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const match = (label: string, id: string, extra = '') =>
      !f || label.toLowerCase().includes(f) || id.includes(f) || extra.toLowerCase().includes(f);
    const result: { name: string; items: PItem[] }[] = [];

    const actors = CATALOG.shapes.filter((s) => s.group === 'Actor' && match(s.label, s.id));
    if (actors.length) result.push({ name: 'アクター / 汎用', items: actors.map((s) => ({ kind: 'shape', id: s.id, label: s.label, svg: s.svg })) });
    const logos = CATALOG.shapes.filter((s) => s.group === 'Logo' && match(s.label, s.id));
    if (logos.length) result.push({ name: '外部サービス / ロゴ', items: logos.map((s) => ({ kind: 'shape', id: s.id, label: s.label, svg: s.svg })) });

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

    return result;
  }, [filter]);

  return (
    <aside id="palette">
      <div className="psearch">
        <input
          className="s"
          type="text"
          placeholder="検索… (例: EC2, VPC, User, GitHub)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="plist">
        {blocks.length === 0 && <div className="empty" style={{ padding: 16 }}>該当なし</div>}
        {blocks.map((b) => (
          <CategoryBlock key={b.name} name={b.name} items={b.items} />
        ))}
      </div>
    </aside>
  );
}
