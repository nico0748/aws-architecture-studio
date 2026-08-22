import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DocumentSession } from './session';
import { Workspace } from './workspace';
import type { ToolCtx } from './tools/shared';
import { registerDocumentTools } from './tools/document';
import { registerCatalogTools } from './tools/catalog';
import { registerEditTools } from './tools/edit';
import { registerIoTools } from './tools/io';
import { registerAnalysisTools } from './tools/analysis';

const INSTRUCTIONS = `AWS Architecture Studio の構成図を読み書きするサーバです。

図は「編集中の 1 枚」を共有します。まず open_diagram でファイルを読むか、load_template
または import_iac で図を用意し、describe_diagram で全体像を掴んでから編集してください。

- 配置できる要素の catId は search_catalog で探します。当てずっぽうの id は通りません。
- 図の親子関係は座標の重なりで決まります。枠の中に入れたい場合は、その枠の矩形内の座標を
  指定してください。add_node と move_node は、結果としてどの枠に入ったかを返します。
- 脆弱性調査には analyze_security を使います。これは図に描かれた要素と位置関係だけを見て
  おり、実際のセキュリティグループや暗号化設定は読んでいません。結果は「確認すべき箇所」
  として扱い、断定的な結論を出さないでください。
- 編集はすべて undo で戻せます。`;

export function createServer(ctx: ToolCtx): McpServer {
  const server = new McpServer(
    { name: 'aws-architecture-studio', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );

  registerDocumentTools(server, ctx);
  registerCatalogTools(server, ctx);
  registerEditTools(server, ctx);
  registerIoTools(server, ctx);
  registerAnalysisTools(server, ctx);

  return server;
}

/** コマンドライン引数から作業ディレクトリを決める。既定はプロセスの実行場所。 */
export function createContext(argv: string[] = process.argv.slice(2)): ToolCtx {
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 && argv[rootIndex + 1] ? argv[rootIndex + 1] : process.cwd();
  return { session: new DocumentSession(), workspace: new Workspace(root) };
}
