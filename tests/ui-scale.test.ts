import { describe, expect, it } from 'vitest';
import { scaleFor } from '../src/ui/root';
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

describe('needsRotate', () => {
  it('chỉ nhắc xoay ngang khi điện thoại cảm ứng cầm dựng đứng', () => {
    expect(needsRotate(true, 390, 664)).toBe(true);
    expect(needsRotate(true, 430, 932)).toBe(true);
    expect(needsRotate(true, 750, 342)).toBe(false);
    expect(needsRotate(true, 810, 1080)).toBe(false);
    expect(needsRotate(false, 390, 664)).toBe(false);
  });
});
