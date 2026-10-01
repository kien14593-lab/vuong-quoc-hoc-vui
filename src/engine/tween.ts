import { engine } from './core';

/** Hàm làm mượt chuyển động. */
export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t: number) => {
    const c1 = 1.70158;
    return (c1 + 1) * t * t * t - c1 * t * t;
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  sine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};
export type EaseName = keyof typeof ease;
export type Ease = EaseName | ((t: number) => number);

interface Job {
  start: number;
  dur: number;
  ease: (t: number) => number;
  update: (k: number) => void;
  done: () => void;
  owner?: unknown;
  cancelled: boolean;
}

export interface Handle extends Promise<void> {
  cancel(): void;
}

const jobs = new Set<Job>();
let hooked = false;

function ensureHook(): void {
  if (hooked) return;
  hooked = true;
  engine.onFrame((_dt, t) => {
    for (const j of [...jobs]) {
      if (j.cancelled) {
        jobs.delete(j);
        continue;
      }
      if (t < j.start) continue;
      const k = j.dur <= 0 ? 1 : Math.min(1, (t - j.start) / j.dur);
      try {
        j.update(j.ease(k));
      } catch (e) {
        console.error(e);
      }
      if (k >= 1) {
        jobs.delete(j);
        j.done();
      }
    }
  });
}

export interface TweenOpts {
  delay?: number;
  ease?: Ease;
  owner?: unknown;
}

/** Chạy hàm `update(k)` với k đi từ 0 → 1 trong `dur` giây. */
export function tween(dur: number, update: (k: number) => void, o: TweenOpts = {}): Handle {
  ensureHook();
  let resolveFn!: () => void;
  const p = new Promise<void>((r) => (resolveFn = r)) as Handle;
  const e = o.ease ?? 'outCubic';
  const job: Job = {
    start: engine.t + (o.delay ?? 0),
    dur,
    ease: typeof e === 'function' ? e : ease[e],
    update,
    done: resolveFn,
    owner: o.owner,
    cancelled: false,
  };
  jobs.add(job);
  p.cancel = () => {
    if (!job.cancelled) {
      job.cancelled = true;
      jobs.delete(job);
      resolveFn();
    }
  };
  return p;
}

/** Đổi dần các thuộc tính số của một đối tượng (hỗ trợ đường dẫn 'position.y'). */
export function animate(target: object, to: Record<string, number>, dur: number, o: TweenOpts = {}): Handle {
  const entries = Object.entries(to).map(([path, end]) => {
    const parts = path.split('.');
    const last = parts.pop()!;
    let obj = target as Record<string, unknown>;
    for (const p of parts) obj = obj[p] as Record<string, unknown>;
    return { obj, last, from: NaN, end };
  });
  let started = false;
  return tween(
    dur,
    (k) => {
      if (!started) {
        started = true;
        for (const en of entries) en.from = en.obj[en.last] as number;
      }
      for (const en of entries) en.obj[en.last] = en.from + (en.end - en.from) * k;
    },
    o,
  );
}

/** Chờ `sec` giây (theo thời gian trò chơi). */
export function wait(sec: number, owner?: unknown): Handle {
  return tween(sec, () => {}, { owner, ease: 'linear' });
}

/** Gọi `fn` mỗi `sec` giây cho đến khi hủy. */
export function every(sec: number, fn: () => void): () => void {
  let stop = false;
  let h: Handle | null = null;
  const loop = () => {
    if (stop) return;
    h = wait(sec);
    void h.then(() => {
      if (!stop) {
        fn();
        loop();
      }
    });
  };
  loop();
  return () => {
    stop = true;
    h?.cancel();
  };
}

/** Hủy mọi chuyển động thuộc về `owner` (gọi khi rời khu vực). */
export function cancelOwner(owner: unknown): void {
  for (const j of [...jobs]) {
    if (j.owner === owner) {
      j.cancelled = true;
      jobs.delete(j);
      j.done();
    }
  }
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** Nội suy mượt độc lập khung hình: tiến về đích với "tốc độ" `rate` (1/giây). */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
export function dampAngle(a: number, b: number, rate: number, dt: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-rate * dt));
}
