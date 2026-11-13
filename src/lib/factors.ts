/* ============================================================
   排放因子库（演示口径）
   ------------------------------------------------------------
   设计原则：
   1. 每条因子都是一个自洽的结构体，包含值、单位、边界、出处；
      界面与接口只消费该结构，不硬编码数字，避免口径分裂。
   2. source 字段是「可审计」的关键：任何展示给用户的数字都能追到出处。
   3. 演示取值参考公开资料，正式盘查必须替换为企业所在行业/
      地区、对应年度的官方因子，并在报告中注明版本。
   ============================================================ */

export type FactorCategory = 'energy' | 'fuel' | 'transport';

export interface FactorSource {
  /** 发布机构 */
  org: string;
  /** 文件或数据集名称 */
  doc: string;
  /** 年份（因子适用年度） */
  year: number;
  /** 官方链接，便于复核 */
  url?: string;
}

export interface EmissionFactor {
  id: string;
  name: string;
  category: FactorCategory;
  /** 活动数据单位 */
  unit: string;
  /** 排放因子：kgCO2e / unit */
  factor: number;
  /** 适用边界说明 */
  boundary: string;
  /** 关键词，用于检索与模糊匹配 */
  aliases: string[];
  source: FactorSource;
}

export const FACTORS: EmissionFactor[] = [
  {
    id: 'elec',
    name: '电力消耗',
    category: 'energy',
    unit: 'kWh',
    factor: 0.581,
    boundary: '外购电力，按全国电网平均排放因子折算（范围二）',
    aliases: ['电', '用电', '电费', '度数', 'kwh', '度电'],
    source: {
      org: '生态环境部',
      doc: '企业温室气体排放核算方法与报告指南（发电设施）· 全国电网平均排放因子',
      year: 2022
    }
  },
  {
    id: 'gas',
    name: '天然气',
    category: 'fuel',
    unit: 'm³',
    factor: 2.16,
    boundary: '天然气燃烧直接排放（范围一），按体积计量',
    aliases: ['天然气', '燃气', '煤气', 'm3'],
    source: {
      org: 'IPCC',
      doc: '2006 年国家温室气体清单指南（2019 修订版）· 固定源燃烧',
      year: 2019
    }
  },
  {
    id: 'gasoline',
    name: '汽油',
    category: 'fuel',
    unit: 'L',
    factor: 2.27,
    boundary: '车用汽油燃烧直接排放（范围一），按体积计量',
    aliases: ['汽油', '92号', '95号', '加油', '油票'],
    source: {
      org: 'UK DEFRA',
      doc: 'Greenhouse gas reporting: conversion factors · Fuel',
      year: 2023,
      url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting'
    }
  },
  {
    id: 'diesel',
    name: '柴油',
    category: 'fuel',
    unit: 'L',
    factor: 2.68,
    boundary: '车用/工程机械柴油燃烧直接排放（范围一）',
    aliases: ['柴油', '0号柴油', '发电机'],
    source: {
      org: 'UK DEFRA',
      doc: 'Greenhouse gas reporting: conversion factors · Fuel',
      year: 2023
    }
  },
  {
    id: 'coal',
    name: '原煤',
    category: 'fuel',
    unit: 'kg',
    factor: 2.46,
    boundary: '工业锅炉燃煤直接排放（范围一），按收到基质量计量',
    aliases: ['煤', '原煤', '燃煤', '锅炉'],
    source: {
      org: '生态环境部',
      doc: '企业温室气体排放核算方法与报告指南 · 化石燃料燃烧',
      year: 2022
    }
  },
  {
    id: 'flight_short',
    name: '短途飞行',
    category: 'transport',
    unit: '人·公里',
    factor: 0.255,
    boundary: '航程小于 3700 km 的经济舱客运（范围三，差旅）',
    aliases: ['飞机', '航班', '短途', '出差', '机票'],
    source: {
      org: 'UK DEFRA',
      doc: 'Greenhouse gas reporting: conversion factors · Business travel - air',
      year: 2023
    }
  },
  {
    id: 'flight_long',
    name: '长途飞行',
    category: 'transport',
    unit: '人·公里',
    factor: 0.139,
    boundary: '航程大于 3700 km 的经济舱客运（范围三，差旅）',
    aliases: ['飞机', '航班', '长途', '国际', '机票'],
    source: {
      org: 'UK DEFRA',
      doc: 'Greenhouse gas reporting: conversion factors · Business travel - air',
      year: 2023
    }
  },
  {
    id: 'car',
    name: '汽油车出行',
    category: 'transport',
    unit: '公里',
    factor: 0.184,
    boundary: '乘用车平均载客下的里程排放（范围三，通勤/差旅）',
    aliases: ['汽车', '开车', '自驾', '里程', '公里'],
    source: {
      org: 'UK DEFRA',
      doc: 'Greenhouse gas reporting: conversion factors · Business travel - land',
      year: 2023
    }
  }
];

/** 按 id 取因子，供计算器与工具调用使用 */
export function getFactor(id: string): EmissionFactor | undefined {
  return FACTORS.find((f) => f.id === id);
}

/** 关键词检索：命中名称或别名即返回，按命中长度排序（越长越相关） */
export function searchFactors(query: string): EmissionFactor[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FACTORS.map((f) => {
    const hay = [f.name, ...f.aliases].map((s) => s.toLowerCase());
    const hit = hay.filter((h) => h.includes(q) || q.includes(h));
    const score = hit.reduce((m, h) => Math.max(m, h.length), 0);
    return { f, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
}
