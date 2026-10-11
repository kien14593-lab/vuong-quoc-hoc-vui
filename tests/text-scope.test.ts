import type * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeTextScope, fitPlate, numberBadge, openTextScope, textTexture } from '../src/engine/text';

/**
 * Chữ 3D (engine/text.ts) được lưu đệm để dùng lại. Trước đây không bao giờ giải phóng: mỗi lượt trò chơi nhỏ để lại
 * vĩnh viễn mọi bảng số, nhãn đáp án của lượt đó trên GPU (8 lượt: thêm chừng 38 MB) – iPhone/iPad chơi lâu dễ mất đồ họa.
 * Giờ mỗi lượt có một phạm vi chữ: chữ vẽ mới trong lượt được giải phóng khi lượt kết thúc; chữ của khu vực giữ nguyên.
 */
const SRC = import.meta.glob<string>('../src/minigames/base.ts', { query: '?raw', import: 'default', eager: true });

// Môi trường node không có DOM: canvas giả vừa đủ cho textTexture (đo chữ 40 px mỗi kí tự, các lệnh vẽ không làm gì).
function fakeCanvas(): unknown {
  const ctx = new Proxy({ measureText: (s: string) => ({ width: s.length * 40 }) } as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
  return { width: 0, height: 0, getContext: () => ctx };
}

const g = globalThis as { document?: unknown };
let hadDocument: unknown;
beforeAll(() => {
  hadDocument = g.document;
  g.document = { createElement: () => fakeCanvas() };
});
afterAll(() => {
  g.document = hadDocument;
});

/** Đếm số lần texture bị giải phóng. */
function disposals(t: THREE.Texture): () => number {
  let n = 0;
  t.addEventListener('dispose', () => n++);
  return () => n;
}

const O = { bg: '#fff8ee', size: 60 };
const mapOf = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture;

describe('phạm vi chữ của trò chơi nhỏ', () => {
  it('chữ vẽ mới trong lượt được giải phóng khi lượt kết thúc; chữ của khu vực giữ nguyên', () => {
    const sign = textTexture('Làng Vui', O);
    const signGone = disposals(sign);
    const game = openTextScope();
    expect(textTexture('Làng Vui', O)).toBe(sign);
    const badge = mapOf(numberBadge(17, 1));
    const badgeGone = disposals(badge);
    closeTextScope(game);
    expect(badgeGone()).toBe(1);
    expect(badge.userData.shared).toBe(false);
    expect(signGone()).toBe(0);
    expect(sign.userData.shared).toBe(true);
    expect(textTexture('Làng Vui', O)).toBe(sign);
    // Lần sau vẽ bảng mới, không trả lại texture đã giải phóng.
    const game2 = openTextScope();
    expect(mapOf(numberBadge(17, 1))).not.toBe(badge);
    closeTextScope(game2);
  });

  it('fitPlate: cả bản một dòng lẫn bản hai dòng vẽ thử đều được giải phóng', () => {
    const game = openTextScope();
    fitPlate('ice cream cone', 1, 0.5, O);
    const one = textTexture('ice cream cone', O);
    const two = textTexture('ice cream\ncone', O);
    const gone = [disposals(one), disposals(two)];
    closeTextScope(game);
    expect(gone.map((n) => n())).toEqual([1, 1]);
  });

  it('"Chơi lại": lượt mới dùng lại chữ của lượt cũ; lượt cũ bị hủy sau không giải phóng mất', () => {
    const first = openTextScope();
    const a = textTexture('Chơi lại 1', O);
    const b = textTexture('Chơi lại 2', O);
    const [aGone, bGone] = [disposals(a), disposals(b)];
    // launch.ts: lượt mới dựng xong rồi engine.setStage mới hủy lượt cũ.
    const second = openTextScope();
    expect(textTexture('Chơi lại 1', O)).toBe(a);
    closeTextScope(first);
    expect(aGone()).toBe(0);
    expect(bGone()).toBe(1);
    expect(textTexture('Chơi lại 1', O)).toBe(a);
    const c = textTexture('Chơi lại 3', O);
    const cGone = disposals(c);
    closeTextScope(second);
    expect([aGone(), cGone()]).toEqual([1, 1]);
  });

  it('đóng hai lần không làm gì; hết phạm vi thì chữ vẽ sau đó là của khu vực', () => {
    const s = openTextScope();
    const t = textTexture('Một lần', O);
    const gone = disposals(t);
    closeTextScope(s);
    closeTextScope(s);
    expect(gone()).toBe(1);
    const z = textTexture('Sau đó', O);
    const zGone = disposals(z);
    const s2 = openTextScope();
    expect(textTexture('Sau đó', O)).toBe(z);
    closeTextScope(s2);
    expect(zGone()).toBe(0);
  });

  it('mỗi lượt trò chơi nhỏ mở phạm vi chữ khi tạo và đóng khi hủy', () => {
    const base = Object.values(SRC)[0];
    const ctor = base.slice(base.indexOf('  constructor('), base.indexOf('setupSky(this.scene'));
    expect(ctor).toContain('this.labels = openTextScope();');
    const dispose = base.slice(base.indexOf('  dispose(): void {'), base.indexOf('  get isDisposed'));
    expect(dispose).toContain('closeTextScope(this.labels);');
  });
});
