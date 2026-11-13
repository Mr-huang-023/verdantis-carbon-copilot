'use client';

import { useMemo, useRef, useState } from 'react';
import { FACTORS } from '@/src/lib/factors';
import { calcAll, summarize, treesEquivalent, type ActivityRow } from '@/src/lib/calc';
import { toCsv, type ExtractIssue, type ExtractedItem } from '@/src/lib/agent';
import ChatPanel from './ChatPanel';

/* 工作台：左侧录入活动数据并实时计算，右侧是 AI 解读。
   计算完全在前端完成（纯函数），因此断网也能用；
   AI 只读取计算结果做解释，不参与算数。 */

export default function WorkbenchClient() {
  /* 行号计数器放在组件实例内：
     1. 不用模块级变量——'use client' 组件也会 SSR 预渲染，
        模块级 seq 会被服务端多个请求共享，与客户端水合结果不一致；
     2. useRef 每个实例独立，SSR 与客户端首次渲染都得到相同的 rowId。 */
  const seqRef = useRef(0);
  const newRow = (factorId: string): ActivityRow => ({
    rowId: `r${++seqRef.current}`,
    factorId,
    amount: 0
  });

  /* 惰性初始化：只在首次渲染执行一次。
     直接写 useState([newRow(...)]) 会让 newRow 在每次渲染都被调用（结果被丢弃），
     计数器空转且违反渲染纯函数约束。 */
  const [rows, setRows] = useState<ActivityRow[]>(() => [newRow('elec')]);
  const [expanded, setExpanded] = useState<string | null>(null);

  /* ---- Agent 抽取 ---- */
  const [note, setNote] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [agentMsg, setAgentMsg] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [issues, setIssues] = useState<ExtractIssue[]>([]);
  /* 模型给出的原文依据：只作用于"待人工核对"，不参与计算 */
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  /* 人工确认留痕：确认过的行才会在导出记录里标为"已确认" */
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const results = useMemo(() => calcAll(rows), [rows]);
  const total = useMemo(() => summarize(results), [results]);

  const update = (rowId: string, patch: Partial<ActivityRow>) => {
    /* 换因子后，原来那条原文依据就对不上了，直接清掉避免误导核对 */
    if (patch.factorId) {
      setEvidence((prev) => {
        if (!(rowId in prev)) return prev;
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  /* 抽取：服务端只返回通过校验的条目，这里只负责并入表格 */
  async function runExtract() {
    if (!note.trim() || extracting) return;
    setExtracting(true);
    setAgentMsg(null);
    setIssues([]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: note })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setAgentMsg({ tone: 'warn', text: data?.message ?? '抽取服务暂时不可用，请手动录入。' });
        return;
      }

      const items: ExtractedItem[] = Array.isArray(data?.items) ? data.items : [];
      const bad: ExtractIssue[] = Array.isArray(data?.issues) ? data.issues : [];
      setIssues(bad);

      if (!items.length) {
        setAgentMsg({ tone: 'warn', text: '没有识别出可用的活动数据，请补充数量后再试，或手动录入。' });
        return;
      }

      /* 表格里只有默认空行时直接替换，否则追加，避免覆盖用户已录入的内容 */
      const onlyEmptyRow = rows.every((r) => r.amount === 0);
      const created = items.map((it) => ({
        row: { rowId: `r${++seqRef.current}`, factorId: it.factorId, amount: it.amount },
        evidence: it.evidence
      }));

      setRows((prev) => (onlyEmptyRow ? created.map((c) => c.row) : [...prev, ...created.map((c) => c.row)]));
      setEvidence((prev) => {
        const next = { ...prev };
        for (const c of created) next[c.row.rowId] = c.evidence;
        return next;
      });
      setAgentMsg({ tone: 'ok', text: `已抽取 ${items.length} 条活动数据，请逐条核对用量与因子后再确认。` });
      setNote('');
    } catch {
      setAgentMsg({ tone: 'err', text: '网络异常，抽取失败；你仍可手动录入。' });
    } finally {
      setExtracting(false);
    }
  }

  /* 导出审计记录：CSV 带每行的因子出处与人工确认状态 */
  function exportCsv() {
    const csv = toCsv(results, confirmed, new Date().toLocaleString('zh-CN'));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '碳盘查审计记录.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const toneColor =
    agentMsg?.tone === 'ok' ? 'var(--g2)' : agentMsg?.tone === 'err' ? 'var(--danger)' : 'var(--gold)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, .85fr)',
        gap: 20,
        alignItems: 'start'
      }}
      className="workbench-grid"
    >
      {/* ---------------- 左：数据录入 + 结果 ---------------- */}
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Agent 第一步：把票据/用量描述抽成结构化条目（模型不参与计算） */}
        <section className="card" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.3rem', letterSpacing: '.08em' }}>
              智能录入
            </h2>
            <span className="mono">STEP 00</span>
          </div>

          <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.7 }}>
            粘贴电费单、加油票或用量描述，AI 只负责抽取「因子 + 用量 + 原文依据」。
            数值不会直接进结果，仍需你在下方核对后确认。
          </p>

          <textarea
            aria-label="票据或用量描述"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：10 月电费单显示用电 12800 度；公务车加 92 号汽油 260 升；北京往返出差机票 2 人次。"
            rows={3}
            maxLength={4000}
            style={{ ...inputStyle, marginTop: 14, resize: 'vertical', lineHeight: 1.7 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={runExtract}
              disabled={extracting || !note.trim()}
            >
              {extracting ? '抽取中…' : '让 AI 抽取活动数据'}
            </button>
            {agentMsg && (
              <p role="status" style={{ fontSize: '.78rem', color: toneColor, lineHeight: 1.6 }}>
                {agentMsg.text}
              </p>
            )}
          </div>

          {issues.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(240,200,116,.06)', border: '1px solid var(--line)' }}>
              <p style={{ fontSize: '.72rem', color: 'var(--gold)', letterSpacing: '.1em' }}>以下内容未能采用</p>
              <ul style={{ marginTop: 6, paddingLeft: 16, fontSize: '.74rem', color: 'var(--ink-2)', lineHeight: 1.8 }}>
                {issues.map((it, i) => (
                  <li key={i}>{it.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.3rem', letterSpacing: '.08em' }}>
              活动数据
            </h2>
            <span className="mono">STEP 01</span>
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            {rows.map((row) => {
              const f = FACTORS.find((x) => x.id === row.factorId);
              const r = results.find((x) => x.rowId === row.rowId);
              return (
                <div
                  key={row.rowId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--line)'
                  }}
                >
                  <select
                    aria-label="活动类型"
                    value={row.factorId}
                    onChange={(e) => update(row.rowId, { factorId: e.target.value, amount: 0 })}
                    style={inputStyle}
                  >
                    {FACTORS.map((x) => (
                      <option key={x.id} value={x.id} style={{ background: '#0a2418' }}>
                        {x.name}（{x.unit}）
                      </option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      aria-label={`${f?.name ?? ''}用量`}
                      value={row.amount === 0 ? '' : row.amount}
                      placeholder="0"
                      onChange={(e) => update(row.rowId, { amount: Number(e.target.value) })}
                      style={{ ...inputStyle, fontFamily: 'var(--f-mono)' }}
                    />
                    <span style={{ fontSize: '.76rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{f?.unit}</span>
                  </div>

                  <button
                    type="button"
                    aria-label={`删除${f?.name ?? ''}这一行`}
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.rowId !== row.rowId) : prev))}
                    style={{ color: 'var(--ink-3)', fontSize: '1.1rem', padding: '4px 8px' }}
                  >
                    ×
                  </button>

                  {r?.error && (
                    <p role="alert" style={{ gridColumn: '1 / -1', color: 'var(--danger)', fontSize: '.76rem' }}>
                      {r.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 18 }}
            onClick={() => setRows((prev) => [...prev, newRow('gas')])}
          >
            + 添加一项活动
          </button>
        </section>

        {/* 结果：每一项都能展开查看因子出处 */}
        <section className="card" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.3rem', letterSpacing: '.08em' }}>
              计算结果
            </h2>
            <span className="mono">STEP 02</span>
          </div>

          <div style={{ marginTop: 18 }}>
            {results.map((r) => (
              <div key={r.rowId} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontSize: '.92rem' }}>{r.factor.name}</div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 4 }}>
                      {r.amount} {r.factor.unit} × {r.factor.factor}
                    </div>
                    {evidence[r.rowId] && (
                      <div style={{ fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 2 }}>原文依据：{evidence[r.rowId]}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--f-en)', fontSize: '1.1rem', color: 'var(--g2)' }}>
                      {r.error ? '—' : r.emission.toFixed(2)} <span style={{ fontSize: '.7rem' }}>kgCO₂e</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === r.rowId ? null : r.rowId)}
                      aria-expanded={expanded === r.rowId}
                      style={{ fontFamily: 'var(--f-mono)', fontSize: '.66rem', letterSpacing: '.14em', color: 'var(--ink-3)', marginTop: 4, textDecoration: 'underline' }}
                    >
                      {expanded === r.rowId ? '收起出处' : '查看因子出处'}
                    </button>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 6,
                        marginTop: 6,
                        fontSize: '.68rem',
                        color: confirmed.has(r.rowId) ? 'var(--g2)' : 'var(--ink-3)',
                        cursor: r.error ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={confirmed.has(r.rowId)}
                        disabled={!!r.error}
                        onChange={(e) =>
                          setConfirmed((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r.rowId);
                            else next.delete(r.rowId);
                            return next;
                          })
                        }
                      />
                      人工确认
                    </label>
                  </div>
                </div>

                {expanded === r.rowId && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      borderRadius: 10,
                      background: 'rgba(45,216,122,.05)',
                      border: '1px solid var(--line)',
                      fontSize: '.78rem',
                      color: 'var(--ink-2)'
                    }}
                  >
                    <p><strong style={{ color: 'var(--g2)' }}>因子来源：</strong>{r.factor.source.org} · {r.factor.source.doc}（{r.factor.source.year}）</p>
                    <p style={{ marginTop: 6 }}><strong style={{ color: 'var(--g2)' }}>适用边界：</strong>{r.factor.boundary}</p>
                    <p style={{ marginTop: 6, fontFamily: 'var(--f-mono)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{r.formula}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 22,
              padding: '18px 20px',
              borderRadius: 14,
              background: 'linear-gradient(120deg, rgba(45,216,122,.12), rgba(81,216,200,.06))',
              border: '1px solid var(--line-strong)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: '.68rem', letterSpacing: '.24em', color: 'var(--ink-2)' }}>
                TOTAL EMISSION
              </span>
              <span style={{ fontFamily: 'var(--f-en)', fontSize: '1.9rem', color: 'var(--g2)', lineHeight: 1 }}>
                {total.ton.toFixed(3)} <span style={{ fontSize: '.8rem' }}>tCO₂e</span>
              </span>
            </div>
            <p style={{ fontSize: '.76rem', color: 'var(--ink-3)', marginTop: 8 }}>
              约等于 {treesEquivalent(total.kg)} 株成年树一年的固碳量（按 18 kgCO₂e/株·年折算）
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: '.66rem', letterSpacing: '.14em', color: 'var(--ink-3)' }}>
                人工确认 {confirmed.size} / {results.filter((r) => !r.error).length}
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv}>
                导出审计记录 CSV
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ---------------- 右：AI 解读 ---------------- */}
      <ChatPanel
        context={`当前计算结果：${results
          .filter((r) => !r.error)
          .map((r) => `${r.factor.name} ${r.amount}${r.factor.unit}（排放 ${r.emission} kgCO₂e，因子 ${r.factor.factor} kgCO₂e/${r.factor.unit}，来源 ${r.factor.source.org} ${r.factor.source.year}）`)
          .join('；') || '尚未录入有效数据'}；合计 ${total.kg} kgCO₂e。`}
      />

      {/* 小屏改为单列，AI 面板自然落到下方 */}
      <style>{`
        @media (max-width: 960px) {
          .workbench-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'rgba(4, 18, 11, .65)',
  color: 'var(--ink)',
  fontSize: '.86rem',
  outline: 'none'
};
