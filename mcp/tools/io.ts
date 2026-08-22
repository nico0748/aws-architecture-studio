import { z } from 'zod';
import { parseTerraform, parseCloudFormation, type ImportedItem } from '../../src/lib/iac/parse';
import { layoutImported } from '../../src/lib/docBuilder';
import { emptyDoc } from '../../src/lib/doc/ops';
import { buildSvgString } from '../../src/lib/export/svg';
import { buildPptx } from '../../src/lib/export/pptx';
import { svgToPngDataUrl, renderPng } from '../rasterize';
import { ok, fail, guard, type Registrar } from './shared';

/** 拡張子と中身から Terraform か CloudFormation かを推測する。 */
function detectFormat(content: string, path?: string): 'terraform' | 'cloudformation' {
  if (path && /\.tf$/i.test(path)) return 'terraform';
  if (path && /\.(ya?ml|json|template)$/i.test(path)) return 'cloudformation';
  if (/^\s*resource\s+"/m.test(content)) return 'terraform';
  return 'cloudformation';
}

const EXT: Record<string, string> = { svg: 'svg', png: 'png', pptx: 'pptx', json: 'json' };

export const registerIoTools: Registrar = (server, { session, workspace }) => {
  server.registerTool(
    'import_iac',
    {
      title: 'Terraform / CloudFormation を取り込む',
      description:
        'IaC を解析して、対応するリソースを図に自動配置する。VPC とサブネットは枠として、その他はサービスのアイコンとして並ぶ。カタログに対応の無いリソース型は読み飛ばされる。',
      inputSchema: {
        path: z.string().optional().describe('読み込むファイル。content と どちらか一方を指定する'),
        content: z.string().optional().describe('IaC の中身を直接渡す場合'),
        format: z.enum(['terraform', 'cloudformation', 'auto']).default('auto'),
        mode: z.enum(['replace', 'append']).default('replace').describe('replace=図を作り直す, append=いまの図に足す'),
      },
    },
    async ({ path, content, format, mode }) =>
      guard(async () => {
        if (!path && !content) return fail('path か content のどちらかを指定してください。');
        const text = content ?? (await workspace.read(path!));
        const fmt = format === 'auto' ? detectFormat(text, path) : format;

        let items: ImportedItem[];
        try {
          items = fmt === 'terraform' ? parseTerraform(text) : parseCloudFormation(text);
        } catch (e) {
          return fail(`${fmt} として解析できませんでした: ${e instanceof Error ? e.message : String(e)}`);
        }
        if (!items.length) {
          return fail(`${fmt} として読みましたが、カタログに対応するリソースが見つかりませんでした。`);
        }

        const base = mode === 'append' ? session.doc : emptyDoc();
        session.commit(layoutImported(base, items));
        return ok({
          format: fmt,
          mode,
          imported: items.length,
          items: items.map((i) => ({ type: i.type, name: i.name, kind: i.kind, catId: i.catId })),
          note: '自動レイアウトのため、位置関係は実際の構成を反映していません。move_node で整えてください。',
        });
      }),
  );

  server.registerTool(
    'export_diagram',
    {
      title: '図を書き出す',
      description:
        '図をファイルに書き出す。svg / png は画像、pptx は PowerPoint のスライド 1 枚、json はアプリで再度開ける形式。',
      inputSchema: {
        format: z.enum(['svg', 'png', 'pptx', 'json']),
        path: z.string().optional().describe('出力先。省略すると diagram.<拡張子> になる'),
        scale: z.number().min(0.5).max(6).default(2).describe('png のみ。等倍を 1 とした拡大率'),
      },
    },
    async ({ format, path, scale }) =>
      guard(async () => {
        const doc = session.doc;
        if (!doc.nodes.length) return fail('図が空です。');
        const target = path ?? `diagram.${EXT[format]}`;

        if (format === 'json') {
          const abs = await workspace.write(target, JSON.stringify(doc, null, 2));
          return ok({ written: workspace.display(abs), format });
        }
        if (format === 'svg') {
          const abs = await workspace.write(target, buildSvgString(doc));
          return ok({ written: workspace.display(abs), format });
        }
        if (format === 'png') {
          const abs = await workspace.write(target, renderPng(buildSvgString(doc), scale));
          return ok({ written: workspace.display(abs), format, scale });
        }
        const pptx = await buildPptx(doc, svgToPngDataUrl);
        const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
        const abs = await workspace.write(target, buf);
        return ok({ written: workspace.display(abs), format, slides: 1 });
      }),
  );
};
