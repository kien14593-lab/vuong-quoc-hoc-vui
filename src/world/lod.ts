import * as THREE from 'three';
import { KINDS, lodLevels, type Level, type LodData, type LodJob, type LodReply, type Numbers, type RawAttr, type Simplifier } from './lod-core';

/**
 * Mức chi tiết (LOD) tạo lúc chạy cho mô hình AI đứng yên nhiều con (thú Sở Thú).
 *
 * - Mỗi lưới GLB được rút gọn sẵn thành vài mức (meshoptimizer, chỉ một lần mỗi mô hình) trong một luồng phụ
 *   (world/lod-worker.ts) nên khung hình không bị giật; nếu không mở được luồng phụ thì rút gọn ngay trên luồng chính
 *   lúc rảnh. Tất cả mức nằm chung một chỉ mục: [gốc | 50% | 25% | bóng 1 | bóng 2], đổi mức chỉ là đổi drawRange.
 * - Lượt vẽ chính: chọn mức thô nhất mà sai lệch hình học nhìn trên màn hình ≤ 1 điểm ảnh (trông y hệt).
 * - Lượt vẽ bóng: chọn mức ít tam giác nhất mà sai lệch ≤ 1.5 ô bóng (bóng mềm nên không thấy khác),
 *   và bỏ hẳn con thú có bóng không thể rơi vào khung nhìn.
 * - Thêm `?lod=0` vào địa chỉ để tắt (so sánh khi kiểm tra).
 */

interface LodGeo {
  geo: THREE.BufferGeometry;
  /** Mức cho lượt vẽ chính, từ mịn tới thô. */
  main: Level[];
  /** Mức cho lượt vẽ bóng, từ ít tới nhiều tam giác. */
  shadow: Level[];
}

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

/** Nhường máy cho khung hình giữa các lần rút gọn trên luồng chính (chạy lúc rảnh). */
function idle(): Promise<void> {
  return new Promise((r) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => r(), { timeout: 200 });
    else setTimeout(r, 16);
  });
}

type WorkerCtor = new (options?: { name?: string }) => Worker;

let ctor: Promise<WorkerCtor | null> | null = null;
let worker: Worker | null = null;
/** Luồng phụ không dùng được: từ đó rút gọn trên luồng chính. */
let broken = typeof Worker === 'undefined';
const waiting = new Map<number, (r: LodData | null) => void>();
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Tắt luồng phụ (có `why` = vì lỗi); việc đang chờ chuyển sang luồng chính. */
function stop(why?: unknown): void {
  if (why !== undefined) {
    broken = true;
    console.warn('[lod] luồng phụ lỗi, rút gọn trên luồng chính', why);
  }
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  for (const done of waiting.values()) done(null);
  waiting.clear();
}

/** Đang có việc: chờ trả lời tối đa 20 giây; hết việc: tắt luồng phụ sau 8 giây rảnh cho nhẹ máy. */
function arm(): void {
  clearTimeout(timer);
  timer = waiting.size ? setTimeout(() => stop('không trả lời'), 20_000) : setTimeout(() => stop(), 8_000);
}

function open(Ctor: WorkerCtor): Worker {
  const w = new Ctor({ name: 'lod' });
  w.onmessage = (e: MessageEvent<LodReply>) => {
    const r = e.data;
    const done = waiting.get(r.id);
    if (!done) return;
    waiting.delete(r.id);
    arm();
    if ('error' in r) {
      console.warn('[lod] luồng phụ rút gọn lỗi', r.error);
      done(null);
    } else done({ index: r.index, levels: r.levels });
  };
  w.onerror = (e) => {
    e.preventDefault();
    stop(e.message || 'error');
  };
  w.onmessageerror = () => stop('messageerror');
  return w;
}

/** Rút gọn trong luồng phụ; null = không được (khi đó rút gọn trên luồng chính). */
async function inWorker(job: LodJob): Promise<LodData | null> {
  if (broken) return null;
  ctor ??= import('./lod-worker?worker&inline').then(
    (m) => m.default,
    (e: unknown) => {
      console.warn('[lod] không tải được luồng phụ', e);
      return null;
    },
  );
  const Ctor = await ctor;
  if (!Ctor) broken = true;
  if (broken || !Ctor) return null;
  try {
    worker ??= open(Ctor);
  } catch (e) {
    stop(e);
    return null;
  }
  // Gửi bản chép (mảng gốc vẫn đang được vẽ) và chuyển giao luôn bản chép, không chép thêm lần nào.
  const buffers: ArrayBuffer[] = [];
  const take = <T extends { buffer: ArrayBuffer }>(a: T): T => {
    buffers.push(a.buffer);
    return a;
  };
  const copy = (a: RawAttr): RawAttr => ({ ...a, array: take(a.array.slice()) });
  const id = ++seq;
  const msg = { id, count: job.count, pos: copy(job.pos), nor: job.nor && copy(job.nor), index: take(job.index.slice()) };
  const w = worker;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    try {
      w.postMessage(msg, buffers);
      arm();
    } catch (e) {
      stop(e);
    }
  });
}

async function onMain(job: LodJob): Promise<LodData | null> {
  const S = await simplifier();
  return S ? lodLevels(S, job, idle) : null;
}

/** Thuộc tính đỉnh → dạng thô gửi được sang luồng phụ (kiểu lạ thì đọc luôn bằng three ra số thực 32 bit). */
function raw(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, n: number): RawAttr {
  const ib = (a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? (a as THREE.InterleavedBufferAttribute) : null;
  if (!(a as { isFloat16BufferAttribute?: boolean }).isFloat16BufferAttribute && KINDS.includes(a.array.constructor)) {
    return { array: a.array as Numbers, stride: ib ? ib.data.stride : a.itemSize, offset: ib ? ib.offset : 0, normalized: a.normalized };
  }
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    f[i * 3] = a.getX(i);
    f[i * 3 + 1] = a.getY(i);
    f[i * 3 + 2] = a.getZ(i);
  }
  return { array: f, stride: 3, offset: 0, normalized: false };
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

/** Việc rút gọn của một lưới (dữ liệu đỉnh thô, chưa chép), hoặc null nếu lưới không hợp. */
export function lodJob(src: THREE.BufferGeometry): LodJob | null {
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  if (!pos || !index || src.groups.length > 1 || Object.keys(src.morphAttributes).length) return null;
  const n = pos.count;
  const nor = src.getAttribute('normal');
  const ia = index.array;
  return {
    count: n,
    pos: raw(pos, n),
    nor: nor ? raw(nor, n) : null,
    index: ia instanceof Uint8Array || ia instanceof Uint16Array || ia instanceof Uint32Array ? ia : Uint32Array.from({ length: index.count }, (_, i) => index.getX(i)),
  };
}

async function build(src: THREE.BufferGeometry): Promise<LodGeo | null> {
  const job = lodJob(src);
  if (!job) return null;
  const data = (await inWorker(job)) ?? (await onMain(job));
  if (!data) return null;
  const { levels } = data;

  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) geo.setAttribute(name, attr);
  geo.setIndex(new THREE.BufferAttribute(data.index, 1));
  // Mặc định (raycast, vẽ khác) luôn là lưới gốc; chỉ đổi trong lúc vẽ.
  geo.setDrawRange(0, levels[0].count);
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
