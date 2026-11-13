/* ============================================================
   认证引擎 — Firebase Auth + 无配置降级演示模式
   · 若 js/firebase-config.js 提供有效配置 → 使用 Firebase Authentication（云端真实鉴权）
   · 否则 → 演示模式（localStorage），并在页面顶部显示醒目的演示提示条
   API：VAuth.register / login / logout / currentUser / whenReady / requireAuth / escapeHTML / rules / strength
   ============================================================ */
(function () {
  'use strict'; /* 严格模式：避免意外的全局变量与静默错误 */

  /* ---------- 模块级状态 ---------- */
  var USERS_KEY = 'vg_users_demo';       // 演示模式：用户列表在 localStorage 中的键名
  var SESS_KEY = 'vg_session_demo';      // 演示模式：登录会话（用户 id）在存储中的键名
  var cfg = window.FIREBASE_CONFIG || null; // 读取页面引入的 Firebase 配置（可能为空）
  var fbAuth = null;                     // Firebase Auth 实例（仅云端模式非空）
  var isDemo = true;                     // 是否处于演示模式（默认为是）
  var currentUserObj = null;             // 当前登录用户的规范化对象 {id, email, username}
  var ready = false;                     // 鉴权是否已初始化完成（Firebase 为异步，演示模式为同步）
  var readyListeners = [];               // 初始化完成前注册的等待回调队列

  /* ---------- HTML 转义（防 XSS） ---------- */
  // 将用户输入中的特殊字符转为实体，插入 DOM 前调用，避免脚本注入
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"'`=\/]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' }[c];
    });
  }

  /* ---------- 校验规则 ---------- */
  // 每个字段校验器：返回空字符串表示通过，否则返回错误提示文案
  var rules = {
    // 用户名：2–20 位，允许中文、英文字母、数字与下划线
    username: function (v) {
      v = (v || '').trim();
      if (!v) return '请输入用户名';
      if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]{2,20}$/.test(v)) return '2–20 位，支持中文、字母、数字与下划线';
      return '';
    },
    // 邮箱：基础格式校验 + 长度上限 64
    email: function (v) {
      v = (v || '').trim();
      if (!v) return '请输入邮箱';
      if (!/^[\w.%+-]+@[\w-]+(\.[\w-]+)+$/.test(v) || v.length > 64) return '邮箱格式不正确';
      return '';
    },
    // 密码：8–64 位，且必须同时包含字母与数字
    password: function (v) {
      if (!v) return '请输入密码';
      if (v.length < 8 || v.length > 64) return '密码长度需为 8–64 位';
      if (!/[a-zA-Z]/.test(v) || !/\d/.test(v)) return '密码需同时包含字母与数字';
      return '';
    },
    // 确认密码：与 password 完全一致
    confirm: function (v, ref) { return v === ref ? '' : '两次输入的密码不一致'; },
    // 协议勾选：必须为真
    agree: function (ok) { return ok ? '' : '请阅读并同意《用户协议》'; }
  };

  /* ---------- 密码强度评分（0–5） ---------- */
  // 综合长度、大小写组合、数字、特殊字符累加得分，用于注册页强度条展示
  function strength(v) {
    if (!v) return 0;
    var s = 0;
    if (v.length >= 8) s++;                                   // 长度 ≥ 8
    if (v.length >= 12) s++;                                  // 长度 ≥ 12
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;              // 同时含大小写
    if (/\d/.test(v)) s++;                                    // 含数字
    if (/[^a-zA-Z0-9]/.test(v)) s++;                          // 含特殊字符
    return Math.min(s, 5);                                    // 上限 5 分
  }

  /* ---------- 演示模式存储 ---------- */
  // 读取本地演示用户列表（解析失败时返回空数组）
  function demoUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) { return []; } }
  // 写回本地演示用户列表
  function saveDemoUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
  // 依据存储中的会话 id 还原当前用户；优先会话级(sessionStorage)，其次持久级(localStorage)
  function demoCurrent() {
    try {
      var uid = sessionStorage.getItem(SESS_KEY) || localStorage.getItem(SESS_KEY);
      if (!uid) return null;
      var u = demoUsers().find(function (x) { return x.id === uid; });
      return u ? { id: u.id, username: u.username, email: u.email } : null;
    } catch (e) { return null; }
  }
  // 生成 16 字节随机盐（十六进制字符串）；优先使用加密安全随机数
  function randomSalt() {
    var b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  // 密码加盐哈希：优先 SHA-256（安全上下文），降级为 FNV-1a 轻量散列
  function demoHash(pw, salt) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '::' + pw + '::vgdemo')).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
      });
    }
    // 降级：FNV-1a（非加密安全，仅用于本地演示）
    var h = 0x811c9dc5;
    var s = salt + '::' + pw;
    for (var i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
    return Promise.resolve('fnv$' + h.toString(16));
  }

  /* ---------- 演示模式提示条 ---------- */
  // 在页面顶部注入黄色提示条，告知当前为演示模式并提供配置指引
  function showDemoBanner() {
    if (document.querySelector('.demo-banner')) return; // 避免重复插入
    var b = document.createElement('div');
    b.className = 'demo-banner';
    b.innerHTML = '<b>演示模式</b> · 未配置 Firebase，账号仅保存在本机浏览器，不具备真实安全性。' +
      ' 配置 <a href="#" id="vgDemoLink">Firebase 认证</a> 后可启用云端真实鉴权。';
    document.body.appendChild(b);
    document.body.classList.add('has-demo-banner'); // 附加类：让导航/进度条下移避让
    document.getElementById('vgDemoLink').addEventListener('click', function (e) {
      e.preventDefault();
      alert('配置步骤：\n1. 访问 https://console.firebase.google.com 创建项目\n2. 开启 Authentication → 启用「邮箱/密码」登录\n3. 项目设置 → 添加 Web 应用 → 复制 firebaseConfig\n4. 将 js/firebase-config.example.js 复制为 js/firebase-config.js 并填入配置\n5. 刷新页面即可启用云端认证');
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    // 判定是否具备有效 Firebase 配置：配置存在、apiKey 非占位符、且 SDK 已加载
    if (cfg && cfg.apiKey && cfg.apiKey.indexOf('YOUR_') !== 0 && window.firebase) {
      try {
        firebase.initializeApp(cfg);          // 初始化 Firebase 应用
        fbAuth = firebase.auth();             // 获取鉴权实例
        isDemo = false;                       // 切换为云端模式
        var first = true;
        // 监听登录状态变化（异步）；首次触发时标记 ready 并通知等待者
        fbAuth.onAuthStateChanged(function (u) {
          currentUserObj = u ? {
            id: u.uid,
            email: u.email,
            username: u.displayName || u.email.split('@')[0]
          } : null;
          if (first) { first = false; ready = true; }
          notifyReady();
        });
        return;
      } catch (e) {
        // 初始化失败则记录告警并继续走降级逻辑
        console.warn('[VAuth] Firebase 初始化失败，已降级为演示模式：', e.message);
      }
    }
    /* 降级：演示模式 */
    isDemo = true;
    currentUserObj = demoCurrent();           // 从本地存储还原会话
    if (document.body) showDemoBanner();
    else document.addEventListener('DOMContentLoaded', showDemoBanner);
    ready = true;                            // 演示模式同步就绪
    notifyReady();
  }

  // 依次通知所有等待者当前用户（回调内异常不阻断其他回调）
  function notifyReady() {
    readyListeners.forEach(function (l) { try { l(currentUserObj); } catch (e) {} });
  }

  /* ---------- API：注册 ---------- */
  function register(input) {
    // 先做字段校验，任一失败即返回错误集合
    var errs = {
      username: rules.username(input.username),
      email: rules.email(input.email),
      password: rules.password(input.password)
    };
    if (input.confirm !== undefined) errs.confirm = rules.confirm(input.confirm, input.password);
    if (Object.keys(errs).some(function (k) { return errs[k]; }))
      return Promise.resolve({ ok: false, errors: errs });

    var uname = input.username.trim();
    var mail = input.email.trim().toLowerCase(); // 邮箱统一小写，避免大小写重复

    // 云端模式：调用 Firebase 创建用户，并写入 displayName
    if (!isDemo) {
      return fbAuth.createUserWithEmailAndPassword(mail, input.password)
        .then(function (cred) {
          return cred.user.updateProfile({ displayName: uname }).then(function () {
            currentUserObj = { id: cred.user.uid, email: mail, username: uname };
            return { ok: true, user: currentUserObj };
          });
        })
        .catch(function (e) {
          // 将 Firebase 错误码映射为中文提示
          var msg = e.message || '注册失败';
          var errs2 = {};
          if (/email-already-in-use/i.test(e.code)) errs2.email = '该邮箱已被注册';
          else if (/weak-password/i.test(e.code)) errs2.password = '密码强度不足，请增加复杂度';
          else errs2.form = msg;
          return { ok: false, errors: errs2 };
        });
    }

    /* 演示模式 */
    var list = demoUsers();
    if (list.some(function (u) { return u.email === mail; }))
      return Promise.resolve({ ok: false, errors: { email: '该邮箱已被注册' } });
    var salt = randomSalt();
    return demoHash(input.password, salt).then(function (hash) {
      // 存储：仅保留 id/username/email/盐/哈希，不保存明文密码
      var u = { id: 'demo_' + Date.now().toString(36), username: uname, email: mail, salt: salt, hash: hash };
      list.push(u);
      saveDemoUsers(list);
      sessionStorage.setItem(SESS_KEY, u.id);  // 会话级登录
      localStorage.setItem(SESS_KEY, u.id);    // 持久级登录（注册默认记住）
      currentUserObj = { id: u.id, username: u.username, email: u.email };
      return { ok: true, user: currentUserObj };
    });
  }

  /* ---------- API：登录 ---------- */
  function login(email, password, remember) {
    // 基础非空校验
    if (!email) return Promise.resolve({ ok: false, errors: { email: '请输入邮箱' } });
    if (!password) return Promise.resolve({ ok: false, errors: { password: '请输入密码' } });
    var mail = email.trim().toLowerCase();

    // 云端模式：调用 Firebase 邮箱密码登录
    if (!isDemo) {
      return fbAuth.signInWithEmailAndPassword(mail, password)
        .then(function (cred) {
          currentUserObj = {
            id: cred.user.uid, email: mail,
            username: cred.user.displayName || mail.split('@')[0]
          };
          return { ok: true, user: currentUserObj };
        })
        .catch(function (e) {
          // 错误码到中文字段提示的映射
          var errs = {};
          if (/user-not-found|invalid-email/i.test(e.code)) errs.email = '该邮箱尚未注册';
          else if (/wrong-password/i.test(e.code)) errs.password = '密码不正确';
          else errs.form = '登录失败：' + (e.message || '请稍后重试');
          return { ok: false, errors: errs };
        });
    }

    /* 演示模式 */
    var u = demoUsers().find(function (x) { return x.email === mail; });
    if (!u) return Promise.resolve({ ok: false, errors: { email: '该邮箱尚未注册' } });
    return demoHash(password, u.salt).then(function (h) {
      if (h !== u.hash) return { ok: false, errors: { password: '密码不正确' } }; // 哈希比对
      // 记住我 → 持久存储；否则仅会话级
      if (remember) localStorage.setItem(SESS_KEY, u.id); else sessionStorage.setItem(SESS_KEY, u.id);
      currentUserObj = { id: u.id, username: u.username, email: u.email };
      return { ok: true, user: currentUserObj };
    });
  }

  /* ---------- API：退出登录 ---------- */
  function logout() {
    // 云端：调用 Firebase 登出并通知等待者
    if (!isDemo) return fbAuth.signOut().then(function () { currentUserObj = null; notifyReady(); return true; });
    // 演示：清除两级会话标识
    sessionStorage.removeItem(SESS_KEY);
    localStorage.removeItem(SESS_KEY);
    currentUserObj = null;
    notifyReady();
    return Promise.resolve(true);
  }

  /* ---------- API：就绪回调 ---------- */
  // 若已就绪则立即同步回调，否则入队；用于解决 Firebase 异步鉴权的竞态
  function whenReady(cb) {
    if (ready) { try { cb(currentUserObj); } catch (e) {} }
    else readyListeners.push(cb);
  }

  /* ---------- API：登录守卫（同步快速判断） ---------- */
  // 未登录时记录来源页并跳转登录页；注意 Firebase 模式应配合 whenReady 使用
  function requireAuth() {
    if (!currentUserObj) {
      sessionStorage.setItem('vg_next', location.pathname.split('/').pop() + location.search);
      location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop()));
      return false;
    }
    return true;
  }

  /* ---------- API：登录后的目标页 ---------- */
  // 优先使用 ?next= 参数，其次使用会话中暂存的来源页；仅允许形如 xxx.html 的站内相对路径
  function nextAfterAuth() {
    var nxt = null;
    try {
      var q = new URLSearchParams(location.search).get('next');
      var st = sessionStorage.getItem('vg_next');
      nxt = q || st;
      sessionStorage.removeItem('vg_next');
    } catch (e) {}
    if (nxt && /^[a-z]+\.html$/i.test(nxt)) return nxt; // 白名单校验，防开放重定向
    return 'index.html';
  }

  /* ---------- 对外暴露 API ---------- */
  window.VAuth = {
    escapeHTML: escapeHTML,
    rules: rules,
    strength: strength,
    register: register,
    login: login,
    logout: logout,
    currentUser: function () { return currentUserObj; },
    whenReady: whenReady,
    requireAuth: requireAuth,
    nextAfterAuth: nextAfterAuth,
    isDemo: function () { return isDemo; }
  };

  // DOM 尚在加载则等 DOMContentLoaded，否则立即初始化
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
