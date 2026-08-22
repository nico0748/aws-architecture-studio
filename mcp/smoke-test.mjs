/**
 * MCP サーバの疎通確認。実際にクライアントとして接続し、全ツールを一通り呼ぶ。
 *
 *   npm run build:mcp && npm run test:mcp
 *
 * 一時ディレクトリを作業ディレクトリとして使うので、リポジトリは汚さない。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'aas-mcp-'));
mkdirSync(ROOT, { recursive: true });
console.log(`作業ディレクトリ: ${ROOT}`);

writeFileSync(
  ROOT + '/main.tf',
  `
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }
resource "aws_subnet" "public_a" { map_public_ip_on_launch = true }
resource "aws_subnet" "private_a" { }
resource "aws_instance" "web" { }
resource "aws_db_instance" "orders" { }
resource "aws_s3_bucket" "assets" { }
resource "aws_lb" "front" { }
`,
);

const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({ command: 'node', args: ['mcp/dist/stdio.js', '--root', ROOT] }),
);

let pass = 0;
let fail = 0;

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content.map((c) => c.text).join('\n');
  return { isError: !!r.isError, text, json: safeJson(text) };
};
const safeJson = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
const check = (label, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label} ${extra}`);
  }
};

// --- tools ---
const { tools } = await client.listTools();
console.log(`\n[tools] ${tools.length} 個`);
console.log('  ' + tools.map((t) => t.name).join(', '));
check('ツールが 20 個以上ある', tools.length >= 20, `(${tools.length})`);
check('全ツールに description がある', tools.every((t) => t.description));

// --- template + describe ---
console.log('\n[document]');
const tpl = await call('load_template', { name: 'mlops' });
check('load_template', !tpl.isError && tpl.json?.nodes > 30, tpl.text.slice(0, 120));

const desc = await call('describe_diagram');
check('describe_diagram が入れ子を返す', Array.isArray(desc.json?.containment) && desc.json.containment.length > 0);
const vpc = JSON.stringify(desc.json?.containment ?? []);
check('VPC の中に Public subnet が入っている', vpc.includes('Public subnet'), '');
check('describe_diagram が線を返す', desc.json?.edges?.length > 10, `(${desc.json?.edges?.length})`);

// --- catalog ---
console.log('\n[catalog]');
const waf = await call('search_catalog', { query: 'waf' });
check('search_catalog で waf が引ける', waf.json?.results?.some((r) => r.id === 'waf'));
const kafka = await call('search_catalog', { query: 'kafka', kind: 'shape' });
check('ロゴも検索できる', kafka.json?.results?.length > 0);
const entry = await call('get_catalog_entry', { id: 'rds' });
check('get_catalog_entry が tf マッピングを返す', entry.json?.terraform?.includes('aws_db_instance'), entry.text.slice(0, 100));
const bogus = await call('get_catalog_entry', { id: 'nope' });
check('存在しない id はエラーになる', bogus.isError);
const flows = await call('list_flows');
check('list_flows', flows.json?.length === 7);

// --- edit ---
console.log('\n[edit]');
const added = await call('add_node', { kind: 'service', catId: 'waf', x: 100, y: 250, label: 'WAF' });
check('add_node', !added.isError && added.json?.added?.id, added.text.slice(0, 120));
const wafId = added.json?.added?.id;
const badCat = await call('add_node', { kind: 'service', catId: 'not-real', x: 0, y: 0 });
check('存在しない catId は弾かれる', badCat.isError);

const inGroup = await call('add_node', { kind: 'service', catId: 'rds', x: 200, y: 600, label: 'Orders DB' });
check('枠の中に置くと placedIn が返る', !!inGroup.json?.placedIn, inGroup.text.slice(0, 200));
console.log('       placedIn=' + inGroup.json?.placedIn?.label);

const rdsId = inGroup.json?.added?.id;
const edge = await call('add_edge', { from: wafId, to: rdsId, label: 'test', flow: 'inference' });
check('add_edge', !edge.isError && edge.json?.added?.id);
const dupEdge = await call('add_edge', { from: wafId, to: rdsId, flow: 'inference' });
check('重複した線は作られない', dupEdge.isError);
const upd = await call('update_node', { id: wafId, label: 'WAF (edge)' });
check('update_node', upd.json?.updated?.label === 'WAF (edge)');
const mv = await call('move_node', { id: wafId, x: 150, y: 260 });
check('move_node', mv.json?.moved?.rect?.x === 165, mv.text.slice(0, 120));
const ord = await call('set_node_order', { id: wafId, order: 'back' });
check('set_node_order', ord.json?.changed === true);
const dup = await call('duplicate_node', { id: wafId });
check('duplicate_node', !!dup.json?.created?.id);
const delOk = await call('delete_node', { id: dup.json?.created?.id });
check('delete_node', !delOk.isError);
const delEdge = await call('delete_edge', { id: edge.json?.added?.id });
check('delete_edge', !delEdge.isError);
const delMissing = await call('delete_node', { id: 'zzz' });
check('存在しないノードの削除はエラー', delMissing.isError);

// --- undo / redo ---
console.log('\n[history]');
// 直前の確定操作は delete_edge なので、戻るのは線の本数
const before = (await call('describe_diagram')).json?.edges?.length;
await call('undo');
const afterUndo = (await call('describe_diagram')).json?.edges?.length;
await call('redo');
const afterRedo = (await call('describe_diagram')).json?.edges?.length;
check('undo で削除した線が戻る', afterUndo === before + 1, `${before} -> ${afterUndo}`);
check('redo で元に戻る', afterRedo === before, `${afterRedo} vs ${before}`);

// --- analysis ---
console.log('\n[analysis]');
const sec = await call('analyze_security');
check('analyze_security が finding を返す', sec.json?.findings?.length > 0, sec.text.slice(0, 200));
check('summary の合計が一致', sec.json?.summary?.total === sec.json?.findings?.length);
check('caveat が付く', typeof sec.json?.caveat === 'string' && sec.json.caveat.length > 20);
console.log('       ' + (sec.json?.findings ?? []).map((f) => `${f.severity}:${f.rule}`).join(', '));
const high = await call('analyze_security', { minSeverity: 'medium' });
check('minSeverity で絞れる', high.json?.findings?.every((f) => ['high', 'medium'].includes(f.severity)));

const beforeAnn = (await call('describe_diagram')).json?.nodes;
const ann = await call('annotate_findings', { minSeverity: 'medium' });
const afterAnn = (await call('describe_diagram')).json?.nodes;
check('annotate_findings がノードを増やす', afterAnn > beforeAnn, `${beforeAnn} -> ${afterAnn}`);
await call('undo');
check('注釈は undo で戻せる', (await call('describe_diagram')).json?.nodes === beforeAnn);

// --- 意図的に危ない構成を作って high が出るか ---
console.log('\n[analysis: 危ない構成]');
await call('new_diagram');
// group は (x, y) を中心として扱う
await call('add_node', { kind: 'group', catId: 'vpc', x: 400, y: 400, w: 600, h: 500, label: 'VPC' });
await call('add_node', { kind: 'group', catId: 'public_subnet', x: 400, y: 300, w: 400, h: 150, label: 'Public subnet' });
const badDb = await call('add_node', { kind: 'service', catId: 'rds', x: 380, y: 280, label: 'Orders DB' });
const badEc2 = await call('add_node', { kind: 'service', catId: 'ec2', x: 380, y: 500, label: 'App' });
const net = await call('add_node', { kind: 'shape', catId: 'internet', x: 60, y: 700, label: 'Internet' });
await call('add_edge', { from: net.json.added.id, to: badEc2.json.added.id, label: 'ssh' });
await call('add_node', { kind: 'text', x: 60, y: 820, text: 'deploy key: AKIA1234567890ABCDEF' });

check('RDS が Public Subnet に入った', badDb.json?.placedIn?.label === 'Public subnet', JSON.stringify(badDb.json?.placedIn));
const bad = await call('analyze_security', { minSeverity: 'high' });
const rules = (bad.json?.findings ?? []).map((f) => f.rule);
console.log('       high: ' + rules.join(', '));
check('データストアの公開サブネット配置を検出', rules.includes('datastore-in-public-subnet'));
check('インターネットからの直結を検出', rules.includes('internet-to-internal-directly'));
check('図に書かれた認証情報を検出', rules.includes('secret-in-diagram-text'));
const all = await call('analyze_security');
check('WAF 不在も検出', all.json?.findings?.some((f) => f.rule === 'no-waf-on-public-entrypoint') === false, '(公開エンドポイント無しなので出ない想定)');
check('finding に位置情報が付く', bad.json?.findings?.[0]?.targets?.[0]?.location !== undefined);

// --- iac ---
console.log('\n[iac]');
const iac = await call('import_iac', { path: 'main.tf' });
check('import_iac (terraform)', iac.json?.imported >= 6, iac.text.slice(0, 200));
check('public/private subnet を判別', JSON.stringify(iac.json?.items).includes('public_subnet'));
const iacSec = await call('analyze_security');
check('取り込んだ図も解析できる', iacSec.json?.findings?.length > 0);
const badIac = await call('import_iac', { content: 'これは IaC ではありません' });
check('解析できない入力はエラー', badIac.isError);

// --- export ---
console.log('\n[export]');
for (const [format, min] of [['svg', 2000], ['png', 5000], ['pptx', 10000], ['json', 500]]) {
  const out = await call('export_diagram', { format, path: `out/diagram.${format}` });
  let size = 0;
  try {
    size = statSync(`${ROOT}/out/diagram.${format}`).size;
  } catch {
    /* not written */
  }
  check(`export ${format} (${size} bytes)`, !out.isError && size > min, out.text.slice(0, 150));
}

// --- save / open ---
console.log('\n[persistence]');
await call('save_diagram', { path: 'saved.json' });
await call('new_diagram');
check('new_diagram で空になる', (await call('describe_diagram')).text.includes('空'));
const opened = await call('open_diagram', { path: 'saved.json' });
check('open_diagram で読み戻せる', opened.json?.nodes > 0, opened.text.slice(0, 150));

// --- path guard ---
console.log('\n[safety]');
const escape = await call('save_diagram', { path: '../../escape.json' });
check('作業ディレクトリの外へは書けない', escape.isError, escape.text.slice(0, 120));
const escapeRead = await call('open_diagram', { path: '/etc/hosts' });
check('外部ファイルは読めない', escapeRead.isError);

console.log(`\n===== pass ${pass} / fail ${fail} =====`);
await client.close();
process.exit(fail ? 1 : 0);
