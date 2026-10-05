import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _box = new THREE.Box3();
/** Ma trận từng xương (bỏ hàng cuối, theo cột như Matrix4.elements): 12 số mỗi xương. */
let bonesM = new Float64Array(0);

/**
 * Khung bao sát quanh mọi đỉnh, trong hệ tọa độ thế giới – như `box.setFromObject(obj, true)` của three.js, nhưng nhanh
 * hơn với lưới có xương (bé AI, thú có xương): three.js nhân lại ma trận xương cho từng đỉnh (bé trai: 32 nghìn đỉnh –
 * 8–12 ms trên máy chậm, CPU 4×, lúc vẽ chân dung bé), ở đây mỗi xương nhân một lần (3–4 ms). Phần không có lưới có xương:
 * three.js đo như cũ. Ma trận thế giới phải đã cập nhật (như three.js: chỉ cập nhật chính đối tượng, không cập nhật cha).
 */
export function preciseBox(obj: THREE.Object3D, out = new THREE.Box3()): THREE.Box3 {
  out.makeEmpty();
  const path = new Set<THREE.Object3D>();
  obj.traverse((o) => {
    if (!fastSkin(o)) return;
    for (let p: THREE.Object3D | null = o; p && !path.has(p); p = p === obj ? null : p.parent) path.add(p);
  });
  expand(obj, out, path);
  return out;
}

/** `path`: lưới có xương đo nhanh được và các đối tượng chứa chúng; nhánh khác để three.js đo. */
function expand(o: THREE.Object3D, out: THREE.Box3, path: Set<THREE.Object3D>): void {
  if (!path.has(o)) {
    out.expandByObject(o, true);
    return;
  }
  o.updateWorldMatrix(false, false);
  if (fastSkin(o)) skinned(o, out);
  else if ((o as THREE.Mesh).geometry !== undefined) own(o, out);
  for (const c of o.children) expand(c, out, path);
}

/** Lưới có xương đo nhanh được: không có hình biến dạng (morph target) – có thì để three.js đo. */
function fastSkin(o: THREE.Object3D): o is THREE.SkinnedMesh {
  const m = o as THREE.SkinnedMesh;
  if (m.isSkinnedMesh !== true || (o as THREE.InstancedMesh).isInstancedMesh === true || !m.skeleton) return false;
  const g = m.geometry;
  const a = g?.attributes;
  return !!(a?.position && a.skinIndex && a.skinWeight) && !(g.morphAttributes.position && m.morphTargetInfluences);
}

/**
 * Đỉnh của lưới có xương, cùng phép tính với three.js (SkinnedMesh.applyBoneTransform): tổng theo trọng số của đỉnh qua
 * từng xương (xương · nghịch đảo gốc · bindMatrix – nhân sẵn cho mỗi xương), rồi bindMatrixInverse và matrixWorld (sau
 * khi cộng: trọng số lượng tử hóa có tổng khác 1 vẫn đúng như three.js).
 */
function skinned(m: THREE.SkinnedMesh, out: THREE.Box3): void {
  const { bones, boneInverses } = m.skeleton;
  if (bonesM.length < bones.length * 12) bonesM = new Float64Array(bones.length * 12);
  const M = bonesM;
  for (let j = 0; j < bones.length; j++) {
    const e = _m.multiplyMatrices(bones[j].matrixWorld, boneInverses[j]).multiply(m.bindMatrix).elements;
    const o = j * 12;
    M[o] = e[0];
    M[o + 1] = e[1];
    M[o + 2] = e[2];
    M[o + 3] = e[4];
    M[o + 4] = e[5];
    M[o + 5] = e[6];
    M[o + 6] = e[8];
    M[o + 7] = e[9];
    M[o + 8] = e[10];
    M[o + 9] = e[12];
    M[o + 10] = e[13];
    M[o + 11] = e[14];
  }
  const c = _m.multiplyMatrices(m.matrixWorld, m.bindMatrixInverse).elements;
  const { position: pos, skinIndex: si, skinWeight: sw } = m.geometry.attributes;
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0, n = pos.count; i < n; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w === 0) continue;
      const o = si.getComponent(i, k) * 12;
      sx += (M[o] * px + M[o + 3] * py + M[o + 6] * pz + M[o + 9]) * w;
      sy += (M[o + 1] * px + M[o + 4] * py + M[o + 7] * pz + M[o + 10]) * w;
      sz += (M[o + 2] * px + M[o + 5] * py + M[o + 8] * pz + M[o + 11]) * w;
    }
    const x = c[0] * sx + c[4] * sy + c[8] * sz + c[12];
    const y = c[1] * sx + c[5] * sy + c[9] * sz + c[13];
    const z = c[2] * sx + c[6] * sy + c[10] * sz + c[14];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  if (x0 > x1) return;
  out.expandByPoint(_v.set(x0, y0, z0));
  out.expandByPoint(_v.set(x1, y1, z1));
}

/** Hình của chính đối tượng (không gồm con) – như three.js (Box3.expandByObject, precise). */
function own(o: THREE.Object3D, out: THREE.Box3): void {
  const g = (o as THREE.Mesh).geometry;
  const pos = g.getAttribute('position');
  if (pos !== undefined && (o as THREE.InstancedMesh).isInstancedMesh !== true) {
    const mesh = (o as THREE.Mesh).isMesh === true ? (o as THREE.Mesh) : null;
    for (let i = 0; i < pos.count; i++) {
      if (mesh) mesh.getVertexPosition(i, _v);
      else _v.fromBufferAttribute(pos, i);
      out.expandByPoint(_v.applyMatrix4(o.matrixWorld));
    }
    return;
  }
  const ob = o as unknown as { boundingBox?: THREE.Box3 | null; computeBoundingBox(): void };
  if (ob.boundingBox !== undefined) {
    if (ob.boundingBox === null) ob.computeBoundingBox();
    _box.copy(ob.boundingBox!);
  } else {
    if (g.boundingBox === null) g.computeBoundingBox();
    _box.copy(g.boundingBox!);
  }
  out.union(_box.applyMatrix4(o.matrixWorld));
}
