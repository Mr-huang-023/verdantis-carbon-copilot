import { NextRequest } from 'next/server';
import { FACTORS, searchFactors } from '@/src/lib/factors';

/* ============================================================
   AI 对话接口 /api/chat
   ------------------------------------------------------------
   设计要点：
   1. 密钥只在服务端读取（DEEPSEEK_API_KEY），前端永远拿不到；
   2. 未配置密钥时返回 503 + 可读文案，页面降级而不是报错；
   3. 简易内存限流（按 IP 每分钟 10 次），演示足够，生产应换 Redis；
   4. 上下文注入采用「关键词检索因子」的轻量 RAG：
      命中的因子连同出处一起写进 system prompt，模型回答时可直接引用。
   ============================================================ */

export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
const LIMIT = 10;
const hits = new Map<string, { count: number; reset: number }>();
/* 上次全量清理时间：清理节流，避免每个请求都 O(n) 扫描整表 */
let lastSweep = 0;

function rateLimited(ip: string): boolean {
  const now = Date.now();

  /* 过期记录清理：每个窗口最多扫一次，防止只写不删导致内存无限增长。
     同一 IP 的记录即使没被扫到，也会在下方读取时按过期处理，不影响限流正确性。 */
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [k, v] of hits) {
      if (now > v.reset) hits.delete(k);
    }
  }

  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > LIMIT;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 把检索到的因子渲染成带出处的文本块，供模型引用 */
function buildFactorContext(query: string, calcContext: string): string {
  const matched = searchFactors(query).slice(0, 4);
  const list = (matched.length ? matched : FACTORS.slice(0, 4))
    .map(
      (f) =>
        `- ${f.name}（id=${f.id}）：${f.factor} kgCO₂e/${f.unit}；边界：${f.boundary}；出处：${f.source.org}《${f.source.doc}》${f.source.year}`
    )
    .join('\n');

  return `【可用排放因子（唯一可信数值来源）】\n${list}\n\n【用户当前计算结果】\n${calcContext}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (rateLimited(ip)) {
    return Response.json({ message: '请求过于频繁，请稍后再试。' }, { status: 429 });
  }

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return Response.json(
      { message: '尚未配置 DEEPSEEK_API_KEY，AI 解读暂不可用；上方计算结果不受影响。' },
      { status: 503 }
    );
  }

  let payload: { messages?: ChatMessage[]; context?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ message: '请求格式错误' }, { status: 400 });
  }

  const messages = (payload.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!messages.length) {
    return Response.json({ message: '缺少对话内容' }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const calcContext = (payload.context ?? '').slice(0, 2000);

  const system = [
    '你是绿境科技「碳智囊」的解读助手，服务对象是中小企业负责碳盘查的员工。',
    '规则：',
    '1. 不要做算术。所有排放量都以【用户当前计算结果】中的数值为准；如需引用，原样引用。',
    '2. 提到排放因子时，必须同时给出出处的机构与年份；没有出处的数值一律不编造。',
    '3. 回答控制在 200 字以内，先给结论，再给 1-2 条可执行建议。',
    '4. 不确定就直说需要补充哪些数据，不要猜测。',
    '',
    buildFactorContext(lastUser, calcContext)
  ].join('\n');

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      stream: true,
      temperature: 0.3,
      max_tokens: 700,
      messages: [{ role: 'system', content: system }, ...messages]
    })
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    return Response.json({ message: '模型服务暂时不可用，请稍后重试。' }, { status: 502 });
  }

  /* 把上游 SSE 转成纯文本流：只提取 delta.content，前端按块追加即可 */
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* 单行解析失败不影响后续流 */
            }
          }
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform'
    }
  });
}
