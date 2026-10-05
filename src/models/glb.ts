import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { box } from '../engine/kit';
import { SHADOW_LAYER } from '../engine/layers';
import { autoRig, placeRig, RIG_VERSION, rigReport, type AutoRigAnchors, type AutoRigResult, type BakedRig, type V3 } from './autorig';
import { useImageWorker } from './glb-image';
import { overrideModel, type Collider, type ModelDef } from './registry';
import { animateRig, type AnimState, type Rig, type RigKind } from './rig';

/**
 * Mô hình 3D dạng tệp GLB (tải từ thư viện CC0 hoặc tạo bằng AI) thay cho mô hình dựng bằng code.
 *
 *  - `defineGlbModel('npc_bear', { src })` thay mô hình cùng khóa; mô hình dựng bằng code vẫn được giữ làm dự phòng
 *    (khi tệp chưa nạp/lỗi) và cho va chạm, chiều cao, mô tả mặc định.
 *  - Tệp được nạp theo nhu cầu: `await ensureGlb(keys)` trước khi dựng cảnh cần các khóa đó (màn tiêu đề, từng
 *    khu vực, trò chơi nhỏ – danh sách ở game/needs.ts) để `buildModel` luôn đồng bộ; `prefetchGlb()` nạp trước phần
 *    còn lại ở nền. Tệp chưa nạp xong/lỗi thì dùng mô hình dựng bằng code. `preloadGlb()` nạp tất cả (trang xem thử).
 *  - Mô hình được chuẩn hóa: chân chạm y = 0, cao đúng `height` mét, mặt trước hướng +Z (chỉnh bằng `rotY`).
 *  - Hoạt cảnh (idle/walk/run/...) tự nhận theo tên clip, điều khiển qua `animateRig` như mô hình dựng bằng code.
 *    Mô hình không có xương/hoạt cảnh vẫn "sống" nhờ hoạt cảnh đồ chơi (nhún, lắc, thở).
 */

export type ClipRole =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'wave'
  | 'talk'
  | 'happy'
  | 'eat'
  | 'sit'
  | 'swim'
  | 'fly'
  | 'attack'
  | 'hit'
  | 'death';

export const CLIP_ROLES: readonly ClipRole[] = ['idle', 'walk', 'run', 'jump', 'fall', 'wave', 'talk', 'happy', 'eat', 'sit', 'swim', 'fly', 'attack', 'hit', 'death'];

/** Tệp GLB phụ chứa hoạt cảnh (cùng tên xương với mô hình chính). */
export interface AnimSource {
  src: string;
  /** Gán clip (đầu tiên, hoặc `clip`) của tệp này cho vai trò; bỏ trống = tự nhận theo tên clip. */
  role?: ClipRole;
  clip?: string;
}

export interface DecorateCtx {
  /** Nhóm gốc của mô hình (đối tượng được trả về). */
  root: THREE.Group;
  /** Bản sao cảnh GLB (bên trong nhóm đã co giãn). */
  model: THREE.Object3D;
  /** Tìm nút/xương theo tên (chính xác) hoặc biểu thức chính quy. */
  find(name: string | RegExp): THREE.Object3D | undefined;
  /**
   * Gắn `obj` vào nút `target` sao cho trong tư thế nghỉ, `obj` nằm ở `at` (mét, hệ tọa độ mô hình, so với gốc
   * của `target`), dựng thẳng, đúng tỉ lệ thật – không bị ảnh hưởng bởi tỉ lệ/xoay của xương.
   */
  attach(target: THREE.Object3D, obj: THREE.Object3D, at?: [number, number, number]): void;
  /** Chiều cao mô hình (m). */
  height: number;
  opts: Record<string, unknown>;
}

export interface GlbLook {
  /** URL tệp .glb – nhập bằng `import url from '...glb?url'`. */
  src: string;
  /** Chỉ lấy một nút con (theo tên) – cho tệp chứa nhiều mô hình. */
  node?: string;
  /** Ẩn các lưới theo tên (vd. vũ khí, phụ kiện). */
  hide?: (string | RegExp)[];
  /** Chỉ giữ các lưới có tên khớp (bỏ các lưới khác). */
  only?: (string | RegExp)[];
  /** Đổi màu theo tên vật liệu: { 'Fur': '#f5c08a' }. */
  colors?: Record<string, string>;
  /** Kiểu vật liệu: 'lambert' (mặc định – hợp phong cách game), 'toon' (tô bóng 3 mức), 'standard' (giữ nguyên PBR). */
  material?: 'lambert' | 'toon' | 'standard';
  /**
   * Lệch mức mipmap khi lấy màu từ ảnh (vd. -1 = sắc hơn một mức). Ảnh của mô hình AI xếp các mảnh sát nhau nên ở xa,
   * mipmap trộn màu mảnh bên cạnh vào mép mảnh → vệt nứt màu (rõ nhất trên tóc). Lệch -1 bỏ gần hết mà không lấp lánh
   * thêm. Bé (player_*) mặc định -1; 0 = tắt.
   */
  mipBias?: number;
  /** Chiều cao mong muốn (m); mặc định = chiều cao của mô hình dựng bằng code cùng khóa (trừ độ nâng `offset`). */
  height?: number;
  /** Tỉ lệ cố định (bỏ qua `height`). */
  scale?: number;
  /** Xoay thêm quanh trục đứng (độ) để mặt trước hướng +Z. */
  rotY?: number;
  /** Dịch thêm sau khi đặt chân xuống y = 0 (mét); nâng lên (y > 0) thì nhãn tên cũng nâng theo. */
  offset?: [number, number, number];
  /** Tên clip cho từng vai trò (ghi đè tự nhận). */
  clips?: Partial<Record<ClipRole, string | string[]>>;
  /** Tệp hoạt cảnh bổ sung. */
  animSrc?: (string | AnimSource)[];
  /** Khóa chuyển động gốc (hông) theo phương ngang để nhân vật đi tại chỗ (mặc định: có). */
  inPlace?: boolean;
  /** Tốc độ phát clip đi/chạy (mặc định 1). */
  walkRate?: number;
  runRate?: number;
  /** Gắn thêm phụ kiện cho từng bản sao (vương miện, tạp dề...). */
  decorate?: (ctx: DecorateCtx) => void;
  /**
   * Tự dựng xương (6 khớp) cho mô hình người không có xương ở tư thế chữ A để đi/chạy/vẫy tay bằng tay chân thật
   * (xem autorig.ts). Dò không được thì dùng hoạt cảnh nhún nhảy như thường. Tùy chọn dựng `autoRig` ghi đè.
   */
  autoRig?: boolean;
  /**
   * Xương đã dò sẵn bởi công cụ xử lý mô hình (config.json "rig"; trọng số da nằm trong tệp GLB) – khỏi phải dò
   * lúc chạy. Cũ (phiên bản khác) hoặc không khớp tệp thì dò lại lúc chạy.
   */
  rig?: BakedRig;
}

export interface GlbSpec extends GlbLook {
  kind?: RigKind;
  colliders?: Collider[];
  tags?: string[];
  desc?: string;
  /** Nguồn & giấy phép (để ghi công). */
  credit?: string;
  source?: 'cc0' | 'ai' | 'custom';
  /** Biến thể (chọn bằng tùy chọn `v`): mỗi biến thể ghi đè một phần cấu hình. */
  variants?: Partial<GlbLook>[];
  /**
   * Bé (nhân vật chính): tinh chỉnh chỗ gắn đồ – "head" (mũ, kính) / "body" (balo, khăn...): dịch [x, y, z] (mét)
   * và phóng to (số thứ tư, mặc định 1). Từ cau-hinh.json "gan-do": { "dau": [...], "than": [...] }.
   */
  dress?: { head?: [number, number, number, number?]; body?: [number, number, number, number?] };
}

interface Prepared {
  tpl: THREE.Object3D;
  roles: Map<ClipRole, THREE.AnimationClip>;
  clipNames: string[];
  scale: number;
  baseY: number;
  height: number;
  headName?: string;
  /** Xương tự dựng & điểm neo (tính khi cần lần đầu; null = không dựng được). */
  auto?: AutoData | null;
}

/** Xương tự dựng & điểm neo dùng chung cho mọi bản sao của một mô hình (hệ gốc mô hình, mét). */
interface AutoData {
  joints: AutoRigResult['joints'];
  anchors: AutoRigAnchors;
  relax: [number, number];
  armAngle: [number, number];
  /** true = đi bằng chân (xương tự dựng); false = nhún nhảy như các nhân vật AI khác, chỉ dùng điểm neo để gắn đồ. */
  walk: boolean;
  /** Theo thứ tự duyệt cây mẫu: hình học có trọng số da (dùng chung), lưới bóng của nó (nếu tệp có) & ma trận gắn (lưới → hệ gốc mô hình). */
  meshes: { geo: THREE.BufferGeometry; proxy?: THREE.BufferGeometry; bind: THREE.Matrix4 }[];
  /** Nghịch đảo tư thế gốc của từng xương (thứ tự AUTO_BONES). */
  inverses: THREE.Matrix4[];
  /** Lấy từ config.json (công cụ đã dò sẵn) thay vì dò lúc chạy. */
  baked: boolean;
  /** Thời gian chuẩn bị (ms). */
  ms: number;
}

/**
 * Chỗ gắn đồ (mũ, kính, balo, khăn...) trên mô hình có xương tự dựng – `root.userData.sockets`.
 * Mỗi chỗ gắn có trục song song với gốc mô hình khi đứng nghỉ; gốc đặt ở khớp: vị trí cục bộ = điểm − khớp.
 */
export interface GlbSockets {
  /** Theo đầu (gốc ở cổ `joints.neck`). */
  head: THREE.Object3D;
  /** Theo thân (gốc ở hông `joints.pelvis`). */
  body: THREE.Object3D;
  joints: AutoRigResult['joints'];
  anchors: AutoRigAnchors;
  /** true = có xương (đi bằng chân); false = nhún nhảy. */
  walk: boolean;
}

interface Entry {
  key: string;
  spec: GlbSpec;
  base?: ModelDef<any>;
  prepared: Map<number, Prepared | null>;
}

/** Một tệp đang tải. */
interface Load {
  /** Ưu tiên thấp (nạp trước ở nền) – nhường đường khi một khu vực cần tệp khác ngay. */
  low: boolean;
  ctrl: AbortController;
  /** Số byte đã nhận / tổng (đọc từ đầu tệp GLB; -1 = không rõ). */
  got: number;
  total: number;
  /** Đã tải xong, đang giải nén – không hủy nữa. */
  parsing: boolean;
  promise: Promise<void>;
}

const entries = new Map<string, Entry>();
const gltfs = new Map<string, GLTF>();
const loads = new Map<string, Load>();
/** Hàng đợi nạp trước ở nền (lần lượt từng tệp, ưu tiên thấp). */
const queue: string[] = [];
const failed = new Set<string>();
/** Số lần đang chờ nhóm tệp cần trước nhất (EnsureOpts.first) tải xong – trong lúc đó không nạp trước ở nền. */
let holds = 0;
let enabled = true;
let loader: GLTFLoader | undefined;

/** Bật/tắt mô hình GLB (tắt = dùng mô hình dựng bằng code – để so sánh, gỡ lỗi). */
export function setGlbEnabled(v: boolean): void {
  enabled = v;
}

export function defineGlbModel(key: string, spec: GlbSpec): void {
  const entry: Entry = { key, spec, prepared: new Map() };
  entries.set(key, entry);
  overrideModel(key, (base) => {
    entry.base = base;
    entry.prepared.clear();
    const def: ModelDef<any> = {
      build: (o: Record<string, unknown> = {}) => buildGlb(entry, o),
      colliders: spec.colliders ?? base?.colliders,
      height: (o: Record<string, unknown> = {}) => {
        const vi = variantIndex(entry, o);
        const look = lookOf(entry, vi);
        const h = entry.prepared.get(vi)?.height ?? look.height;
        // Đỉnh mô hình tính từ mặt đất (để đặt nhãn tên) – gồm cả độ nâng của nhân vật bay.
        return h !== undefined ? h + liftOf(entry, look) : baseHeight(entry, o) ?? 1.5;
      },
      tags: [...new Set([...(spec.tags ?? base?.tags ?? []), 'glb'])],
      desc: spec.desc ?? `${spec.source === 'ai' ? 'AI' : 'GLB'}${spec.credit ? ` (${spec.credit})` : ''}${base?.desc ? ' – ' + base.desc : ''}`,
      variants: spec.variants?.length ? spec.variants.map((_, i) => ({ v: i })) : undefined,
      portrait: base?.portrait,
    };
    return def;
  });
}

function urlsOf(spec: GlbSpec): string[] {
  const out: string[] = [];
  const add = (l: Partial<GlbLook>) => {
    if (l.src) out.push(l.src);
    for (const a of l.animSrc ?? []) out.push(typeof a === 'string' ? a : a.src);
  };
  add(spec);
  for (const v of spec.variants ?? []) add(v);
  return out;
}

function getLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    useImageWorker(loader);
  }
  return loader;
}

const settled = (url: string) => gltfs.has(url) || failed.has(url);
/** Tệp đã tải quá nửa (hoặc đang giải nén): tải tiếp rẻ hơn dừng rồi tải lại từ đầu. */
const halfDone = (ld: Load) => ld.parsing || (ld.total > 0 && ld.got * 2 > ld.total);

/** Các tệp (mô hình + hoạt cảnh, mọi biến thể) của các khóa có mô hình GLB. */
function urlsFor(keys: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const k of keys) {
    const e = entries.get(k);
    if (e) for (const u of urlsOf(e.spec)) out.add(u);
  }
  return [...out];
}

async function download(url: string, ld: Load): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal: ld.ctrl.signal, priority: ld.low ? 'low' : 'high' } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();
  const parts: Uint8Array[] = [];
  const head = new Uint8Array(12);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (ld.got < 12) head.set(value.subarray(0, 12 - ld.got), ld.got);
    parts.push(value);
    ld.got += value.byteLength;
    if (!ld.total && ld.got >= 12) {
      // Đầu tệp GLB: "glTF", phiên bản, tổng dung lượng – để tính tiến độ (kể cả khi máy chủ nén gzip).
      const dv = new DataView(head.buffer);
      ld.total = dv.getUint32(0, true) === 0x46546c67 ? dv.getUint32(8, true) : -1;
    }
  }
  const buf = new Uint8Array(ld.got);
  let at = 0;
  for (const p of parts) {
    buf.set(p, at);
    at += p.byteLength;
  }
  return buf.buffer;
}

function startLoad(url: string, low: boolean): Load {
  const ld: Load = { low, ctrl: new AbortController(), got: 0, total: 0, parsing: false, promise: Promise.resolve() };
  ld.promise = download(url, ld)
    .then((buf) => {
      ld.parsing = true;
      return getLoader().parseAsync(buf, url.startsWith('data:') ? '' : THREE.LoaderUtils.extractUrlBase(url));
    })
    .then((g) => {
      gltfs.set(url, g);
    })
    .catch((e) => {
      if (ld.ctrl.signal.aborted) return;
      failed.add(url);
      console.warn('[glb] không nạp được', url.slice(0, 80), e);
    })
    .finally(() => {
      if (loads.get(url) === ld) loads.delete(url);
      pump();
    });
  loads.set(url, ld);
  return ld;
}

/** Nạp trước ở nền: chỉ một tệp mỗi lúc và chỉ khi không có tệp nào khác đang tải. */
function pump(): void {
  if (loads.size || holds) return;
  while (queue.length) {
    const u = queue.shift()!;
    if (!settled(u) && !loads.has(u)) {
      startLoad(u, true);
      return;
    }
  }
}

export interface EnsureOpts {
  /** Chờ tối đa (ms). Quá hạn: trả về false, tệp vẫn tải tiếp và được dùng từ lần dựng mô hình sau. */
  timeoutMs?: number;
  /** Tiến độ 0..1. */
  onProgress?: (frac: number) => void;
  /**
   * Khóa cần trước nhất (vd. bé – luôn ở giữa màn hình): tải trước; tệp khác chưa tải thì đợi nhóm này xong mới bắt đầu
   * (mạng chậm, quá hạn chờ thì ít nhất bé đã sẵn sàng). Tệp đang tải dở vẫn tải tiếp, trừ tệp ưu tiên thấp chưa quá nửa.
   */
  first?: Iterable<string>;
}

/**
 * Nạp (ưu tiên cao) các tệp GLB của các khóa và chờ xong. Các tệp đang nạp trước ở nền mà không cần ngay
 * sẽ tạm dừng để nhường đường. Không bao giờ báo lỗi: tệp lỗi/quá hạn thì nhân vật dùng mô hình dựng bằng code.
 * Trả về true khi mọi tệp đã sẵn sàng.
 */
export function ensureGlb(keys: Iterable<string>, o: EnsureOpts = {}): Promise<boolean> {
  const urls = enabled ? urlsFor(keys).filter((u) => !settled(u)) : [];
  if (!urls.length) {
    o.onProgress?.(1);
    return Promise.resolve(true);
  }
  const need = new Set(urls);
  for (const [u, ld] of loads) {
    if (ld.low && !ld.parsing && !need.has(u)) {
      ld.ctrl.abort();
      loads.delete(u);
      queue.unshift(u);
    }
  }
  const take = (u: string): Load => {
    const ld = loads.get(u);
    if (!ld) return startLoad(u, false);
    ld.low = false;
    return ld;
  };
  const head = new Set(o.first ? urlsFor(o.first).filter((u) => need.has(u)) : []);
  // Chưa có bé: tệp khác chưa tải – hoặc đang tải ở ưu tiên thấp, chưa quá nửa (mạng rất chậm) – đợi bé xong mới tải.
  const later = head.size ? urls.filter((u) => !head.has(u) && (!loads.has(u) || yields(loads.get(u)!))) : [];
  for (const u of later) {
    loads.get(u)?.ctrl.abort();
    loads.delete(u);
  }
  const now = urls.filter((u) => !later.includes(u)).map((u) => ({ u, ld: take(u) }));
  if (later.length) holds++;
  const frac = () =>
    urls.reduce((s, u) => {
      const ld = loads.get(u);
      return s + (settled(u) ? 1 : ld && ld.total > 0 ? Math.min(0.98, ld.got / ld.total) : 0);
    }, 0) / urls.length;
  return new Promise<boolean>((resolve) => {
    let over = false;
    const tick = o.onProgress ? setInterval(() => o.onProgress!(frac()), 120) : undefined;
    const timer = o.timeoutMs
      ? setTimeout(() => {
          console.warn('[glb] chờ quá lâu – tạm dùng mô hình dựng bằng code:', urls.filter((u) => !settled(u)).map((u) => u.slice(0, 80)));
          finish(false);
        }, o.timeoutMs)
      : undefined;
    function finish(ok: boolean): void {
      if (over) return;
      over = true;
      clearInterval(tick);
      clearTimeout(timer);
      o.onProgress?.(1);
      resolve(ok);
    }
    const headDone = Promise.all(now.filter((x) => head.has(x.u)).map((x) => x.ld.promise));
    const rest = headDone.then(() => {
      if (later.length) holds--;
      const todo = later.filter((u) => !settled(u));
      // Đã thôi chờ (quá hạn): phần còn lại tải dần ở nền.
      if (over) for (const u of todo) if (!loads.has(u) && !queue.includes(u)) queue.push(u);
      const mine = over ? [] : todo.map((u) => take(u).promise);
      pump();
      return Promise.all(mine);
    });
    void Promise.all([...now.map((x) => x.ld.promise), rest]).then(() => finish(urls.every((u) => gltfs.has(u))));
  });
}

/** Tệp đang tải ở ưu tiên thấp, chưa quá nửa: tạm dừng được (tải lại sau rẻ hơn để chen làm chậm cả hai). */
const yields = (ld: Load) => ld.low && !halfDone(ld);

/**
 * Các tệp đang tải không cần gấp nữa (vd. vào thế giới: ảnh bé ở màn tiêu đề / tạo hồ sơ): tệp chưa tải quá nửa thành
 * ưu tiên thấp – cảnh sắp vào cần tệp khác thì tạm dừng, sau đó tải lại dần ở nền.
 */
export function lowerGlb(): void {
  for (const ld of loads.values()) if (!halfDone(ld)) ld.low = true;
}

/** Các tệp GLB của các khóa đã xong (nạp được hoặc lỗi) chưa – xong thì dựng mô hình không cần chờ. */
export function glbReady(keys?: Iterable<string>): boolean {
  return !enabled || urlsFor(keys ?? entries.keys()).every(settled);
}

/** Khóa này có mô hình GLB đăng ký không (bật hay tắt GLB đều trả lời theo tệp có sẵn). */
export function hasGlb(key: string): boolean {
  return entries.has(key);
}

/** Cấu hình GLB của khóa (config.json + mặc định) – để đọc tinh chỉnh riêng, vd. chỗ gắn đồ của bé. */
export function glbSpec(key: string): Readonly<GlbSpec> | undefined {
  return entries.get(key)?.spec;
}

/** Mô hình GLB của khóa đã nạp xong, dựng ngay được (không lỗi, đang bật GLB). */
export function glbLoaded(key: string): boolean {
  const e = entries.get(key);
  return !!e && enabled && urlsOf(e.spec).every((u) => gltfs.has(u));
}

/** Nạp trước ở nền (ưu tiên thấp, lần lượt theo thứ tự) để các khu vực sau mở ngay; bỏ qua khi bật tiết kiệm dữ liệu. */
export function prefetchGlb(keys?: Iterable<string>): void {
  if (!enabled) return;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  for (const u of urlsFor(keys ?? entries.keys())) if (!settled(u) && !queue.includes(u)) queue.push(u);
  pump();
}

/** Nạp và chờ các tệp GLB của các khóa (mặc định: tất cả – cho trang xem thử). Gọi lại an toàn (chỉ nạp tệp mới). */
export async function preloadGlb(keys?: Iterable<string>, o: EnsureOpts = {}): Promise<void> {
  await ensureGlb(keys ?? [...entries.keys()], o);
}

/* ------------------------------------------------------------------ */
/* Vật liệu                                                            */
/* ------------------------------------------------------------------ */

const matCache = new Map<string, THREE.Material>();
let toonRamp: THREE.DataTexture | undefined;

function toonGradient(): THREE.DataTexture {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    toonRamp.minFilter = THREE.NearestFilter;
    toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
    toonRamp.userData.shared = true;
  }
  return toonRamp;
}

/** Lấy màu từ ảnh (map) với độ lệch mức mipmap – xem GlbLook.mipBias. */
export function biasMipmap(m: THREE.Material, bias: number): void {
  const b = bias.toFixed(2);
  const chunk = THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', `texture2D( map, vMapUv, ${b} )`);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', chunk);
  };
  m.customProgramCacheKey = () => `mipBias${b}`;
}

function convertMaterial(src: THREE.Material, mode: GlbLook['material'], color?: string, mipBias = 0): THREE.Material {
  const key = `${src.uuid}|${mode ?? 'lambert'}|${color ?? ''}|${mipBias}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const s = src as THREE.MeshStandardMaterial;
  let m: THREE.Material;
  if (mode === 'standard' || !s.isMeshStandardMaterial) {
    m = color || mipBias ? src.clone() : src;
    if (color && (m as THREE.MeshStandardMaterial).color) (m as THREE.MeshStandardMaterial).color.set(color);
  } else {
    const common = {
      name: s.name,
      color: color ? new THREE.Color(color) : s.color.clone(),
      map: s.map,
      vertexColors: s.vertexColors,
      transparent: s.transparent,
      opacity: s.opacity,
      alphaTest: s.alphaTest,
      side: s.side,
      emissive: s.emissive.clone(),
      emissiveMap: s.emissiveMap,
      emissiveIntensity: s.emissiveIntensity,
      normalMap: s.normalMap,
      normalScale: s.normalScale.clone(),
    };
    if (mode === 'toon') m = new THREE.MeshToonMaterial({ ...common, gradientMap: toonGradient() });
    // Có ảnh kim loại (mô hình AI xuất từ Blender) thì hệ số thường = 1 dù bề mặt không phải kim loại → giữ mờ.
    else if (s.metalness > 0.5 && !s.metalnessMap) m = new THREE.MeshPhongMaterial({ ...common, shininess: 70, specular: new THREE.Color(0x777777) });
    else m = new THREE.MeshLambertMaterial(common);
  }
  m.userData.shared = true;
  if (mipBias && (m as THREE.MeshLambertMaterial).map) biasMipmap(m, mipBias);
  for (const t of [s.map, s.emissiveMap, s.normalMap]) if (t) t.userData.shared = true;
  matCache.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Hoạt cảnh                                                           */
/* ------------------------------------------------------------------ */

/** Tên clip đã làm sạch: bỏ "Armature|", "|baselayer", chữ thường. */
export function cleanClipName(name: string): string {
  const parts = name
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p && !/^(.*armature|baselayer|base layer|take ?\d*|mixamo\.com|animation)$/i.test(p));
  return (parts.join('_') || name).toLowerCase().replace(/[\s.-]+/g, '_');
}

const ROLE_RULES: [ClipRole, RegExp[], RegExp?][] = [
  ['idle', [/^idle$/, /^idle_?(loop|0?1|a|neutral)$/, /^(idle|stand|breath)/, /idle|stand|breath/], /jump|walk|run|attack|hit|death|sit|eat|swim|fly|gallop|sword|gun|crouch/],
  ['walk', [/^walk(ing)?$/, /^walk(ing)?_?(loop|fwd|forward|f)?$/, /walk/], /back|left|right|stair|carry|limp|crouch|sneak|formal|bwd/],
  ['run', [/^run(ning)?$/, /^(run|jog|sprint|gallop|trot)(ning)?(_?(loop|fwd|forward|f))?$/, /run|gallop|jog|sprint|trot/], /back|left|right|jump|attack|stop|start|bwd|carry|gun|sword/],
  ['jump', [/^jump_?(idle|loop|air|mid|fall)$/, /^jump(ing)?$/, /jump/], /attack|gallop_jump|to_?idle|land|start|run/],
  ['fall', [/fall/, /jump_?land/]],
  ['wave', [/wave|waving|hello|greet|salute/]],
  ['talk', [/talk|speak|convers|yes|nod|interact/]],
  ['happy', [/cheer|happy|victory|celebrat|dance|clap|win/]],
  ['eat', [/(^|_)eat(ing)?($|_)|graz|peck/]],
  ['sit', [/(^|_)sit(ting|_?down|_?idle)?($|_)/]],
  ['swim', [/swim/]],
  ['fly', [/(^|_)fly(ing)?($|_)|flap/]],
  ['attack', [/attack|punch|slash|kick|bite|headbutt/]],
  ['hit', [/(^|_)hit|react|recieve|receive|damage/]],
  ['death', [/death|(^|_)die($|_)|dead/]],
];

const FALLBACK: Record<ClipRole, ClipRole[]> = {
  idle: ['idle'],
  walk: ['walk', 'run', 'idle'],
  run: ['run', 'walk', 'idle'],
  jump: ['jump', 'fall', 'idle'],
  fall: ['fall', 'jump', 'idle'],
  wave: ['wave', 'happy', 'talk', 'idle'],
  talk: ['talk', 'idle'],
  happy: ['happy', 'jump', 'wave', 'idle'],
  eat: ['eat', 'idle'],
  sit: ['sit', 'idle'],
  swim: ['swim', 'walk', 'idle'],
  fly: ['fly', 'idle'],
  attack: ['attack', 'idle'],
  hit: ['hit', 'idle'],
  death: ['death', 'idle'],
};

function detectRoles(clips: THREE.AnimationClip[], fixed: Map<ClipRole, THREE.AnimationClip>): void {
  const named = clips.map((c) => ({ c, n: cleanClipName(c.name) }));
  for (const [role, rxs, bad] of ROLE_RULES) {
    if (fixed.has(role)) continue;
    for (const rx of rxs) {
      const hits = named.filter((x) => rx.test(x.n) && !(bad && bad.test(x.n)));
      if (hits.length) {
        hits.sort((a, b) => a.n.length - b.n.length);
        fixed.set(role, hits[0].c);
        break;
      }
    }
  }
}

const inPlaceCache = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();

/** Khóa dịch chuyển ngang của xương gốc (hông) để hoạt cảnh đi/chạy tại chỗ. */
function makeInPlace(clip: THREE.AnimationClip, rootBone: string | undefined): THREE.AnimationClip {
  if (!rootBone) return clip;
  const hit = inPlaceCache.get(clip);
  if (hit) return hit;
  let changed = false;
  const tracks = clip.tracks.map((tr) => {
    const dot = tr.name.lastIndexOf('.');
    if (tr.name.slice(dot + 1) !== 'position' || tr.name.slice(0, dot) !== rootBone) return tr;
    const t = tr.clone();
    const v = t.values;
    if (v.length >= 3) {
      const x0 = v[0];
      const z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0;
        v[i + 2] = z0;
      }
      changed = true;
    }
    return t;
  });
  const out = changed ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode) : clip;
  inPlaceCache.set(clip, out);
  return out;
}

function findRootBone(obj: THREE.Object3D): string | undefined {
  let found: THREE.Object3D | undefined;
  obj.traverse((o) => {
    if (found || !(o as THREE.Bone).isBone) return;
    found = o;
  });
  if (!found) return undefined;
  // Ưu tiên xương hông nếu xương gốc chỉ là "root" đứng yên.
  let hips: THREE.Object3D | undefined;
  found.traverse((o) => {
    if (!hips && (o as THREE.Bone).isBone && /hips|pelvis/i.test(o.name)) hips = o;
  });
  return (hips ?? found).name;
}

function findHead(obj: THREE.Object3D): string | undefined {
  let exact: string | undefined;
  let loose: string | undefined;
  obj.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    if (!exact && /^(mixamorig\d*:?)?head$/i.test(o.name)) exact = o.name;
    if (!loose && /head/i.test(o.name) && !/end|top|nub|tip|hair|jaw|eye|ear/i.test(o.name)) loose = o.name;
  });
  return exact ?? loose;
}

const approach = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/**
 * Lời chào thay cho động tác vẫy tay (mô hình không có clip 'wave'): một cú nhún nhảy nhỏ lúc bắt đầu
 * + lắc người qua lại rồi tắt dần. Thời gian tính bằng giây, độ cao theo chiều cao nhân vật, góc bằng rad.
 */
const GREET = {
  crouch: 0.14,
  air: 0.34,
  land: 0.16,
  hop: 0.075,
  floatLen: 0.7,
  floatHop: 0.1,
  burst: (3 * Math.PI) / 7,
  speed: 7,
  yaw: 0.21,
  roll: 0.06,
  rest: 0.25,
};

class GlbAnimator {
  readonly mixer: THREE.AnimationMixer | null;
  readonly head?: THREE.Object3D;
  private readonly actions = new Map<ClipRole, THREE.AnimationAction>();
  private cur: THREE.AnimationAction | null = null;
  private curRole: ClipRole | null = null;
  private readonly headRest?: THREE.Quaternion;
  private readonly baseY: number;
  private readonly baseScale: THREE.Vector3;
  private readonly baseRotY: number;
  private readonly seed = Math.random() * 100;
  private hop = 0;
  private phase = 0;
  private talkW = 0;
  private lastDriven = -1e9;
  private waveOn = false;
  private greetT = -1;
  private greetAmp = 0;
  private greetPh = 0;
  private waveW = 0;

  constructor(
    model: THREE.Object3D,
    private readonly inner: THREE.Group,
    private readonly prep: Prepared,
    private readonly look: GlbLook,
    /** Bay lơ lửng (rig 'float'): nhấp nhô thay cho nhún bước. */
    private readonly float = false,
    /** Hiệu ứng dưới thân (vòng đẩy của robot): nhấp nhô theo thân và tự quay. */
    private readonly fx?: { obj: THREE.Object3D; y: number; spin: number },
  ) {
    if (prep.roles.size) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const [role, clip] of prep.roles) this.actions.set(role, this.mixer.clipAction(clip));
    } else this.mixer = null;
    this.head = prep.headName ? model.getObjectByName(prep.headName) : undefined;
    this.headRest = this.head?.quaternion.clone();
    this.baseY = inner.position.y;
    this.baseScale = inner.scale.clone();
    this.baseRotY = inner.rotation.y;
    this.play('idle', 0, true);
    this.mixer?.update(0);
  }

  has(role: ClipRole): boolean {
    return this.actions.has(role);
  }

  private resolve(role: ClipRole): ClipRole | null {
    for (const r of FALLBACK[role]) if (this.actions.has(r)) return r;
    return null;
  }

  private play(role: ClipRole, fade = 0.22, randomStart = false): void {
    const r = this.resolve(role);
    if (!r || r === this.curRole) return;
    const next = this.actions.get(r)!;
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    if (randomStart) next.time = Math.random() * next.getClip().duration;
    next.play();
    if (this.cur && fade > 0) this.cur.crossFadeTo(next, fade, false);
    else this.cur?.stop();
    this.cur = next;
    this.curRole = r;
  }

  /** Gọi từ animateRig (mỗi khung hình). */
  update(s: AnimState): void {
    this.lastDriven = performance.now();
    // Chỉ chào khi vừa bật vẫy tay (xét ở khung có người điều khiển để autoTick không gây chào lại).
    const wave = !!s.wave;
    if (wave && !this.waveOn && !this.has('wave') && !s.air && !s.ride && s.move <= 0.05) {
      if (this.greetAmp < 0.02 && this.waveW < 0.02) this.greetPh = 0;
      this.greetT = 0;
    }
    this.waveOn = wave;
    this.step(s);
  }

  /** Gọi từ userData.tick: giữ mô hình "sống" (đứng thở) khi không ai điều khiển. */
  autoTick(dt: number, t: number): void {
    if (performance.now() - this.lastDriven > 250) this.step({ t, dt, move: 0 });
  }

  private step(s: AnimState): void {
    const dt = Math.min(0.1, Math.max(0, s.dt));
    const t = s.t + this.seed;
    const mv = Math.min(1.4, Math.max(0, s.move));
    const happy = s.happy ?? 0;
    let role: ClipRole = 'idle';
    if (s.air) role = 'jump';
    else if (s.ride) role = 'sit';
    else if (mv > 0.05) role = s.run ? 'run' : 'walk';
    else if (s.wave) role = 'wave';
    else if (happy > 0.4) role = 'happy';
    else if (s.talk) role = 'talk';
    this.play(role);

    if (this.cur) {
      const cr = this.curRole;
      if (cr === 'walk' || cr === 'run') {
        const rate = cr === 'walk' ? this.look.walkRate ?? 1 : this.look.runRate ?? 1;
        const borrow = role === 'run' && cr === 'walk' ? 1.5 : role === 'walk' && cr === 'run' ? 0.75 : 1;
        const k = cr === 'run' ? mv / 1.3 : mv;
        this.cur.timeScale = rate * borrow * Math.min(1.35, Math.max(0.6, k));
      } else this.cur.timeScale = 1;
    }
    if (this.head && this.headRest) this.head.quaternion.copy(this.headRest);
    this.mixer?.update(dt);

    // Lớp chuyển động bổ sung (trên nhóm bên trong, quanh điểm chân).
    const h = this.prep.height;
    let y = this.baseY;
    let sy = 1;
    let rz = 0;
    let rx = 0;
    if (this.float) {
      // Bay lơ lửng: nhấp nhô lên xuống, lắc lư nhẹ, nghiêng về trước khi bay đi (không nhún theo bước chân).
      y += Math.sin(t * 2.2) * 0.08;
      if (!this.mixer) {
        rz = Math.sin(t * 1.3) * 0.045;
        rx = Math.sin(t * 0.9 + 1) * 0.025 + (s.run ? 0.16 : 0.1) * Math.min(1, mv);
        if (s.talk) sy = 1 + Math.abs(Math.sin(t * 12)) * 0.035;
      }
    } else if (!this.mixer) {
      const moving = mv > 0.05 && !s.air;
      const k = Math.min(1, mv);
      this.phase += dt * Math.PI * 2 * (s.run ? 3.3 : 2.4) * (moving ? 1 : 0);
      if (moving) {
        y += Math.abs(Math.sin(this.phase)) * 0.06 * h * k;
        rz = Math.sin(this.phase) * 0.09 * k;
        rx = (s.run ? 0.1 : 0.05) * k;
      } else {
        sy = 1 + Math.sin(t * 2.2) * 0.016;
        rz = Math.sin(t * 0.8) * 0.02;
      }
      if (s.talk) sy *= 1 + Math.abs(Math.sin(t * 12)) * 0.035;
    }
    let ry = 0;
    if (!this.has('wave')) {
      // Vẫy tay: nhún nhảy nhỏ lúc bắt đầu + lắc người (xoay & nghiêng cùng nhịp), về đúng 0 khi thôi vẫy.
      const busy = mv > 0.05 || !!s.air || !!s.ride;
      if (this.greetT >= 0) {
        if (busy) this.greetT = -1;
        else {
          const [dy, ds] = this.greetHop(this.greetT, h);
          y += dy;
          sy *= ds;
          this.greetT += dt;
          if (this.greetT > Math.max(GREET.burst, GREET.crouch + GREET.air + GREET.land)) this.greetT = -1;
        }
      }
      const burst = this.greetT >= 0 && this.greetT < GREET.burst;
      const ampGoal = burst ? 1 : s.wave && !busy ? GREET.rest : 0;
      this.greetAmp = approach(this.greetAmp, ampGoal, burst ? 10 : 4, dt);
      if (ampGoal === 0 && this.greetAmp < 0.004) this.greetAmp = 0;
      this.waveW = approach(this.waveW, s.wave ? 1 : 0, 6, dt);
      if (!s.wave && this.waveW < 0.004) this.waveW = 0;
      if (this.greetAmp > 0 || this.waveW > 0) {
        this.greetPh = (this.greetPh + dt * GREET.speed) % (Math.PI * 2);
        const w = Math.sin(this.greetPh);
        ry = w * GREET.yaw * this.greetAmp;
        rz += w * GREET.roll * Math.max(this.waveW, this.greetAmp);
      }
    }
    const wantHop = happy > 0.4 && !this.has('happy') ? happy : 0;
    this.hop = approach(this.hop, wantHop, 6, dt);
    if (this.hop > 0.01) y += Math.abs(Math.sin(t * 9)) * 0.18 * h * this.hop;
    this.inner.position.y = y;
    this.inner.scale.set(this.baseScale.x * (2 - sy), this.baseScale.y * sy, this.baseScale.z * (2 - sy));
    this.inner.rotation.z = rz;
    this.inner.rotation.x = rx;
    this.inner.rotation.y = this.baseRotY + ry;
    if (this.fx) {
      this.fx.obj.position.y = this.fx.y + (y - this.baseY);
      this.fx.obj.rotation.y = t * this.fx.spin;
    }

    // Gật đầu khi nói.
    this.talkW = approach(this.talkW, s.talk ? 1 : 0, 8, dt);
    if (this.head && this.talkW > 0.01) this.head.rotateX(Math.sin(t * 9) * 0.09 * this.talkW);
  }

  /** Cú nhún nhảy lúc chào: [độ cao cộng thêm, hệ số co giãn dọc] tại thời điểm g (giây). */
  private greetHop(g: number, h: number): [number, number] {
    if (this.float) {
      // Bay: vọt nhẹ lên rồi hạ xuống êm, không chạm đất.
      return g < GREET.floatLen ? [Math.sin((Math.PI * g) / GREET.floatLen) ** 2 * GREET.floatHop * h, 1] : [0, 1];
    }
    const { crouch, air, land } = GREET;
    if (g < crouch) return [0, 1 - 0.05 * Math.sin((Math.PI * g) / crouch)];
    if (g < crouch + air) {
      const u = (g - crouch) / air;
      return [4 * GREET.hop * h * u * (1 - u), 1 + 0.03 * Math.sin(2 * Math.PI * u) ** 2];
    }
    if (g < crouch + air + land) return [0, 1 - 0.045 * Math.sin((Math.PI * (g - crouch - air)) / land)];
    return [0, 1];
  }
}

/* ------------------------------------------------------------------ */
/* Chuẩn bị mẫu & dựng bản sao                                         */
/* ------------------------------------------------------------------ */

const matchName = (name: string, list: (string | RegExp)[]) => list.some((p) => (typeof p === 'string' ? p === name : p.test(name)));

function lookOf(entry: Entry, vi: number): GlbLook {
  const v = entry.spec.variants?.[vi];
  return v ? { ...entry.spec, ...v } : entry.spec;
}

function variantIndex(entry: Entry, o: Record<string, unknown>): number {
  const n = entry.spec.variants?.length ?? 0;
  if (!n) return -1;
  const v = Number(o.v ?? 0) || 0;
  return ((Math.floor(v) % n) + n) % n;
}

function baseHeight(entry: Entry, o: Record<string, unknown>): number | undefined {
  const h = entry.base?.height;
  return typeof h === 'function' ? h(o) : h;
}

/** Độ nâng khỏi mặt đất (m): "nang-len" trong cấu hình, hoặc khoảng hở bay của mô hình dựng bằng code (Robot Bíp). */
function liftOf(entry: Entry, look: GlbLook): number {
  return look.offset?.[1] ?? entry.base?.hover?.gap ?? 0;
}

/* ------------------------------------------------------------------ */
/* Lưới bóng (bé AI)                                                   */
/* ------------------------------------------------------------------ */

/**
 * Công cụ (tools/luoi-bong.mjs) kèm trong tệp GLB của bé một phần lưới thứ hai: cùng đỉnh với lưới thật nhưng ít
 * tam giác hơn nhiều (lệch dưới 1 cm), có extras.proxy. Lúc nạp, phần này được tách khỏi mẫu; mỗi bản sao gắn
 * một lưới bóng vào lưới thật – nằm ở lớp SHADOW_LAYER nên chỉ được vẽ vào bản đồ bóng – còn lưới thật thôi đổ
 * bóng. Hình bóng xuyên tường (world/player.ts) cũng vẽ bằng lưới bóng.
 * Hình học gốc (của tệp GLB) → chỉ số tam giác của lưới bóng.
 */
const proxyIdx = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
/** Hình học lưới bóng của mô hình không xương, dùng chung cho mọi bản sao (theo hình học gốc). */
const rigidProxies = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const shadowMats = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Phần lưới bóng: extras.proxy (nằm ở userData của hình học). Phòng khi GLTFLoader dùng chung một hình học cho
 * hai phần cùng thuộc tính & chỉ số: phần mang vật liệu 'bong' dùng chung hình học với phần bên cạnh.
 */
function isShadowProxy(mesh: THREE.Mesh): boolean {
  if (mesh.geometry.userData.proxy) return true;
  return (
    !Array.isArray(mesh.material) &&
    mesh.material.name === 'bong' &&
    !!mesh.parent?.children.some((c) => c !== mesh && (c as THREE.Mesh).geometry === mesh.geometry)
  );
}

/** Tách lưới bóng khỏi mẫu; nhớ chỉ số tam giác của nó theo lưới thật bên cạnh (cùng thuộc tính vị trí). */
function linkProxies(proxies: THREE.Mesh[]): void {
  for (const px of proxies) {
    const pos = px.geometry.getAttribute('position');
    const vis = px.parent?.children.find((c) => {
      const m = c as THREE.Mesh;
      return m.isMesh && !proxies.includes(m) && m.geometry.getAttribute('position') === pos;
    }) as THREE.Mesh | undefined;
    px.removeFromParent();
    // Mô hình có xương sẵn (hoạt cảnh trong tệp) không dùng lưới bóng.
    if (!vis || !px.geometry.index || (vis as THREE.SkinnedMesh).isSkinnedMesh) continue;
    // Lưới thủng theo ảnh (alphaTest): bóng phải thủng theo – để lưới thật đổ bóng.
    const mats = Array.isArray(vis.material) ? vis.material : [vis.material];
    if (mats.some((m) => m.alphaTest > 0)) continue;
    proxyIdx.set(vis.geometry, px.geometry.index);
  }
}

/** Hình học lưới bóng: dùng chung mọi thuộc tính (vị trí, trọng số da...) với `src`, chỉ khác danh sách tam giác. */
function proxyGeometry(src: THREE.BufferGeometry, index: THREE.BufferAttribute): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) g.setAttribute(name, attr);
  g.setIndex(index);
  g.boundingBox = src.boundingBox?.clone() ?? null;
  g.boundingSphere = src.boundingSphere?.clone() ?? null;
  g.userData.shared = true;
  return g;
}

/** Vật liệu lưới bóng: không vẽ màu, không ghi chiều sâu (phòng khi lọt vào lượt vẽ thường); mặt đổ bóng như lưới thật. */
function shadowMat(src: THREE.Material): THREE.MeshBasicMaterial {
  const k = `${src.side}|${src.shadowSide}`;
  let m = shadowMats.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: src.side });
    m.shadowSide = src.shadowSide;
    m.name = 'bong';
    m.userData.shared = true;
    shadowMats.set(k, m);
  }
  return m;
}

/** Gắn lưới bóng (hình học `geo`, cùng bộ xương nếu có) vào lưới thật `vis`; lưới thật thôi đổ bóng. */
function addShadowProxy(vis: THREE.Mesh, geo: THREE.BufferGeometry): void {
  const mat = shadowMat(Array.isArray(vis.material) ? vis.material[0] : vis.material);
  const sv = vis as THREE.SkinnedMesh;
  let px: THREE.Mesh;
  if (sv.isSkinnedMesh) {
    const ps = new THREE.SkinnedMesh(geo, mat);
    ps.bind(sv.skeleton, sv.bindMatrix);
    ps.frustumCulled = false;
    px = ps;
  } else px = new THREE.Mesh(geo, mat);
  px.name = 'bong';
  px.layers.set(SHADOW_LAYER);
  px.castShadow = true;
  px.receiveShadow = false;
  px.raycast = () => {};
  px.userData.shadowProxy = true;
  vis.castShadow = false;
  // Trò chơi nhỏ bật đổ bóng cho mọi lưới, trừ lưới có cờ này (minigames/base.ts).
  vis.userData.noShadow = true;
  vis.add(px);
}

/** Mô hình không xương tự dựng: gắn lưới bóng cho các lưới mà tệp có lưới bóng. */
function addRigidProxies(model: THREE.Object3D): void {
  const meshes: THREE.Mesh[] = [];
  model.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) meshes.push(x as THREE.Mesh);
  });
  for (const mesh of meshes) {
    const idx = proxyIdx.get(mesh.geometry);
    if (!idx) continue;
    let g = rigidProxies.get(mesh.geometry);
    if (!g) rigidProxies.set(mesh.geometry, (g = proxyGeometry(mesh.geometry, idx)));
    addShadowProxy(mesh, g);
  }
}

function prepare(entry: Entry, vi: number, o: Record<string, unknown>): Prepared | null {
  if (entry.prepared.has(vi)) return entry.prepared.get(vi) ?? null;
  const look = lookOf(entry, vi);
  const gltf = gltfs.get(look.src);
  if (!gltf) return null;
  let src: THREE.Object3D = gltf.scene;
  if (look.node) {
    const n = gltf.scene.getObjectByName(look.node);
    if (n) src = n;
    else console.warn(`[glb] ${entry.key}: không thấy nút "${look.node}"`);
  }
  const tpl = cloneSkinned(src);
  if (look.node) tpl.position.set(0, 0, 0);

  const drop: THREE.Object3D[] = [];
  const proxies: THREE.Mesh[] = [];
  tpl.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (isShadowProxy(mesh)) {
      proxies.push(mesh);
      return;
    }
    if ((look.hide && matchName(mesh.name, look.hide)) || (look.only && !matchName(mesh.name, look.only))) {
      drop.push(mesh);
      return;
    }
    const conv = (m: THREE.Material) => convertMaterial(m, look.material, look.colors?.[m.name], look.mipBias);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
    mesh.geometry.userData.shared = true;
    takeSkin(mesh.geometry);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  });
  for (const d of drop) d.removeFromParent();
  linkProxies(proxies);

  // Hoạt cảnh
  const rootBone = look.inPlace === false ? undefined : findRootBone(tpl);
  const fix = (c: THREE.AnimationClip) => makeInPlace(c, rootBone);
  const all: THREE.AnimationClip[] = gltf.animations.map(fix);
  const roles = new Map<ClipRole, THREE.AnimationClip>();
  for (const a of look.animSrc ?? []) {
    const as = typeof a === 'string' ? { src: a } : a;
    const g = gltfs.get(as.src);
    if (!g?.animations.length) continue;
    const clips = g.animations.map(fix);
    if (as.role) {
      const c = (as.clip && clips.find((x) => x.name === as.clip || cleanClipName(x.name) === cleanClipName(as.clip!))) || clips[0];
      roles.set(as.role, c);
    }
    all.push(...clips);
  }
  for (const [role, want] of Object.entries(look.clips ?? {}) as [ClipRole, string | string[]][]) {
    const names = Array.isArray(want) ? want : [want];
    const c = names.map((n) => all.find((x) => x.name === n || cleanClipName(x.name) === cleanClipName(n))).find(Boolean);
    if (c) roles.set(role, c);
    else console.warn(`[glb] ${entry.key}: không thấy clip "${names.join('/')}" cho ${role}`);
  }
  detectRoles(all, roles);
  if (!roles.has('idle') && all.length === 1) roles.set('idle', all[0]);

  // Đo kích thước trong tư thế nghỉ (frame đầu của idle nếu có).
  const probe = cloneSkinned(tpl);
  const idle = roles.get('idle');
  if (idle) {
    const mx = new THREE.AnimationMixer(probe);
    mx.clipAction(idle).play();
    mx.update(0);
  }
  probe.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(probe, true);
  const rawH = Math.max(1e-4, bb.max.y - bb.min.y);
  const fallback = baseHeight(entry, o);
  const height = look.height ?? (look.scale ? rawH * look.scale : fallback !== undefined ? Math.max(0.1, fallback - liftOf(entry, look)) : rawH);
  const scale = look.scale ?? height / rawH;

  // Khung bao của lưới có xương: tính sẵn theo tư thế nghỉ (nới rộng cho hoạt cảnh) để các bản sao
  // không phải tính lại bằng xương chưa cập nhật (sai lệch rất lớn).
  const skinned = (root: THREE.Object3D) => {
    const out: THREE.SkinnedMesh[] = [];
    root.traverse((x) => {
      if ((x as THREE.SkinnedMesh).isSkinnedMesh) out.push(x as THREE.SkinnedMesh);
    });
    return out;
  };
  const tplSkinned = skinned(tpl);
  skinned(probe).forEach((pm, i) => {
    const tm = tplSkinned[i];
    if (!tm) return;
    pm.computeBoundingBox();
    pm.computeBoundingSphere();
    const size = pm.boundingBox!.getSize(new THREE.Vector3()).length();
    tm.boundingBox = pm.boundingBox!.clone().expandByScalar(size * 0.08);
    tm.boundingSphere = pm.boundingSphere!.clone();
    tm.boundingSphere.radius *= 1.15;
  });

  const prep: Prepared = {
    tpl,
    roles,
    clipNames: all.map((c) => c.name),
    scale,
    baseY: -bb.min.y * scale,
    height,
    headName: findHead(tpl),
  };
  // Tệp hoạt cảnh phụ chưa nạp xong: dùng tạm, chưa lưu (lần sau dựng lại đủ hoạt cảnh).
  if ((look.animSrc ?? []).every((a) => settled(typeof a === 'string' ? a : a.src))) entry.prepared.set(vi, prep);
  return prep;
}

/* ------------------------------------------------------------------ */
/* Xương tự dựng (mô hình người tạo bằng AI, không có xương)           */
/* ------------------------------------------------------------------ */

/** Tinh chỉnh dáng đi của mô hình có xương tự dựng. */
const AUTO = {
  stride: 0.7,
  cadence: 2.3,
  /** Góc giơ tay tối đa so với phương thẳng đứng (rad) – giơ cao hơn thì vai méo. */
  armMax: 2.4,
};

/** Biến đổi của nhóm 'glbInner' (mẫu → hệ gốc mô hình). */
function innerMatrix(prep: Prepared, look: GlbLook, off: number[]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(off[0], prep.baseY + off[1], off[2]),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(look.rotY ?? 0)),
    new THREE.Vector3().setScalar(prep.scale),
  );
}

/** Các lưới của mẫu (thứ tự duyệt cây) cùng ma trận lưới → hệ gốc mô hình; null nếu mô hình đã có xương. */
function tplMeshes(prep: Prepared, look: GlbLook, off: number[]): { mesh: THREE.Mesh; bind: THREE.Matrix4 }[] | null {
  const inner = innerMatrix(prep, look, off);
  prep.tpl.updateMatrixWorld(true);
  const out: { mesh: THREE.Mesh; bind: THREE.Matrix4 }[] = [];
  let skinned = false;
  prep.tpl.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    out.push({ mesh, bind: inner.clone().multiply(mesh.matrixWorld) });
  });
  return skinned || !out.length ? null : out;
}

function rigInput(list: { mesh: THREE.Mesh; bind: THREE.Matrix4 }[]): { pos: Float32Array; index: ArrayLike<number> | null }[] {
  const v = new THREE.Vector3();
  return list.map(({ mesh, bind }) => {
    const g = mesh.geometry;
    const pa = g.getAttribute('position');
    const pos = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(bind);
      pos[3 * i] = v.x;
      pos[3 * i + 1] = v.y;
      pos[3 * i + 2] = v.z;
    }
    return { pos, index: g.index ? g.index.array : null };
  });
}

type SkinAttr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/** Trọng số da công cụ đã tính sẵn (thuộc tính _SKIN_INDEX, _SKIN_WEIGHT trong GLB), theo hình học gốc. */
const bakedSkin = new WeakMap<THREE.BufferGeometry, [SkinAttr, SkinAttr]>();

/** Cất trọng số da tính sẵn ra khỏi hình học gốc (lưới không xương khỏi phải tải chúng lên GPU). */
function takeSkin(g: THREE.BufferGeometry): void {
  const si = g.getAttribute('_skin_index');
  const sw = g.getAttribute('_skin_weight');
  if (!si || !sw) return;
  bakedSkin.set(g, [si, sw]);
  g.deleteAttribute('_skin_index');
  g.deleteAttribute('_skin_weight');
}

/** Điểm neo dự phòng khi không tìm được cổ: theo tỉ lệ của bé dựng bằng code (cao 1,8). */
function boxRig(list: { mesh: THREE.Mesh; bind: THREE.Matrix4 }[]): Pick<AutoRigResult, 'joints' | 'anchors'> {
  const bb = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const { mesh, bind } of list) {
    const pa = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pa.count; i++) bb.expandByPoint(v.fromBufferAttribute(pa, i).applyMatrix4(bind));
  }
  const h = Math.max(1e-3, bb.max.y - bb.min.y);
  const x = (bb.min.x + bb.max.x) / 2;
  const z = (bb.min.z + bb.max.z) / 2;
  const at = (k: number, dx = 0): V3 => [x + dx * h, bb.min.y + k * h, z];
  const hr = 0.244 * h;
  const torso = 0.143 * h;
  const pelvis = at(0.233);
  const neck = at(0.511);
  return {
    joints: { pelvis, neck, shoulderL: at(0.46, 0.15), shoulderR: at(0.46, -0.15), hipL: at(0.233, 0.07), hipR: at(0.233, -0.07) },
    anchors: {
      head: at(0.711),
      headR: [hr * 1.04, hr * 0.95, hr],
      headTop: bb.max.y,
      faceZ: z + hr,
      neck,
      chestY: bb.min.y + 0.36 * h,
      chestFrontZ: z + torso,
      chestBackZ: z - torso,
      chestHalfW: torso,
      shoulderL: at(0.46, 0.15),
      shoulderR: at(0.46, -0.15),
      handL: at(0.27, 0.2),
      handR: at(0.27, -0.2),
      pelvis,
    },
  };
}

/**
 * Xương tự dựng & điểm neo của mô hình người dáng chữ A: lấy từ config.json khi công cụ đã dò sẵn (nhanh),
 * không thì dò lúc chạy. Dùng chung cho mọi bản sao.
 */
function autoData(entry: Entry, prep: Prepared, look: GlbLook, off: number[]): AutoData | null {
  if (prep.auto !== undefined) return prep.auto;
  const t0 = performance.now();
  const list = tplMeshes(prep, look, off);
  if (!list) return (prep.auto = null);
  const b = look.rig;
  const pre = list.map(({ mesh }) => bakedSkin.get(mesh.geometry));
  const usable = !!b && b.v === RIG_VERSION && b.rotY === (look.rotY ?? 0) && !look.node && !look.hide && !look.only && pre.every(Boolean);
  let placed: Pick<AutoRigResult, 'joints' | 'anchors'>;
  let relax: [number, number];
  let armAngle: [number, number];
  let walk: boolean;
  let neckOk: boolean;
  let skin: [SkinAttr, SkinAttr][];
  if (usable) {
    placed = placeRig(b, prep.scale, [off[0], prep.baseY + off[1], off[2]]);
    relax = b.relax;
    armAngle = b.armAngle;
    walk = b.ok && b.walk;
    neckOk = !b.fail.includes('neck');
    skin = pre as [SkinAttr, SkinAttr][];
  } else {
    if (b) console.info(`[glb] ${entry.key}: xương dò sẵn đã cũ hoặc không khớp tệp – dò lại lúc chạy (chạy lại CapNhatMoHinh.bat để nhanh hơn)`);
    const res = autoRig(rigInput(list));
    const verdict = rigReport(res);
    if (!verdict.walk) console.warn(`[glb] ${entry.key}: dùng hoạt cảnh nhún nhảy – ${verdict.lines.join(' ')}`);
    placed = res;
    relax = res.relax;
    armAngle = res.armAngle;
    walk = verdict.walk;
    neckOk = !res.fail.includes('neck');
    skin = res.skin.map((s) => [new THREE.BufferAttribute(s.index, 4), new THREE.BufferAttribute(s.weight, 4)]);
  }
  if (!neckOk) placed = boxRig(list);
  const meshes = walk
    ? list.map(({ mesh, bind }, i) => {
        const src = mesh.geometry;
        const geo = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(src.attributes)) geo.setAttribute(name, attr);
        geo.setIndex(src.index);
        for (const g of src.groups) geo.addGroup(g.start, g.count, g.materialIndex);
        geo.setDrawRange(src.drawRange.start, src.drawRange.count);
        geo.setAttribute('skinIndex', skin[i][0]);
        geo.setAttribute('skinWeight', skin[i][1]);
        geo.userData.shared = true;
        const idx = proxyIdx.get(src);
        return { geo, proxy: idx ? proxyGeometry(geo, idx) : undefined, bind };
      })
    : [];
  const J = placed.joints;
  const inverses = [J.pelvis, J.neck, J.shoulderL, J.shoulderR, J.hipL, J.hipR].map((p) => new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]));
  return (prep.auto = { joints: J, anchors: placed.anchors, relax, armAngle, walk, meshes, inverses, baked: usable, ms: performance.now() - t0 });
}

/** Chỗ gắn đồ: nhóm có tên (không bị gộp lưới) – con của `parent`, biến đổi cục bộ `local`. */
function socket(name: string, parent: THREE.Object3D, local?: THREE.Matrix4): THREE.Object3D {
  const s = new THREE.Group();
  s.name = name;
  if (local) local.decompose(s.position, s.quaternion, s.scale);
  parent.add(s);
  return s;
}

function buildRigged(entry: Entry, prep: Prepared, rg: AutoData, inner: THREE.Group, model: THREE.Object3D, off: number[]): THREE.Object3D {
  const root = new THREE.Group();
  root.name = entry.key;
  root.add(inner);
  const J = rg.joints;
  const bone = (name: string, p: V3, parent: THREE.Object3D, rel: V3 = [0, 0, 0]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(p[0] - rel[0], p[1] - rel[1], p[2] - rel[2]);
    parent.add(b);
    return b;
  };
  const body = bone('body', J.pelvis, root);
  const head = bone('head', J.neck, body, J.pelvis);
  const armL = bone('armL', J.shoulderL, body, J.pelvis);
  const armR = bone('armR', J.shoulderR, body, J.pelvis);
  const legL = bone('legL', J.hipL, root);
  const legR = bone('legR', J.hipR, root);
  const skel = new THREE.Skeleton(
    [body, head, armL, armR, legL, legR],
    rg.inverses.map((m) => m.clone()),
  );
  const meshes: THREE.Mesh[] = [];
  model.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) meshes.push(x as THREE.Mesh);
  });
  meshes.forEach((mesh, i) => {
    const sm = new THREE.SkinnedMesh(rg.meshes[i].geo, mesh.material);
    sm.name = mesh.name;
    sm.position.copy(mesh.position);
    sm.quaternion.copy(mesh.quaternion);
    sm.scale.copy(mesh.scale);
    sm.castShadow = true;
    sm.frustumCulled = false;
    sm.bind(skel, rg.meshes[i].bind);
    const proxy = rg.meshes[i].proxy;
    if (proxy) addShadowProxy(sm, proxy);
    const parent = mesh.parent!;
    parent.add(sm);
    parent.remove(mesh);
  });
  // Hạ tay từ tư thế chữ A xuống gần thân (bàn tay vẫn không chạm hông).
  armL.rotation.z = -rg.relax[0];
  armR.rotation.z = rg.relax[1];

  const rig: Rig = { root, kind: 'biped', height: prep.height + off[1], body, head, armL, armR, legL, legR, stride: AUTO.stride, cadence: AUTO.cadence };
  const legLen = Math.max(0.05, (J.hipL[1] + J.hipR[1]) / 2 - off[1]);
  const bodyY = body.position.y;
  const [aL, aR] = rg.armAngle;
  let lastDriven = -1e9;
  let self = false;
  rig.custom = (_r, s) => {
    if (!self) lastDriven = performance.now();
    // Thân không nhún riêng (sẽ kéo giãn hông): cả người hạ xuống theo góc bước để bàn chân vẫn chạm đất.
    body.position.y = bodyY;
    if (!s.air && !s.ride) {
      const a = Math.max(Math.abs(legL.rotation.x), Math.abs(legR.rotation.x));
      root.position.y -= legLen * (1 - Math.cos(a));
    }
    if (aL + armL.rotation.z > AUTO.armMax) armL.rotation.z = AUTO.armMax - aL;
    if (aR - armR.rotation.z > AUTO.armMax) armR.rotation.z = aR - AUTO.armMax;
  };
  root.userData.rig = rig;
  root.userData.compacted = true;
  root.userData.glb = true;
  root.userData.rigged = true;
  root.userData.dynamic = true;
  root.userData.sockets = { head: socket('sockHead', head), body: socket('sockBody', body), joints: J, anchors: rg.anchors, walk: true } satisfies GlbSockets;
  root.userData.tick = (dt: number, t: number) => {
    if (performance.now() - lastDriven < 250) return;
    self = true;
    animateRig(rig, { t, dt, move: 0 });
    self = false;
  };
  return root;
}

/** Kết quả dò xương của một mô hình (trang dev/rig): tính lại, kèm lưới nhãn. */
export function glbAutoRig(key: string, o: Record<string, unknown> = {}): AutoRigResult | null {
  const entry = entries.get(key);
  if (!entry) return null;
  const vi = variantIndex(entry, o);
  const prep = prepare(entry, vi, o);
  if (!prep) return null;
  const look = lookOf(entry, vi);
  const off = look.offset ?? [0, entry.base?.hover?.gap ?? 0, 0];
  const list = tplMeshes(prep, look, off);
  return list ? autoRig(rigInput(list), { debug: true }) : null;
}

function placeholder(key: string): THREE.Object3D {
  const m = box(0.6, 1, 0.6, '#ff9ec7', { base: true });
  m.userData.key = key;
  m.userData.missing = true;
  return m;
}

function buildGlb(entry: Entry, o: Record<string, unknown>): THREE.Object3D {
  const vi = variantIndex(entry, o);
  const prep = enabled ? prepare(entry, vi, o) : null;
  if (!prep) return entry.base ? entry.base.build(o) : placeholder(entry.key);
  const look = lookOf(entry, vi);

  const model = cloneSkinned(prep.tpl);
  const inner = new THREE.Group();
  inner.name = 'glbInner';
  inner.add(model);
  inner.scale.setScalar(prep.scale);
  inner.rotation.y = THREE.MathUtils.degToRad(look.rotY ?? 0);
  const hover = entry.base?.hover;
  const off = look.offset ?? [0, hover?.gap ?? 0, 0];
  inner.position.set(off[0], prep.baseY + off[1], off[2]);

  const wantRig = (o.autoRig as boolean | undefined) ?? look.autoRig;
  const auto = wantRig && !prep.roles.size ? autoData(entry, prep, look, off) : null;
  if (auto?.walk) return buildRigged(entry, prep, auto, inner, model, off);
  addRigidProxies(model);

  const root = new THREE.Group();
  root.name = entry.key;
  root.add(inner);

  const kind = entry.spec.kind ?? (hover ? 'float' : 'biped');
  let fx: { obj: THREE.Object3D; y: number; spin: number } | undefined;
  if (hover?.fx) {
    // Hiệu ứng bay của mô hình dựng bằng code (vòng đẩy phát sáng), đặt ngay dưới đáy mô hình.
    const obj = hover.fx();
    obj.position.set(off[0], off[1] - 0.06, off[2]);
    root.add(obj);
    fx = { obj, y: obj.position.y, spin: hover.spin ?? 0 };
  }
  const anim = new GlbAnimator(model, inner, prep, look, kind === 'float', fx);
  const rig: Rig = { root, kind, height: prep.height + off[1], animator: anim, head: anim.head };
  root.userData.rig = rig;
  root.userData.compacted = true;
  root.userData.glb = true;
  root.userData.dynamic = true;
  root.userData.tick = (dt: number, t: number) => anim.autoTick(dt, t);
  if (auto) {
    // Nhún nhảy: chỗ gắn đồ là con của nhóm bên trong (nhún, nghiêng theo mô hình), đứng nghỉ thì ở đúng khớp.
    const rest = innerMatrix(prep, look, off).invert();
    const at = (p: V3) => rest.clone().multiply(new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]));
    root.userData.sockets = {
      head: socket('sockHead', inner, at(auto.joints.neck)),
      body: socket('sockBody', inner, at(auto.joints.pelvis)),
      joints: auto.joints,
      anchors: auto.anchors,
      walk: false,
    } satisfies GlbSockets;
  }

  if (look.decorate) {
    const m4 = new THREE.Matrix4();
    const m4b = new THREE.Matrix4();
    root.updateMatrixWorld(true);
    look.decorate({
      root,
      model,
      height: prep.height,
      opts: o,
      find: (name) => {
        let hit: THREE.Object3D | undefined;
        model.traverse((x) => {
          if (!hit && (typeof name === 'string' ? x.name === name : name.test(x.name))) hit = x;
        });
        return hit;
      },
      attach: (target, obj, at = [0, 0, 0]) => {
        root.updateMatrixWorld(true);
        // Xương trong hệ tọa độ gốc mô hình: Br = R⁻¹·B. Biến đổi mong muốn D (đứng thẳng, đúng mét) → cục bộ = Br⁻¹·D.
        const br = m4b.copy(root.matrixWorld).invert().multiply(target.matrixWorld);
        const origin = new THREE.Vector3().setFromMatrixPosition(br);
        m4.compose(origin.add(new THREE.Vector3(...at)).add(obj.position), obj.quaternion, obj.scale);
        br.invert().multiply(m4).decompose(obj.position, obj.quaternion, obj.scale);
        target.add(obj);
        obj.traverse((x) => {
          if ((x as THREE.Mesh).isMesh) x.castShadow = true;
        });
      },
    });
  }
  return root;
}

/* ------------------------------------------------------------------ */
/* Báo cáo (cho trang xem thử / kiểm tra)                              */
/* ------------------------------------------------------------------ */

export interface GlbInfo {
  key: string;
  source?: string;
  credit?: string;
  loaded: boolean;
  failed: boolean;
  clips: string[];
  roles: Partial<Record<ClipRole, string>>;
  height?: number;
  scale?: number;
}

export function glbReport(): GlbInfo[] {
  return [...entries.values()].map((e) => {
    const p = e.prepared.get(variantIndex(e, {})) ?? (gltfs.has(e.spec.src) ? prepare(e, variantIndex(e, {}), {}) : null);
    return {
      key: e.key,
      source: e.spec.source,
      credit: e.spec.credit,
      loaded: gltfs.has(e.spec.src),
      failed: failed.has(e.spec.src),
      clips: p?.clipNames ?? [],
      roles: Object.fromEntries([...(p?.roles ?? new Map<ClipRole, THREE.AnimationClip>())].map(([r, c]) => [r, c.name])),
      height: p?.height,
      scale: p?.scale,
    };
  });
}

export function glbKeys(): string[] {
  return [...entries.keys()].sort();
}
