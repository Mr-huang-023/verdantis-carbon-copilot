import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '联系我们',
  description: '绿境科技联系方式与演示预约说明。'
};

export default function ContactPage() {
  return (
    <>
      <section className="sec" style={{ paddingTop: 150 }}>
        <p className="crumb"><Link href="/">首页</Link> / CONTACT</p>
        <h1 className="sec-title" style={{ marginTop: 18, fontSize: 'clamp(2.2rem, 5vw, 3.6rem)' }}>
          想验证一份真实账单？
          <br />
          <span className="hl">把票据发给我们</span>
        </h1>
        <p className="sec-sub">
          我们可以用你提供的一份脱敏电费单，完整跑一遍抽取 → 因子 → 计算 → 报告流程，并把中间结果一并给你复核。
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
            marginTop: 44
          }}
        >
          {[
            ['邮箱', 'hello@verdantis.example', '演示用地址，正式环境替换为企业邮箱'],
            ['电话', '0571-0000 0000', '工作日 9:30 – 18:00'],
            ['地址', '浙江省杭州市', '具体门牌在正式站点中填写']
          ].map(([k, v, note]) => (
            <div className="card" key={k} style={{ padding: 26 }}>
              <div className="mono">{k}</div>
              <div style={{ fontSize: '1.02rem', marginTop: 10 }}>{v}</div>
              <p style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 8 }}>{note}</p>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 24, padding: 'clamp(24px, 4vw, 40px)' }}>
          <h2 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.4rem', letterSpacing: '.06em' }}>
            演示预约需要准备什么
          </h2>
          <ul style={{ marginTop: 16, paddingLeft: 20, color: 'var(--ink-2)', fontSize: '.9rem', lineHeight: 2 }}>
            <li>一份脱敏的能源账单（可遮盖户号与金额，保留用量与账期）</li>
            <li>企业所属行业与所在地区（决定采用哪套因子口径）</li>
            <li>盘查边界：仅范围一，还是包含外购电力与差旅</li>
          </ul>
          <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/workbench">先自己试一次</Link>
            <Link className="btn btn-ghost" href="/products#factors">查看因子口径</Link>
          </div>
        </div>
      </section>
    </>
  );
}
