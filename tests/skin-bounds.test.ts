import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimState, Rig } from '../src/models/rig';
import type { BakedRig } from '../src/models/autorig';

/**
 * Bé AI có xương tự dựng (glb.ts buildRigged): lưới có xương mới dựng không có khối cầu bao thì ở khung hình đầu
 * three.js tính lại bằng xương cho từng đỉnh (WebGLRenderer.projectObject → SkinnedMesh.computeBoundingSphere) –
 * với bé thật (~32 nghìn đỉnh, 3 lưới: thật, bóng, hình bóng khi bị che) mất hàng trăm ms mỗi lần vào khu vực.
 * Ở đây: bé giả dáng chữ A (hộp), xương dò sẵn như công cụ ghi vào config.json, trọng số da nằm trong "tệp".
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
// Bàn phím, âm thanh gắn vào window lúc nạp (môi trường thử không có window).
vi.mock('../src/world/input', () => ({ K: {}, keys: {}, moveVector: () => ({ x: 0, y: 0 }), virtualMag: () => 0 }));
vi.mock('../src/core/audio', () => ({ sfx: {} }));

type V3 = [number, number, number];
const ARM = Math.PI / 4;
const J = { pelvis: [0, 0.8, 0], neck: [0, 1.3, 0], shoulderL: [0.2, 1.25, 0], shoulderR: [-0.2, 1.25, 0], hipL: [0.1, 0.8, 0], hipR: [-0.1, 0.8, 0] } satisfies Record<string, V3>;
const hand = (s: number): V3 => [s * (0.2 + 0.5 * Math.sin(ARM)), 1.25 - 0.5 * Math.cos(ARM), 0];

const RIG: BakedRig = {
  v: 0,
  rotY: 0,
  ok: true,
  walk: true,
  fail: [],
  warnings: [],
  metrics: { crotch: 0.47, legExtra: [0, 0], armExtra: [0, 0], legDepth: [0, 0], armDepth: [0, 0] },
  height: 1.7,
  joints: J,
  relax: [0.45, 0.45],
  armAngle: [ARM, ARM],
  anchors: {
    head: [0, 1.5, 0],
    headR: [0.2, 0.21, 0.19],
    headTop: 1.7,
    faceZ: 0.2,
    neck: J.neck,
    chestY: 1.1,
    chestFrontZ: 0.12,
    chestBackZ: -0.12,
    chestHalfW: 0.2,
    shoulderL: J.shoulderL,
    shoulderR: J.shoulderR,
    handL: hand(1),
    handR: hand(-1),
    pelvis: J.pelvis,
  },
};

/** Hộp từ `a` tới `b` (theo trục a→b), dày 2·t; mọi đỉnh theo xương `bone` (thứ tự body, head, armL, armR, legL, legR). */
function part(out: { pos: number[]; bone: number[]; idx: number[] }, a: V3, b: V3, t: number, bone: number): void {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const u = new THREE.Vector3(0, 0, 1);
  const w = new THREE.Vector3().crossVectors(d, u).normalize();
  const n0 = out.pos.length / 3;
  for (let i = 0; i < 8; i++) {
    const p = A.clone()
      .addScaledVector(d, i & 1 ? 1 : 0)
      .addScaledVector(w, i & 2 ? t : -t)
      .addScaledVector(u, i & 4 ? t : -t);
    out.pos.push(p.x, p.y, p.z);
    out.bone.push(bone);
  }
  const f = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
  out.idx.push(...f.map((k) => n0 + k));
}

/** Bé giả cao 1,7 (chân ở y = 0), tay dang 45°; kèm lưới bóng trong tệp (cùng đỉnh, ít tam giác hơn). */
function kidScene(): THREE.Object3D {
  const o = { pos: [] as number[], bone: [] as number[], idx: [] as number[] };
  part(o, [0, 0.75, 0], [0, 1.3, 0], 0.18, 0);
  part(o, [0, 1.28, 0.01], [0, 1.7, 0.01], 0.19, 1);
  part(o, J.shoulderL, hand(1), 0.05, 2);
  part(o, J.shoulderR, hand(-1), 0.05, 3);
  part(o, [0.1, 0.8, 0], [0.1, 0, 0], 0.07, 4);
  part(o, [-0.1, 0.8, 0], [-0.1, 0, 0], 0.07, 5);
  const n = o.pos.length / 3;
  const position = new THREE.Float32BufferAttribute(o.pos, 3);
  const normal = new THREE.Float32BufferAttribute(new Array(n * 3).fill(0), 3);
  const vis = new THREE.BufferGeometry();
  vis.setAttribute('position', position);
  vis.setAttribute('normal', normal);
  vis.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0), 2));
  vis.setAttribute('_skin_index', new THREE.Uint8BufferAttribute(o.bone.flatMap((b) => [b, 0, 0, 0]), 4));
  vis.setAttribute('_skin_weight', new THREE.Float32BufferAttribute(o.bone.flatMap(() => [1, 0, 0, 0]), 4));
  vis.setIndex(o.idx);
  const px = new THREE.BufferGeometry();
  px.setAttribute('position', position);
  px.setAttribute('normal', normal);
  px.setIndex(o.idx.filter((_, i) => i % 36 < 18));
  px.userData = { proxy: 1, lech: 0.004 };
  const group = new THREE.Group();
  group.name = 'Be';
  const a = new THREE.Mesh(vis, new THREE.MeshStandardMaterial({ name: 'Material.001' }));
  a.name = 'Be_0';
  const b = new THREE.Mesh(px, new THREE.MeshStandardMaterial({ name: 'bong' }));
  b.name = 'Be_1';
  group.add(a, b);
  const scene = new THREE.Group();
  scene.add(group);
  return scene;
}

let glb: typeof import('../src/models/glb');
let reg: typeof import('../src/models/registry');

function skinned(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((x) => {
    if ((x as THREE.SkinnedMesh).isSkinnedMesh) out.push(x as THREE.SkinnedMesh);
  });
  return out;
}

/** Tỉ lệ lớn nhất (khoảng cách đỉnh đã uốn theo xương tới tâm) / bán kính, mọi lưới có xương trong `root`. */
function reach(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let worst = 0;
  for (const sm of skinned(root)) {
    const s = sm.boundingSphere!;
    const n = sm.geometry.getAttribute('position').count;
    for (let i = 0; i < n; i++) worst = Math.max(worst, sm.getVertexPosition(i, v).distanceTo(s.center) / s.radius);
  }
  return worst;
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
  const { RIG_VERSION } = await import('../src/models/autorig');
  h.scenes.set('kid.glb', kidScene);
  glb.defineGlbModel('kid', { src: 'kid.glb', height: 1.7, autoRig: true, rig: { ...RIG, v: RIG_VERSION } });
  await expect(glb.ensureGlb(['kid'])).resolves.toBe(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bé AI có xương tự dựng: khối cầu bao có sẵn', () => {
  it('lưới thật & lưới bóng có khối cầu bao ngay khi dựng – three.js khỏi tính lại bằng xương', async () => {
    const calc = vi.spyOn(THREE.SkinnedMesh.prototype, 'computeBoundingSphere');
    const a = reg.buildModel('kid');
    const b = reg.buildModel('kid');
    expect(a.userData.rigged).toBe(true);
    const [vis, ...rest] = skinned(a);
    expect(vis).toBeInstanceOf(THREE.SkinnedMesh);
    expect(rest).toHaveLength(1);
    expect(rest[0].userData.shadowProxy).toBe(true);
    for (const sm of [...skinned(a), ...skinned(b)]) {
      expect(sm.boundingSphere, sm.name).not.toBeNull();
      // Khung hộp để trống như cũ (Box3/tia chọn vẫn đo theo tư thế thật).
      expect(sm.boundingBox).toBeNull();
    }
    expect(rest[0].boundingSphere).toEqual(vis.boundingSphere);
    expect(rest[0].boundingSphere).not.toBe(vis.boundingSphere);
    // Mỗi bản sao một khối cầu riêng.
    expect(skinned(b)[0].boundingSphere).toEqual(vis.boundingSphere);
    expect(skinned(b)[0].boundingSphere).not.toBe(vis.boundingSphere);
    // Như WebGLRenderer.projectObject ở khung hình đầu.
    for (const sm of skinned(a)) if (sm.boundingSphere === null) sm.computeBoundingSphere();
    expect(calc).not.toHaveBeenCalled();
  });

  it('xương ở tư thế gốc: đỉnh uốn theo xương trùng đỉnh trong tệp (khối cầu tính từ hình học là đúng)', () => {
    const root = reg.buildModel('kid');
    const rig = root.userData.rig as Rig;
    rig.armL!.rotation.z = 0;
    rig.armR!.rotation.z = 0;
    root.updateMatrixWorld(true);
    const [sm] = skinned(root);
    const pos = sm.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    const p = new THREE.Vector3();
    let err = 0;
    for (let i = 0; i < pos.count; i++) err = Math.max(err, sm.getVertexPosition(i, v).distanceTo(p.fromBufferAttribute(pos, i)));
    expect(err).toBeLessThan(1e-5);
    const g = sm.geometry.clone();
    g.computeBoundingSphere();
    expect(sm.boundingSphere!.center.distanceTo(g.boundingSphere!.center)).toBeLessThan(1e-6);
    expect(sm.boundingSphere!.radius).toBeCloseTo(g.boundingSphere!.radius * 1.15, 6);
  });

  it('khối cầu vẫn chứa trọn bé khi đi, chạy, nhảy, ngồi ván, vui mừng giơ tay, vẫy tay', async () => {
    const { animateRig } = await import('../src/models/rig');
    const states: [string, Partial<AnimState>][] = [
      ['đứng yên', { move: 0 }],
      ['đi', { move: 1 }],
      ['chạy', { move: 1.4, run: true }],
      ['nhảy', { move: 0, air: true }],
      ['ngồi ván', { move: 0.6, ride: true }],
      ['vui mừng', { move: 0, happy: 1 }],
      ['vẫy tay', { move: 0, wave: true, talk: true }],
    ];
    for (const [name, s] of states) {
      const root = reg.buildModel('kid');
      const rig = root.userData.rig as Rig;
      let worst = reach(root);
      for (let f = 0; f < 120; f++) {
        animateRig(rig, { t: f / 60, dt: 1 / 60, move: 0, ...s });
        if (f % 4 === 3) worst = Math.max(worst, reach(root));
      }
      expect(worst, name).toBeLessThanOrEqual(1);
    }
  });

  it('hình bóng khi bị che (player.ts): chép khối cầu của lưới thật, không tính lại', async () => {
    reg.overrideModel('player', () => ({ build: () => reg.buildModel('kid') }));
    const { buildLook } = await import('../src/world/player');
    const calc = vi.spyOn(THREE.SkinnedMesh.prototype, 'computeBoundingSphere');
    const root = buildLook('boy' as never, {} as never);
    const [vis] = skinned(root);
    const xray = vis.children.find((c) => c.userData.xray) as THREE.SkinnedMesh;
    expect(xray.isSkinnedMesh).toBe(true);
    expect(xray.boundingSphere).toEqual(vis.boundingSphere);
    expect(xray.boundingSphere).not.toBe(vis.boundingSphere);
    expect(xray.boundingBox).toBeNull();
    for (const sm of skinned(root)) if (sm.boundingSphere === null) sm.computeBoundingSphere();
    expect(calc).not.toHaveBeenCalled();
  });
});
