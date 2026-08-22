import { z } from 'zod';
import type { DiagramDoc } from '../../src/types';
import { analyzeSecurity, locationOf, type Finding, type Severity } from '../../src/lib/analysis/security';
import * as ops from '../../src/lib/doc/ops';
import { contentBBox, textHeight } from '../../src/lib/geometry';
import { ok, fail, guard, type Registrar } from './shared';

const ORDER: Severity[] = ['high', 'medium', 'low', 'info'];
const severitySchema = z.enum(['high', 'medium', 'low', 'info']);

const SEVERITY_COLOR: Record<Severity, string> = {
  high: '#D93025',
  medium: '#E8710A',
  low: '#8C6D1F',
  info: '#5A6B7B',
};

function filterBy(findings: Finding[], min: Severity): Finding[] {
  const cutoff = ORDER.indexOf(min);
  return findings.filter((f) => ORDER.indexOf(f.severity) <= cutoff);
}

/** 全角はフォントサイズと同じ幅、半角はその約半分として概算する。 */
function charWidth(ch: string, fontSize: number): number {
  return /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch)
    ? fontSize
    : fontSize * 0.55;
}

/**
 * text ノードは改行文字でしか折り返さないため、幅に収まるよう自前で改行を入れる。
 * これをしないと長い指摘文が枠からはみ出して見切れる。
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    let width = 0;
    for (const ch of paragraph) {
      const w = charWidth(ch, fontSize);
      if (line && width + w > maxWidth) {
        lines.push(line);
        line = '';
        width = 0;
      }
      line += ch;
      width += w;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** 指摘を図の右側にレビュー用の枠として書き加える。 */
function annotate(doc: DiagramDoc, findings: Finding[], mark: boolean): DiagramDoc {
  const bbox = contentBBox(doc);
  const panelX = Math.round(bbox.x + bbox.w + 80);
  const panelY = Math.round(bbox.y);
  const width = 460;
  const pad = 20;

  let next = doc;
  let cursor = panelY + 54;

  const fontSize = 12;
  const textW = width - pad * 2;

  findings.forEach((f, i) => {
    const no = i + 1;
    const body = wrapText(
      `#${no} [${f.severity.toUpperCase()}] ${f.title}\n${f.detail}\n→ ${f.recommendation}`,
      textW - 10,
      fontSize,
    );
    const res = ops.addNode(next, {
      kind: 'text',
      x: panelX + pad,
      y: cursor,
      snap: false,
      opts: {
        text: body,
        w: textW,
        fontSize,
        textColor: SEVERITY_COLOR[f.severity],
        align: 'left',
        boxed: true,
      },
    });
    next = res.doc;
    cursor += textHeight(res.node) + 14;

    if (!mark) return;
    // 指摘の対象に番号を振って、枠の中の説明と図を対応づける
    for (const id of f.nodeIds) {
      const target = ops.findNode(next, id);
      if (!target) continue;
      const marker = ops.addNode(next, {
        kind: 'text',
        x: target.x - 6,
        y: target.y - 18,
        snap: false,
        opts: { text: `#${no}`, w: 40, fontSize: 12, bold: true, textColor: SEVERITY_COLOR[f.severity], align: 'left' },
      });
      next = marker.doc;
    }
  });

  const panelH = Math.max(cursor - panelY + pad, 120);
  const panel = ops.addNode(next, {
    kind: 'group',
    catId: 'section',
    x: panelX,
    y: panelY,
    snap: false,
    center: false,
    opts: {
      w: width,
      h: panelH,
      label: `セキュリティレビュー（${findings.length} 件）`,
      subtitle: '構成図からの推定。実環境の設定を確認してください',
      color: '#D93025',
      fill: '#FFFFFF',
    },
  });
  // 枠は最背面に置かないと中身のテキストが隠れる
  return ops.reorderNode(panel.doc, panel.node.id, 'back');
}

export const registerAnalysisTools: Registrar = (server, { session }) => {
  server.registerTool(
    'analyze_security',
    {
      title: '構成図のセキュリティを点検する',
      description:
        '図に描かれた要素と位置関係から、セキュリティ・可用性の懸念を洗い出す。データストアの配置、外部からの経路、WAF や監査ログの有無、単一 AZ などを見る。実際の AWS 設定は読まないため、結果は確認すべき箇所の一覧として扱うこと。',
      inputSchema: {
        minSeverity: severitySchema.default('info').describe('この深刻度以上のみ返す'),
      },
    },
    async ({ minSeverity }) =>
      guard(() => {
        const doc = session.doc;
        if (!doc.nodes.length) return fail('図が空です。open_diagram か load_template で図を読み込んでください。');
        const result = analyzeSecurity(doc);
        const findings = filterBy(result.findings, minSeverity);
        return ok({
          summary: result.summary,
          rulesEvaluated: result.rulesEvaluated,
          caveat: result.caveat,
          findings: findings.map((f) => ({
            ...f,
            targets: f.nodeIds.map((id) => ({
              id,
              label: doc.nodes.find((n) => n.id === id)?.label ?? id,
              location: locationOf(doc, id) || '(枠の外)',
            })),
          })),
        });
      }),
  );

  server.registerTool(
    'annotate_findings',
    {
      title: '指摘を図に書き込む',
      description:
        'analyze_security の結果を、図の右側にレビュー枠として追加する。対象のノードには番号が振られるので、図を見ればどこの指摘か分かる。元の図は変更されないので、書き込んだあと export_diagram や save_diagram で共有できる。',
      inputSchema: {
        minSeverity: severitySchema.default('low').describe('この深刻度以上を書き込む'),
        markTargets: z.boolean().default(true).describe('指摘対象のノードに番号を振る'),
      },
    },
    async ({ minSeverity, markTargets }) =>
      guard(() => {
        const doc = session.doc;
        if (!doc.nodes.length) return fail('図が空です。');
        const findings = filterBy(analyzeSecurity(doc).findings, minSeverity);
        if (!findings.length) return ok({ annotated: 0, note: `${minSeverity} 以上の指摘はありませんでした。` });
        session.commit(annotate(doc, findings, markTargets));
        return ok({
          annotated: findings.length,
          note: '図の右側にレビュー枠を追加しました。取り消す場合は undo を呼んでください。',
        });
      }),
  );
};
