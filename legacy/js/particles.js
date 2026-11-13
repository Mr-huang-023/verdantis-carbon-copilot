/* ============================================================
   粒子光影引擎 — 全站氛围背景
   — 基于 Canvas 绘制漂浮粒子/连线/流光，支持鼠标交互与
     三种模式（body[data-particles]：spores 浮游孢子 / network 网络连线 / wisps 光丝）
   ============================================================ */
(function () {
  'use strict';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; // 减少动效偏好
  var canvas = document.createElement('canvas');
  canvas.id = 'fx-canvas';
  document.body.prepend(canvas);              // 作为最底层背景
  var ctx = canvas.getContext('2d');

  /* ---------- 运行时状态 ---------- */
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2); // 尺寸与像素比（上限 2 防过高开销）
  var particles = [], streaks = [];          // 粒子集合、流光集合
  var mouse = { x: -9999, y: -9999 };        // 鼠标坐标（初始离屏）
  var running = true;                        // 是否继续动画（标签页隐藏时暂停）
  var hue = '45, 216, 122';                  // 主绿色 RGB 分量
  var hue2 = '81, 216, 200';                 // 辅助青色 RGB 分量
  var mode = (document.body.dataset.particles || 'spores').toLowerCase(); // 模式
  var densityScale = parseFloat(document.body.dataset.particleDensity || '1') || 1; // 密度系数

  // 区间随机数工具
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- 尺寸自适应 ---------- */
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;   // 按设备像素比放大画布
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);            // 使绘制坐标回到 CSS 像素
    seed();                                            // 尺寸变化后重建粒子
  }

  /* ---------- 粒子 ---------- */
  function Particle() { this.reset(true); }
  Particle.prototype.reset = function (init) {
    this.x = rand(0, W);
    this.y = init ? rand(0, H) : H + rand(10, 60);     // 初始铺满；复用则从底部重新出现
    this.r = rand(0.7, 2.4);                           // 半径
    this.vy = rand(-0.42, -0.12);                      // 纵向速度（向上）
    this.vx = rand(-0.08, 0.08);                       // 横向基础速度
    this.swayAmp = rand(0.4, 1.6);                     // 左右摆动幅度
    this.swaySpd = rand(0.001, 0.003);                 // 摆动速度
    this.phase = rand(0, Math.PI * 2);                 // 摆动初相位
    this.alpha = rand(0.25, 0.85);                     // 基础透明度
    this.tw = rand(0.002, 0.006);                      // 闪烁频率
    this.color = Math.random() < 0.82 ? hue : hue2;    // 82% 绿色，其余青色
    this.isWisp = Math.random() < 0.08;                // 8% 概率为「光晕粒子」
    if (this.isWisp) { this.r = rand(3, 5.5); this.alpha = rand(0.12, 0.3); }
  };

  /* ---------- 流光（高速掠过线条） ---------- */
  function Streak() { this.reset(); }
  Streak.prototype.reset = function () {
    var fromLeft = Math.random() < 0.5;                       // 随机从左右一侧进入
    this.x = fromLeft ? -rand(80, 300) : W + rand(80, 300);
    this.y = rand(H * 0.06, H * 0.94);
    this.vx = (fromLeft ? 1 : -1) * rand(3.5, 8);             // 水平飞行速度
    this.len = rand(90, 240);                                 // 拖尾长度
    this.life = 0;
    this.maxLife = rand(160, 320);                            // 存活帧数
    this.color = Math.random() < 0.6 ? hue : hue2;
  };

  /* ---------- 重建粒子与流光 ---------- */
  function seed() {
    var base = (W * H) / 26000;                               // 依据屏幕面积估算基础数量
    var count = Math.round(Math.min(150, Math.max(36, base)) * densityScale); // 限制在 36–150 之间
    if (mode === 'network') count = Math.round(count * 0.75); // 网络模式减少粒子以降开销
    particles = [];
    for (var i = 0; i < count; i++) particles.push(new Particle());
    streaks = [];
    var sCount = mode === 'wisps' ? 3 : 2;                    // 流光数量随模式调整
    for (var j = 0; j < sCount; j++) streaks.push(new Streak());
  }

  var CONNECT = mode === 'network' ? 118 : 88;                // 连线触发距离阈值

  /* ---------- 每帧绘制 ---------- */
  function draw(t) {
    if (!running) return;                                     // 暂停时不绘制
    ctx.clearRect(0, 0, W, H);

    // 1) 绘制流光：渐隐拖尾 + 正弦衰减的出生-消亡曲线
    for (var s = 0; s < streaks.length; s++) {
      var st = streaks[s];
      st.x += st.vx; st.life++;
      var fade = Math.sin(Math.PI * st.life / st.maxLife);    // 0→1→0 的生命曲线
      var g = ctx.createLinearGradient(st.x - st.vx * st.len / 6, st.y, st.x, st.y);
      g.addColorStop(0, 'rgba(' + st.color + ',0)');
      g.addColorStop(1, 'rgba(' + st.color + ',' + (0.35 * fade) + ')');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(st.x - st.vx * st.len / 6, st.y); ctx.lineTo(st.x, st.y); ctx.stroke();
      // 生命周期结束或完全飞出屏幕则重置
      if (st.life > st.maxLife || (st.vx > 0 && st.x - st.len > W) || (st.vx < 0 && st.x + st.len < 0)) st.reset();
    }

    // 2) 绘制粒子：更新位置、鼠标斥力、闪烁与光晕
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.phase += p.swaySpd * 16;                              // 推进摆动相位
      p.x += p.vx + Math.sin(p.phase) * p.swayAmp * 0.16;     // 横向 = 基础速度 + 正弦摆动
      p.y += p.vy;                                            // 纵向匀速上升

      // 鼠标斥力：在半径内被轻微推开
      var dxm = p.x - mouse.x, dym = p.y - mouse.y;
      var dm2 = dxm * dxm + dym * dym;
      if (dm2 < 12000 && dm2 > 0.01) {
        var f = (1 - dm2 / 12000) * 0.9;
        var dm = Math.sqrt(dm2);
        p.x += (dxm / dm) * f * 1.6;
        p.y += (dym / dm) * f * 1.6;
      }

      var twinkle = 0.72 + Math.sin(t * p.tw) * 0.28;         // 呼吸闪烁系数
      var a = p.alpha * twinkle;                              // 实际透明度

      if (p.isWisp) {
        // 光晕粒子：径向渐变圆形光斑
        var wg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        wg.addColorStop(0, 'rgba(' + p.color + ',' + a + ')');
        wg.addColorStop(1, 'rgba(' + p.color + ',0)');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, 6.2832); ctx.fill();
      } else {
        // 普通粒子：带辉光的小圆点
        ctx.fillStyle = 'rgba(' + p.color + ',' + a + ')';
        ctx.shadowColor = 'rgba(' + p.color + ',0.9)';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        ctx.shadowBlur = 0;                                   // 复位辉光，避免影响后续绘制
      }
      // 飞出上方或左右边界则从底部重置
      if (p.y < -30 || p.x < -40 || p.x > W + 40) p.reset(false);
    }

    // 3) 绘制粒子间连线（network / spores 模式）
    if (mode === 'network' || mode === 'spores') {
      ctx.lineWidth = 0.6;
      for (var a = 0; a < particles.length; a++) {
        var pa = particles[a];
        if (pa.isWisp) continue;                              // 光晕粒子不参与连线
        for (var b = a + 1; b < particles.length; b++) {
          var pb = particles[b];
          if (pb.isWisp) continue;
          var dx = pa.x - pb.x, dy = pa.y - pb.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < CONNECT * CONNECT) {                       // 距离阈值内则连线
            var o = (1 - Math.sqrt(d2) / CONNECT) * 0.16;     // 越近越亮
            ctx.strokeStyle = 'rgba(122,240,184,' + o + ')';
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          }
        }
      }
    }

    if (!REDUCED) requestAnimationFrame(draw);                // 减少动效则只画一帧
  }

  /* ---------- 事件绑定 ---------- */
  window.addEventListener('resize', resize);                  // 窗口尺寸变化重建
  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('mouseout', function () { mouse.x = -9999; mouse.y = -9999; }); // 移出窗口时取消斥力
  document.addEventListener('visibilitychange', function () { // 切到后台暂停以省电
    running = !document.hidden;
    if (running && !REDUCED) requestAnimationFrame(draw);
  });

  resize();                                                   // 首帧尺寸
  if (REDUCED) draw(0); else requestAnimationFrame(draw);     // 启动绘制循环
})();
