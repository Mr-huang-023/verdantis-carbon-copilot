'use client';

import { useRef, useState } from 'react';

/* AI 解读面板
   - 只把「计算结果」作为上下文发给服务端，不发送原始票据
   - 流式渲染，逐块追加，避免等待整段返回
   - 服务端未配置密钥时返回 503，这里降级为友好提示而不是报错 */

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const PRESETS = ['帮我解读这份排放结构', '有哪些明显的减排空间？', '这些因子的出处可靠吗？'];

export default function ChatPanel({ context }: { context: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setNotice('');
    setBusy(true);

    const history: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs([...history, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context })
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.message || 'AI 服务暂不可用，计算结果仍可正常使用。');
        setMsgs(history);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs([...history, { role: 'assistant', content: acc }]);
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      }
    } catch {
      setNotice('网络异常，请稍后重试。');
      setMsgs(history);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card"
      style={{ padding: 'clamp(20px, 3vw, 30px)', position: 'sticky', top: 96 }}
      aria-label="AI 解读"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.3rem', letterSpacing: '.08em' }}>
          AI 解读
        </h2>
        <span className="mono">STEP 03</span>
      </div>

      <p style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 8 }}>
        AI 只解释上方计算结果；因子数值与排放量均由计算器给出，模型不参与算术。
      </p>

      <div
        ref={listRef}
        style={{ marginTop: 16, maxHeight: 380, overflowY: 'auto', display: 'grid', gap: 12 }}
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'rgba(45,216,122,.05)',
                  color: 'var(--ink-2)',
                  fontSize: '.82rem'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ fontSize: '.86rem', lineHeight: 1.8 }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: '.64rem', letterSpacing: '.2em', color: m.role === 'user' ? 'var(--ink-3)' : 'var(--g1)', marginBottom: 4 }}>
              {m.role === 'user' ? 'YOU' : 'COPILOT'}
            </div>
            <div style={{ color: m.role === 'user' ? 'var(--ink-2)' : 'var(--ink)', whiteSpace: 'pre-wrap' }}>
              {m.content || (busy ? '…' : '')}
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <p role="status" style={{ marginTop: 12, fontSize: '.76rem', color: 'var(--gold)' }}>
          {notice}
        </p>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ marginTop: 16, display: 'flex', gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="就这份结果提问…"
          aria-label="向 AI 提问"
          maxLength={500}
          style={{
            flex: 1,
            padding: '11px 13px',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'rgba(4,18,11,.65)',
            color: 'var(--ink)',
            fontSize: '.85rem',
            outline: 'none'
          }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !input.trim()}>
          {busy ? '…' : '发送'}
        </button>
      </form>
    </section>
  );
}
