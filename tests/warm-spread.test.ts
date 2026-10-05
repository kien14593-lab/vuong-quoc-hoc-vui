import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { engine } from '../src/engine/core';

/**
 * Engine.warmUp đưa ảnh lên GPU: sau màn che thì đưa hết một lượt như cũ; đang chơi (mô hình AI tải xong muộn, đổi
 * bộ đồ...) thì đưa dần ngay sau từng khung hình, mỗi lần chừng 4 ms – ảnh lớn không dồn vào một lần khựng.
 * Bộ vẽ giả: mỗi ảnh đưa lên tốn `cost` ms trên đồng hồ giả.
 */
let clock = 0;
let frames: FrameRequestCallback[] = [];
let uploads: string[][] = [];

function fakeRenderer(cost: number): THREE.WebGLRenderer {
  const props = new WeakMap<object, { __version?: number }>();
  const get = (t: object) => {
    let p = props.get(t);
    if (!p) props.set(t, (p = {}));
    return p;
  };
  return {
    properties: { get },
    initTexture: (t: THREE.Texture) => {
      const p = get(t);
      if (p.__version === t.version) return;
      clock += cost;
      p.__version = t.version;
      uploads[uploads.length - 1].push(t.name);
    },
    extensions: { has: () => false },
  } as unknown as THREE.WebGLRenderer;
}

function tex(name: string): THREE.Texture {
  const t = new THREE.Texture({ width: 1024, height: 1024 });
  t.name = name;
  t.needsUpdate = true;
  return t;
}

/** Mô hình có `n` vật liệu, mỗi vật liệu hai ảnh (màu + pháp tuyến) như mô hình AI. */
function model(n: number): { obj: THREE.Group; texs: THREE.Texture[] } {
  const obj = new THREE.Group();
  const texs: THREE.Texture[] = [];
  for (let i = 0; i < n; i++) {
    const map = tex(`m${i}`);
    const normalMap = tex(`n${i}`);
    texs.push(map, normalMap);
    obj.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial({ map, normalMap })));
  }
  return { obj, texs };
}

/** Vẽ một khung hình rồi để việc chen sau khung hình chạy xong. */
async function frame(): Promise<void> {
  uploads.push([]);
  const q = frames.splice(0);
  for (const cb of q) cb(clock);
  await new Promise((r) => setTimeout(r, 5));
}

describe('warmUp: đưa ảnh lên GPU', () => {
  beforeEach(() => {
    clock = 0;
    frames = [];
    uploads = [[]];
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    engine.lost = false;
    engine.setLoading(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('đang chơi: không đưa ảnh nào ngay lúc gọi; sau mỗi khung hình một ảnh lớn (7 ms > 4 ms), xong mới hết chờ', async () => {
    engine.renderer = fakeRenderer(7);
    const { obj } = model(2);
    let done = false;
    void engine.warmUp(obj).then(() => (done = true));
    expect(uploads).toEqual([[]]);
    for (let i = 0; i < 4; i++) {
      expect(done).toBe(false);
      await frame();
    }
    await frame();
    expect(uploads).toEqual([[], ['m0'], ['n0'], ['m1'], ['n1'], []]);
    expect(done).toBe(true);
  });

  it('ảnh nhỏ: một lần sau khung hình đưa được vài ảnh (tới khi đủ 4 ms)', async () => {
    engine.renderer = fakeRenderer(1.5);
    const { obj } = model(3);
    const warm = engine.warmUp(obj);
    await frame();
    await frame();
    await warm;
    expect(uploads).toEqual([[], ['m0', 'n0', 'm1'], ['n1', 'm2', 'n2']]);
  });

  it('sau màn che: đưa hết ảnh một lượt ngay lúc gọi (như cũ)', async () => {
    engine.renderer = fakeRenderer(7);
    const { obj } = model(2);
    engine.setLoading(true);
    await engine.warmUp(obj);
    expect(uploads).toEqual([['m0', 'n0', 'm1', 'n1']]);
    expect(frames.length).toBe(0);
  });

  it('ảnh đã lên GPU (lần vẽ đầu đã đưa) thì thôi; ảnh bị hủy giữa chừng thì không đưa lên lại', async () => {
    const r = fakeRenderer(7);
    engine.renderer = r;
    const { obj, texs } = model(2);
    const warm = engine.warmUp(obj);
    await frame();
    r.initTexture(texs[2]);
    texs[1].dispose();
    await frame();
    await frame();
    await warm;
    expect(uploads.flat()).toEqual(['m0', 'm1', 'n1']);
  });

  it('mất ngữ cảnh WebGL giữa chừng: thôi, không đưa tiếp', async () => {
    engine.renderer = fakeRenderer(7);
    const { obj } = model(2);
    const warm = engine.warmUp(obj);
    await frame();
    engine.lost = true;
    await frame();
    await warm;
    expect(uploads.flat()).toEqual(['m0']);
    engine.lost = false;
  });
});
