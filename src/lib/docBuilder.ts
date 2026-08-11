import type { DiagramDoc, DiagramNode, DiagramEdge, NodeKind, FlowKey, EdgeRouting } from '../types';
import { makeNode, type NodeOpts } from './nodeFactory';
import type { ImportedItem } from './iac/parse';

/** Small mutable builder used by sample + import to assemble a document. */
export class DocBuilder {
  nodes: DiagramNode[] = [];
  edges: DiagramEdge[] = [];
  private seq = 1;

  node(kind: NodeKind, catId: string | undefined, x: number, y: number, opts: NodeOpts = {}, center = false): DiagramNode {
    const id = 'n' + this.seq++;
    const n = makeNode(id, kind, catId, Math.round(x), Math.round(y), opts, center);
    this.nodes.push(n);
    return n;
  }

  edge(from: string, to: string, opts: { flow?: FlowKey; label?: string; routing?: EdgeRouting; arrow?: boolean } = {}): void {
    this.edges.push({
      id: 'n' + this.seq++,
      from,
      to,
      label: opts.label ?? '',
      flow: opts.flow ?? 'default',
      routing: opts.routing ?? 'orthogonal',
      arrow: opts.arrow !== false,
    });
  }

  doc(): DiagramDoc {
    return { nodes: this.nodes, edges: this.edges, seq: this.seq };
  }
}

/** Reference-style MLOps sample diagram. */
export function buildSample(): DiagramDoc {
  const b = new DocBuilder();
  const add = (k: NodeKind, c: string | undefined, x: number, y: number, o?: NodeOpts) => b.node(k, c, x, y, o);

  add('group', 'aws_cloud', 60, 120, { w: 1180, h: 760, label: 'AWS Cloud (ap-northeast-1)', subtitle: '' });

  const user = add('shape', 'user', -140, 300, { label: 'User' });
  const inet = add('shape', 'internet', -40, 300, { label: 'Internet' });
  const gh = add('shape', 'github', 560, -40, { label: 'GitHub Actions (CI/CD)' });
  add('shape', 'terraform', 680, -40, { label: 'Terraform' });
  const dev = add('shape', 'developer', 760, 930, { label: 'Developer' });

  add('group', 'section', 520, 40, { w: 340, h: 150, label: 'CI/CD：コードの変更をビルド・デプロイ', subtitle: '', color: '#E53935', fill: '#FFFFFF' });
  const iam = add('service', 'iam', 560, 90, { label: 'GitHub OIDC Role' });
  const ecr = add('service', 'ecr', 720, 90, { label: 'ECR (fluentbit)' });

  const cw = add('service', 'cloudwatch', 110, 180, { label: 'メトリクス/ログ監視' });
  add('service', 's3', 280, 180, { label: 'Assets' });
  add('service', 'igw', 180, 300, { label: 'Internet Gateway' });

  add('group', 'vpc', 95, 360, { w: 470, h: 470, label: 'VPC (10.0.0.0/16)' });
  add('group', 'public_subnet', 120, 410, { w: 420, h: 120, label: 'Public subnet' });
  const alb = add('service', 'elb', 150, 430, { label: 'ALB (:8080)' });
  add('service', 'natgw', 300, 430, { label: 'NAT Gateway' });
  add('group', 'private_subnet', 120, 545, { w: 420, h: 260, label: 'Private subnet' });
  add('shape', 'nextjs', 150, 575, { label: 'Web (Next.js)' });
  add('shape', 'go', 260, 575, { label: 'API (Go)' });
  const pred = add('service', 'ecs', 150, 690, { label: 'predict-api (ECS)' });
  const fb = add('shape', 'fluentbit', 300, 690, { label: 'Fluent Bit' });

  add('group', 'section', 600, 220, { w: 250, h: 250, label: '特徴量ストア', subtitle: '行動特徴量を保存・提供', color: '#8896A6', fill: '#FFFFFF' });
  const feat = add('service', 'dynamodb', 700, 300, { label: 'オンライン特徴量' });
  const featS3 = add('service', 's3', 700, 390, { label: 'オフライン特徴量' });

  add('group', 'section', 880, 220, { w: 230, h: 250, label: 'モデルレジストリ', subtitle: 'モデルとバージョン管理', color: '#8896A6', fill: '#FFFFFF' });
  const reg = add('service', 'dynamodb', 960, 300, { label: 'モデルバージョン' });
  const modelS3 = add('service', 's3', 960, 390, { label: 'モデルファイル' });

  add('group', 'section', 600, 540, { w: 520, h: 200, label: 'モデル訓練パイプライン', subtitle: '定期的に再訓練し予測サービスを更新', color: '#8896A6', fill: '#FFFFFF' });
  const ev = add('service', 'eventbridge', 630, 610, { label: 'EventBridge (cron)' });
  const sf = add('service', 'stepfunctions', 780, 610, { label: 'Step Functions' });
  const train = add('service', 'ecs', 930, 610, { label: 'train (ECS Fargate)' });

  add('group', 'section', 600, 760, { w: 520, h: 110, label: '学習データ・特徴量分析', subtitle: '収集・蓄積しSQLで分析', color: '#8896A6', fill: '#FFFFFF' });
  const glue = add('service', 'glue', 630, 800, { label: 'Glue Crawler' });
  const athena = add('service', 'athena', 900, 800, { label: 'Athena' });
  const outS3 = add('service', 's3', 1030, 800, { label: 'クエリ結果' });

  add('legend', undefined, 1290, 120, {});
  add('text', undefined, 540, 880, { text: 'uv run python src/train.py --ecs --cpu 2048 --memory 4096', fontSize: 12, boxed: false, w: 420, align: 'left' });

  b.edge(user.id, inet.id, { flow: 'default' });
  b.edge(inet.id, alb.id, { flow: 'inference', label: '/predict' });
  b.edge(alb.id, pred.id, { flow: 'inference' });
  b.edge(pred.id, feat.id, { flow: 'inference', label: '特徴量取得' });
  b.edge(gh.id, iam.id, { flow: 'cicd' });
  b.edge(iam.id, ecr.id, { flow: 'cicd', label: 'イメージ push' });
  b.edge(ev.id, sf.id, { flow: 'training', label: 'cron' });
  b.edge(sf.id, train.id, { flow: 'training', label: 'RunTask' });
  b.edge(train.id, modelS3.id, { flow: 'training', label: 'モデル保存' });
  b.edge(modelS3.id, reg.id, { flow: 'training', label: '登録' });
  b.edge(train.id, featS3.id, { flow: 'training', label: 'データ読込' });
  b.edge(train.id, pred.id, { flow: 'training', label: 'UpdateService' });
  b.edge(featS3.id, glue.id, { flow: 'analysis' });
  b.edge(glue.id, athena.id, { flow: 'analysis' });
  b.edge(athena.id, outS3.id, { flow: 'analysis', label: '結果出力' });
  b.edge(pred.id, fb.id, { flow: 'log' });
  b.edge(fb.id, cw.id, { flow: 'log' });
  b.edge(dev.id, train.id, { flow: 'default' });

  return b.doc();
}

/** Auto-layout imported IaC items into a fresh document (or appended). */
export function layoutImported(base: DiagramDoc, items: ImportedItem[]): DiagramDoc {
  const b = new DocBuilder();
  // seed builder seq beyond existing ids so appended items stay unique
  b.nodes = [...base.nodes];
  b.edges = [...base.edges];
  (b as unknown as { seq: number }).seq = base.seq;

  const groups = items.filter((i) => i.kind === 'group');
  const svcs = items.filter((i) => i.kind === 'service');
  const ox = 90;
  const oy = 90;
  const cols = Math.max(1, Math.ceil(Math.sqrt(svcs.length || 1)));
  const cellW = 118;
  const cellH = 96;
  const pad = 28;
  const hd = 44;
  const gridW = cols * cellW;
  const rows = Math.ceil((svcs.length || 1) / cols);
  const gridH = rows * cellH;
  const vpc = groups.find((g) => g.catId === 'vpc');
  const subnets = groups.filter((g) => g.catId === 'public_subnet' || g.catId === 'private_subnet');
  const others = groups.filter((g) => g !== vpc && !subnets.includes(g));

  const grid = (x0: number, y0: number) =>
    svcs.forEach((s, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      b.node('service', s.catId, x0 + c * cellW, y0 + r * cellH, { label: s.label });
    });

  if (vpc) {
    const w = Math.max(gridW + pad * 2, 360);
    const h = Math.max(gridH + pad * 2 + hd, 220);
    b.node('group', 'vpc', ox, oy, { w, h, label: vpc.label });
    let sy = oy + hd;
    subnets.forEach((s) => {
      const sh = Math.max(80, gridH / Math.max(1, subnets.length));
      b.node('group', s.catId, ox + 16, sy, { w: w - 32, h: sh, label: s.label });
      sy += Math.max(90, gridH / Math.max(1, subnets.length)) + 8;
    });
    grid(ox + pad, oy + hd + 6);
  } else {
    let sy = oy;
    subnets.forEach((s) => {
      b.node('group', s.catId, ox, sy, { w: gridW + pad * 2 || 320, h: 130, label: s.label });
      sy += 150;
    });
    grid(ox, sy);
  }
  let gx = ox;
  const gy = oy + Math.max(gridH + pad * 2 + hd, 240) + 40;
  others.forEach((g) => {
    b.node('group', g.catId, gx, gy, { w: 220, h: 150, label: g.label });
    gx += 250;
  });

  return b.doc();
}
