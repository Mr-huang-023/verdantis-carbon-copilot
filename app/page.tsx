import Link from 'next/link';

/* 首页：定位为「产品落地页」，核心是把用户导流到碳盘查工作台。
   文案全部围绕一个可验证的能力链：上传票据 → 因子检索溯源 → 确定性计算 → 人工确认 → 导出报告。 */

const FLOW = [
  { n: '01', t: '票据抽取', d: '上传电费单、燃气单、油票截图，多模态模型抽取用量、单位与账期，字段缺失会显式标记而非猜测。' },
  { n: '02', t: '因子检索', d: '按活动类型检索排放因子库，每条结果返回因子值、单位、年份与发布机构，可点击查看出处。' },
  { n: '03', t: '确定性计算', d: '排放量由固定公式计算，大模型不参与算术。模型数值与计算结果冲突时以计算器为准。' },
  { n: '04', t: '人工确认', d: 'AI 建议以卡片形式进入待确认队列，必须由人逐条确认后才写入盘查报告，符合复核要求。' },
  { n: '05', t: '报告导出', d: '生成含活动数据、因子来源、计算过程与确认记录的盘查报告，可直接用于内部审计留档。' }
];

const FACTS = [
  { k: '因子条目', v: '8', u: '类活动' },
  { k: '计算链路', v: '0', u: '误差容差' },
  { k: '溯源粒度', v: '逐条', u: '到出处' }
];

export default function HomePage() {
  return (
    <>
      {/* ---------------- 首屏 ---------------- */}
      <section
        className="sec"
        style={{ minHeight: '92vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 140 }}
      >
        <p className="mono" data-fade style={{ '--d': '.2s' } as React.CSSProperties}>
          AI CARBON AUDIT · 面向中小企业
        </p>

        <h1
          data-fade
          style={{
            '--d': '.35s',
            marginTop: 22,
            fontFamily: 'var(--f-disp)',
            fontWeight: 400,
            fontSize: 'clamp(2.4rem, 6.4vw, 4.6rem)',
            lineHeight: 1.18,
            letterSpacing: '.05em',
            maxWidth: '18ch'
          } as React.CSSProperties}
        >
          让 AI 帮你算碳，
          <br />
          但<span className="hl">每一个数字都有出处</span>。
        </h1>

        <p
          data-fade
          className="sec-sub"
          style={{ '--d': '.5s', fontSize: '1.02rem', maxWidth: '56ch' } as React.CSSProperties}
        >
          绿境 · 碳智囊把票据识别、排放因子检索、排放量计算与报告编制串成一条可复核的链路：
          大模型负责理解与组织语言，计算与因子由确定性引擎给出，所有结论都能点开看到依据。
        </p>

        <div
          data-fade
          style={{ '--d': '.65s', display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 38 } as React.CSSProperties}
        >
          <Link className="btn btn-primary" href="/workbench">
            进入盘查工作台 →
          </Link>
          <Link className="btn btn-outline" href="/about#method">
            查看核算方法
          </Link>
        </div>

        <div
          data-fade
          style={{
            '--d': '.8s',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 18,
            marginTop: 72,
            maxWidth: 620
          } as React.CSSProperties}
        >
          {FACTS.map((f) => (
            <div key={f.k}>
              <div style={{ fontFamily: 'var(--f-en)', fontSize: '2.1rem', color: 'var(--g2)', lineHeight: 1 }}>
                {f.v}
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 8, letterSpacing: '.1em' }}>
                {f.k} · {f.u}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 能力链 ---------------- */}
      <section className="sec" id="flow">
        <p className="crumb">WORKFLOW / 五步可复核</p>
        <h2 className="sec-title" style={{ marginTop: 16 }}>
          从一张票据，到一份<span className="hl">能交差的报告</span>
        </h2>
        <p className="sec-sub">
          每一步都有明确的输入、输出与责任边界。AI 不做最终决策，只把重复劳动压缩到最短。
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
            marginTop: 44
          }}
        >
          {FLOW.map((s) => (
            <article className="card" key={s.n}>
              <span className="card-corner tl" aria-hidden="true" />
              <span className="card-corner br" aria-hidden="true" />
              <div className="mono" style={{ marginBottom: 14 }}>{s.n}</div>
              <h3 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.24rem', letterSpacing: '.08em' }}>
                {s.t}
              </h3>
              <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginTop: 12 }}>{s.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- 为什么可信 ---------------- */}
      <section className="sec">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 40,
            alignItems: 'center'
          }}
        >
          <div>
            <p className="crumb">WHY TRUSTWORTHY</p>
            <h2 className="sec-title" style={{ marginTop: 16 }}>
              算碳这件事，
              <br />
              <span className="hl">语言模型不该独自拍板</span>
            </h2>
            <p className="sec-sub">
              通用对话模型能流畅地编出一个排放数字，却给不出它来自哪一版因子表。
              我们把「理解」和「计算」拆开：模型只做抽取、解释与规划，数值一律走确定性计算器，
              并在界面上显式标注数据来源、因子版本与确认人。
            </p>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {[
              ['算术不交给模型', '所有排放量 = 活动数据 × 因子，由纯函数计算并保留中间结果。'],
              ['因子可回溯', '每条因子带发布机构与年份，界面可展开查看引用出处。'],
              ['冲突以计算为准', '模型输出与计算器不一致时，界面提示并以计算器结果覆盖。'],
              ['人工确认留痕', '建议进入待确认队列，确认人与时间写入报告附录。']
            ].map(([t, d]) => (
              <div className="card" key={t} style={{ padding: 22 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 9, flexShrink: 0,
                      background: 'var(--g1)', boxShadow: '0 0 10px var(--g1)'
                    }}
                  />
                  <div>
                    <h3 style={{ fontSize: '.98rem', fontWeight: 400, letterSpacing: '.06em' }}>{t}</h3>
                    <p style={{ fontSize: '.84rem', color: 'var(--ink-2)', marginTop: 6 }}>{d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="sec" style={{ paddingBottom: 120 }}>
        <div
          className="card"
          style={{
            padding: 'clamp(32px, 6vw, 64px)',
            textAlign: 'center',
            background: 'linear-gradient(150deg, rgba(15,143,87,.22), rgba(5,18,12,.7))'
          }}
        >
          <h2 className="sec-title" style={{ fontSize: 'clamp(1.7rem, 3.6vw, 2.6rem)' }}>
            先用一份<span className="hl">真实电费单</span>试试
          </h2>
          <p className="sec-sub" style={{ margin: '14px auto 0' }}>
            不需要注册即可体验计算与溯源；上传票据的抽取能力需要配置模型密钥后开启。
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/workbench">开始盘查</Link>
            <Link className="btn btn-ghost" href="/contact">预约演示</Link>
          </div>
        </div>
      </section>
    </>
  );
}
