import * as THREE from 'three';

/**
 * Mức chi tiết (LOD) tạo lúc chạy cho mô hình AI đứng yên nhiều con (thú Sở Thú).
 *
 * - Mỗi lưới GLB được rút gọn sẵn thành vài mức (meshoptimizer, chạy lúc rảnh, chỉ một lần mỗi mô hình).
 *   Tất cả mức nằm chung một chỉ mục: [gốc | 50% | 25% | bóng 1 | bóng 2], đổi mức chỉ là đổi drawRange.
 * - Lượt vẽ chính: chọn mức thô nhất mà sai lệch hình học nhìn trên màn hình ≤ 1 điểm ảnh (trông y hệt).
 * - Lượt vẽ bóng: chọn mức ít tam giác nhất mà sai lệch ≤ 1.5 ô bóng (bóng mềm nên không thấy khác),
 *   và bỏ hẳn con thú có bóng không thể rơi vào khung nhìn.
 * - Thêm `?lod=0` vào địa chỉ để tắt (so sánh khi kiểm tra).
 */

interface Level {
  start: number;
  count: number;
  /** Sai lệch hình học lớn nhất (đơn vị cục bộ của lưới). */
  err: number;
}

interface LodGeo {
  geo: THREE.BufferGeometry;
  /** Mức cho lượt vẽ chính, từ mịn tới thô. */
  main: Level[];
  /** Mức cho lượt vẽ bóng, từ ít tới nhiều tam giác. */
  shadow: Level[];
}

type Simplifier = (typeof import('meshoptimizer/simplifier'))['MeshoptSimplifier'];

const MAX_PX = 1;
const MAX_TEXELS = 1.5;
const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lod') === '0';

let lib: Promise<Simplifier | null> | null = null;
function simplifier(): Promise<Simplifier | null> {
  lib ??= import('meshoptimizer/simplifier')
    .then(async ({ MeshoptSimplifier: S }) => {
      if (!S.supported) return null;
      await S.ready;
      return S;
    })
    .catch((e: unknown) => {
      console.warn('[lod] không tải được bộ rút gọn lưới', e);
      return null;
    });
  return lib;
}

/** Nhường máy cho khung hình (mỗi lần rút gọn chỉ vài mili giây, chạy lúc rảnh). */
function idle(): Promise<void> {
  return new Promise((r) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => r(), { timeout: 200 });
    else setTimeout(r, 16);
  });
}

const cache = new WeakMap<THREE.BufferGeometry, Promise<LodGeo | null>>();

function lodFor(src: THREE.BufferGeometry): Promise<LodGeo | null> {
  let p = cache.get(src);
  if (!p) {
    p = build(src).catch((e: unknown) => {
      console.warn('[lod] rút gọn lưới lỗi', e);
      return null;
    });
    cache.set(src, p);
  }
  return p;
}

async function build(src: THREE.BufferGeometry): Promise<LodGeo | null> {
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  if (!pos || !index || src.groups.length > 1 || Object.keys(src.morphAttributes).length) return null;
  const S = await simplifier();
  if (!S) return null;

  const n = pos.count;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    P[i * 3] = pos.getX(i);
    P[i * 3 + 1] = pos.getY(i);
    P[i * 3 + 2] = pos.getZ(i);
  }
  const nor = src.getAttribute('normal');
  let N: Float32Array | null = null;
  if (nor) {
    N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      N[i * 3] = nor.getX(i);
      N[i * 3 + 1] = nor.getY(i);
      N[i * 3 + 2] = nor.getZ(i);
    }
  }
  const I = new Uint32Array(index.count);
  for (let i = 0; i < I.length; i++) I[i] = index.getX(i);
  const scale = S.getScale(P, 3);
  const target = (k: number) => Math.max(3, Math.floor((I.length * k) / 3) * 3);
  const smooth = (k: number, cap: number) => (N ? S.simplifyWithAttributes(I, P, 3, N, 3, [0.5, 0.5, 0.5], null, target(k), cap) : S.simplify(I, P, 3, target(k), cap));

  const parts: [Uint32Array, number][] = [[I, 0]];
  await idle();
  parts.push(smooth(0.5, 0.01));
  await idle();
  parts.push(smooth(0.25, 0.02));
  await idle();
  parts.push(S.simplifySloppy(I, P, 3, null, 1200 * 3, 1));
  await idle();
  parts.push(S.simplifySloppy(I, P, 3, null, 800 * 3, 1));

  const total = parts.reduce((s, [a]) => s + a.length, 0);
  const all = n < 65536 ? new Uint16Array(total) : new Uint32Array(total);
  const levels: Level[] = [];
  let at = 0;
  for (const [a, e] of parts) {
    all.set(a, at);
    levels.push({ start: at, count: a.length, err: e * scale });
    at += a.length;
  }

  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) geo.setAttribute(name, attr);
  geo.setIndex(new THREE.BufferAttribute(all, 1));
  // Mặc định (raycast, vẽ khác) luôn là lưới gốc; chỉ đổi trong lúc vẽ.
  geo.setDrawRange(0, I.length);
  if (!src.boundingSphere) src.computeBoundingSphere();
  if (!src.boundingBox) src.computeBoundingBox();
  geo.boundingSphere = src.boundingSphere!.clone();
  geo.boundingBox = src.boundingBox!.clone();
  // Dùng chung các mảng đỉnh với lưới gốc (cũng dùng chung): không bao giờ hủy.
  geo.userData.shared = true;
  geo.name = `${src.name || 'glb'}:lod`;

  const main = levels.slice(0, 3).filter((l, i) => i === 0 || l.count < levels[i - 1].count);
  const shadow = [...levels].sort((a, b) => a.count - b.count);
  return { geo, main, shadow };
}

const _sphere = new THREE.Sphere();
const _probe = new THREE.Sphere();
const _cam = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _frustum = new THREE.Frustum();

function worldSphere(mesh: THREE.Mesh, geo: THREE.BufferGeometry): THREE.Sphere {
  return _sphere.copy(geo.boundingSphere!).applyMatrix4(mesh.matrixWorld);
}

function pickMain(renderer: THREE.WebGLRenderer, camera: THREE.Camera, mesh: THREE.Mesh, lod: LodGeo): Level {
  const cam = camera as THREE.PerspectiveCamera;
  if (!cam.isPerspectiveCamera) return lod.main[0];
  const s = worldSphere(mesh, lod.geo);
  _cam.setFromMatrixPosition(cam.matrixWorld);
  const d = Math.max(0.1, _cam.distanceTo(s.center) - s.radius);
  const h = renderer.getRenderTarget()?.height ?? renderer.domElement.height;
  const pxPerM = h / ((2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / cam.zoom);
  const k = mesh.matrixWorld.getMaxScaleOnAxis() * pxPerM;
  for (let i = lod.main.length - 1; i > 0; i--) if (lod.main[i].err * k <= MAX_PX) return lod.main[i];
  return lod.main[0];
}

/** Bóng của khối cầu bao (rơi theo hướng nắng xuống mặt đất) có thể nằm trong khung nhìn không. */
function shadowVisible(camera: THREE.Camera, shadowCamera: THREE.Camera, s: THREE.Sphere): boolean {
  _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  if (_frustum.intersectsSphere(s)) return true;
  shadowCamera.getWorldDirection(_dir);
  if (_dir.y > -0.05) return true;
  const t = Math.max(0, s.center.y) / -_dir.y;
  _probe.set(_probe.center.copy(s.center).addScaledVector(_dir, t * 0.5), s.radius * 1.1);
  if (_frustum.intersectsSphere(_probe)) return true;
  _probe.set(_probe.center.copy(s.center).addScaledVector(_dir, t), s.radius * 1.25);
  return _frustum.intersectsSphere(_probe);
}

function pickShadow(renderer: THREE.WebGLRenderer, camera: THREE.Camera, shadowCamera: THREE.Camera, mesh: THREE.Mesh, lod: LodGeo): Level | null {
  const s = worldSphere(mesh, lod.geo);
  if (!shadowVisible(camera, shadowCamera, s)) return null;
  const sc = shadowCamera as THREE.OrthographicCamera;
  if (!sc.isOrthographicCamera) return lod.main[0];
  const w = renderer.getRenderTarget()?.width ?? 2048;
  const texel = (sc.right - sc.left) / sc.zoom / w;
  const k = mesh.matrixWorld.getMaxScaleOnAxis();
  for (const l of lod.shadow) if (l.err * k <= texel * MAX_TEXELS) return l;
  return lod.main[0];
}

function hook(mesh: THREE.Mesh, lod: LodGeo): void {
  const geo = lod.geo;
  const full = lod.main[0];
  const reset = () => geo.setDrawRange(full.start, full.count);
  const prev = {
    render: mesh.onBeforeRender,
    after: mesh.onAfterRender,
    shadow: mesh.onBeforeShadow,
    afterShadow: mesh.onAfterShadow,
  };
  mesh.geometry = geo;
  mesh.userData.lod = true;
  mesh.onBeforeRender = function (renderer, scene, camera, g, material, group) {
    prev.render.call(this, renderer, scene, camera, g, material, group);
    const l = pickMain(renderer, camera, mesh, lod);
    geo.setDrawRange(l.start, l.count);
  };
  mesh.onAfterRender = function (renderer, scene, camera, g, material, group) {
    reset();
    prev.after.call(this, renderer, scene, camera, g, material, group);
  };
  mesh.onBeforeShadow = function (renderer, obj, camera, shadowCamera, g, depthMaterial, group) {
    prev.shadow.call(this, renderer, obj, camera, shadowCamera, g, depthMaterial, group);
    const l = pickShadow(renderer, camera, shadowCamera, mesh, lod);
    // Bóng ngoài khung nhìn: khoảng vẽ rỗng (start > số chỉ mục) → renderer bỏ qua lệnh vẽ.
    if (l) geo.setDrawRange(l.start, l.count);
    else geo.setDrawRange(geo.index!.count + 1, 0);
  };
  mesh.onAfterShadow = function (renderer, obj, camera, shadowCamera, g, depthMaterial, group) {
    reset();
    prev.afterShadow.call(this, renderer, obj, camera, shadowCamera, g, depthMaterial, group);
  };
}

/**
 * Gắn LOD cho mọi lưới GLB (dùng chung, không xương) trong cây. Chạy nền; `alive` = còn cần không
 * (khu vực chưa đóng, mô hình còn trong cảnh). Trả về số lưới đã gắn.
 */
export async function addLod(root: THREE.Object3D, alive: () => boolean = () => true): Promise<number> {
  if (off) return 0;
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.lod || m.userData.shadowProxy || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    if (!m.geometry.userData.shared || Array.isArray(m.material)) return;
    meshes.push(m);
  });
  let done = 0;
  for (const m of meshes) {
    const lod = await lodFor(m.geometry);
    if (!alive()) return done;
    if (!lod || m.userData.lod) continue;
    hook(m, lod);
    done++;
  }
  return done;
}
