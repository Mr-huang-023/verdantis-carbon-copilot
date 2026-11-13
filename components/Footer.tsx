import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <Link className="brand" href="/">
            <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="22" height="22" rx="5" transform="rotate(45 20 20)" stroke="#2dd87a" strokeWidth="1.5" />
              <path d="M20 11c-4.4 4.4-6.6 8-6.6 11.2a6.6 6.6 0 0 0 13.2 0C26.6 19 24.4 15.4 20 11Z" fill="rgba(45,216,122,.22)" stroke="#7af0b8" strokeWidth="1.2" />
            </svg>
            <span className="brand-name">
              绿境科技<i>VERDANT GREENTECH</i>
            </span>
          </Link>
          <p className="footer-desc">
            面向中小企业的可审计 AI 碳盘查工具。数字有出处，结论可复核。
          </p>
        </div>

        <div>
          <h4>PRODUCT</h4>
          <div className="footer-links">
            <Link href="/workbench">碳盘查工作台</Link>
            <Link href="/products#factor">排放因子库</Link>
            <Link href="/products#report">盘查报告</Link>
          </div>
        </div>

        <div>
          <h4>COMPANY</h4>
          <div className="footer-links">
            <Link href="/about">关于我们</Link>
            <Link href="/contact">联系我们</Link>
            <Link href="/about#method">核算方法</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2019–2026 绿境科技（杭州）有限公司 · 本站为 AI Web 开发挑战赛参赛作品，页面数据为演示数据</span>
      </div>
    </footer>
  );
}
