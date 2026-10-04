import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Gộp lưới để giảm số lệnh vẽ:
 *  - `compactModel`: gộp các phần cứng của MỘT mô hình theo từng khớp chuyển động (tay, chân, đầu...).
 *  - `bakeStatic`: gộp toàn bộ cảnh tĩnh của một khu vực theo ô không gian.
 * Vật liệu Lambert thường được đổi thành màu đỉnh (vertex color) nên nhiều màu vẫn chỉ cần 1 lệnh vẽ.
 *
 * Quy ước: phần nào cần chuyển động/đổi màu/tìm theo tên về sau phải là Object3D có `name`,
 * hoặc `userData.dynamic = true` (hoặc `noBake`, hoặc có `userData.tick`), hoặc là khớp trong rig –
 * khi đó nó được giữ nguyên và các lưới con của nó được gộp vào chính nó.
 */
const vcMats = new Map<string, THREE.Material>();

export function vcMat(flat: boolean, side: THREE.Side): THREE.Material {
  const k = `${flat ? 1 : 0}|${side}`;
  let m = vcMats.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat, side });
    m.userData.shared = true;
    vcMats.set(k, m);
  }
  return m;
}

interface Bucket {
  mat: THREE.Material;
  geos: THREE.BufferGeometry[];
  cast: boolean;
  receive: boolean;
  vc: boolean;
}

const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
const tmpM = new THREE.Matrix4();

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function isVcCandidate(m: THREE.Material): m is THREE.MeshLambertMaterial {
  const l = m as THREE.MeshLambertMaterial;
  return l.isMeshLambertMaterial === true && !l.transparent && !l.map && l.emissive.getHex() === 0 && l.opacity >= 1;
}

function mergeable(o: THREE.Object3D): o is THREE.Mesh {
  const m = o as THREE.Mesh;
  if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) return false;
  if (Array.isArray(m.material)) return false;
  if ((m.material as THREE.MeshBasicMaterial).map) return false;
  if (m.morphTargetInfluences) return false;
  return true;
}

/** Hình học mới đã biến đổi bởi `matrix` (không chỉ mục, chỉ position/normal[/color]). */
function transformedGeometry(mesh: THREE.Mesh, matrix: THREE.Matrix4, color: THREE.Color | null): THREE.BufferGeometry | null {
  const src = mesh.geometry;
  if (!src.getAttribute('position')) return null;
  const ni = src.index ? src.toNonIndexed() : src;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', (ni.getAttribute('position') as THREE.BufferAttribute).clone());
  const nrm = ni.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nrm) g.setAttribute('normal', nrm.clone());
  else g.computeVertexNormals();
  const col = ni.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!color && col && col.itemSize === 3) g.setAttribute('color', col.clone());
  if (ni !== src) ni.dispose();
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) flipWinding(g);
  if (color) {
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = color.r;
      arr[i * 3 + 1] = color.g;
      arr[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

function flipWinding(g: THREE.BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    const s = a.itemSize;
    const arr = a.array as Float32Array;
    for (let i = 0; i + 2 < a.count; i += 3) {
      for (let k = 0; k < s; k++) {
        const i1 = (i + 1) * s + k;
        const i2 = (i + 2) * s + k;
        const t = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = t;
      }
    }
    a.needsUpdate = true;
  }
}

/** Đưa một lưới vào giỏ gộp phù hợp. `matrix`: biến đổi sang hệ tọa độ đích. */
function addToBuckets(buckets: Map<string, Bucket>, mesh: THREE.Mesh, matrix: THREE.Matrix4, suffix: string): void {
  const m = mesh.material as THREE.Material;
  const cast = mesh.castShadow;
  const receive = mesh.receiveShadow;
  let key: string;
  let bmat: THREE.Material;
  let color: THREE.Color | null = null;
  let vc = false;
  if (isVcCandidate(m)) {
    vc = true;
    const flat = m.flatShading;
    key = `vc|${flat ? 1 : 0}|${m.side}|${cast ? 1 : 0}|${receive ? 1 : 0}|${suffix}`;
    bmat = vcMat(flat, m.side);
    if (!m.vertexColors) {
      color = tmpC.copy(m.color);
      if (mesh.userData.tint) {
        tmpV.setFromMatrixPosition(mesh.matrixWorld);
        const h = hash3(tmpV.x, tmpV.y, tmpV.z);
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        color.setHSL(hsl.h + (h - 0.5) * 0.03, hsl.s, Math.max(0, Math.min(1, hsl.l + (h - 0.5) * 0.08)));
      }
    } else if (!mesh.geometry.getAttribute('color')) {
      color = tmpC.setRGB(1, 1, 1);
    }
  } else {
    key = `m|${m.uuid}|${cast ? 1 : 0}|${receive ? 1 : 0}|${suffix}`;
    bmat = m;
  }
  const g = transformedGeometry(mesh, matrix, color);
  if (!g) return;
  let b = buckets.get(key);
  if (!b) {
    b = { mat: bmat, geos: [], cast, receive, vc };
    buckets.set(key, b);
  }
  b.geos.push(g);
}

function flush(buckets: Map<string, Bucket>, parent: THREE.Object3D, frozen: boolean): { calls: number; verts: number } {
  let calls = 0;
  let verts = 0;
  for (const b of buckets.values()) {
    for (const g of b.geos) {
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && !(b.vc && name === 'color')) g.deleteAttribute(name);
      }
    }
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.userData.baked = true;
    if (frozen) {
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
    }
    parent.add(mesh);
    calls++;
    verts += merged.getAttribute('position').count;
  }
  return { calls, verts };
}

/**
 * Gộp các phần cứng của một mô hình theo từng "khớp" (giữ nguyên các khớp chuyển động).
 * Trả về số lưới sau khi gộp.
 */
export function compactModel(root: THREE.Object3D, keep: Iterable<THREE.Object3D | undefined> = []): number {
  const keepSet = new Set<THREE.Object3D>();
  for (const k of keep) if (k) keepSet.add(k);
  keepSet.add(root);
  root.traverse((o) => {
    if (o.userData.dynamic || o.userData.noBake || o.userData.tick || o.name) keepSet.add(o);
  });
  root.updateMatrixWorld(true);
  const owners = new Map<THREE.Object3D, THREE.Mesh[]>();
  const visit = (o: THREE.Object3D, owner: THREE.Object3D) => {
    for (const c of o.children) {
      if (keepSet.has(c)) {
        visit(c, c);
        continue;
      }
      if (mergeable(c) && c.children.length === 0 && c.visible) {
        let arr = owners.get(owner);
        if (!arr) owners.set(owner, (arr = []));
        arr.push(c);
      }
      visit(c, owner);
    }
  };
  visit(root, root);
  let total = 0;
  const inv = new THREE.Matrix4();
  for (const [owner, meshes] of owners) {
    if (meshes.length < 2) {
      total += meshes.length;
      continue;
    }
    inv.copy(owner.matrixWorld).invert();
    const buckets = new Map<string, Bucket>();
    for (const m of meshes) {
      tmpM.multiplyMatrices(inv, m.matrixWorld);
      addToBuckets(buckets, m, tmpM, 'c');
    }
    for (const m of meshes) m.parent?.remove(m);
    total += flush(buckets, owner, false).calls;
  }
  prune(root, keepSet);
  return total;
}

/** Xóa các nhóm rỗng còn sót lại sau khi gộp. */
function prune(o: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  for (const c of [...o.children]) {
    prune(c, keep);
    if ((c as THREE.Group).isGroup && c.children.length === 0 && !keep.has(c) && !c.name && Object.keys(c.userData).length === 0) o.remove(c);
  }
}

export interface BakeResult {
  group: THREE.Group;
  drawCalls: number;
  vertices: number;
}

/**
 * Gộp tất cả lưới tĩnh dưới `root` theo ô không gian `chunk`. Trả về nhóm mới (ở gốc tọa độ thế giới)
 * gồm lưới đã gộp + các đối tượng động được chuyển sang (giữ nguyên vị trí thế giới). `root` bị làm rỗng.
 */
export function bakeStatic(root: THREE.Object3D, chunk = 24): BakeResult {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, Bucket>();
  const keep: THREE.Object3D[] = [];
  const box = new THREE.Box3();

  const visit = (o: THREE.Object3D) => {
    if (o !== root && (o.userData.dynamic || o.userData.noBake || o.userData.tick || o.name)) {
      keep.push(o);
      return;
    }
    if (!o.visible) return;
    if ((o as THREE.Mesh).isMesh) {
      if (!mergeable(o)) {
        keep.push(o);
        return;
      }
      box.setFromObject(o);
      box.getCenter(tmpV);
      const suffix = `${Math.floor(tmpV.x / chunk)}|${Math.floor(tmpV.z / chunk)}`;
      addToBuckets(buckets, o, o.matrixWorld, suffix);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);

  const out = new THREE.Group();
  out.name = 'baked';
  const r = flush(buckets, out, true);
  for (const k of keep) out.attach(k);
  return { group: out, drawCalls: r.calls, vertices: r.verts };
}

/** Giải phóng hình học/vật liệu KHÔNG dùng chung của một cây đối tượng. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton?.dispose();
    if (m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) {
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) {
        if (!mt || mt.userData.shared) continue;
        const map = (mt as THREE.MeshBasicMaterial).map;
        if (map && !map.userData.shared) map.dispose();
        mt.dispose();
      }
    }
  });
}
