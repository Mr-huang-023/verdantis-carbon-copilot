import { NextRequest } from 'next/server';
import { FACTORS } from '@/src/lib/factors';
import { parseExtraction } from '@/src/lib/agent';
import { createRateLimiter } from '@/src/lib/rate-limit';

/* ============================================================
   票据智能录入接口 /api/agent
   ------------------------------------------------------------
   这是 Agent 工作流的第一步：把「人话 / 票据文字」变成结构化活动数据。

   边界非常明确：
   · 模型只做抽取（文本 → {因子, 用量, 原文依据}），返回 JSON；
   · 抽取结果必须经过 parseExtraction 的确定性校验，
     因子不存在、数值非法、模型编造的条目会被拦下并附原因；
   · 排放量完全不在这里算，由前端的 calc.ts 纯函数完成，
     模型既没有机会也没有必要参与算术。

   安全：密钥仅服务端、按 IP 限流、入参截断、未配置密钥时 503 降级。
   ============================================================ */

export const runtime = 'nodejs';

const limited = createRateLimiter(10, 60_000);
const MAX_TEXT = 4000;

/** 因子清单写进提示词：模型只能从这份清单里选 id，不允许自己发明 */
const FACTOR_MENU = FACTORS.map(
  (f) => `- id=${f.id}｜${f.name}｜单位 ${f.unit}｜${f.boundary}`
).join('\n');

const SYSTEM = [
  '你是企业碳盘查的数据抽取器。任务：把用户给出的票据、账单或用量描述，拆成结构化活动数据条目。',
  '只做抽取，不做任何计算，也不要给出排放量。',
  '只能使用下列因子 id，禁止发明清单之外的因子：',
  FACTOR_MENU,
  '',
  '输出 JSON 对象，格式严格为：',
  '{"items":[{"factorId":"清单中的 id","amount":数字,"evidence":"原文中对应的片段"}]}',
  '',
  '规则：',
  '1. amount 必须是纯数字，不要带单位、千分位或文字；单位以清单为准。',
  '2. 描述里没有明确数量的条目不要输出。',
  '3. 同一因子出现多次时可合并求和，此时 evidence 写明合并依据。',
  '4. 无法归类的内容不要硬凑，宁可不输出。',
  '5. 只输出 JSON，不要任何解释性文字。'
].join('\n');

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) {
    return Response.json({ message: '请求过于频繁，请稍后再试。' }, { status: 429 });
  }

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return Response.json(
      { message: '尚未配置 DEEPSEEK_API_KEY，智能抽取暂不可用；你仍可手动添加活动数据，计算结果不受影响。' },
      { status: 503 }
    );
  }

  let payload: { text?: unknown };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ message: '请求格式错误' }, { status: 400 });
  }

  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) {
    return Response.json({ message: '请先粘贴票据或用量描述' }, { status: 400 });
  }

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      /* 抽取任务要稳定复现，温度设为 0，并强制 JSON 输出 */
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text }
      ]
    })
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    return Response.json({ message: '模型服务暂时不可用，请稍后重试。' }, { status: 502 });
  }

  const data = (await upstream.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[] }
    | null;

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return Response.json({ message: '模型未返回内容，请重试。' }, { status: 502 });
  }

  /* 校验在服务端完成：即使前端被绕过，非法条目也不会进入计算 */
  const { items, issues } = parseExtraction(content);

  return Response.json({ items, issues });
}
