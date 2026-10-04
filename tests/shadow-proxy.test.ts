import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHADOW_LAYER, useShadowProxies } from '../src/engine/layers';

/**
 * Lưới bóng của bé AI lúc chạy: lớp SHADOW_LAYER chỉ bật trong lượt vẽ bóng (engine/layers.ts); lưới bóng trong
 * tệp GLB được tách khỏi mẫu và gắn vào lưới thật của từng bản sao (models/glb.ts). Cảnh GLTF giả (như GLTFLoader
 * dựng từ tệp của công cụ): một lưới hai phần dùng chung đỉnh, phần thứ hai là lưới bóng (extras.proxy).
 */
const h = vi.hoisted(() => ({ scenes: new Map<string, () => unknown>() }));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder(): void {}
    parseAsync(buf: ArrayBuffer): Promise<unknown> {
      const make = h.scenes.get(new TextDecoder().decode(buf));
      return Promise.resolve({ scene: make?.(), animations: [] });
    }
  },
}));
vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({ MeshoptDecoder: {} }));

describe('useShadowProxies: lớp lưới bóng chỉ bật khi vẽ bản đồ bóng', () => {
  function fake(impl: () => void = () => {}) {
    const seen: { on: boolean; self: unknown }[] = [];
    const shadowMap = {
      render(this: unknown, _l: unknown, _s: unknown, cam: THREE.Camera) {
        seen.push({ on: cam.layers.isEnabled(SHADOW_LAYER), self: this });
        impl();
      },
    };
    return { r: { shadowMap } as unknown as THREE.WebGLRenderer, shadowMap, seen };
  }
  const draw = (r: THREE.WebGLRenderer, cam: THREE.Camera) => r.shadowMap.render([], new THREE.Scene(), cam);

  it('bật lớp trong lúc vẽ bóng, xong trả lại như cũ (camera chính không thấy lưới bóng)', () => {
    const { r, shadowMap, seen } = fake();
    useShadowProxies(r);
    const cam = new THREE.PerspectiveCamera();
    draw(r, cam);
    expect(seen).toEqual([{ on: true, self: shadowMap }]);
    expect(cam.layers.mask).toBe(1);
  });

  it('camera đã bật sẵn lớp này thì vẫn giữ bật', () => {
    const { r, seen } = fake();
    useShadowProxies(r);
    const cam = new THREE.PerspectiveCamera();
    cam.layers.enable(SHADOW_LAYER);
    draw(r, cam);
    expect(seen[0].on).toBe(true);
    expect(cam.layers.isEnabled(SHADOW_LAYER)).toBe(true);
  });

  it('vẽ bóng bị lỗi: vẫn trả lại lớp, lỗi được báo tiếp', () => {
    const { r } = fake(() => {
      throw new Error('hỏng');
    });
    useShadowProxies(r);
    const cam = new THREE.PerspectiveCamera();
    expect(() => draw(r, cam)).toThrow('hỏng');
    expect(cam.layers.mask).toBe(1);
  });

  it('gọi nhiều lần chỉ bọc một lần', () => {
    const { r, seen } = fake();
    useShadowProxies(r);
    const once = r.shadowMap.render;
    useShadowProxies(r);
    expect(r.shadowMap.render).toBe(once);
    draw(r, new THREE.PerspectiveCamera());
    expect(seen).toHaveLength(1);
  });

  it('mất ngữ cảnh WebGL rồi có lại: three.js dựng bản đồ bóng mới – bản mới cũng được bọc', () => {
    const seen: boolean[] = [];
    const mk = () =>
      ({
        render(_l: unknown, _s: unknown, cam: THREE.Camera) {
          seen.push(cam.layers.isEnabled(SHADOW_LAYER));
        },
      }) as unknown as THREE.WebGLShadowMap;
    const canvas = new EventTarget();
    const r = { shadowMap: mk(), domElement: canvas } as unknown as THREE.WebGLRenderer;
    // Như three.js: trình nghe của bộ vẽ gắn lúc dựng (trước useShadowProxies) và thay bản đồ bóng khi có lại ngữ cảnh.
    canvas.addEventListener('webglcontextrestored', () => {
      r.shadowMap = mk();
    });
    useShadowProxies(r);
    useShadowProxies(r);
    const old = r.shadowMap;
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(r.shadowMap).not.toBe(old);
    const cam = new THREE.PerspectiveCamera();
    draw(r, cam);
    expect(seen).toEqual([true]);
    expect(cam.layers.mask).toBe(1);
    const once = r.shadowMap.render;
    useShadowProxies(r);
    expect(r.shadowMap.render).toBe(once);
    draw(r, cam);
    expect(seen).toEqual([true, true]);
  });
});

/** Hộp 8 đỉnh, 12 tam giác; lưới bóng giữ 6 tam giác (cùng thuộc tính đỉnh). */
function kidScene(o: { alphaTest?: number; skinned?: boolean; collide?: boolean } = {}): THREE.Object3D {
  const pos: number[] = [];
  for (let i = 0; i < 8; i++) pos.push(i & 1 ? 0.25 : -0.25, i & 2 ? 1 : 0, i & 4 ? 0.15 : -0.15);
  const full = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
  const position = new THREE.Float32BufferAttribute(pos, 3);
  const normal = new THREE.Float32BufferAttribute(new Array(24).fill(0), 3);
  const vis = new THREE.BufferGeometry();
  vis.setAttribute('position', position);
  vis.setAttribute('normal', normal);
  vis.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(16).fill(0), 2));
  vis.setIndex(full);
  let px = new THREE.BufferGeometry();
  px.setAttribute('position', position);
  px.setAttribute('normal', normal);
  px.setIndex(full.slice(0, 18));
  px.userData = { proxy: 1, lech: 0.004 };
  if (o.collide) px = vis;
  const mat = new THREE.MeshStandardMaterial({ name: 'Material.001', alphaTest: o.alphaTest ?? 0 });
  const bong = new THREE.MeshStandardMaterial({ name: 'bong' });
  const group = new THREE.Group();
  group.name = 'Be';
  if (o.skinned) {
    const bone = new THREE.Bone();
    group.add(bone);
    const skel = new THREE.Skeleton([bone]);
    vis.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(32).fill(0), 4));
    vis.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: 32 }, (_, i) => (i % 4 ? 0 : 1)), 4));
    px.setAttribute('skinIndex', vis.getAttribute('skinIndex'));
    px.setAttribute('skinWeight', vis.getAttribute('skinWeight'));
    for (const [g, m, name] of [[vis, mat, 'Be_0'], [px, bong, 'Be_1']] as const) {
      const sm = new THREE.SkinnedMesh(g, m);
      sm.name = name;
      group.add(sm);
      sm.bind(skel);
    }
  } else {
    const a = new THREE.Mesh(vis, mat);
    a.name = 'Be_0';
    const b = new THREE.Mesh(px, bong);
    b.name = 'Be_1';
    group.add(a, b);
  }
  const scene = new THREE.Group();
  scene.add(group);
  return scene;
}

let glb: typeof import('../src/models/glb');
let reg: typeof import('../src/models/registry');

async function load(key: string, make: () => THREE.Object3D): Promise<void> {
  const url = `${key}.glb`;
  h.scenes.set(url, make);
  glb.defineGlbModel(key, { src: url, height: 1.7 });
  await expect(glb.ensureGlb([key])).resolves.toBe(true);
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) out.push(x as THREE.Mesh);
  });
  return out;
}

beforeEach(async () => {
  h.scenes.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(new Response(url))),
  );
  vi.resetModules();
  glb = await import('../src/models/glb');
  reg = await import('../src/models/registry');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lưới bóng trong tệp GLB của bé', () => {
  it('tách khỏi mẫu, gắn vào lưới thật: chỉ ở lớp bóng, đổ bóng thay lưới thật', async () => {
    await load('kid', () => kidScene());
    const model = reg.buildModel('kid');
    const all = meshes(model);
    expect(all.some((m) => m.geometry.userData.proxy)).toBe(false);
    const vis = all.filter((m) => !m.userData.shadowProxy);
    expect(vis).toHaveLength(1);
    const [v] = vis;
    expect(v.castShadow).toBe(false);
    expect(v.userData.noShadow).toBe(true);
    const px = v.children.filter((c) => c.userData.shadowProxy) as THREE.Mesh[];
    expect(px).toHaveLength(1);
    const [p] = px;
    expect(p.layers.mask).toBe(1 << SHADOW_LAYER);
    expect(p.castShadow).toBe(true);
    expect(p.receiveShadow).toBe(false);
    expect(p.position.lengthSq() + p.rotation.x + p.rotation.y + p.rotation.z).toBe(0);
    expect(p.scale.toArray()).toEqual([1, 1, 1]);
    expect(p.geometry.index!.count).toBe(18);
    expect(p.geometry.getAttribute('position')).toBe(v.geometry.getAttribute('position'));
    expect(p.geometry.getAttribute('uv')).toBe(v.geometry.getAttribute('uv'));
    const pm = p.material as THREE.MeshBasicMaterial;
    expect([pm.name, pm.colorWrite, pm.depthWrite, pm.side]).toEqual(['bong', false, false, (v.material as THREE.Material).side]);
    // Camera chính (lớp 0) và tia chọn không thấy lưới bóng.
    expect(p.layers.test(new THREE.PerspectiveCamera().layers)).toBe(false);
    expect(v.layers.test(new THREE.PerspectiveCamera().layers)).toBe(true);
    model.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.5, 5), new THREE.Vector3(0, 0, -1));
    ray.layers.enableAll();
    const hits = ray.intersectObject(model, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((x) => x.object === v)).toBe(true);
  });

  it('các bản sao dùng chung hình học lưới bóng và vật liệu', async () => {
    await load('kid', () => kidScene());
    const proxyOf = (m: THREE.Object3D) => meshes(m).find((x) => x.userData.shadowProxy)!;
    const a = proxyOf(reg.buildModel('kid'));
    const b = proxyOf(reg.buildModel('kid'));
    expect(a).not.toBe(b);
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).toBe(b.material);
    expect(a.geometry.userData.shared).toBe(true);
  });

  it('vật liệu thủng theo ảnh (alphaTest): không dùng lưới bóng, lưới thật đổ bóng', async () => {
    await load('kid', () => kidScene({ alphaTest: 0.5 }));
    const all = meshes(reg.buildModel('kid'));
    expect(all).toHaveLength(1);
    expect(all[0].castShadow).toBe(true);
    expect(all[0].userData.noShadow).toBeUndefined();
  });

  it('mô hình có xương sẵn trong tệp: bỏ lưới bóng, giữ cách đổ bóng cũ', async () => {
    await load('kid', () => kidScene({ skinned: true }));
    const all = meshes(reg.buildModel('kid'));
    expect(all).toHaveLength(1);
    expect((all[0] as THREE.SkinnedMesh).isSkinnedMesh).toBe(true);
    expect(all[0].castShadow).toBe(true);
  });

  it('phần vật liệu "bong" dùng chung hình học với phần bên cạnh (GLTFLoader gộp): vẫn bị tách khỏi mẫu', async () => {
    await load('kid', () => kidScene({ collide: true }));
    const all = meshes(reg.buildModel('kid'));
    const vis = all.filter((m) => !m.userData.shadowProxy);
    expect(vis).toHaveLength(1);
    expect((vis[0].material as THREE.Material).name).toBe('Material.001');
  });

  it('mô hình không có lưới bóng: như cũ', async () => {
    await load('npc', () => {
      const s = kidScene();
      const g = s.children[0];
      g.remove(g.children[1]);
      return s;
    });
    const all = meshes(reg.buildModel('npc'));
    expect(all).toHaveLength(1);
    expect(all[0].castShadow).toBe(true);
    expect(all[0].children).toHaveLength(0);
  });
});
