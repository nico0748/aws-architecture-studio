/**
 * docs/logo-candidates.md を唯一の入力として、simple-icons のパスから
 * src/data/catalog.json の shapes（group: 'Logo'）を再生成する。
 *
 *   node scripts/build-logos.mjs [--dry]
 *
 * 生成する SVG は既存ロゴと同じ体裁:
 *   64x64 の白い角丸カード + 24x24 のブランドパスを translate(14 14) scale(1.5) で中央配置。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = resolve(ROOT, 'docs/logo-candidates.md');
const CATALOG = resolve(ROOT, 'src/data/catalog.json');
const SI_DIR = resolve(ROOT, 'node_modules/simple-icons/icons');
const SI_DATA = resolve(ROOT, 'node_modules/simple-icons/data/simple-icons.json');

const DRY = process.argv.includes('--dry');

/** simple-icons の slug と、既にカタログに入っている shape id が異なるもの。 */
const ID_ALIASES = { nodedotjs: 'nodejs', nextdotjs: 'nextjs' };

/** 「simple-icons に無い」節（2列表）はカタログ生成の対象外。 */
const UNAVAILABLE_HEADING = 'simple-icons に無い';

// ===== 1. ドキュメントの表をパース =====

/** @returns {{cat: string, name: string, slug: string, docHex: string}[]} */
function parseDoc() {
  const rows = [];
  let cat = null;
  let stop = false;

  for (const line of readFileSync(DOC, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const title = heading[1];
      if (title.includes(UNAVAILABLE_HEADING)) { stop = true; continue; }
      stop = false;
      // 「プログラミング言語（32）」→「プログラミング言語」
      cat = title.replace(/（\d+）\s*$/, '').trim();
      continue;
    }
    if (stop || !cat || !line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (cells[0] === '名称' || /^-+$/.test(cells[0].replace(/:/g, ''))) continue;

    const slug = cells[1].match(/^`(.+)`$/)?.[1];
    if (!slug) continue;
    rows.push({ cat, name: cells[0], slug, docHex: cells[2].replace(/^#/, '').toUpperCase() });
  }
  return rows;
}

// ===== 2. simple-icons を引く =====

const siData = JSON.parse(readFileSync(SI_DATA, 'utf8'));
const hexBySlug = new Map();
for (const icon of siData) {
  // slug が省略されている場合は title から導出（simple-icons の規則に準拠）
  const slug = icon.slug ?? icon.title.toLowerCase().replace(/\+/g, 'plus').replace(/^\./, 'dot').replace(/[^a-z0-9]/g, '');
  hexBySlug.set(slug, icon.hex.toUpperCase());
}

/** @returns {{paths: string[], hex: string} | null} */
function loadIcon(slug) {
  let svg;
  try {
    svg = readFileSync(resolve(SI_DIR, `${slug}.svg`), 'utf8');
  } catch {
    return null;
  }
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) return null;
  return { paths, hex: hexBySlug.get(slug) ?? '000000' };
}

// ===== 3. カタログ用 SVG を組み立て =====

function buildSvg(paths, hex) {
  const body = paths.map((d) => `<path d="${d}"/>`).join('');
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="10" fill="#ffffff" stroke="#e2e6ea" stroke-width="1.5"/>' +
    `<g transform="translate(14 14) scale(1.5)" fill="#${hex.toLowerCase()}">${body}</g>` +
    '</svg>'
  );
}

// ===== 4. 突き合わせて catalog.json を更新 =====

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const existingLogos = new Map(catalog.shapes.filter((s) => s.group === 'Logo').map((s) => [s.id, s]));

const rows = parseDoc();
const shapes = [];
const seen = new Set();
const missing = [];
const mismatched = [];
const duplicates = [];
let kept = 0;

for (const row of rows) {
  const id = ID_ALIASES[row.slug] ?? row.slug;
  if (seen.has(id)) { duplicates.push(`${row.name} (${row.cat})`); continue; }
  seen.add(id);

  const icon = loadIcon(row.slug);
  if (!icon) { missing.push(`${row.name} \`${row.slug}\``); continue; }
  if (row.docHex && row.docHex !== icon.hex) mismatched.push(`${row.name}: doc #${row.docHex} → si #${icon.hex}`);

  const prev = existingLogos.get(id);
  if (prev) kept++;
  shapes.push({
    id,
    // 既存ロゴのラベルは維持（Node.js / Next.js など表記が定着しているため）
    label: prev?.label ?? row.name,
    svg: prev?.svg ?? buildSvg(icon.paths, icon.hex),
    group: 'Logo',
    cat: row.cat,
  });
}

const orphans = [...existingLogos.keys()].filter((id) => !seen.has(id));
if (orphans.length) throw new Error(`既存ロゴがドキュメントに載っていません: ${orphans.join(', ')}`);

catalog.shapes = [...catalog.shapes.filter((s) => s.group !== 'Logo'), ...shapes];

// ===== 5. 結果を報告 =====

const byCat = {};
shapes.forEach((s) => (byCat[s.cat] = (byCat[s.cat] || 0) + 1));

console.log(`表の行数            : ${rows.length}`);
console.log(`重複を除いた候補    : ${seen.size}`);
console.log(`  既存を維持        : ${kept}`);
console.log(`  新規生成          : ${shapes.length - kept}`);
console.log(`  simple-icons に無い: ${missing.length}`);
console.log(`カタログ内ロゴ合計  : ${shapes.length}`);
console.log('\nカテゴリ別:');
Object.entries(byCat).forEach(([c, n]) => console.log(`  ${String(n).padStart(3)}  ${c}`));

if (duplicates.length) console.log(`\n重複（先勝ちでスキップ）: ${duplicates.join(', ')}`);
if (missing.length) console.log(`\n⚠ slug が見つからない: ${missing.join(', ')}`);
if (mismatched.length) console.log(`\n色の差分（simple-icons を採用）:\n  ${mismatched.join('\n  ')}`);

if (DRY) {
  console.log('\n--dry のため書き込みませんでした。');
} else {
  writeFileSync(CATALOG, JSON.stringify(catalog) + '\n');
  console.log(`\n${CATALOG} を更新しました。`);
}
