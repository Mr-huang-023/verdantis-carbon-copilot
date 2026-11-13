import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

/* 全站元信息：标题模板、描述、Open Graph。
   生产环境部署后把 metadataBase 换成真实域名即可。 */
export const metadata: Metadata = {
  title: {
    default: '绿境科技 VERDANT GREENTECH · 碳智囊',
    template: '%s · 绿境科技'
  },
  description:
    '绿境科技面向中小企业提供可审计的 AI 碳盘查：票据多模态抽取、排放因子检索溯源、确定性计算与人工确认，最终导出合规盘查报告。',
  keywords: ['碳盘查', '碳排放核算', 'AI Agent', 'RAG', '绿色科技', '碳管理'],
  openGraph: {
    title: '绿境科技 VERDANT GREENTECH',
    description: '可审计的 AI 碳盘查 Agent：数字有出处，结论可复核。',
    type: 'website',
    locale: 'zh_CN'
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 字体：中文标题用 ZCOOL XiaoWei，英文与数字用 Marcellus，正文 Noto Sans SC */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&family=Marcellus&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* 背景氛围层：模糊光球 + 噪点，纯装饰，对读屏隐藏 */}
        <div className="bg-atmosphere" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
        </div>
        <div className="noise-veil" aria-hidden="true" />

        <Nav />
        <main className="page-shell">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
