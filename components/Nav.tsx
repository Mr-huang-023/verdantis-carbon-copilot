'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/* 导航项集中定义，新增页面只需在这里加一条，避免多处同步 */
const LINKS = [
  { href: '/', label: '首页', en: 'HOME' },
  { href: '/products', label: '产品方案', en: 'PRODUCTS' },
  { href: '/workbench', label: '碳盘查工作台', en: 'WORKBENCH' },
  { href: '/about', label: '关于我们', en: 'ABOUT' },
  { href: '/contact', label: '联系我们', en: 'CONTACT' }
];

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);

  /* 滚动超过 20px 时收起导航并加毛玻璃背景 */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* 打开移动端菜单时锁定页面滚动，并支持 Esc 关闭 */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus(); // 关闭后把焦点还给触发按钮，避免焦点丢失
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* 路由变化时自动关闭菜单 */
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      <header className={`nav${scrolled ? ' is-scrolled' : ''}`} data-open={open}>
        <Link className="brand" href="/" aria-label="绿境科技首页">
          <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="22" height="22" rx="5" transform="rotate(45 20 20)" stroke="#2dd87a" strokeWidth="1.5" />
            <path d="M20 11c-4.4 4.4-6.6 8-6.6 11.2a6.6 6.6 0 0 0 13.2 0C26.6 19 24.4 15.4 20 11Z" fill="rgba(45,216,122,.22)" stroke="#7af0b8" strokeWidth="1.2" />
            <path d="M20 14.5V24" stroke="#7af0b8" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          <span className="brand-name">
            绿境科技<i>VERDANT GREENTECH</i>
          </span>
        </Link>

        <nav className="nav-links" aria-label="主导航">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link className="btn btn-primary btn-sm" href="/workbench">
            开始盘查
          </Link>
          <button
            ref={burgerRef}
            className="nav-burger"
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* 移动端全屏菜单：id 与 aria-controls 对应，读屏可感知展开关系 */}
      <div id="mobile-menu" className={`mobile-menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} tabIndex={open ? 0 : -1}>
            {l.label}<em>{l.en}</em>
          </Link>
        ))}
      </div>
    </>
  );
}
