import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '产品与因子库',
  description: '碳智囊的三大能力模块：票据抽取、排放因子库与盘查报告，以及 8 类常用排放因子的口径说明。'
};

/* 产品页：把能力拆成三个可独立理解的模块，并公开因子口径。
   因子数据与 src/lib/factors.ts 保持一致，避免页面与计算逻辑口径分裂。 */

const MODULES = [
  {
    id: 'extract',
    name: '票据抽取',
    en: 'EXTRACTION',
    desc: '识别电费单、燃气单、加油票、差旅行程单中的活动数据。抽取结果以结构化字段返回，缺失或模糊字段标注为待补，不做猜测。',
    points: ['支持图片与 PDF 截图', '用量、单位、账期三要素校验', '低置信度字段进入人工补录']
  },
  {
    id: 'factor',
    name: '排放因子库',
    en: 'FACTOR LIBRARY',
    desc: '内置 8 类常用活动的排放因子，每条包含因子值、单位、适用边界、发布机构与年份。检索结果按相关度排序并附出处。',
    points: ['覆盖电、气、油、煤与差旅', '每条因子可展开查看出处', '因子更新时保留历史版本']
  },
  {
    id: 'report',
    name: '盘查报告',
    en: 'AUDIT REPORT',
    desc: '把活动数据、因子引用、计算中间结果与人工确认记录汇总为一份可留档的报告，支持导出与逐项复核。',
    points: ['计算过程可展开', '确认人与时间留痕', '默认导出 Markdown，可打印为 PDF']
  }
];

export default function ProductsPage() {
  return (
    <>
      <section className="sec" style={{ paddingTop: 150 }}>
        <p className="crumb"><Link href="/">首页</Link> / PRODUCTS</p>
        <h1 className="sec-title" style={{ marginTop: 18, fontSize: 'clamp(2.2rem, 5vw, 3.6rem)' }}>
          三个模块，
          <span className="hl">一条可复核的链路</span>
        </h1>
        <p className="sec-sub">
          每个模块都能单独使用，但组合起来才构成完整盘查：抽取提供活动数据，因子库提供计算依据，报告承载结论与责任。
        </p>

        <div style={{ display: 'grid', gap: 20, marginTop: 48 }}>
          {MODULES.map((m) => (
            <article className="card" id={m.id} key={m.id} style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
              <span className="card-corner tl" aria-hidden="true" />
              <span className="card-corner br" aria-hidden="true" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32 }}>
                <div>
                  <div className="mono">{m.en}</div>
                  <h2 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.7rem', letterSpacing: '.08em', marginTop: 10 }}>
                    {m.name}
                  </h2>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.92rem', marginTop: 14 }}>{m.desc}</p>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
                  {m.points.map((p) => (
                    <li key={p} style={{ display: 'flex', gap: 12, fontSize: '.88rem', color: 'var(--ink-2)' }}>
                      <span aria-hidden="true" style={{ color: 'var(--g1)' }}>▸</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 因子口径表：公开数据来源，是「可审计」的基础 */}
      <section className="sec" id="factors" style={{ paddingTop: 20 }}>
        <p className="crumb">FACTOR / 口径公开</p>
        <h2 className="sec-title" style={{ marginTop: 16 }}>8 类活动排放因子</h2>
        <p className="sec-sub">
          下表为演示用因子口径，取值参考公开的温室气体核算资料并在数据文件中标注来源。
          正式盘查应按企业所在行业与地区采用对应年度、对应边界的官方因子。
        </p>

        <div style={{ overflowX: 'auto', marginTop: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem', minWidth: 620 }}>
            <caption style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: '.78rem', paddingBottom: 12 }}>
              排放量 = 活动数据 × 因子；因子单位见「单位」列
            </caption>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line-strong)' }}>
                {['活动类型', '单位', '因子 (kgCO₂e/单位)', '适用边界'].map((h) => (
                  <th key={h} scope="col" style={{ textAlign: 'left', padding: '12px 14px', fontFamily: 'var(--f-mono)', fontSize: '.7rem', letterSpacing: '.16em', color: 'var(--g1)', fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['电力消耗', 'kWh', '0.581', '全国电网平均'],
                ['天然气', 'm³', '2.16', '燃烧排放'],
                ['汽油', 'L', '2.27', '车用汽油燃烧'],
                ['柴油', 'L', '2.68', '车用柴油燃烧'],
                ['原煤', 'kg', '2.46', '工业燃烧'],
                ['短途飞行', '人·公里', '0.255', '经济舱'],
                ['长途飞行', '人·公里', '0.139', '经济舱'],
                ['汽油车', '公里', '0.184', '乘用车出行']
              ].map((row) => (
                <tr key={row[0]} style={{ borderBottom: '1px solid var(--line)' }}>
                  {row.map((cell, i) => (
                    <td key={i} style={{ padding: '14px', color: i === 0 ? 'var(--ink)' : 'var(--ink-2)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 22, fontSize: '.78rem', color: 'var(--ink-3)' }}>
          数据的完整出处、版本与更新记录见仓库 <code>src/lib/factors.ts</code> 中的 <code>source</code> 字段。
        </p>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="card" style={{ padding: 'clamp(28px, 5vw, 52px)', textAlign: 'center' }}>
          <h2 className="sec-title" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.3rem)' }}>
            直接用一份票据验证
          </h2>
          <div style={{ marginTop: 26 }}>
            <Link className="btn btn-primary" href="/workbench">打开工作台</Link>
          </div>
        </div>
      </section>
    </>
  );
}
