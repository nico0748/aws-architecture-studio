# MCP サーバ

AWS Architecture Studio の構成図を、Claude から直接読み書きするための MCP サーバです。
アプリでできる操作（要素の配置、接続、IaC の取り込み、各形式への書き出し）をツールとして
公開しているほか、構成図からセキュリティ上の懸念を洗い出す解析を追加しています。

図の操作ロジックは Web アプリと同じ `src/lib/` を共有しているため、画面から編集した場合と
Claude が編集した場合で結果が食い違いません。

## セットアップ

```bash
npm install
npm run build:mcp      # mcp/dist/ に stdio.js と http.js を生成
npm run test:mcp       # 全ツールの疎通確認（一時ディレクトリを使うので副作用なし）
```

### Claude Code に登録する

```bash
claude mcp add aws-architecture-studio -- \
  node /absolute/path/to/aws-architecture-studio/mcp/dist/stdio.js \
  --root /absolute/path/to/diagrams
```

### Claude Desktop に登録する

`claude_desktop_config.json` に追記します。

```json
{
  "mcpServers": {
    "aws-architecture-studio": {
      "command": "node",
      "args": [
        "/absolute/path/to/aws-architecture-studio/mcp/dist/stdio.js",
        "--root",
        "/absolute/path/to/diagrams"
      ]
    }
  }
}
```

### HTTP で動かす

stdio が使えない場合（ブラウザ上のアプリから接続する場合など）は Streamable HTTP で起動します。

```bash
npm run mcp:http -- --port 3333 --root ./diagrams
# エンドポイント: http://127.0.0.1:3333/mcp
# 死活確認:       http://127.0.0.1:3333/health
```

リクエストごとにサーバを組み立てるステートレス構成ですが、編集中の図はプロセスが保持するため、
複数のリクエストにまたがって同じ図を編集できます。既定では `127.0.0.1` にのみ bind します。
別オリジンのページから叩く場合は `--allow-origin https://example.com` を指定してください。

### `--root` について

ファイルの読み書きはこのディレクトリ配下に限定されます。指定しない場合はサーバの起動場所です。
外を指すパスはツール側でエラーになるため、図を置くディレクトリを明示的に渡してください。

## ツール一覧

### 図の管理

| ツール | 内容 |
| --- | --- |
| `new_diagram` | 編集中の図を空にする |
| `open_diagram` | 保存済みの JSON を読み込む |
| `save_diagram` | JSON として保存する。path 省略で直近のファイルを上書き |
| `get_diagram` | 図の JSON をそのまま返す |
| `describe_diagram` | 入れ子構造と線の一覧を要約して返す。最初に呼ぶと全体を把握できる |
| `load_template` | MLOps 構成の作例を読み込む |
| `undo` / `redo` | 編集を 1 つ戻す / 進める |

### カタログ

| ツール | 内容 |
| --- | --- |
| `search_catalog` | 配置できる要素を検索して `catId` を得る（AWS 92 種 + 枠 13 種 + ロゴ 291 種） |
| `get_catalog_entry` | 詳細を返す。サービスには対応する Terraform / CloudFormation のリソース型を含む |
| `list_flows` | 線の種類（推論 / ログ / 訓練 / 分析 / CI・CD / 監視）と色を返す |

### 編集

| ツール | 内容 |
| --- | --- |
| `add_node` | 要素を配置する。結果としてどの枠に入ったかを返す |
| `update_node` | ラベル・サイズ・色などを変更する |
| `move_node` | 座標を変更する。枠への出し入れもこれで行う |
| `delete_node` | 要素と、それに繋がる線をまとめて削除する |
| `duplicate_node` | 要素を複製する |
| `set_node_order` | 重なり順を変える |
| `add_edge` / `update_edge` / `delete_edge` | 線の追加・編集・削除 |

### 取り込みと書き出し

| ツール | 内容 |
| --- | --- |
| `import_iac` | Terraform / CloudFormation を解析して自動配置する。形式は拡張子と中身から推測 |
| `export_diagram` | `svg` / `png` / `pptx` / `json` でファイルに書き出す |

### 解析

| ツール | 内容 |
| --- | --- |
| `analyze_security` | 構成図から懸念を洗い出す |
| `annotate_findings` | 指摘を図の右側にレビュー枠として書き込み、対象に番号を振る |

## セキュリティ解析について

### 何を見ているか

**図に描かれた要素と、その位置関係だけ**です。図の親子関係は座標の重なりで決まるため、
「この RDS はどの Subnet の中にあるか」「この経路はどの枠をまたぐか」を復元したうえで
18 個のルールを当てています。

### 何を見ていないか

実際の AWS の設定は一切読みません。セキュリティグループの規則、暗号化の有無、IAM ポリシーの
中身、バケットポリシー、パッチ適用状況などは図には現れないため判定できません。

したがって出力は **「実環境で確認すべき箇所の一覧」** であって、脆弱性が存在することの証明では
ありません。逆に、指摘が 0 件でも安全である保証にもなりません。各 finding には「図の何を見て
そう判断したか」を `detail` に持たせているので、そこを起点に実環境を確認してください。

### ルール

| ルール | 深刻度 | 検出内容 |
| --- | --- | --- |
| `datastore-in-public-subnet` | high | RDS などのデータストアが Public Subnet の枠内にある |
| `internet-to-internal-directly` | high | 公開エンドポイントを介さず外部から内部リソースへ経路がある |
| `secret-in-diagram-text` | high | ラベルや注釈にアクセスキー・秘密鍵らしき文字列がある |
| `compute-in-public-subnet` | medium | アプリケーション層が Public Subnet にある |
| `storage-exposed-to-internet` | medium | S3 などが外部と直結している |
| `no-waf-on-public-entrypoint` | medium | 公開エンドポイントがあるのに WAF が無い |
| `no-identity-control` | medium | 公開エンドポイントがあるのに認証の要素が無い |
| `no-audit-trail` | medium | CloudTrail が無い |
| `single-az` | medium | AZ の枠が 1 つ以下 |
| `no-monitoring` | low | CloudWatch / X-Ray が無い |
| `no-threat-detection` | low | GuardDuty / Inspector が無い |
| `no-key-management` | low | データストアがあるのに KMS / Secrets Manager が無い |
| `private-subnet-without-egress` | low | Private Subnet に NAT / VPC エンドポイントが無い |
| `operator-direct-access` | low | 運用者が踏み台を介さず内部リソースに繋がっている |
| `resource-outside-vpc` | info | VPC 前提のサービスが枠の外にある |
| `public-subnet-without-igw` | info | Public Subnet があるのに Internet Gateway が無い |
| `empty-security-group` | info | Security Group の枠が空 |
| `unconnected-node` | info | どの経路にも繋がっていない要素がある（解析の精度が落ちる） |

ルールは `src/lib/analysis/security.ts` の `RULES` にあります。配列に関数を足せば増やせます。

### 使い方の例

```
図を読み込んで、セキュリティ上の懸念を洗い出してください。
→ open_diagram → describe_diagram → analyze_security

Terraform から図を起こして点検してください。
→ import_iac → analyze_security → annotate_findings → export_diagram (png)
```

## 開発

```bash
npm run typecheck   # Web アプリと MCP サーバの両方
npm run build:mcp   # esbuild で mcp/dist/ にバンドル
npm run test:mcp    # 疎通確認
```

MCP サーバのコードは Web アプリのビルドには含まれません（`src/` からは参照していないため）。

## 現状の制約

- 図はサーバのプロセス内で 1 枚だけ保持します。複数の図を同時に開くことはできません。
- ブラウザで開いているキャンバスとはまだ繋がっていません。アプリで「プロジェクト保存」した
  JSON を `open_diagram` で読む、あるいは MCP 側で編集した JSON をアプリで開く、という
  ファイル経由のやり取りになります。ライブ連携には、アプリから HTTP サーバへ接続して図を
  同期する仕組みを足す必要があります。
- `import_iac` はリソースの宣言を拾うだけで、参照関係から線を引くところまでは行いません。
  取り込み後の配置は自動レイアウトのため、実際の構成とは一致しません。
