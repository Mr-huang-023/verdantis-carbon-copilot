import type { Metadata } from 'next';
import Link from 'next/link';
import WorkbenchClient from './WorkbenchClient';

export const metadata: Metadata = {
  title: '碳盘查工作台',
  description: '录入活动数据，实时计算排放量，逐条查看排放因子出处，并让 AI 解读排放结构。'
};

export default function WorkbenchPage() {
  return (
    <section className="sec" style={{ paddingTop: 140 }}>
      <p className="crumb"><Link href="/">首页</Link> / WORKBENCH</p>
      <h1 className="sec-title" style={{ marginTop: 14, fontSize: 'clamp(2rem, 4.4vw, 3rem)' }}>
        碳盘查<span className="hl">工作台</span>
      </h1>
      <p className="sec-sub" style={{ marginBottom: 36 }}>
        录入活动数据即可实时得到排放量，每一项都能展开查看因子出处。计算在前端完成，
        断网可用；AI 解读为可选能力，不影响计算结果。
      </p>

      <WorkbenchClient />
    </section>
  );
}
