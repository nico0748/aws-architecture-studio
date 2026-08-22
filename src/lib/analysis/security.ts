/**
 * 構成図からセキュリティ・可用性の懸念を洗い出す。
 *
 * ここで見ているのは図に描かれた要素とその位置関係だけで、実際の AWS の設定
 * （セキュリティグループの規則、暗号化の有無、IAM ポリシーの中身）は分からない。
 * したがって出力は「実際の設定を確認すべき箇所」であって、断定的な脆弱性報告では
 * ない。各 finding はなぜそう判断したかを detail に持たせている。
 */
import type { DiagramDoc, DiagramNode } from '../../types';
import { ancestorsOf, descendantsOf, isInside } from '../doc/containment';

export type Severity = 'high' | 'medium' | 'low' | 'info';

/** Well-Architected のどの柱に紐づく指摘か。 */
export type Pillar = 'security' | 'reliability' | 'operational-excellence';

export interface Finding {
  /** 安定した識別子。再実行しても同じ問題には同じ値がつく。 */
  rule: string;
  severity: Severity;
  pillar: Pillar;
  title: string;
  /** 図の何を見てそう判断したか。 */
  detail: string;
  recommendation: string;
  nodeIds: string[];
  edgeIds?: string[];
}

export interface AnalysisResult {
  findings: Finding[];
  summary: Record<Severity, number> & { total: number };
  rulesEvaluated: number;
  caveat: string;
}

export const CAVEAT =
  '構成図に描かれた要素と位置関係のみに基づく推定です。実際のセキュリティグループ規則・暗号化設定・IAM ポリシーは図からは判断できないため、各項目は「実環境を確認すべき箇所」として扱ってください。';

// ===== サービスの分類 =====

/** VPC のプライベート側に置くのが定石のデータストア。 */
const PRIVATE_DATASTORES = new Set([
  'rds', 'aurora', 'elasticache', 'redshift', 'neptune', 'documentdb', 'memorydb', 'opensearch', 'msk', 'emr', 'efs',
]);

const COMPUTE = new Set([
  'ec2', 'ecs', 'eks', 'fargate', 'lambda', 'batch', 'beanstalk', 'apprunner', 'lightsail', 'autoscaling', 'sagemaker',
]);

/** インターネットからの受け口として正当なサービス。 */
const INGRESS = new Set(['cloudfront', 'elb', 'apigateway', 'globalaccelerator', 'appsync', 'amplify', 'route53', 'igw']);

const OBJECT_STORAGE = new Set(['s3', 'efs', 'glacier']);

/** VPC 内に置かれる前提のサービス。図で VPC の外にあると描き漏れの可能性がある。 */
const VPC_BOUND = new Set([
  'ec2', 'ecs', 'eks', 'fargate', 'rds', 'aurora', 'elasticache', 'redshift', 'neptune', 'documentdb',
  'memorydb', 'efs', 'emr', 'msk', 'opensearch', 'natgw', 'elb',
]);

/** 外部の人・ネットワークを表す shape。 */
const EXTERNAL_ACTORS = new Set(['internet', 'user', 'users', 'client', 'mobile']);

/** 運用者を表す shape。 */
const OPERATOR_ACTORS = new Set(['developer', 'admin']);

// ラベルに紛れ込みやすい機密情報のパターン。
const SECRET_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: 'AWS アクセスキー ID' },
  { re: /\bASIA[0-9A-Z]{16}\b/, what: 'AWS 一時アクセスキー ID' },
  { re: /\b\d{12}\b/, what: 'AWS アカウント ID とみられる 12 桁の数字' },
  { re: /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S+/i, what: '認証情報らしき key=value' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, what: '秘密鍵' },
];

// ===== 補助 =====

interface Ctx {
  doc: DiagramDoc;
  services: DiagramNode[];
  shapes: DiagramNode[];
  groups: DiagramNode[];
  /** catId → そのサービスのノード。 */
  byCat: Map<string, DiagramNode[]>;
  has: (catId: string) => boolean;
  labelOf: (id: string) => string;
}

function buildCtx(doc: DiagramDoc): Ctx {
  const services = doc.nodes.filter((n) => n.kind === 'service');
  const shapes = doc.nodes.filter((n) => n.kind === 'shape');
  const groups = doc.nodes.filter((n) => n.kind === 'group');
  const byCat = new Map<string, DiagramNode[]>();
  doc.nodes.forEach((n) => {
    if (!n.catId) return;
    const list = byCat.get(n.catId) ?? [];
    list.push(n);
    byCat.set(n.catId, list);
  });
  const labels = new Map(doc.nodes.map((n) => [n.id, n.label ?? n.title ?? n.catId ?? n.id]));
  return {
    doc,
    services,
    shapes,
    groups,
    byCat,
    has: (catId) => (byCat.get(catId)?.length ?? 0) > 0,
    labelOf: (id) => labels.get(id) ?? id,
  };
}

const names = (ctx: Ctx, nodes: DiagramNode[]) => nodes.map((n) => ctx.labelOf(n.id)).join('、');

/** 外部アクターから到達できるノード id（エッジの向きは双方向として扱う）。 */
function reachableFromExternal(ctx: Ctx): Map<string, string[]> {
  const externals = ctx.shapes.filter((s) => s.catId && EXTERNAL_ACTORS.has(s.catId));
  const direct = new Map<string, string[]>();
  for (const e of ctx.doc.edges) {
    for (const ext of externals) {
      const other = e.from === ext.id ? e.to : e.to === ext.id ? e.from : null;
      if (!other) continue;
      const list = direct.get(other) ?? [];
      list.push(e.id);
      direct.set(other, list);
    }
  }
  return direct;
}

// ===== ルール =====

type Rule = (ctx: Ctx) => Finding[];

const RULES: Rule[] = [
  // データストアが Public Subnet に置かれている
  (ctx) => {
    const hit = ctx.services.filter(
      (n) => n.catId && PRIVATE_DATASTORES.has(n.catId) && isInside(ctx.doc, n, 'public_subnet'),
    );
    if (!hit.length) return [];
    return [{
      rule: 'datastore-in-public-subnet',
      severity: 'high',
      pillar: 'security',
      title: 'データストアが Public Subnet に配置されている',
      detail: `${names(ctx, hit)} が Public Subnet の枠内に描かれています。Public Subnet は Internet Gateway への経路を持つため、セキュリティグループの設定次第で外部から直接到達できます。`,
      recommendation: 'データストアは Private Subnet へ移し、アプリケーション層からのみ到達できるようセキュリティグループを絞ってください。',
      nodeIds: hit.map((n) => n.id),
    }];
  },

  // コンピュートが Public Subnet に直接置かれている
  (ctx) => {
    const hit = ctx.services.filter(
      (n) => n.catId && COMPUTE.has(n.catId) && isInside(ctx.doc, n, 'public_subnet'),
    );
    if (!hit.length) return [];
    return [{
      rule: 'compute-in-public-subnet',
      severity: 'medium',
      pillar: 'security',
      title: 'アプリケーション層が Public Subnet に配置されている',
      detail: `${names(ctx, hit)} が Public Subnet 内にあります。ロードバランサ以外のコンピュートリソースを公開サブネットに置くと、攻撃面が直接インターネットに晒されます。`,
      recommendation: 'アプリケーションは Private Subnet に置き、Public Subnet にはロードバランサと NAT Gateway のみを配置する構成を検討してください。',
      nodeIds: hit.map((n) => n.id),
    }];
  },

  // 外部からの受け口が公開エンドポイント以外に直結している
  (ctx) => {
    const direct = reachableFromExternal(ctx);
    const hit: DiagramNode[] = [];
    const edgeIds: string[] = [];
    for (const [nodeId, edges] of direct) {
      const n = ctx.doc.nodes.find((x) => x.id === nodeId);
      if (!n || n.kind !== 'service' || !n.catId) continue;
      if (INGRESS.has(n.catId)) continue;
      if (OBJECT_STORAGE.has(n.catId)) continue; // 別ルールで扱う
      hit.push(n);
      edgeIds.push(...edges);
    }
    if (!hit.length) return [];
    return [{
      rule: 'internet-to-internal-directly',
      severity: 'high',
      pillar: 'security',
      title: 'インターネットから内部リソースへ直接の経路が描かれている',
      detail: `${names(ctx, hit)} が外部アクターと直接つながっています。CloudFront / ALB / API Gateway といった受け口を挟まない経路は、認証・レート制限・WAF による検査を通りません。`,
      recommendation: '公開が必要ならロードバランサや API Gateway を前段に置き、そこで認証と WAF を適用してください。図の描き漏れであれば経路を修正してください。',
      nodeIds: hit.map((n) => n.id),
      edgeIds,
    }];
  },

  // ストレージがインターネットに直結
  (ctx) => {
    const direct = reachableFromExternal(ctx);
    const hit = ctx.services.filter((n) => n.catId && OBJECT_STORAGE.has(n.catId) && direct.has(n.id));
    if (!hit.length) return [];
    return [{
      rule: 'storage-exposed-to-internet',
      severity: 'medium',
      pillar: 'security',
      title: 'ストレージがインターネットから直接参照されている',
      detail: `${names(ctx, hit)} が外部アクターと直接つながっています。バケットを直接公開する構成は、意図しないオブジェクトまで露出させやすく、アクセスログも取りにくくなります。`,
      recommendation: 'CloudFront + Origin Access Control を挟み、バケット自体はパブリックアクセスをブロックしてください。',
      nodeIds: hit.map((n) => n.id),
    }];
  },

  // 公開エンドポイントの手前に WAF が無い
  (ctx) => {
    const entry = ctx.services.filter((n) => n.catId && ['cloudfront', 'elb', 'apigateway'].includes(n.catId));
    if (!entry.length || ctx.has('waf')) return [];
    return [{
      rule: 'no-waf-on-public-entrypoint',
      severity: 'medium',
      pillar: 'security',
      title: '公開エンドポイントに WAF が置かれていない',
      detail: `${names(ctx, entry)} が公開の入口になっていますが、図に WAF がありません。SQL インジェクションや L7 の大量リクエストが素通りします。`,
      recommendation: 'AWS WAF を CloudFront / ALB / API Gateway に関連付け、マネージドルールとレート制限を有効にしてください。',
      nodeIds: entry.map((n) => n.id),
    }];
  },

  // 公開エンドポイントがあるのに認証の要素が無い
  (ctx) => {
    const entry = ctx.services.filter((n) => n.catId && ['elb', 'apigateway', 'appsync', 'cloudfront'].includes(n.catId));
    if (!entry.length || ctx.has('cognito') || ctx.has('iam')) return [];
    return [{
      rule: 'no-identity-control',
      severity: 'medium',
      pillar: 'security',
      title: '認証・認可の要素が図に現れていない',
      detail: '公開エンドポイントがある一方で、Cognito や IAM といった認証・認可を担う要素が図にありません。',
      recommendation: '誰がどの経路でアクセスできるのかを図に表現し、認証が不要な経路が残っていないか確認してください。',
      nodeIds: entry.map((n) => n.id),
    }];
  },

  // 監査ログが無い
  (ctx) => {
    if (ctx.has('cloudtrail')) return [];
    return [{
      rule: 'no-audit-trail',
      severity: 'medium',
      pillar: 'security',
      title: 'API 監査ログ (CloudTrail) が図に無い',
      detail: '図に CloudTrail がありません。誰がいつどの API を呼んだかの記録が無いと、インシデント発生時に追跡できません。',
      recommendation: '全リージョンで CloudTrail を有効にし、証跡を専用アカウントの S3 バケットへ集約してください。',
      nodeIds: [],
    }];
  },

  // 監視・メトリクスが無い
  (ctx) => {
    if (ctx.has('cloudwatch') || ctx.has('xray')) return [];
    return [{
      rule: 'no-monitoring',
      severity: 'low',
      pillar: 'operational-excellence',
      title: '監視・ログ集約の要素が図に無い',
      detail: '図に CloudWatch や X-Ray がありません。異常検知とトラブルシュートの経路が設計されていない可能性があります。',
      recommendation: 'メトリクスとログの集約先、アラームの通知先を図に明示してください。',
      nodeIds: [],
    }];
  },

  // 脅威検知が無い
  (ctx) => {
    if (ctx.has('guardduty') || ctx.has('inspector')) return [];
    return [{
      rule: 'no-threat-detection',
      severity: 'low',
      pillar: 'security',
      title: '脅威検知サービスが図に無い',
      detail: '図に GuardDuty や Inspector がありません。不審な API 呼び出しや既知の脆弱性を持つワークロードの検知手段が見当たりません。',
      recommendation: 'GuardDuty を有効にし、検出結果の通知先を決めてください。',
      nodeIds: [],
    }];
  },

  // 鍵・シークレット管理が無い
  (ctx) => {
    const stores = ctx.services.filter((n) => n.catId && (PRIVATE_DATASTORES.has(n.catId) || OBJECT_STORAGE.has(n.catId)));
    if (!stores.length || ctx.has('kms') || ctx.has('secretsmanager')) return [];
    return [{
      rule: 'no-key-management',
      severity: 'low',
      pillar: 'security',
      title: '鍵・シークレット管理の要素が図に無い',
      detail: `${names(ctx, stores)} を保持している一方で、KMS や Secrets Manager が図にありません。保管時の暗号化と接続情報の管理方法が読み取れません。`,
      recommendation: '保存データの暗号化に使う鍵と、DB 接続情報の保管先を図に含めてください。',
      nodeIds: stores.map((n) => n.id),
    }];
  },

  // VPC 前提のサービスが VPC の外に描かれている
  (ctx) => {
    if (!ctx.has('vpc')) return [];
    const hit = ctx.services.filter(
      (n) => n.catId && VPC_BOUND.has(n.catId) && !isInside(ctx.doc, n, 'vpc'),
    );
    if (!hit.length) return [];
    return [{
      rule: 'resource-outside-vpc',
      severity: 'info',
      pillar: 'security',
      title: 'VPC の外に描かれているリソースがある',
      detail: `${names(ctx, hit)} は通常 VPC 内に置かれるサービスですが、図では VPC の枠外にあります。`,
      recommendation: '図の描き漏れであれば枠内へ移動してください。意図的に VPC 外へ置いている場合は、その経路の保護方法を確認してください。',
      nodeIds: hit.map((n) => n.id),
    }];
  },

  // Private Subnet があるのに外向き経路が無い
  (ctx) => {
    if (!ctx.has('private_subnet')) return [];
    if (ctx.has('natgw') || ctx.has('vpcendpoint') || ctx.has('privatelink')) return [];
    const subnets = ctx.byCat.get('private_subnet') ?? [];
    return [{
      rule: 'private-subnet-without-egress',
      severity: 'low',
      pillar: 'reliability',
      title: 'Private Subnet の外向き経路が図に無い',
      detail: 'Private Subnet がありますが、NAT Gateway も VPC エンドポイントも描かれていません。パッチ取得や AWS API の呼び出し経路が不明です。',
      recommendation: 'AWS サービスへは VPC エンドポイント、インターネットへは NAT Gateway と、必要な経路を明示してください。',
      nodeIds: subnets.map((n) => n.id),
    }];
  },

  // 単一 AZ
  (ctx) => {
    if (!ctx.has('vpc')) return [];
    const azs = ctx.byCat.get('az') ?? [];
    if (azs.length >= 2) return [];
    return [{
      rule: 'single-az',
      severity: 'medium',
      pillar: 'reliability',
      title: 'アベイラビリティゾーンが 1 つ以下しか描かれていない',
      detail: `VPC はありますが、AZ の枠が ${azs.length} 個です。単一 AZ 構成であれば、その AZ の障害でサービス全体が停止します。`,
      recommendation: '2 つ以上の AZ にサブネットとリソースを分散し、図にも AZ の境界を表現してください。',
      nodeIds: azs.map((n) => n.id),
    }];
  },

  // 運用者が内部リソースへ直接つながっている
  (ctx) => {
    const operators = ctx.shapes.filter((s) => s.catId && OPERATOR_ACTORS.has(s.catId));
    if (!operators.length || ctx.has('ssm')) return [];
    const opIds = new Set(operators.map((o) => o.id));
    const hit: DiagramNode[] = [];
    const edgeIds: string[] = [];
    for (const e of ctx.doc.edges) {
      const other = opIds.has(e.from) ? e.to : opIds.has(e.to) ? e.from : null;
      if (!other) continue;
      const n = ctx.doc.nodes.find((x) => x.id === other);
      if (!n || n.kind !== 'service' || !n.catId) continue;
      if (!COMPUTE.has(n.catId) && !PRIVATE_DATASTORES.has(n.catId)) continue;
      hit.push(n);
      edgeIds.push(e.id);
    }
    if (!hit.length) return [];
    return [{
      rule: 'operator-direct-access',
      severity: 'low',
      pillar: 'security',
      title: '運用者が内部リソースへ直接接続している',
      detail: `${names(ctx, hit)} へ運用者から直接の経路があります。踏み台や Session Manager を経由しない接続は、記録が残らず経路の管理も難しくなります。`,
      recommendation: 'Systems Manager Session Manager 経由の接続に切り替え、SSH ポートの常時開放をやめてください。',
      nodeIds: hit.map((n) => n.id),
      edgeIds,
    }];
  },

  // Public Subnet があるのに Internet Gateway が無い
  (ctx) => {
    if (!ctx.has('public_subnet') || ctx.has('igw')) return [];
    const subnets = ctx.byCat.get('public_subnet') ?? [];
    return [{
      rule: 'public-subnet-without-igw',
      severity: 'info',
      pillar: 'reliability',
      title: 'Public Subnet があるのに Internet Gateway が描かれていない',
      detail: 'Public Subnet の枠はありますが、Internet Gateway が図にありません。実際には Public Subnet として機能していない可能性があります。',
      recommendation: 'ルートテーブルの向き先を確認し、図にも Internet Gateway を含めてください。',
      nodeIds: subnets.map((n) => n.id),
    }];
  },

  // 中身の無い Security Group 枠
  (ctx) => {
    const empty = (ctx.byCat.get('security_group') ?? []).filter((g) => descendantsOf(ctx.doc, g).length === 0);
    if (!empty.length) return [];
    return [{
      rule: 'empty-security-group',
      severity: 'info',
      pillar: 'security',
      title: '中身の無い Security Group の枠がある',
      detail: `${names(ctx, empty)} の枠内にリソースがありません。どのリソースにどの規則が適用されるのか図から読み取れません。`,
      recommendation: 'Security Group の枠に対象リソースを入れるか、不要な枠を削除してください。',
      nodeIds: empty.map((n) => n.id),
    }];
  },

  // ラベルやテキストに機密情報らしき文字列
  (ctx) => {
    const findings: Finding[] = [];
    const hit: { node: DiagramNode; what: string }[] = [];
    for (const n of ctx.doc.nodes) {
      const text = [n.label, n.subtitle, n.text, n.title].filter(Boolean).join(' ');
      if (!text) continue;
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(text)) {
          hit.push({ node: n, what: p.what });
          break;
        }
      }
    }
    if (hit.length) {
      findings.push({
        rule: 'secret-in-diagram-text',
        severity: 'high',
        pillar: 'security',
        title: '図のテキストに機密情報らしき文字列がある',
        detail: hit.map((h) => `${ctx.labelOf(h.node.id)}: ${h.what}`).join(' / ') + '。構成図は共有・添付されやすいため、記載された値はそのまま流出します。',
        recommendation: '該当箇所を伏せ字にし、値が実在するものであればローテーションしてください。',
        nodeIds: hit.map((h) => h.node.id),
      });
    }
    return findings;
  },

  // どこにも繋がっていないノード
  (ctx) => {
    const connected = new Set<string>();
    ctx.doc.edges.forEach((e) => {
      connected.add(e.from);
      connected.add(e.to);
    });
    const hit = [...ctx.services, ...ctx.shapes].filter((n) => !connected.has(n.id));
    if (!hit.length) return [];
    return [{
      rule: 'unconnected-node',
      severity: 'info',
      pillar: 'operational-excellence',
      title: 'どの経路にも繋がっていない要素がある',
      detail: `${names(ctx, hit)} に接続が 1 本もありません。通信経路が描かれていないため、この解析でも到達性を評価できていません。`,
      recommendation: '実際のデータフローを図に追加すると、経路まわりの指摘の精度が上がります。',
      nodeIds: hit.map((n) => n.id),
    }];
  },
];

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low', 'info'];

export function analyzeSecurity(doc: DiagramDoc): AnalysisResult {
  const ctx = buildCtx(doc);
  const findings = RULES.flatMap((rule) => rule(ctx)).sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const summary = { high: 0, medium: 0, low: 0, info: 0, total: findings.length };
  findings.forEach((f) => (summary[f.severity] += 1));

  return { findings, summary, rulesEvaluated: RULES.length, caveat: CAVEAT };
}

/** ノードがどの枠の中にあるかを "AWS Cloud > VPC > Private Subnet" の形で返す。 */
export function locationOf(doc: DiagramDoc, nodeId: string): string {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node) return '';
  const chain = ancestorsOf(doc, node).reverse();
  return chain.map((g) => g.label ?? g.catId ?? g.id).join(' > ');
}
