import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '关于与方法',
  description: '绿境科技团队背景、碳核算方法说明与 AI 技术选型理由。'
};

const TIMELINE = [
  { y: '2019', t: '团队组建', d: '由环境工程与前端工程背景成员组成，最初为园区做能耗数据采集。' },
  { y: '2022', t: '转向碳核算', d: '开始为制造类中小企业编制温室气体盘查表，积累活动数据与因子口径经验。' },
  { y: '2024', t: '工具化', d: '把人工盘查流程沉淀为内部表格工具，把重复录入压缩约一半。' },
  { y: '2026', t: 'AI 原生化', d: '重构为 AI 驱动的盘查工作台：抽取、检索、计算、确认全链路留痕。' }
];

export default function AboutPage() {
  return (
    <>
      <section className="sec" style={{ paddingTop: 150 }}>
        <p className="crumb"><Link href="/">首页</Link> / ABOUT</p>
        <h1 className="sec-title" style={{ marginTop: 18, fontSize: 'clamp(2.2rem, 5vw, 3.6rem)' }}>
          我们做过手工盘查，
          <br />
          所以知道<span className="hl">哪里最容易出错</span>
        </h1>
        <p className="sec-sub">
          碳盘查的难点不在公式，而在数据：票据格式千差万别、用量单位不统一、因子版本年年变化。
          我们把这些年的踩坑经验直接写进了工具的校验规则里。
        </p>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {TIMELINE.map((n) => (
            <div className="card" key={n.y} style={{ padding: 26 }}>
              <div style={{ fontFamily: 'var(--f-en)', fontSize: '1.8rem', color: 'var(--g2)' }}>{n.y}</div>
              <h2 style={{ fontSize: '1rem', fontWeight: 400, letterSpacing: '.08em', marginTop: 8 }}>{n.t}</h2>
              <p style={{ fontSize: '.84rem', color: 'var(--ink-2)', marginTop: 10 }}>{n.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 方法说明：对应赛事材料中的「AI 选型理由」与「可信边界」 */}
      <section className="sec" id="method">
        <p className="crumb">METHOD / 核算方法</p>
        <h2 className="sec-title" style={{ marginTop: 16 }}>AI 在这套流程里的位置</h2>

        <div style={{ display: 'grid', gap: 16, marginTop: 36 }}>
          {[
            {
              t: '模型负责理解，不负责算术',
              d: '排放量统一由 activity × factor 的纯函数计算，输入输出均可单测。模型输出若与计算结果冲突，界面以计算结果为准并提示冲突，避免「听起来合理的错数字」。'
            },
            {
              t: '检索增强保证因子可溯源',
              d: '因子库以结构化条目存储，检索结果返回条目 id、发布机构与年份。回答中出现的每个因子都可点击展开原始出处，便于评审与审计复核。'
            },
            {
              t: 'Agent 只做流程编排',
              d: '工具调用限定为查因子、算排放、生成报告三类。每一步的输入输出写入会话记录，可回放整条链路。'
            },
            {
              t: '安全边界',
              d: '密钥仅存于服务端环境变量；接口做请求限流与输入长度校验；前端不接触任何模型凭证。'
            }
          ].map((b) => (
            <article className="card" key={b.t} style={{ padding: 26 }}>
              <h3 style={{ fontFamily: 'var(--f-disp)', fontWeight: 400, fontSize: '1.2rem', letterSpacing: '.06em' }}>{b.t}</h3>
              <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginTop: 10 }}>{b.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="card" style={{ padding: 'clamp(28px, 5vw, 52px)' }}>
          <h2 className="sec-title" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.3rem)' }}>技术栈</h2>
          <p className="sec-sub">
            Next.js App Router + TypeScript + Tailwind CSS；AI 层使用 Vercel AI SDK 接入大模型，
            流式返回并支持工具调用；数据全部本地存储，不依赖外部数据库。
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link className="btn btn-outline btn-sm" href="/products">查看产品能力</Link>
            <Link className="btn btn-ghost btn-sm" href="/contact">技术合作</Link>
          </div>
        </div>
      </section>
    </>
  );
}
