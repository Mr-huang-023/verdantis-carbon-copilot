/* 简易内存限流器
   ------------------------------------------------------------
   服务端按 IP 计数，用于演示环境防止接口被刷。
   仅存于单进程内存：多实例部署或重启即失效，生产环境应换成 Redis
   之类的共享存储。这里保持最小实现，不做过度设计。 */

export interface RateLimiter {
  (ip: string): boolean;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, { count: number; reset: number }>();
  /* 上次全量清理时间：清理节流，避免每个请求都 O(n) 扫描整表 */
  let lastSweep = 0;

  return function limited(ip: string): boolean {
    const now = Date.now();

    /* 过期记录清理：每个窗口最多扫一次，防止只写不删导致内存无限增长。
       没被扫到的记录在下方读取时也会按过期处理，不影响限流正确性。 */
    if (now - lastSweep > windowMs) {
      lastSweep = now;
      for (const [k, v] of hits) {
        if (now > v.reset) hits.delete(k);
      }
    }

    const rec = hits.get(ip);
    if (!rec || now > rec.reset) {
      hits.set(ip, { count: 1, reset: now + windowMs });
      return false;
    }
    rec.count += 1;
    return rec.count > limit;
  };
}
