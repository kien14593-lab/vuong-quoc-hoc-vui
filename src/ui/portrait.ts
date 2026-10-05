import * as THREE from 'three';
import { DEFAULT_OUTFIT, playerKey, type Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { texturesOf, uploadTextures } from '../engine/core';
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
  // Đã chuẩn bị sẵn (preparePortraits) mà chưa kịp vẽ: vẽ ngay bằng mô hình đã dựng, shader đã / đang biên dịch.
  const p = ready && !cache.has(e.k) ? preps.find((x) => x.jobs.has(e.k)) : undefined;
  if (p) drawPrep(p, e.k);
  return cached(e.k, () => buildModel(e.key, o.opts ?? {}), o, ready);
}

/* ------------------------------------------------------------------ */
/* Vẽ sẵn chân dung (người sắp nói chuyện trong khu vực)                 */
/* ------------------------------------------------------------------ */

/** Mô hình đã dựng, chờ vẽ các ảnh `jobs` (khóa bộ nhớ đệm → tùy chọn ảnh). */
interface Prep {
  obj: THREE.Object3D;
  jobs: Map<string, PortraitOpts>;
  /**
   * 'draw' = vẽ được (shader đã biên dịch, ảnh – texture – đã lên GPU). 'upload' = shader đã biên dịch, còn đưa ảnh lên GPU.
   * 'compile' = trình duyệt còn đang biên dịch shader (song song): chưa làm gì – vẽ lúc này là phải chờ biên dịch xong
   * (khựng). Mỗi việc một lúc rảnh.
   */
  stage: 'compile' | 'upload' | 'draw';
  /** Ảnh (texture) còn phải đưa lên GPU (giai đoạn 'upload'; tính lúc bắt đầu đưa). */
  tex?: THREE.Texture[];
}

let preps: Prep[] = [];
/** Người thêm sau khi mở màn (`queuePortraits`), chờ dựng mô hình – mỗi lúc rảnh một người. */
let queue: [key: string, opts: PortraitOpts[]][] = [];
let prepGen = 0;
/** Trạng thái khu vực cho vòng vẽ dần (`drawPrepared`); null = chưa mở màn hoặc đã bỏ. */
let drawState: (() => 'go' | 'wait' | 'stop') | null = null;
/** Vòng vẽ dần chưa làm gì trước lúc này (performance.now() – `drawPrepared` afterMs). */
let startAt = 0;
/** prepGen của vòng vẽ dần đang chạy (-1 = không có). */
let loopGen = -1;

/** Vẽ ảnh `k` của mô hình đã chuẩn bị vào bộ nhớ đệm; vẽ hết các ảnh của mô hình thì hủy mô hình. */
function drawPrep(p: Prep, k: string): void {
  const o = p.jobs.get(k);
  p.jobs.delete(k);
  if (o && !cache.has(k)) {
    const url = renderPortrait(p.obj, o);
    // Đã vẽ: shader đã xong, ảnh đã lên GPU.
    p.stage = 'draw';
    if (cache.size > 400) cache.clear();
    if (url) cache.set(k, url);
  }
  if (p.jobs.size) return;
  preps = preps.filter((x) => x !== p);
  disposeTree(p.obj);
}

/** Bỏ các chân dung đã chuẩn bị mà chưa vẽ (cả người chờ chuẩn bị) và vòng vẽ dần đang chạy. */
export function dropPrepared(): void {
  prepGen++;
  for (const p of preps) disposeTree(p.obj);
  preps = [];
  queue = [];
  drawState = null;
}

/**
 * Biên dịch shader của mô hình cho cảnh chân dung (cùng đèn, cùng cách tô màu → lúc vẽ dùng lại). Xong khi trình duyệt
 * báo đã biên dịch xong (biên dịch song song); không hỏi được thì xong ngay.
 */
function compileFor(obj: THREE.Object3D): Promise<unknown> {
  return withoutProxies(obj, () => {
    if (R!.extensions.has('KHR_parallel_shader_compile')) return R!.compileAsync(obj, cam, scene);
    R!.compile(obj, cam, scene);
    return Promise.resolve();
  });
}

/** Biên dịch xong (`done`): chuyển `p` sang giai đoạn `next` và chạy lại vòng vẽ dần (bỏ qua nếu đã đổi khu vực / đã vẽ). */
function whenCompiled(p: Prep, done: Promise<unknown>, next: 'upload' | 'draw'): void {
  const gen = prepGen;
  void done
    .catch(() => undefined)
    .then(() => {
      if (gen !== prepGen || !preps.includes(p)) return;
      if (p.stage === 'compile') p.stage = next;
      kick();
    });
}

/** Ảnh còn phải vẽ của mô hình `art` (bỏ ảnh đã có / đã chuẩn bị) + khóa mô hình thật; null nếu không còn ảnh nào. */
function jobsFor(art: string, os: PortraitOpts[]): { key: string; jobs: Map<string, PortraitOpts> } | null {
  const jobs = new Map<string, PortraitOpts>();
  let key = '';
  for (const o of os) {
    const e = modelEntry(art, o);
    if (!e || !glbReady([e.key]) || cache.has(e.k) || preps.some((x) => x.jobs.has(e.k))) continue;
    key = e.key;
    jobs.set(e.k, o);
  }
  return jobs.size ? { key, jobs } : null;
}

/**
 * Chuẩn bị vẽ sẵn chân dung mô hình: dựng mô hình và biên dịch shader ngay (gọi lúc màn chuyển cảnh còn che – trình duyệt
 * biên dịch song song với phần chờ của khu vực), còn vẽ thì để sau, lúc rảnh (`drawPrepared`). Người đứng đầu (hộp thoại
 * đầu tiên thường với người này): đưa luôn ảnh (texture) lên GPU – lúc rảnh đầu tiên chỉ còn vẽ; những người khác đưa ảnh
 * lên vào một lúc rảnh riêng. Mỗi phần tử: khóa mô hình + các ảnh cần (cùng `opts`, khác cỡ ảnh). Chỉ mô hình đã sẵn sàng
 * (mô hình AI đã tải xong, không tải thêm), bỏ ảnh đã có. Thay cho lần chuẩn bị trước. Trả về số mô hình đã chuẩn bị.
 */
export function preparePortraits(list: [key: string, opts: PortraitOpts[]][], max = 6): number {
  dropPrepared();
  if (!list.length || !ensure() || !R) return 0;
  for (const [art, os] of list) {
    if (preps.length >= max) break;
    const j = jobsFor(art, os);
    if (!j) continue;
    let obj: THREE.Object3D | null = null;
    try {
      const built = buildModel(j.key, os[0].opts ?? {});
      obj = built;
      const done = compileFor(built);
      const lead = !preps.length;
      if (lead) withoutProxies(built, () => uploadTextures(R!, built));
      const p: Prep = { obj: built, jobs: j.jobs, stage: 'compile' };
      preps.push(p);
      // Thường đã xong trước khi mở màn; chưa xong thì lúc rảnh đầu tiên chờ thêm, không vẽ (vẽ là phải chờ – khựng).
      whenCompiled(p, done, lead ? 'draw' : 'upload');
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

/**
 * Việc tiếp theo của các mô hình đã biên dịch xong: ảnh lớn trước (ảnh hộp thoại trước ảnh thẻ câu hỏi – vẽ hết ảnh lớn rồi
 * mới tới ảnh nhỏ, chỉ đổi cỡ khung vẽ một lần), cùng cỡ thì theo thứ tự trong `preps`.
 */
function nextJob(): [Prep, string] | null {
  let best: [Prep, string] | null = null;
  let px = -1;
  for (const p of preps) {
    if (p.stage === 'compile') continue;
    for (const [k, o] of p.jobs)
      if (sizeOf(o) > px) {
        best = [p, k];
        px = sizeOf(o);
      }
  }
  return best;
}

/**
 * Đưa ảnh (texture) lên GPU trong một lúc rảnh: ít nhất một ảnh, thêm ảnh nữa khi chưa quá chừng này ms (một khung hình) –
 * máy chậm, ảnh lớn: mỗi lúc rảnh một ảnh.
 */
const UPLOAD_MS = 16;

/**
 * Làm việc `k` của mô hình `p`: chưa đưa hết ảnh (texture) lên GPU thì đưa tiếp (xem UPLOAD_MS), xong rồi mới vẽ (lúc rảnh
 * sau).
 */
function doJob([p, k]: [Prep, string]): void {
  if (p.stage !== 'upload') return drawPrep(p, k);
  const tex = (p.tex ??= withoutProxies(p.obj, () => texturesOf(p.obj)));
  const t0 = performance.now();
  while (tex.length) {
    R!.initTexture(tex.shift()!);
    if (performance.now() - t0 > UPLOAD_MS) break;
  }
  if (!tex.length) p.stage = 'draw';
}

/**
 * Chạy `fn` lúc máy rảnh, chậm nhất sau `timeout` ms (máy chậm ít khi rảnh). Safari chưa có requestIdleCallback: sau 150 ms.
 */
function later(fn: () => void, timeout = 1200): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 150);
}

/**
 * Việc đầu tiên sau khi mở màn: lúc rảnh, chậm nhất sau chừng này ms (sau `afterMs` của `drawPrepared`) – ảnh hộp thoại
 * của người đứng đầu phải xong trước hộp thoại đầu tiên (người mới chơi: Thỏ Bông chào sau chừng 1,4 giây).
 */
const FIRST_MS = 400;

/**
 * Một việc nhỏ cho một lúc rảnh: vẽ một ảnh, đưa ảnh (texture) của một mô hình lên GPU, hoặc dựng mô hình một người chờ
 * (`queuePortraits`) và bắt đầu biên dịch shader song song. Thứ tự: người đứng đầu (gần bé nhất lúc vào khu vực – hộp thoại
 * đầu tiên thường với người này), rồi người vừa thêm (vừa đổi sang mô hình AI, lấp lánh – bé hay tới hỏi), rồi những người
 * còn lại.
 */
function work(): void {
  const next = nextJob();
  if (next && next[0] === preps[0]) return doJob(next);
  while (queue.length) {
    const [art, os] = queue.shift()!;
    const j = jobsFor(art, os);
    if (!j) continue;
    let obj: THREE.Object3D | null = null;
    try {
      const built = buildModel(j.key, os[0].opts ?? {});
      obj = built;
      const p: Prep = { obj: built, jobs: j.jobs, stage: 'compile' };
      const done = compileFor(built);
      // Ngay sau người đứng đầu (người mới nhất trước).
      preps.splice(Math.min(1, preps.length), 0, p);
      whenCompiled(p, done, 'upload');
    } catch (err) {
      console.warn('[portrait] queue', err);
      if (obj) disposeTree(obj);
    }
    return;
  }
  if (next) doJob(next);
}

/** Bắt đầu vòng vẽ dần (đã mở màn – `drawPrepared`, còn việc, chưa có vòng nào đang chạy). */
function kick(): void {
  const state = drawState;
  if (!state || loopGen === prepGen || (!preps.length && !queue.length)) return;
  const gen = (loopGen = prepGen);
  const step = () => {
    if (gen !== prepGen) return;
    const s = ensure() ? state() : 'stop';
    if (s === 'stop') return dropPrepared();
    if (s === 'go') {
      try {
        work();
      } catch (err) {
        console.warn('[portrait] idle', err);
      }
    }
    // Chỉ còn mô hình đang biên dịch: nghỉ, biên dịch xong thì chạy lại (whenCompiled → kick).
    if (queue.length || preps.some((p) => p.stage !== 'compile')) later(step);
    else loopGen = -1;
  };
  const ms = startAt - performance.now();
  if (ms > 0) setTimeout(() => later(step, FIRST_MS), ms);
  else later(step);
}

/**
 * Vẽ dần các chân dung đã chuẩn bị và những người thêm sau (`queuePortraits`), mỗi lúc rảnh một việc (thứ tự: xem `work`) –
 * kể cả ảnh đầu tiên: ngay lúc mở màn máy còn bận vẽ cảnh, đọc ảnh ra phải chờ lâu.
 * `state()`: 'go' = vẽ được, 'wait' = để lúc khác (vd. bé đang chạy), 'stop' = bỏ hết (đã rời khu vực).
 * `afterMs`: chưa làm gì trong chừng này ms (màn che còn đang mờ dần: GPU còn bận với cảnh vừa hiện – mọi lệnh phải chờ GPU,
 * cả trên khung vẽ chân dung, lúc này đều chờ lâu, khựng ngay lúc cảnh hiện ra).
 */
export function drawPrepared(state: () => 'go' | 'wait' | 'stop', afterMs = 0): void {
  drawState = state;
  startAt = performance.now() + afterMs;
  kick();
}

/**
 * Thêm người sẽ nói chuyện sau khi đã mở màn (vd. mô hình AI tải sau vừa xong – world/zone.ts lateLoaded): cùng dạng với
 * `preparePortraits` nhưng không làm gì ngay – vòng vẽ dần (`drawPrepared`) dựng mô hình, biên dịch shader, đưa ảnh lên GPU
 * rồi vẽ, mỗi lúc rảnh một việc. Chỉ mô hình đã sẵn sàng, bỏ ảnh đã có / đang chuẩn bị. Bỏ khi rời khu vực (`dropPrepared`).
 */
export function queuePortraits(list: [key: string, opts: PortraitOpts[]][]): void {
  if (failed) return;
  for (const [art, os] of list) if (jobsFor(art, os)) queue.push([art, os]);
  kick();
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
