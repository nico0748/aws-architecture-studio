import yaml from 'js-yaml';
import { TF_MAP, CFN_MAP } from '../../data/catalog';

export interface ImportedItem {
  type: string;
  name: string;
  kind: 'service' | 'group';
  catId: string;
  label: string;
}

function pretty(n: string): string {
  return n
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTerraform(txt: string): ImportedItem[] {
  const items: ImportedItem[] = [];
  const re = /resource\s+"([a-zA-Z0-9_]+)"\s+"([a-zA-Z0-9_-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const type = m[1];
    const name = m[2];
    const map = TF_MAP[type];
    if (!map) continue;
    let catId = map.id;
    let kind: 'service' | 'group' = map.kind;
    if (type === 'aws_subnet') {
      const seg = txt.slice(m.index, m.index + 400);
      const pub = /public/i.test(name) || /map_public_ip_on_launch\s*=\s*true/.test(seg);
      catId = pub ? 'public_subnet' : 'private_subnet';
      kind = 'group';
    }
    items.push({ type, name, kind, catId, label: pretty(name) });
  }
  return items;
}

export function parseCloudFormation(txt: string): ImportedItem[] {
  const t = txt.trim();
  let doc: unknown;
  if (t[0] === '{') doc = JSON.parse(t);
  else doc = yaml.load(t, { schema: yaml.JSON_SCHEMA, json: true });
  const res = (doc as { Resources?: Record<string, { Type?: string; Properties?: Record<string, unknown> }> })?.Resources;
  if (!res) return [];
  const items: ImportedItem[] = [];
  for (const name of Object.keys(res)) {
    const r = res[name];
    const type = r?.Type;
    if (!type) continue;
    const map = CFN_MAP[type];
    if (!map) continue;
    let catId = map.id;
    let kind: 'service' | 'group' = map.kind;
    if (type === 'AWS::EC2::Subnet') {
      const p = r.Properties ?? {};
      const pub = /public/i.test(name) || p.MapPublicIpOnLaunch === true;
      catId = pub ? 'public_subnet' : 'private_subnet';
      kind = 'group';
    }
    items.push({ type, name, kind, catId, label: pretty(name) });
  }
  return items;
}
