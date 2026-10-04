import { describe, expect, it } from 'vitest';
import { detectTouch } from '../src/core/device';
import { DrsPolicy, TOUCH_PIXEL_BUDGET, touchLadder } from '../src/engine/drs';

/**
 * Tự chỉnh độ nét 3D trên máy cảm ứng (engine/drs.ts): mô phỏng máy vẽ theo nhịp màn hình (60 hoặc 30 khung/giây),
 * khung nào vẽ quá một nhịp thì hiện ở nhịp sau – như Safari trên iPhone / iPad.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Một cửa sổ 2 giây: thời gian từng khung (ms), xếp tăng dần. `cost`: thời gian vẽ trung bình; dao động ±`jitter`. */
function window2s(cost: number, hz: number, jitter: number, rand: () => number): number[] {
  const period = 1000 / hz;
  const out: number[] = [];
  let sum = 0;
  while (sum < 2000) {
    const c = cost * (1 + jitter * (rand() + rand() + rand() - 1.5) * 2);
    const ms = Math.max(1, Math.ceil(c / period - 1e-9)) * period;
    out.push(ms);
    sum += ms;
  }
  return out.sort((a, b) => a - b);
}

interface Run {
  levels: number[];
  changes: number;
  /** Tỉ lệ khung hình trễ (> 20,8 ms) khi màn hình chạy 60 khung/giây. */
  jank: number;
}

function simulate(p: DrsPolicy, windows: number, cost: (level: number) => number, o: { hz?: number; jitter?: number; seed?: number } = {}): Run {
  const rand = rng(o.seed ?? 7);
  const levels: number[] = [];
  let changes = 0;
  let late = 0;
  let total = 0;
  for (let i = 0; i < windows; i++) {
    const ms = window2s(cost(p.level), o.hz ?? 60, o.jitter ?? 0.08, rand);
    for (const v of ms) if (v > 20.8) late++;
    total += ms.length;
    if (p.window(ms)) changes++;
    levels.push(p.level);
  }
  return { levels, changes, jank: late / total };
}

/** iPad (gen 7) nằm ngang: 1080×810 điểm, tỉ lệ 2 → các nấc [1,51; 1,25; 1]. Thời gian vẽ tỉ lệ với số điểm ảnh. */
const IPAD = touchLadder(2, 1080, 810);
function gpuBound(ms0: number): (level: number) => number {
  return (level) => {
    const r = IPAD[Math.min(level, IPAD.length - 1)];
    return ms0 * ((r * r) / (IPAD[0] * IPAD[0])) * (level >= IPAD.length ? 0.9 : 1);
  };
}

function ipadPolicy(): DrsPolicy {
  const p = new DrsPolicy();
  p.setSteps(IPAD.length);
  return p;
}

describe('touchLadder – các nấc tỉ lệ điểm ảnh', () => {
  it('iPad (gen 7) nằm ngang: nét nhất vừa ngân sách ~2 triệu điểm ảnh', () => {
    expect(IPAD.map((r) => +r.toFixed(3))).toEqual([1.512, 1.25, 1]);
    const px = 1080 * 810 * IPAD[0] * IPAD[0];
    expect(px).toBeLessThanOrEqual(TOUCH_PIXEL_BUDGET + 1);
    expect(Math.round(1080 * IPAD[0])).toBe(1633);
  });

  it('iPhone 13 nằm ngang (tỉ lệ 3): tối đa 2, hạ dần tới 1', () => {
    expect(touchLadder(3, 750, 342)).toEqual([2, 1.75, 1.5, 1.25, 1]);
    expect(touchLadder(3, 844, 390)).toEqual([2, 1.75, 1.5, 1.25, 1]);
  });

  it('màn hình tỉ lệ 1: chỉ một nấc', () => {
    expect(touchLadder(1, 1280, 800)).toEqual([1]);
  });

  it('không bao giờ vượt ngân sách (trừ nấc 1) và luôn giảm dần', () => {
    for (const [dpr, w, h] of [
      [2, 1366, 1024],
      [2, 1024, 768],
      [3, 932, 430],
      [2, 667, 375],
      [2.625, 915, 412],
      [1.5, 1280, 800],
      [2, 810, 1080],
    ]) {
      const l = touchLadder(dpr, w, h);
      expect(l[l.length - 1]).toBe(1);
      for (let i = 1; i < l.length; i++) expect(l[i]).toBeLessThan(l[i - 1]);
      if (l[0] > 1) expect(w * h * l[0] * l[0]).toBeLessThanOrEqual(TOUCH_PIXEL_BUDGET + 1);
      expect(l[0]).toBeLessThanOrEqual(Math.min(2, dpr));
    }
  });
});

describe('detectTouch – máy cảm ứng', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

  it('iPhone, Android: có', () => {
    expect(detectTouch(true, 5, IPHONE)).toBe(true);
    expect(detectTouch(true, 5, ANDROID)).toBe(true);
  });

  it('iPad đời mới báo là máy Mac: vẫn nhận ra (kể cả khi gắn bàn di chuột)', () => {
    expect(detectTouch(true, 5, IPADOS, 'MacIntel')).toBe(true);
    expect(detectTouch(false, 5, IPADOS, 'MacIntel')).toBe(true);
  });

  it('máy Mac, máy tính Windows (kể cả màn hình cảm ứng dùng chuột): không', () => {
    expect(detectTouch(false, 0, IPADOS, 'MacIntel')).toBe(false);
    expect(detectTouch(false, 0, WIN, 'Win32')).toBe(false);
    expect(detectTouch(false, 10, WIN, 'Win32')).toBe(false);
    expect(detectTouch(true, 1, WIN, 'Win32')).toBe(false);
    expect(detectTouch(false, 0, WIN, 'Win32', true)).toBe(false);
    expect(detectTouch(true, 0, WIN, 'Win32', false)).toBe(false);
  });

  it('trình duyệt không báo số điểm chạm nhưng có sự kiện chạm + ngón tay: có', () => {
    expect(detectTouch(true, 0, IPHONE, 'iPhone', true)).toBe(true);
  });
});

describe('DrsPolicy – tự hạ / nâng độ nét', () => {
  it('máy dư sức (60 khung/giây): không đổi gì', () => {
    const p = ipadPolicy();
    const r = simulate(p, 300, () => 8);
    expect(r.changes).toBe(0);
    expect(p.level).toBe(0);
  });

  it('chế độ nguồn điện thấp (luôn 30 khung/giây dù vẽ nhẹ): thử hạ rất ít lần rồi trả lại như cũ', () => {
    const p = ipadPolicy();
    const r = simulate(p, 300, () => 8, { hz: 30 });
    expect(r.changes).toBeLessThanOrEqual(4);
    expect(p.level).toBe(0);
    expect(r.levels.filter((l) => l !== 0).length).toBeLessThanOrEqual(8);
  });

  it('vẽ không kịp ở độ nét cao nhất (30 khung/giây), nhẹ hơn thì 60: hạ xuống, giữ lại, hiếm khi thử nâng', () => {
    const p = ipadPolicy();
    const r = simulate(p, 300, gpuBound(22));
    const tail = r.levels.slice(150);
    expect(tail.filter((l) => l === 2).length / tail.length).toBeGreaterThan(0.85);
    expect(r.jank).toBeLessThan(0.05);
  });

  it('nấc giữa vừa sức: dừng ở nấc giữa', () => {
    const p = ipadPolicy();
    const r = simulate(p, 300, gpuBound(19));
    const tail = r.levels.slice(150);
    expect(tail.filter((l) => l === 1).length / tail.length).toBeGreaterThan(0.9);
    expect(r.jank).toBeLessThan(0.05);
  });

  it('máy rất yếu: xuống nấc nhẹ nhất kèm bóng nhỏ', () => {
    const p = ipadPolicy();
    simulate(p, 60, () => 45);
    expect(p.level).toBe(p.max);
  });

  it('một lúc khựng (tải mô hình) không làm hạ độ nét', () => {
    const p = ipadPolicy();
    expect(p.window(window2s(60, 60, 0, rng(1)))).toBe(false);
    for (let i = 0; i < 20; i++) p.window(window2s(8, 60, 0.08, rng(i)));
    expect(p.level).toBe(0);
  });

  it('đang tải cảnh sau màn che: không tính', () => {
    const p = ipadPolicy();
    p.loading = true;
    const r = simulate(p, 30, () => 45);
    expect(r.changes).toBe(0);
    expect(p.level).toBe(0);
  });

  it('đổi số nấc (đổi kích thước khung vẽ): mức "bóng nhỏ" vẫn là mức cuối', () => {
    const p = ipadPolicy();
    p.safeMode();
    expect(p.level).toBe(3);
    p.setSteps(5);
    expect([p.level, p.max]).toEqual([5, 5]);
    p.setSteps(2);
    expect([p.level, p.max]).toEqual([2, 2]);
    p.reset();
    expect(p.level).toBe(0);
  });

  it('sau khi mất hình 3D (thiếu bộ nhớ): ở mức nhẹ nhất rất lâu', () => {
    const p = ipadPolicy();
    p.safeMode();
    const r = simulate(p, 60, () => 6);
    expect(r.levels.every((l) => l === p.max)).toBe(true);
  });
});
