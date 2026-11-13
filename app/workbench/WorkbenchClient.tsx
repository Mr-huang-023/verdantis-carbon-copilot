'use client';

import { useMemo, useRef, useState } from 'react';
import { FACTORS } from '@/src/lib/factors';
import { calcAll, summarize, treesEquivalent, type ActivityRow } from '@/src/lib/calc';
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

  const results = useMemo(() => calcAll(rows), [rows]);
  const total = useMemo(() => summarize(results), [results]);

  const update = (rowId: string, patch: Partial<ActivityRow>) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));

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
