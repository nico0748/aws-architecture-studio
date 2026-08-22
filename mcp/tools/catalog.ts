import { z } from 'zod';
import { CATALOG, svcById, grpById, shpById } from '../../src/data/catalog';
import { FLOWS, FLOW_KEYS } from '../../src/data/flows';
import { ok, fail, guard, type Registrar } from './shared';

type Kind = 'service' | 'group' | 'shape';

interface Entry {
  id: string;
  kind: Kind;
  label: string;
  category?: string;
}

function allEntries(): Entry[] {
  return [
    ...CATALOG.services.map((s): Entry => ({ id: s.id, kind: 'service', label: s.label, category: s.cat })),
    ...CATALOG.groups.map((g): Entry => ({ id: g.id, kind: 'group', label: g.label, category: 'コンテナ / 枠' })),
    ...CATALOG.shapes.map((s): Entry => ({ id: s.id, kind: 'shape', label: s.label, category: s.cat ?? 'アクター / 汎用' })),
  ];
}

export const registerCatalogTools: Registrar = (server) => {
  server.registerTool(
    'search_catalog',
    {
      title: 'カタログを検索する',
      description:
        '配置できる要素を検索して catId を得る。add_node には ここで得た id を渡す。query を省略すると kind / category での絞り込みだけを行う。',
      inputSchema: {
        query: z.string().optional().describe('名称や id の部分一致。例: rds, ロードバランサ, kafka'),
        kind: z.enum(['service', 'group', 'shape']).optional().describe('種類で絞り込む'),
        category: z.string().optional().describe('カテゴリ名の部分一致。例: Database, 監視'),
        limit: z.number().int().min(1).max(300).default(50),
      },
    },
    async ({ query, kind, category, limit }) =>
      guard(() => {
        const q = query?.trim().toLowerCase();
        const c = category?.trim().toLowerCase();
        const hits = allEntries().filter((e) => {
          if (kind && e.kind !== kind) return false;
          if (c && !(e.category ?? '').toLowerCase().includes(c)) return false;
          if (!q) return true;
          return e.label.toLowerCase().includes(q) || e.id.includes(q);
        });
        return ok({ total: hits.length, shown: Math.min(hits.length, limit), results: hits.slice(0, limit) });
      }),
  );

  server.registerTool(
    'get_catalog_entry',
    {
      title: 'カタログの詳細を見る',
      description: 'catId の詳細を返す。サービスには対応する Terraform / CloudFormation のリソース型が含まれる。',
      inputSchema: {
        id: z.string().describe('search_catalog で得た id'),
      },
    },
    async ({ id }) =>
      guard(() => {
        const svc = svcById[id];
        if (svc) return ok({ id, kind: 'service', label: svc.label, category: svc.cat, terraform: svc.tf, cloudformation: svc.cfn });
        const grp = grpById[id];
        if (grp) return ok({ id, kind: 'group', label: grp.label, color: grp.color, terraform: grp.tf, cloudformation: grp.cfn });
        const shp = shpById[id];
        if (shp) return ok({ id, kind: 'shape', label: shp.label, group: shp.group, category: shp.cat });
        return fail(`カタログに ${id} はありません。search_catalog で探してください。`);
      }),
  );

  server.registerTool(
    'list_flows',
    {
      title: '線の種類を一覧する',
      description: 'エッジに指定できる flow と、その色・凡例上の名称を返す。',
      inputSchema: {},
    },
    async () =>
      guard(() =>
        ok(FLOW_KEYS.map((k) => ({ key: k, label: FLOWS[k].label, color: FLOWS[k].color, dashed: FLOWS[k].dash }))),
      ),
  );
};
