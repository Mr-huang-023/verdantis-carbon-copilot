/* ============================================================
   Firebase 认证配置
   ————————————————————————————————————————————————————————————
   默认使用下方占位配置 → 网站以「演示模式」运行，账号仅保存在本机浏览器。
   启用真实云端认证，请按以下步骤操作：

   1. 访问 https://console.firebase.google.com/ 并创建项目（无需信用卡）
   2. 左侧菜单 → Authentication → 开始使用 → 启用「邮箱/密码」登录方式
   3. 项目设置（齿轮图标）→ 常规 → 下滑到「你的应用」→ 点击 </> 添加 Web 应用
   4. 复制 firebaseConfig 对象中的值，替换下方对应字段
   5. 刷新页面，顶部「演示模式」提示条消失，即为云端认证已生效

   安全说明：
   · apiKey 在前端可见是正常的（Firebase 安全依赖 Security Rules，不是隐藏 apiKey）
   · 本模板的「登录/注册」仅用于演示企业会员入口的鉴权流程
   · 生产环境请在 Firebase Console 中配置 Security Rules 与域名白名单
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",                        // 项目 Web API 密钥（替换为 Firebase 控制台中的真实值）
  authDomain: "YOUR_PROJECT.firebaseapp.com",    // 鉴权域名，形如 <projectId>.firebaseapp.com
  projectId: "YOUR_PROJECT_ID",                  // 项目 ID
  appId: "YOUR_APP_ID"                           // Web 应用 ID，形如 1:xxxx:web:xxxx
  // 任一字段仍为 YOUR_ 前缀时，auth.js 会自动判定为「演示模式」
};
