import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { dropSky, keepSky, SKY_KEEP } from '../src/minigames/sky-cache';

/**
 * Bầu trời (setupSky) là ảnh gắn vào scene.background, không nằm trong cây cảnh nên disposeTree không hủy nó.
 * three dựng từ ảnh đó một khối lập phương 256² (6 mặt màu + 6 bộ đệm độ sâu) trên GPU và chỉ giải phóng khi ảnh bị hủy:
 * trước đây mỗi lượt trò chơi nhỏ để lại khoảng 3 MB bộ nhớ GPU (iPhone/iPad chơi lâu dễ mất đồ họa).
 */
const SRC = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
const FREE_SKY = '(this.scene.background as THREE.Texture | null)?.dispose?.();';
// Trò chơi nhỏ giữ lại vài ảnh bầu trời cho lượt sau (sky-cache.ts): dropSky hủy mọi ảnh không còn được giữ.
const DROP_SKY = 'dropSky(this.scene.background);';
const BASE = '../src/minigames/base.ts';

describe('giải phóng bầu trời', () => {
  it('mọi cảnh tự dựng bầu trời đều hủy scene.background khi dọn cảnh', () => {
    const scenes = Object.entries(SRC).filter(([, s]) => s.includes('setupSky(this.scene'));
    expect(scenes.map(([p]) => p)).toEqual(expect.arrayContaining([BASE, '../src/world/title.ts', '../src/world/zone.ts']));
    for (const [path, s] of scenes) {
      const at = s.indexOf('disposeTree(this.scene);');
      expect(at, path).toBeGreaterThan(0);
      expect(s.slice(at, at + 300), path).toContain(path === BASE ? DROP_SKY : FREE_SKY);
    }
  });

  it('trò chơi nhỏ đổi bầu trời thì hủy ảnh cũ trước', () => {
    const base = SRC[BASE];
    const sky = base.slice(base.indexOf('  sky(top: string'), base.indexOf('setupSky(this.scene, top'));
    expect(sky).toContain(DROP_SKY);
  });
});

describe('ảnh bầu trời giữ lại cho lượt sau', () => {
  const tex = () => ({ isTexture: true, dispose: vi.fn() }) as unknown as THREE.Texture & { dispose: ReturnType<typeof vi.fn> };

  it('cùng màu thì dùng lại ảnh cũ, hủy ảnh mới (chưa lên GPU); ảnh đang giữ không bị dropSky hủy', () => {
    const a = tex();
    const b = tex();
    expect(keepSky('same|1', a)).toBe(a);
    expect(keepSky('same|1', b)).toBe(a);
    expect(b.dispose).toHaveBeenCalledTimes(1);
    dropSky(a);
    expect(a.dispose).not.toHaveBeenCalled();
  });

  it('ảnh không được giữ thì dropSky hủy', () => {
    const t = tex();
    dropSky(t);
    expect(t.dispose).toHaveBeenCalledTimes(1);
    expect(() => dropSky(null)).not.toThrow();
  });

  it(`giữ tối đa ${SKY_KEEP} ảnh: ảnh lâu chưa dùng nhất bị đẩy ra và hủy`, () => {
    const ts = Array.from({ length: SKY_KEEP + 2 }, tex);
    ts.forEach((t, i) => keepSky(`lru|${i}`, t));
    expect(ts.map((t) => t.dispose.mock.calls.length)).toEqual(ts.map((_, i) => (i < 2 ? 1 : 0)));
  });

  it('ảnh vừa dùng lại thành ảnh mới nhất, không bị đẩy ra trước', () => {
    const a = tex();
    keepSky('touch|0', a);
    for (let i = 1; i < SKY_KEEP; i++) keepSky(`touch|${i}`, tex());
    keepSky('touch|0', tex());
    keepSky('touch|new', tex());
    expect(a.dispose).not.toHaveBeenCalled();
  });
});
