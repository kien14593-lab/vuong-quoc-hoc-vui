import { describe, expect, it } from 'vitest';

/**
 * Bầu trời (setupSky) là ảnh gắn vào scene.background, không nằm trong cây cảnh nên disposeTree không hủy nó.
 * three dựng từ ảnh đó một khối lập phương 256² (6 mặt màu + 6 bộ đệm độ sâu) trên GPU và chỉ giải phóng khi ảnh bị hủy:
 * trước đây mỗi lượt trò chơi nhỏ để lại khoảng 3 MB bộ nhớ GPU (iPhone/iPad chơi lâu dễ mất đồ họa).
 */
const SRC = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
const FREE_SKY = '(this.scene.background as THREE.Texture | null)?.dispose?.();';

describe('giải phóng bầu trời', () => {
  it('mọi cảnh tự dựng bầu trời đều hủy scene.background khi dọn cảnh', () => {
    const scenes = Object.entries(SRC).filter(([, s]) => s.includes('setupSky(this.scene'));
    expect(scenes.map(([p]) => p)).toEqual(expect.arrayContaining(['../src/minigames/base.ts', '../src/world/title.ts', '../src/world/zone.ts']));
    for (const [path, s] of scenes) {
      const at = s.indexOf('disposeTree(this.scene);');
      expect(at, path).toBeGreaterThan(0);
      expect(s.slice(at, at + 300), path).toContain(FREE_SKY);
    }
  });

  it('trò chơi nhỏ đổi bầu trời thì hủy ảnh cũ trước', () => {
    const base = SRC['../src/minigames/base.ts'];
    const sky = base.slice(base.indexOf('  sky(top: string'), base.indexOf('setupSky(this.scene, top'));
    expect(sky).toContain(FREE_SKY);
  });
});
