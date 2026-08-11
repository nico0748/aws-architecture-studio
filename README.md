# AWS Architecture Studio

AWS のインフラ構成図をブラウザ上で作成し、**PowerPoint (.pptx) / SVG / PNG** に書き出し、プロジェクトを JSON で保存・復元できる専用エディタです。HTML プロトタイプを土台に **Vite + React + TypeScript** で再構築しています。

![sample](docs/sample.png)

## 特長

- **公式 AWS アイコン 92 サービス**＋コンテナ枠 13 種＋アクター/外部ロゴ 24 種（GitHub, Terraform, Python, Go, Next.js ほか）
- **データフローの色分け**（推論 / ログ / 訓練 / 分析 / CI・CD / 監視）と自動**凡例**
- **直角（オルソゴナル）配線**とエッジラベル、直線配線の切替
- **入れ子コンテナ**（AWS Cloud → VPC → Subnet …）と**セクション枠**（タイトル＋説明文）
- **テキスト注釈**・**付箋(凡例)**・アクター配置
- **Terraform / CloudFormation インポート**（主要リソースを自動レイアウト）
- **Undo/Redo**、グリッド吸着、複製（Ctrl+D）、パン & ズーム
- **プロジェクトの保存・復元**（JSON ファイル／JSON テキスト）
- 依存ライブラリはバンドルされるため、ビルド後は**オフラインでも動作**

## セットアップ

```bash
npm install
npm run dev      # 開発サーバ (http://localhost:5173)
npm run build    # 本番ビルド → dist/
npm run preview  # ビルド結果をプレビュー
```

Node.js 18 以上を推奨します。

## 使い方

1. 左パレットからキャンバスへ**ドラッグ**（ダブルクリックでも配置）。
2. ノードの**オレンジ丸**から別ノードへドラッグして**接続**。
3. 接続を選択し、右パネルで**フロー種別（色）・ラベル・配線**を設定。
4. 「追加」からセクション枠・テキスト・凡例を追加。
5. 「書き出す」から **PowerPoint / SVG / PNG** を出力。
6. 「操作」→「プロジェクト」から JSON を保存・復元。

「テンプレート」ボタンで MLOps 構成の作例を読み込めます。

## ディレクトリ構成

```
src/
├─ main.tsx                # エントリ
├─ App.tsx                 # レイアウト・キーボード操作
├─ types.ts                # ドメイン型
├─ styles.css              # スタイル
├─ data/
│  ├─ catalog.json         # アイコンカタログ（AWS公式SVG + ロゴ/アクター）
│  ├─ catalog.ts           # カタログ索引・IaCマッピング
│  └─ flows.ts             # フロー定義・定数
├─ store/
│  └─ useStore.ts          # Zustand ストア（履歴付き）
├─ lib/
│  ├─ geometry.ts          # 図形・配線ルーティング
│  ├─ nodeFactory.ts       # ノード生成
│  ├─ docBuilder.ts        # サンプル / インポートのレイアウト
│  ├─ viewport.ts          # ズーム・パン・フィット
│  ├─ raster.ts            # SVG→PNG、ダウンロード
│  ├─ iac/parse.ts         # Terraform / CloudFormation 解析
│  └─ export/{pptx,svg,png}.ts  # 各種エクスポート
└─ components/
   ├─ Toolbar.tsx  Palette.tsx  Canvas.tsx
   ├─ NodeView.tsx  Edges.tsx  PropertiesPanel.tsx  Toast.tsx
   └─ modals/{ImportModal,ProjectModal}.tsx
```

## アイコン素材について

`src/data/catalog.json` は [aws-icons](https://www.npmjs.com/package/aws-icons)（AWS 公式アイコンセットベース）と
[simple-icons](https://simpleicons.org/)（外部サービスロゴ）から生成しています。各素材のライセンスに従ってご利用ください。
サービスの追加は `catalog.json` にエントリを追記するか、生成スクリプトを再実行してください。

## 技術スタック

Vite 5 / React 18 / TypeScript 5 / Zustand 4 / pptxgenjs 3 / js-yaml 4
