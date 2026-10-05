import * as THREE from 'three';
import { DEFAULT_OUTFIT, playerKey, type Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { disposeTree } from '../engine/merge';
import type { PlayerOpts } from '../models/character';
import { ensureGlb, glbReady } from '../models/glb';
import { kidModelKey } from '../models/kid';
import { buildModel, hasModel, modelKeyFor } from '../models/registry';

/**
 * Ảnh chân dung 3D (data URL) của nhân vật/NPC/vật phẩm – dùng cho hộp thoại, HUD, cửa hàng, túi đồ.
 * Dùng một bộ vẽ nhỏ riêng (nền trong suốt) để không đụng tới khung hình chính.
 */
export type Framing = 'head' | 'bust' | 'full';

export interface PortraitOpts {
  /** Cạnh ảnh (px). */
  size?: number;
  /** Góc xoay mô hình (độ): 0 = nhìn thẳng, 90 = nghiêng phải, 180 = sau lưng. */
  yaw?: number;
  framing?: Framing;
  /** Góc camera nhìn xuống (độ). */
  pitch?: number;
  /** Tùy chọn khi dựng mô hình. */
  opts?: Record<string, unknown>;
  /** Phóng to thêm (1 = vừa khít). */
  zoom?: number;
}

let R: THREE.WebGLRenderer | null = null;
let failed = false;
let scene: THREE.Scene;
let cam: THREE.PerspectiveCamera;
const cache = new Map<string, string>();
const box = new THREE.Box3();
const size3 = new THREE.Vector3();
const center = new THREE.Vector3();

function ensure(): boolean {
  if (R) return true;
  if (failed) return false;
  try {
    const canvas = document.createElement('canvas');
    R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.NeutralToneMapping;
    R.setPixelRatio(1);
    R.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', () => {
      R = null;
      failed = true;
    });
  } catch {
    failed = true;
    return false;
  }
  scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#f4fbff', '#e8dcc6', 1.75);
  const key = new THREE.DirectionalLight('#fff3e2', 2.1);
  key.position.set(-2.5, 4, 5);
  const rim = new THREE.DirectionalLight('#e4ecff', 0.9);
  rim.position.set(3, 2.5, -3);
  const amb = new THREE.AmbientLight('#ffffff', 0.3);
  scene.add(hemi, key, rim, amb);
  cam = new THREE.PerspectiveCamera(24, 1, 0.05, 80);
  return true;
}

/** Lưới bóng (glb.ts) dùng chung đỉnh với lưới thật, ảnh chân dung không cần: tạm gỡ ra khi đo khung / biên dịch shader. */
function withoutProxies<T>(obj: THREE.Object3D, fn: () => T): T {
  const proxies: [THREE.Object3D, THREE.Object3D][] = [];
  obj.traverse((x) => {
    if (x.userData.shadowProxy && x.parent) proxies.push([x, x.parent]);
  });
  for (const [x] of proxies) x.removeFromParent();
  try {
    return fn();
  } finally {
    for (const [x, parent] of proxies) parent.add(x);
  }
}

const sizeOf = (o: PortraitOpts) => Math.round(o.size ?? 256);

/** Đặt cỡ khung vẽ (đổi cỡ phải chờ GPU xong việc đang làm – tránh đổi qua đổi lại). */
function fitCanvas(px: number): void {
  if (R && (R.domElement.width !== px || R.domElement.height !== px)) R.setSize(px, px, false);
}

/** Vẽ một đối tượng (không lưu đệm). Đối tượng được trả lại nguyên vẹn (không hủy). */
export function renderPortrait(obj: THREE.Object3D, o: PortraitOpts = {}): string {
  if (!ensure() || !R) return '';
  fitCanvas(sizeOf(o));
  const holder = new THREE.Group();
  holder.add(obj);
  holder.rotation.y = ((o.yaw ?? 0) * Math.PI) / 180;
  scene.add(holder);
  holder.updateMatrixWorld(true);
  // Đo không cần lưới bóng (đỡ một lượt tính đỉnh theo xương).
  withoutProxies(obj, () => box.setFromObject(obj, true));
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  box.getSize(size3);
  box.getCenter(center);
  const hgt = Math.max(0.05, size3.y);
  const framing = o.framing ?? 'bust';
  let y0 = box.min.y;
  let y1 = box.max.y + hgt * 0.03;
  if (framing === 'head') y0 = box.min.y + hgt * 0.52;
  else if (framing === 'bust') y0 = box.min.y + hgt * 0.3;
  else y0 = box.min.y - hgt * 0.04;
  const span = y1 - y0;
  const wide = Math.max(size3.x, size3.z);
  const fit = framing === 'full' ? Math.max(span, wide * 0.92) : Math.max(span, Math.min(wide, span * 1.25) * 0.9);
  const fov = (cam.fov * Math.PI) / 180;
  const dist = ((fit / 2) * 1.08) / Math.tan(fov / 2) / (o.zoom ?? 1) + wide * 0.5;
  const pitch = ((o.pitch ?? 6) * Math.PI) / 180;
  const cy = (y0 + y1) / 2;
  cam.position.set(center.x, cy + Math.sin(pitch) * dist, center.z + Math.cos(pitch) * dist);
  cam.lookAt(center.x, cy, center.z);
  cam.updateProjectionMatrix();
  R.render(scene, cam);
  let url = '';
  try {
    url = R.domElement.toDataURL('image/png');
  } catch {
    url = '';
  }
  scene.remove(holder);
  holder.remove(obj);
  return url;
}

function cached(k: string, make: () => THREE.Object3D | null, o: PortraitOpts, keep = true): string {
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  const obj = make();
  if (!obj) return '';
  const url = renderPortrait(obj, o);
  disposeTree(obj);
  if (cache.size > 400) cache.clear();
  if (url && keep) cache.set(k, url);
  return url;
}

/** Khóa mô hình thật và khóa bộ nhớ đệm của ảnh chân dung mô hình; null nếu không có mô hình. */
function modelEntry(key: string, o: PortraitOpts): { key: string; k: string } | null {
  if (!hasModel(key)) return null;
  // Khóa chung (dân làng 'npc_villager' + { v }) → khóa riêng của từng người (mô hình AI riêng).
  key = modelKeyFor(key, o.opts ?? {});
  return { key, k: JSON.stringify(['m', key, o]) };
}

/** Chân dung theo khóa mô hình (NPC, thú cưng, đồ vật...). */
export function modelPortrait(key: string, o: PortraitOpts = {}): string {
  const e = modelEntry(key, o);
  if (!e) return '';
  // Mô hình AI chưa tải xong: vẽ tạm bằng mô hình dựng bằng code nhưng không lưu (lần sau vẽ lại bằng mô hình AI).
  const ready = glbReady([e.key]);
  if (!ready) void ensureGlb([e.key]);
  // Đã chuẩn bị sẵn (preparePortraits) mà chưa kịp vẽ: vẽ ngay bằng mô hình đã dựng, shader đã biên dịch.
  const p = ready && !cache.has(e.k) ? preps.find((x) => x.jobs.has(e.k)) : undefined;
  if (p) drawPrep(p, e.k);
  return cached(e.k, () => buildModel(e.key, o.opts ?? {}), o, ready);
}

/* ------------------------------------------------------------------ */
/* Vẽ sẵn chân dung (người sắp nói chuyện trong khu vực)                 */
/* ------------------------------------------------------------------ */

/** Mô hình đã dựng + biên dịch shader, chờ vẽ các ảnh `jobs` (khóa bộ nhớ đệm → tùy chọn ảnh). */
interface Prep {
  obj: THREE.Object3D;
  jobs: Map<string, PortraitOpts>;
}

let preps: Prep[] = [];
let prepGen = 0;

/** Vẽ ảnh `k` của mô hình đã chuẩn bị vào bộ nhớ đệm; vẽ hết các ảnh của mô hình thì hủy mô hình. */
function drawPrep(p: Prep, k: string): void {
  const o = p.jobs.get(k);
  p.jobs.delete(k);
  if (o && !cache.has(k)) {
    const url = renderPortrait(p.obj, o);
    if (cache.size > 400) cache.clear();
    if (url) cache.set(k, url);
  }
  if (p.jobs.size) return;
  preps = preps.filter((x) => x !== p);
  disposeTree(p.obj);
}

/** Bỏ các chân dung đã chuẩn bị mà chưa vẽ. */
export function dropPrepared(): void {
  prepGen++;
  for (const p of preps) disposeTree(p.obj);
  preps = [];
}

/**
 * Chuẩn bị vẽ sẵn chân dung mô hình: dựng mô hình và biên dịch shader ngay (gọi lúc màn chuyển cảnh còn che – trình duyệt
 * biên dịch song song với phần chờ của khu vực), còn vẽ thì để sau, lúc rảnh (`drawPrepared`). Mỗi phần tử: khóa mô hình +
 * các ảnh cần (cùng `opts`, khác cỡ ảnh). Chỉ mô hình đã sẵn sàng (mô hình AI đã tải xong, không tải thêm), bỏ ảnh đã có.
 * Thay cho lần chuẩn bị trước. Trả về số mô hình đã chuẩn bị.
 */
export function preparePortraits(list: [key: string, opts: PortraitOpts[]][], max = 6): number {
  dropPrepared();
  if (!list.length || !ensure() || !R) return 0;
  for (const [art, os] of list) {
    if (preps.length >= max) break;
    const jobs = new Map<string, PortraitOpts>();
    let key = '';
    for (const o of os) {
      const e = modelEntry(art, o);
      if (!e || !glbReady([e.key]) || cache.has(e.k) || preps.some((x) => x.jobs.has(e.k))) continue;
      key = e.key;
      jobs.set(e.k, o);
    }
    if (!jobs.size) continue;
    let obj: THREE.Object3D | null = null;
    try {
      const built = buildModel(key, os[0].opts ?? {});
      obj = built;
      // Shader cho đúng cảnh chân dung (cùng đèn, cùng cách tô màu) → lúc vẽ dùng lại, không biên dịch nữa.
      withoutProxies(built, () => R!.compile(built, cam, scene));
      preps.push({ obj: built, jobs });
    } catch (err) {
      console.warn('[portrait] prepare', err);
      if (obj) disposeTree(obj);
    }
  }
  // Đổi cỡ khung vẽ ngay lúc còn che màn, để ảnh đầu tiên vẽ sau đó không phải chờ.
  fitPrepared();
  return preps.length;
}

/**
 * Đổi cỡ khung vẽ cho ảnh vẽ sẵn đầu tiên (đổi cỡ phải chờ GPU – làm lúc còn che màn). Gọi lại sau khi vẽ ảnh khác cỡ
 * lúc còn che màn (vd. chân dung bé trên HUD lúc vào khu vực).
 */
export function fitPrepared(): void {
  const first = preps[0]?.jobs.values().next().value;
  if (first) fitCanvas(sizeOf(first));
}

/** Ảnh vẽ tiếp theo: ưu tiên ảnh cùng cỡ khung vẽ hiện tại (vẽ hết ảnh lớn rồi mới tới ảnh nhỏ, chỉ đổi cỡ một lần). */
function nextJob(): [Prep, string] | null {
  const w = R?.domElement.width;
  for (const p of preps) for (const [k, o] of p.jobs) if (sizeOf(o) === w) return [p, k];
  for (const p of preps) for (const k of p.jobs.keys()) return [p, k];
  return null;
}

/**
 * Vẽ dần các chân dung đã chuẩn bị (theo thứ tự chuẩn bị, ảnh cùng cỡ vẽ liền nhau), mỗi lúc rảnh một ảnh – kể cả ảnh
 * đầu tiên: ngay lúc mở màn máy còn bận vẽ cảnh, đọc ảnh ra phải chờ lâu.
 * `state()`: 'go' = vẽ được, 'wait' = để lúc khác (vd. bé đang chạy), 'stop' = bỏ hết (đã rời khu vực).
 */
export function drawPrepared(state: () => 'go' | 'wait' | 'stop'): void {
  const gen = prepGen;
  const later = (fn: () => void) => {
    // Safari chưa có requestIdleCallback.
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 150);
  };
  const step = () => {
    if (gen !== prepGen || !preps.length) return;
    const s = state();
    if (s === 'stop') return dropPrepared();
    if (s === 'go') {
      const j = nextJob();
      if (j) drawPrep(j[0], j[1]);
    }
    if (preps.length) later(step);
  };
  later(step);
}

/* ------------------------------------------------------------------ */
/* Chân dung bé (người chơi)                                            */
/* ------------------------------------------------------------------ */

/** Đồ hiện trên chân dung bé (thú cưng, ván trượt không vẽ). */
type Dress = Pick<Partial<Equipped>, 'outfit' | 'hat' | 'backpack' | 'acc'>;

function dressOf(eq: Partial<Equipped>): Dress {
  return { outfit: eq.outfit ?? DEFAULT_OUTFIT, hat: eq.hat ?? null, backpack: eq.backpack ?? null, acc: eq.acc ?? null };
}

/**
 * Chân dung bé (trai/gái) mặc bộ đồ, đội mũ, đeo balo, phụ kiện. Mô hình AI của bộ đồ chưa tải xong → '' và bắt đầu tải
 * (không vẽ tạm bé dựng bằng code) – dùng `setPlayerPortrait` để tự thay ảnh khi tải xong.
 * Tệp lỗi / tắt mô hình AI → chân dung bé dựng bằng code.
 */
export function playerPortrait(kid: Kid, eq: Partial<Equipped>, o: PortraitOpts = {}): string {
  const key = playerKey(kid, eq.outfit);
  if (!glbReady([key])) {
    void ensureGlb([key]);
    return '';
  }
  const dress = dressOf(eq);
  const k = JSON.stringify(['p', kid, dress, kidModelKey({ kid, eq: dress }) ?? 'code', o]);
  return cached(k, () => buildModel<PlayerOpts>('player', { kid, eq: dress }), o);
}

/** Bóng bé tạm (SVG) khi chờ tải mô hình AI: 'head' = đầu + vai, còn lại = cả người. */
export function playerPlaceholder(framing: Framing = 'full'): string {
  const body =
    framing === 'head'
      ? '<circle cx="50" cy="44" r="27"/><path d="M14 100c2-20 17-30 36-30s34 10 36 30z"/>'
      : '<circle cx="50" cy="26" r="17"/><path d="M30 92V60c0-9 9-16 20-16s20 7 20 16v32z"/><path d="M27 50l-9 22M73 50l9 22" stroke="#d5cce6" stroke-width="7" stroke-linecap="round"/>';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#d5cce6">${body}</svg>`)}`;
}

let reqSeq = 0;

/**
 * Đặt chân dung bé vào thẻ ảnh. Mô hình AI chưa tải xong: hiện bóng bé tạm (hoặc giữ ảnh bé đang có) và nhấp nháy nhẹ
 * (lớp `.portrait-wait`), tải xong thì tự thay. Gọi nhiều lần liên tiếp (bấm thử nhiều bộ đồ) chỉ lấy lần cuối.
 */
export function setPlayerPortrait(img: HTMLImageElement, kid: Kid, eq: Partial<Equipped>, o: PortraitOpts = {}): void {
  const tok = String(++reqSeq);
  img.dataset.portraitReq = tok;
  const show = (url: string) => {
    if (img.src !== url) img.src = url;
    img.dataset.portraitReal = '1';
    img.classList.remove('portrait-wait');
  };
  const url = playerPortrait(kid, eq, o);
  if (url) return show(url);
  if (img.dataset.portraitReal !== '1') img.src = playerPlaceholder(o.framing);
  img.classList.add('portrait-wait');
  void ensureGlb([playerKey(kid, eq.outfit)]).then(() => {
    if (img.dataset.portraitReq !== tok) return;
    // Tải bị tạm dừng (vd. đã vào thế giới, ảnh này không cần nữa): giữ bóng bé tạm, không tải lại.
    const u = glbReady([playerKey(kid, eq.outfit)]) ? playerPortrait(kid, eq, o) : '';
    if (u) show(u);
    else img.classList.remove('portrait-wait');
  });
}

/** Xóa bộ nhớ đệm (ví dụ khi người chơi thay đồ – không bắt buộc vì khóa đã gồm trang phục). */
export function clearPortraits(): void {
  cache.clear();
}

/**
 * Đặt chân dung mô hình (thú cưng...) vào thẻ ảnh. Mô hình AI chưa tải xong: vẽ tạm mô hình dựng bằng code và nhấp nháy
 * nhẹ (lớp `.portrait-wait`), `load` xong thì tự thay bằng mô hình AI. Trả về false nếu không vẽ được.
 */
export function setModelPortrait(
  img: HTMLImageElement,
  key: string,
  o: PortraitOpts = {},
  load: (key: string) => Promise<unknown> = (k) => ensureGlb([k]),
): boolean {
  if (!hasModel(key)) return false;
  key = modelKeyFor(key, o.opts ?? {});
  const tok = String(++reqSeq);
  img.dataset.portraitReq = tok;
  const ready = glbReady([key]);
  const url = cached(JSON.stringify(['m', key, o]), () => buildModel(key, o.opts ?? {}), o, ready);
  if (!url) return false;
  if (img.src !== url) img.src = url;
  img.classList.toggle('portrait-wait', !ready);
  if (!ready)
    void load(key).then(() => {
      if (img.dataset.portraitReq !== tok) return;
      // Tải bị bỏ qua (đã đóng bảng) hoặc tạm dừng: giữ ảnh tạm.
      const u = glbReady([key]) ? modelPortrait(key, o) : '';
      if (u && img.src !== u) img.src = u;
      img.classList.remove('portrait-wait');
    });
  return true;
}
