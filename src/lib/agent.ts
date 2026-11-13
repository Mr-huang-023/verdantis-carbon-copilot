/* ============================================================
   Agent 工作流的确定性部分
   ------------------------------------------------------------
   分工边界（这是本项目对外主张的核心）：
   · 大模型只负责「把票据/用量描述读成结构化条目」和「组织语言」；
   · 条目是否合法、因子是否存在于库中、排放量是多少，全部由本文件
     与 calc.ts 的纯函数判定；
   · 模型给错的 id、编造的因子、离谱的数值，一律在这里被拦下并记录，
     不会进入计算结果。
   这样即使模型产生幻觉，最终报告里的每个数字仍有出处、可回放。
   ============================================================ */

import { FACTORS, type EmissionFactor } from './factors';
import { type ActivityRow, type CalcResult, validateAmount } from './calc';

/** 模型抽取出的单条活动数据（已通过校验才会出现在 items 中） */
export interface ExtractedItem {
  factorId: string;
  amount: number;
  /** 原文依据，作为审计留痕 */
  evidence: string;
}

/** 被拦下的条目：保留原文与原因，便于用户核对，而不是悄悄丢弃 */
export interface ExtractIssue {
  raw: string;
  reason: string;
}

export interface ExtractionResult {
  items: ExtractedItem[];
  issues: ExtractIssue[];
}

/** 单次最多接受的条目数，防止模型输出过长或恶意构造 */
const MAX_ITEMS = 20;
const MAX_EVIDENCE = 120;

/**
 * 从模型返回的文本中取出 JSON。
 * 模型有时会包 ```json 代码块或加一句"以下是结果"，因此按优先级尝试：
 * 整体解析 → 取首个 {…} → 取首个 […]，三者都失败才判定为非 JSON。
 */
function pickJson(raw: string): unknown {
  const text = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  const candidates = [text];
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) candidates.push(text.slice(arrStart, arrEnd + 1));

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* 继续尝试下一种切法 */
    }
  }
  return null;
}

/**
 * 把模型给的因子标识解析成因子库里的真实因子。
 * 只做「确定性匹配」：id 完全相等 → 名称完全相等 → 别名完全相等。
 * 不做模糊猜测——模糊匹配会把"汽油"错配到"汽油车出行"，在碳盘查里属于严重错误。
 */
export function resolveFactor(raw: string): EmissionFactor | undefined {
  const key = raw.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();
  return (
    FACTORS.find((f) => f.id === lower) ??
    FACTORS.find((f) => f.name === key) ??
    FACTORS.find((f) => f.aliases.some((a) => a.toLowerCase() === lower))
  );
}

/** 从条目对象里取因子标识：兼容 factorId / id / factor / name 几种常见字段名 */
function readFactorKey(entry: Record<string, unknown>): string {
  for (const field of ['factorId', 'id', 'factor', 'name', 'type']) {
    const v = entry[field];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/** 从条目对象里取用量：兼容 amount / value / quantity，允许带千分位或单位的字符串 */
function readAmount(entry: Record<string, unknown>): number {
  for (const field of ['amount', 'value', 'quantity']) {
    const v = entry[field];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[,，\s]/g, '').replace(/[^\d.\-]/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return Number.NaN;
}

/**
 * 校验模型抽取结果。
 * 输入是模型原始文本，输出是「可安全计算的条目」+「被拦下的条目及原因」。
 * 任何一条不合格都不会导致整体失败，用户仍然能看到其余可用数据。
 */
export function parseExtraction(raw: string): ExtractionResult {
  const parsed = pickJson(raw);
  const items: ExtractedItem[] = [];
  const issues: ExtractIssue[] = [];

  if (parsed === null) {
    return { items, issues: [{ raw: raw.slice(0, MAX_EVIDENCE), reason: '模型未返回可解析的 JSON' }] };
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { items?: unknown }).items)
      ? ((parsed as { items: unknown[] }).items)
      : [];

  if (!list.length) {
    return { items, issues: [{ raw: '', reason: '未从描述中识别出任何活动数据' }] };
  }

  for (const entry of list.slice(0, MAX_ITEMS)) {
    if (typeof entry !== 'object' || entry === null) {
      issues.push({ raw: String(entry).slice(0, MAX_EVIDENCE), reason: '条目格式不是对象' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    const key = readFactorKey(obj);
    const factor = resolveFactor(key);
    const evidence =
      typeof obj.evidence === 'string' && obj.evidence.trim()
        ? obj.evidence.trim().slice(0, MAX_EVIDENCE)
        : '';

    if (!factor) {
      issues.push({ raw: JSON.stringify(obj).slice(0, MAX_EVIDENCE), reason: `因子库中不存在「${key || '未填写'}」` });
      continue;
    }

    const amount = readAmount(obj);
    const amountError = validateAmount(amount);
    if (amountError) {
      issues.push({
        raw: JSON.stringify(obj).slice(0, MAX_EVIDENCE),
        reason: `${factor.name}：${amountError}`
      });
      continue;
    }

    items.push({ factorId: factor.id, amount, evidence });
  }

  if (list.length > MAX_ITEMS) {
    issues.push({ raw: '', reason: `单次最多处理 ${MAX_ITEMS} 条，超出部分已忽略` });
  }

  return { items, issues };
}

/** 把抽取结果转成计算器可直接消费的行；rowId 由调用方保证唯一 */
export function itemsToRows(items: ExtractedItem[], nextRowId: () => string): ActivityRow[] {
  return items.map((it) => ({ rowId: nextRowId(), factorId: it.factorId, amount: it.amount }));
}

/* ---------------- 审计记录导出 ---------------- */

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 生成审计记录 CSV。
 * 每一行都带因子出处与计算式，人工确认状态单独成列——
 * 这是"可审计"在交付物上的体现：交给财务或第三方复核时，
 * 他们能逐行追到机构和年份，而不是只看到一个总数。
 */
export function toCsv(results: CalcResult[], confirmed: Set<string>, generatedAt: string): string {
  const header = [
    '活动类型',
    '活动数据',
    '数据单位',
    '排放因子',
    '因子单位',
    '排放量(kgCO2e)',
    '计算式',
    '因子发布机构',
    '出处文件',
    '适用年度',
    '适用边界',
    '人工确认'
  ];

  const lines = results.map((r) =>
    [
      r.factor.name,
      r.amount,
      r.factor.unit,
      r.factor.factor,
      `kgCO2e/${r.factor.unit}`,
      r.error ? '' : r.emission.toFixed(2),
      r.formula,
      r.factor.source.org,
      r.factor.source.doc,
      r.factor.source.year,
      r.factor.boundary,
      r.error ? `数据有误：${r.error}` : confirmed.has(r.rowId) ? '已确认' : '待确认'
    ]
      .map(csvCell)
      .join(',')
  );

  const total = results.reduce((sum, r) => sum + (r.error ? 0 : r.emission), 0);
  lines.push(['合计', '', '', '', '', (Math.round(total * 100) / 100).toFixed(2), '', '', '', '', '', ''].map(csvCell).join(','));

  /* 开头加 BOM，Excel 打开中文列名才不乱码 */
  return `\uFEFF${[header.join(','), ...lines, csvCell(`导出时间：${generatedAt}`)].join('\r\n')}\r\n`;
}
