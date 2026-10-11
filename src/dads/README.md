# DADS (デジタル庁デザインシステム) 取り込みファイル

このディレクトリの CSS は、デジタル庁が MIT ライセンスで公開している公式 HTML 実装から
**無改変で**コピーしたものです（ライセンスは同ディレクトリの `LICENSE`）。

- 取り込み元: https://github.com/digital-go-jp/design-system-example-components-html
- コミット: `af8b6656c8d864a22ef444d088e5568f3416f6aa`（2026-09-09）
- 対象: `src/global.css`（デザイントークン・フォーカス・タイポグラフィ）と
  `button` / `input-text` / `textarea` / `select` / `checkbox` / `radio` /
  `form-control-label` / `menu-list` / `menu-list-box` / `modal-dialog` / `divider`

アプリ固有のレイアウトやキャンバス表現は `src/styles.css` に置き、ここにあるトークン
（`--color-*`, `--elevation-*`, `--font-family-*`）だけを参照します。DADS の CSS を
直接書き換えず、更新するときは取り込み元の新しいコミットから上書きコピーしてください。

```bash
git clone --depth 1 https://github.com/digital-go-jp/design-system-example-components-html /tmp/dads
cp /tmp/dads/src/global.css src/dads/global.css
for c in button input-text textarea select checkbox radio form-control-label menu-list menu-list-box modal-dialog divider; do
  cp /tmp/dads/src/components/$c/$c.css src/dads/
done
```
