/* ============================================================
   全站交互引擎：转场 / 光标 / 滚动叙事 / 磁吸 / 3D 卡片 / 导航
   — 通过 DOM 就绪后统一初始化各交互子模块；均带无障碍与
     设备能力降级（减少动效、触屏设备自动关闭部分效果）
   ============================================================ */
(function () {
  'use strict';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; // 用户是否偏好减少动效

  document.addEventListener('DOMContentLoaded', function () { init(); });

  /* ---------- 初始化入口 ---------- */
  function init() {
    var body = document.body;

    // 背景氛围层（三个模糊光球），若页面未预设则自动注入
    if (!body.querySelector('.bg-atmosphere')) {
      var atmo = document.createElement('div');
      atmo.className = 'bg-atmosphere';
      atmo.innerHTML = '<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>';
      body.prepend(atmo);
    }
    // 颗粒噪点遮罩层，增加画面质感
    var noise = document.createElement('div');
    noise.className = 'noise-veil';
    body.appendChild(noise);

    // 依次启用各交互模块
    initProgress();   // 顶部滚动进度条
    initNav();        // 导航吸顶、移动端菜单
    initVeil();       // 页面切换转场遮罩
    initCursor();     // 自定义光标
    initSplit();      // 标题字符逐个入场
    initReveal();     // 滚动进入视口显现
    initCounters();   // 数字滚动计数
    initTilt();       // 卡片 3D 倾斜
    initMagnetic();   // 按钮磁吸跟随
    renderAuthArea(); // 顶部登录态区域渲染

    // 添加 loaded 类触发入场动画；从其它页转场而来时延迟更久以等待遮罩退场
    window.setTimeout(function () { body.classList.add('loaded'); }, body.dataset.entered ? 760 : 120);
  }

  /* ---------- 顶部滚动进度条 ---------- */
  var progressBar;
  function initProgress() {
    progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    var ticking = false;
    // 滚动时用 rAF 节流，避免高频重排
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progressBar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- 导航 ---------- */
  function initNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    // 滚动超过 40px 时进入吸顶/玻璃态
    window.addEventListener('scroll', function () { nav.classList.toggle('is-scrolled', window.scrollY > 40); }, { passive: true });
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
    // 依据 body[data-page] 高亮当前页导航项
    var page = document.body.dataset.page;
    if (page) {
      var link = nav.querySelector('[data-nav="' + page + '"]');
      if (link) link.classList.add('is-active');
    }
    // 移动端汉堡菜单开合
    var burger = document.getElementById('burger');
    var menu = document.getElementById('mobileMenu');
    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('nav-open');
        burger.setAttribute('aria-expanded', open);
        document.documentElement.style.overflow = open ? 'hidden' : ''; // 展开时锁定页面滚动
      });
      // 点击菜单项后自动收起
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('nav-open');
          document.documentElement.style.overflow = '';
        });
      });
    }
  }

  /* ---------- 页面转场遮罩 ---------- */
  function initVeil() {
    var veil = document.createElement('div');
    veil.className = 'pt-veil';
    veil.setAttribute('aria-hidden', 'true');
    var cols = '';
    for (var i = 0; i < 6; i++) cols += '<span class="pt-col"></span>'; // 六列栅格
    // 遮罩中央的品牌叶形图形
    veil.innerHTML = cols +
      '<div class="pt-glyph"><svg viewBox="0 0 64 64" fill="none">' +
      '<path d="M32 6C18 20 10 32 10 42a22 22 0 0 0 44 0c0-10-8-22-22-36Z" stroke="#2dd87a" stroke-width="2" fill="rgba(45,216,122,.12)"/>' +
      '<path d="M32 14v36M32 28l10-8M32 36l-11-9M32 44l9-7" stroke="#7af0b8" stroke-width="1.6" stroke-linecap="round"/></svg></div>';
    document.body.appendChild(veil);

    // 若来源页写入了 vd_pt 标记，说明是站内跳转 → 播放「揭开」入场动画
    var returning = sessionStorage.getItem('vd_pt') === '1';
    if (returning) {
      sessionStorage.removeItem('vd_pt');
      document.body.dataset.entered = '1';
      veil.classList.add('cover');
      veil.style.transition = 'none';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          veil.classList.remove('cover');
          veil.classList.add('release');
          window.setTimeout(function () { veil.remove(); }, 1100);
        });
      });
    } else {
      veil.remove(); // 直接访问（非站内跳转）时无需入场遮罩
    }
    if (REDUCED) return; // 减少动效时跳过后续拦截

    // 拦截站内 .html 链接点击，播放「合拢」动画后再跳转
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 放过新开/组合键
      var href = a.getAttribute('href');
      if (!href || !/\.html(\?|#|$)/.test(href)) return; // 仅处理 html 链接
      if (a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
      e.preventDefault();
      var here = location.pathname.split('/').pop().split('?')[0] || 'index.html';
      var dest = href.split('?')[0].split('#')[0];
      if (dest === here) { location.href = href; return; }      // 同页锚点/刷新直接跳
      if (document.querySelector('.pt-veil')) { location.href = href; return; } // 已有遮罩则避免叠加
      var v = document.createElement('div');
      v.className = 'pt-veil';
      var c = '';
      for (var i = 0; i < 6; i++) c += '<span class="pt-col"></span>';
      v.innerHTML = c;
      document.body.appendChild(v);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { v.classList.add('cover'); });
      });
      // 遮罩合拢后写入标记并跳转
      window.setTimeout(function () { sessionStorage.setItem('vd_pt', '1'); location.href = href; }, 760);
    });
  }

  /* ---------- 自定义光标 ---------- */
  function initCursor() {
    // 触屏设备或减少动效时禁用
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches || REDUCED) return;
    document.documentElement.classList.add('has-cursor'); // 该类的存在会隐藏系统光标
    var dot = document.createElement('div'); dot.className = 'cur-dot';   // 中心实心点
    var ring = document.createElement('div'); ring.className = 'cur-ring'; // 外圈（带缓动跟随）
    document.body.append(dot, ring);
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    // 中心点即时跟随鼠标
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    }, { passive: true });
    // 外圈以插值缓动跟随，形成拖尾效果
    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    // 按下与悬停的视觉反馈
    window.addEventListener('mousedown', function () { ring.classList.add('is-press'); });
    window.addEventListener('mouseup', function () { ring.classList.remove('is-press'); });
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('a, button, [data-tilt], input, label, .swap');
      ring.classList.toggle('is-hover', !!t);
    });
  }

  /* ---------- 标题字符拆分（逐字入场） ---------- */
  function initSplit() {
    document.querySelectorAll('.split').forEach(function (el) {
      var i = 0;
      // 递归遍历文本节点，将每个字符包成 .ch 并写入序号 --i 供动画错峰
      function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) { // 文本节点
            var frag = document.createDocumentFragment();
            n.textContent.split('').forEach(function (c) {
              var s = document.createElement('span');
              s.className = 'ch';
              s.style.setProperty('--i', i++);
              s.textContent = c === ' ' ? '\u00A0' : c; // 空格替换为不换行空格以保留间距
              frag.appendChild(s);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1 && !n.classList.contains('ch')) { // 元素节点继续下钻
            walk(n);
          }
        });
      }
      walk(el);
    });
  }

  /* ---------- 滚动进入视口显现 ---------- */
  function initReveal() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        // 进入视口即添加 in-view 并停止观察（一次性）
        if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('[data-reveal], .split').forEach(function (el) { io.observe(el); });
  }

  /* ---------- 数字滚动计数 ---------- */
  function initCounters() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        var target = parseFloat(el.dataset.count || '0');                       // 目标值
        var decimals = (el.dataset.count.split('.')[1] || '').length;           // 小数位
        var suffix = el.dataset.suffix || '';                                   // 后缀（如 "+"、" MW"）
        var dur = 1800, t0 = null;
        // 使用四次缓出函数（ease-out quart）从 0 滚到目标值
        (function tick(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 4);
          el.textContent = (target * eased).toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(performance.now());
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
  }

  /* ---------- 卡片 3D 倾斜 ---------- */
  function initTilt() {
    if (window.matchMedia('(hover: none)').matches) return; // 触屏不启用
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var strength = parseFloat(card.dataset.tilt) || 8; // 倾斜强度（度）
      card.addEventListener('mouseenter', function () { card.style.transition = 'transform 0.14s ease-out'; });
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;   // 归一化坐标 0–1
        var y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', x * 100 + '%'); // 供卡片高光渐变定位
        card.style.setProperty('--my', y * 100 + '%');
        // 依据鼠标相对中心的位置计算旋转角，并轻微抬起
        card.style.transform = 'perspective(900px) rotateX(' + (0.5 - y) * strength + 'deg) rotateY(' + (x - 0.5) * strength + 'deg) translateY(-6px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transition = ''; card.style.transform = ''; });
    });
  }

  /* ---------- 按钮磁吸 ---------- */
  function initMagnetic() {
    if (window.matchMedia('(hover: none)').matches) return; // 触屏不启用
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var range = parseFloat(el.dataset.magnetic) || 0.3; // 跟随幅度系数
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        // 元素向鼠标方向偏移（相对中心），营造磁吸感
        el.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * range + 'px,' + (e.clientY - r.top - r.height / 2) * range + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- 顶部登录态区域 ---------- */
  function renderAuthArea() {
    var area = document.getElementById('authArea');
    if (!area || !window.VAuth) return; // 无容器或无认证模块则跳过
    window.VAuth.whenReady(function (user) {
      if (user) {
        // 已登录：显示头像+用户名，点击进入控制台；同步更新移动端菜单项
        area.innerHTML =
          '<a class="auth-chip" href="profile.html" title="个人中心">' +
          '<span class="avatar">' + window.VAuth.escapeHTML(user.username.charAt(0).toUpperCase()) + '</span>' +
          '<span>' + window.VAuth.escapeHTML(user.username) + '</span></a>';
        var mLink = document.querySelector('#mobileMenu a[data-auth]');
        if (mLink) { mLink.href = 'profile.html'; mLink.innerHTML = '个人中心<em>MEMBER</em>'; }
      } else {
        // 未登录：显示登录链接与免费试用按钮
        area.innerHTML =
          '<a class="auth-login-link" href="login.html">登录</a>' +
          '<a class="btn btn-primary btn-sm" data-magnetic="0.2" href="register.html">免费试用</a>';
      }
    });
  }

  /* ---------- 轻提示 Toast ---------- */
  // 用法：window.vToast('已保存') / vToast('出错了', 'err')
  window.vToast = function (msg, type, dur) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) { // 首次调用时创建容器
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    wrap.appendChild(t);
    // 到期淡出并移除
    window.setTimeout(function () {
      t.classList.add('out');
      window.setTimeout(function () { t.remove(); }, 420);
    }, dur || 3200);
  };
})();
