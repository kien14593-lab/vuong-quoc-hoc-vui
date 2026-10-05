import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { preciseBox } from '../src/engine/bounds';

/**
 * engine/bounds.ts preciseBox: khung bao sát (chân dung bé – ui/portrait.ts) phải trùng với three.js
 * `box.setFromObject(obj, true)`, kể cả lưới có xương (đo nhanh) đủ kiểu: trọng số lượng tử hóa (tổng khác 1),
 * đỉnh xen kẽ / chuẩn hóa, gắn xương kiểu tách rời, lưới có xương nằm dưới lưới thường; lưới khác do three.js đo.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

interface RigOpts {
  seed: number;
  n?: number;
  /** Trọng số Uint8 chuẩn hóa, làm tròn xuống (tổng < 1 như tệp GLB lượng tử hóa). */
  quant?: boolean;
  /** Vị trí đỉnh xen kẽ trong một bộ đệm chung. */
  interleaved?: boolean;
  /** Vị trí đỉnh Int16 chuẩn hóa (lưới nén – KHR_mesh_quantization). */
  int16?: boolean;
  detached?: boolean;
  morph?: boolean;
}

function rig(o: RigOpts): THREE.SkinnedMesh {
  const r = rng(o.seed);
  const n = o.n ?? 300;
  const bones: THREE.Bone[] = [];
  for (let j = 0; j < 7; j++) {
    const b = new THREE.Bone();
    b.position.set(r() - 0.5, 0.3 + r() * 0.4, r() - 0.5);
    if (j) bones[Math.floor(r() * j)].add(b);
    bones.push(b);
  }
  const g = new THREE.BufferGeometry();
  const xyz = Array.from({ length: n * 3 }, () => (r() - 0.5) * 2);
  if (o.interleaved) {
    const data = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) data.set([xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2], 7, 7], i * 5);
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(data, 5), 3, 0));
  } else if (o.int16) {
    g.setAttribute('position', new THREE.BufferAttribute(Int16Array.from(xyz, (v) => Math.round(v * 32767)), 3, true));
  } else g.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  const idx = new Uint16Array(n * 4);
  const wts = o.quant ? new Uint8Array(n * 4) : new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const raw = [r(), r(), r() < 0.3 ? 0 : r(), r() < 0.6 ? 0 : r()];
    const sum = raw.reduce((a, b) => a + b, 0);
    for (let k = 0; k < 4; k++) {
      idx[i * 4 + k] = Math.floor(r() * bones.length);
      wts[i * 4 + k] = o.quant ? Math.floor((raw[k] / sum) * 255) : raw[k] / sum;
    }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(wts, 4, !!o.quant));
  if (o.morph) g.morphAttributes.position = [new THREE.Float32BufferAttribute(xyz.map((v) => v * 0.5 + 0.3), 3)];
  const m = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
  if (o.morph) {
    m.updateMorphTargets();
    m.morphTargetInfluences![0] = 0.6;
  }
  m.add(bones[0]);
  m.position.set(0.3, -0.2, 0.1);
  m.rotation.set(0.2, 0.7, -0.1);
  m.scale.set(1.3, 0.8, 1.1);
  m.updateMatrixWorld(true);
  if (o.detached) m.bindMode = THREE.DetachedBindMode;
  m.bind(new THREE.Skeleton(bones), o.detached ? new THREE.Matrix4().makeRotationY(0.4).setPosition(0.5, 0, 0.2) : undefined);
  for (const b of bones) b.rotation.set(r() - 0.5, r() - 0.5, r() - 0.5);
  bones[2].scale.set(1.2, 0.9, 1.1);
  return m;
}

function staticMesh(seed: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.3), new THREE.MeshBasicMaterial());
  const r = rng(seed);
  m.position.set(r() * 2, r(), -r());
  m.rotation.set(r(), r(), r());
  return m;
}

function expectSame(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  const want = new THREE.Box3().setFromObject(obj, true);
  const got = preciseBox(obj);
  for (const k of ['min', 'max'] as const)
    for (const a of ['x', 'y', 'z'] as const) expect(got[k][a]).toBeCloseTo(want[k][a], 9);
  return got;
}

describe('preciseBox: như three.js setFromObject(obj, true)', () => {
  it('lưới có xương, trọng số số thực', () => {
    const box = expectSame(rig({ seed: 1 }));
    expect(box.isEmpty()).toBe(false);
  });

  it('trọng số Uint8 chuẩn hóa có tổng khác 1, xương gắn kiểu tách rời', () => {
    expectSame(rig({ seed: 2, quant: true }));
    expectSame(rig({ seed: 3, quant: true, detached: true }));
    expectSame(rig({ seed: 4, detached: true }));
  });

  it('đỉnh xen kẽ, đỉnh Int16 chuẩn hóa', () => {
    expectSame(rig({ seed: 5, interleaved: true }));
    expectSame(rig({ seed: 6, int16: true, quant: true }));
  });

  it('cây nhiều nhánh: lưới thường, lưới có xương dưới lưới thường, lưới lặp, điểm, hình biến dạng', () => {
    const root = new THREE.Group();
    root.position.set(1, 2, 3);
    root.rotation.set(0.1, 0.8, 0);
    const holder = new THREE.Group();
    holder.scale.setScalar(0.7);
    root.add(holder);
    holder.add(rig({ seed: 7 }), staticMesh(8));
    const host = staticMesh(9);
    host.add(rig({ seed: 10, quant: true }), staticMesh(11));
    holder.add(host);
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial(), 2);
    inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 0, 0));
    inst.setMatrixAt(1, new THREE.Matrix4().makeTranslation(-3, 1, 2));
    holder.add(inst);
    holder.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 5, 0, 1, -4, 2], 3))));
    holder.add(rig({ seed: 12, morph: true }));
    expectSame(root);
    // Từng nhánh riêng (khung cả cây do lưới lặp / điểm quyết định).
    for (const c of [...holder.children, ...host.children]) expectSame(c);
  });

  it('không có hình: khung rỗng', () => {
    const g = new THREE.Group();
    g.add(new THREE.Object3D());
    expect(preciseBox(g).isEmpty()).toBe(true);
    expect(new THREE.Box3().setFromObject(g, true).isEmpty()).toBe(true);
  });

  it('không đổi cây đối tượng (thứ tự con giữ nguyên)', () => {
    const m = rig({ seed: 13 });
    const g = new THREE.Group();
    const a = staticMesh(14);
    g.add(a, m, staticMesh(15));
    const before = [...g.children];
    expectSame(g);
    expect(g.children).toEqual(before);
    expect(m.parent).toBe(g);
  });
});
