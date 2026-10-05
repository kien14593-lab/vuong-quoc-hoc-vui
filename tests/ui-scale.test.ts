import { describe, expect, it } from 'vitest';
import { layoutFor, scaleFor } from '../src/ui/root';
import { needsRotate } from '../src/ui/rotate';

/** Tỉ lệ giao diện (ui/root.ts): máy tính giữ nguyên, điện thoại / iPad dựng đứng được phóng to cho chữ dễ đọc. */
describe('scaleFor', () => {
  it('máy tính và iPad nằm ngang: giữ đúng tỉ lệ cũ min(W/1920, H/1080)', () => {
    for (const [w, h] of [
      [1920, 1080],
      [2560, 1440],
      [1366, 768],
      [1280, 720],
      [1536, 864],
      [1440, 900],
      [1080, 810],
      [1024, 768],
    ]) {
      const r = scaleFor(w, h);
      expect(r.s).toBeCloseTo(Math.min(w / 1920, h / 1080), 6);
      expect(r.compact).toBe(false);
    }
  });

  it('điện thoại nằm ngang: chữ 30px logic thành ≥ 15.5px thật, vùng logic không nhỏ hơn 1280×640', () => {
    for (const [w, h] of [
      [750, 342],
      [667, 375],
      [844, 390],
      [932, 430],
      [568, 320],
    ]) {
      const r = scaleFor(w, h);
      expect(r.compact).toBe(true);
      expect(w / r.s).toBeGreaterThanOrEqual(1280 - 1e-6);
      expect(h / r.s).toBeGreaterThanOrEqual(640 - 1e-6);
      if (w >= 667) expect(30 * r.s).toBeGreaterThanOrEqual(15.5);
    }
    expect(scaleFor(750, 342).s).toBeCloseTo(16 / 30, 6);
    expect(scaleFor(667, 375).s).toBeCloseTo(667 / 1280, 6);
  });

  it('iPad dựng đứng: phóng to, không nhỏ hơn tỉ lệ cũ', () => {
    const r = scaleFor(810, 1080);
    expect(r.compact).toBe(true);
    expect(r.s).toBeCloseTo(16 / 30, 6);
    expect(r.s).toBeGreaterThan(810 / 1920);
  });

  it('không bao giờ nhỏ hơn tỉ lệ cũ', () => {
    for (let w = 300; w <= 4000; w += 97) {
      for (let h = 200; h <= 3000; h += 89) {
        expect(scaleFor(w, h).s).toBeGreaterThanOrEqual(Math.min(w / 1920, h / 1080) - 1e-9);
      }
    }
  });
});

describe('layoutFor (lề an toàn: tai thỏ, vạch Home)', () => {
  it('không có lề (máy tính, iPhone SE, iPad): giống hệt scaleFor, giao diện phủ toàn cửa sổ', () => {
    for (const [w, h] of [
      [1920, 1080],
      [1366, 768],
      [1280, 720],
      [750, 342],
      [667, 375],
      [810, 1080],
    ]) {
      const L = layoutFor(w, h);
      const r = scaleFor(w, h);
      expect(L.s).toBe(r.s);
      expect(L.compact).toBe(r.compact);
      expect(L.w).toBeCloseTo(w / r.s, 9);
      expect(L.h).toBeCloseTo(h / r.s, 9);
      expect(L.rootW).toBeCloseTo(L.w, 9);
      expect(L.rootH).toBeCloseTo(L.h, 9);
      expect(L.sa).toEqual({ t: 0, r: 0, b: 0, l: 0 });
    }
  });

  it('iPhone 13 trong Safari nằm ngang (844×342, tai thỏ 47, vạch Home 21): tỉ lệ theo vùng an toàn 750×321', () => {
    const ins = { t: 0, r: 47, b: 21, l: 47 };
    const L = layoutFor(844, 342, ins);
    expect(L.s).toBe(scaleFor(750, 321).s);
    expect(L.compact).toBe(true);
    expect(30 * L.s).toBeGreaterThanOrEqual(15);
    expect(88 * L.s).toBeGreaterThanOrEqual(44);
    expect(L.w * L.s).toBeCloseTo(750, 9);
    expect(L.h * L.s).toBeCloseTo(321, 9);
    expect(L.rootW * L.s).toBeCloseTo(844, 9);
    expect(L.rootH * L.s).toBeCloseTo(342, 9);
    expect(L.sa.l * L.s).toBeCloseTo(47, 9);
    expect(L.sa.b * L.s).toBeCloseTo(21, 9);
    expect(L.sa.l + L.w + L.sa.r).toBeCloseTo(L.rootW, 9);
    expect(L.sa.t + L.h + L.sa.b).toBeCloseTo(L.rootH, 9);
  });

  it('mở từ màn hình chính (844×390): chữ 30px logic = 16px thật', () => {
    const L = layoutFor(844, 390, { t: 0, r: 47, b: 21, l: 47 });
    expect(L.s).toBeCloseTo(16 / 30, 9);
    expect(L.h).toBeCloseTo(369 / L.s, 9);
  });

  it('lề lớn hơn cửa sổ: không chia cho 0', () => {
    const L = layoutFor(100, 100, { t: 80, r: 80, b: 80, l: 80 });
    expect(Number.isFinite(L.s)).toBe(true);
    expect(L.s).toBeGreaterThan(0);
  });
});

describe('needsRotate', () => {
  it('chỉ nhắc xoay ngang khi điện thoại cảm ứng cầm dựng đứng', () => {
    expect(needsRotate(true, 390, 664)).toBe(true);
    expect(needsRotate(true, 430, 932)).toBe(true);
    expect(needsRotate(true, 750, 342)).toBe(false);
    expect(needsRotate(true, 810, 1080)).toBe(false);
    expect(needsRotate(false, 390, 664)).toBe(false);
  });
});
