/* ============================================================
   确定性计算引擎
   ------------------------------------------------------------
   这是「可信 AI」的落点：所有排放量都在这里用纯函数算出，
   大模型只负责抽取字段与解释结论，不参与任何算术。

   · 输入校验与计算分离，便于单测
   · 每个结果保留 activityId / factorId，报告可逐项回放
   ============================================================ */

import { getFactor, type EmissionFactor } from './factors';

export interface ActivityRow {
  /** 行 id，前端用来增删与 key */
  rowId: string;
  /** 因子 id，对应 FACTORS */
  factorId: string;
  /** 活动数据（用电量、用气量、里程等） */
  amount: number;
}

export interface CalcResult {
  rowId: string;
  factor: EmissionFactor;
  amount: number;
  /** kgCO2e */
  emission: number;
  /** 计算式，用于报告展示 */
  formula: string;
  error?: string;
}

/** 数值合法性与量级保护：拒绝负数、NaN、超大值（>1e9） */
export function validateAmount(amount: number): string | null {
  if (!Number.isFinite(amount)) return '请输入有效数字';
  if (amount < 0) return '活动数据不能为负数';
  if (amount > 1e9) return '数值超出合理范围，请检查单位';
  return null;
}

/** 单行计算：amount × factor，四舍五入到 0.01 kg */
export function calcRow(row: ActivityRow): CalcResult | null {
  const factor = getFactor(row.factorId);
  if (!factor) return null;

  const err = validateAmount(row.amount);
  const emission = err ? 0 : Math.round(row.amount * factor.factor * 100) / 100;

  return {
    rowId: row.rowId,
    factor,
    amount: row.amount,
    emission,
    formula: `${row.amount} ${factor.unit} × ${factor.factor} kgCO₂e/${factor.unit} = ${emission} kgCO₂e`,
    error: err ?? undefined
  };
}

/** 批量计算 */
export function calcAll(rows: ActivityRow[]): CalcResult[] {
  return rows.map(calcRow).filter((r): r is CalcResult => r !== null);
}

/** 汇总：返回 kg 与 t（吨），保留 3 位小数 */
export function summarize(results: CalcResult[]) {
  const kg = results.reduce((sum, r) => sum + (r.error ? 0 : r.emission), 0);
  return {
    kg: Math.round(kg * 100) / 100,
    ton: Math.round((kg / 1000) * 1000) / 1000
  };
}

/** 折算树木：一株成年树年固碳约 18 kgCO2e（演示口径） */
export const TREE_KG_PER_YEAR = 18;

export function treesEquivalent(kg: number): number {
  return Math.max(0, Math.round((kg / TREE_KG_PER_YEAR) * 10) / 10);
}
