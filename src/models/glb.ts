import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { box } from '../engine/kit';
import { overrideModel, type Collider, type ModelDef } from './registry';
import type { AnimState, Rig, RigKind } from './rig';

/**
 * Mô hình 3D dạng tệp GLB (tải từ thư viện CC0 hoặc tạo bằng AI) thay cho mô hình dựng bằng code.
 *
 *  - `defineGlbModel('npc_bear', { src })` thay mô hình cùng khóa; mô hình dựng bằng code vẫn được giữ làm dự phòng
 *    (khi tệp chưa nạp/lỗi) và cho va chạm, chiều cao, mô tả mặc định.
 *  - Gọi `await preloadGlb()` một lần lúc khởi động (trước khi dựng cảnh) để `buildModel` luôn đồng bộ.
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
  /** Chiều cao mong muốn (m); mặc định = chiều cao của mô hình dựng bằng code cùng khóa. */
  height?: number;
  /** Tỉ lệ cố định (bỏ qua `height`). */
  scale?: number;
  /** Xoay thêm quanh trục đứng (độ) để mặt trước hướng +Z. */
  rotY?: number;
  /** Dịch thêm sau khi đặt chân xuống y = 0 (mét). */
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
}

interface Prepared {
  tpl: THREE.Object3D;
  roles: Map<ClipRole, THREE.AnimationClip>;
  clipNames: string[];
  scale: number;
  baseY: number;
  height: number;
  headName?: string;
}

interface Entry {
  key: string;
  spec: GlbSpec;
  base?: ModelDef<any>;
  prepared: Map<number, Prepared | null>;
}

const entries = new Map<string, Entry>();
const gltfs = new Map<string, GLTF>();
const pending = new Map<string, Promise<GLTF | null>>();
const failed = new Set<string>();
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
      height: (o: Record<string, unknown> = {}) =>
        entry.prepared.get(variantIndex(entry, o))?.height ?? lookOf(entry, variantIndex(entry, o)).height ?? baseHeight(entry, o) ?? 1.5,
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
  }
  return loader;
}

function loadUrl(url: string): Promise<GLTF | null> {
  let p = pending.get(url);
  if (!p) {
    p = getLoader()
      .loadAsync(url)
      .then((g) => {
        gltfs.set(url, g);
        return g;
      })
      .catch((e) => {
        failed.add(url);
        console.warn('[glb] không nạp được', url.slice(0, 80), e);
        return null;
      });
    pending.set(url, p);
  }
  return p;
}

/** Nạp tất cả tệp GLB đã khai báo. Gọi lại an toàn (chỉ nạp tệp mới). */
export async function preloadGlb(onProgress?: (done: number, total: number) => void): Promise<void> {
  const urls = new Set<string>();
  for (const e of entries.values()) for (const u of urlsOf(e.spec)) urls.add(u);
  const list = [...urls];
  let done = 0;
  onProgress?.(0, list.length);
  await Promise.all(
    list.map((u) =>
      loadUrl(u).then(() => {
        done++;
        onProgress?.(done, list.length);
      }),
    ),
  );
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

function convertMaterial(src: THREE.Material, mode: GlbLook['material'], color?: string): THREE.Material {
  const key = `${src.uuid}|${mode ?? 'lambert'}|${color ?? ''}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const s = src as THREE.MeshStandardMaterial;
  let m: THREE.Material;
  if (mode === 'standard' || !s.isMeshStandardMaterial) {
    m = color ? src.clone() : src;
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

class GlbAnimator {
  readonly mixer: THREE.AnimationMixer | null;
  readonly head?: THREE.Object3D;
  private readonly actions = new Map<ClipRole, THREE.AnimationAction>();
  private cur: THREE.AnimationAction | null = null;
  private curRole: ClipRole | null = null;
  private readonly headRest?: THREE.Quaternion;
  private readonly baseY: number;
  private readonly baseScale: THREE.Vector3;
  private readonly seed = Math.random() * 100;
  private hop = 0;
  private phase = 0;
  private talkW = 0;
  private lastDriven = -1e9;

  constructor(
    model: THREE.Object3D,
    private readonly inner: THREE.Group,
    private readonly prep: Prepared,
    private readonly look: GlbLook,
  ) {
    if (prep.roles.size) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const [role, clip] of prep.roles) this.actions.set(role, this.mixer.clipAction(clip));
    } else this.mixer = null;
    this.head = prep.headName ? model.getObjectByName(prep.headName) : undefined;
    this.headRest = this.head?.quaternion.clone();
    this.baseY = inner.position.y;
    this.baseScale = inner.scale.clone();
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
    if (!this.mixer) {
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
      if (s.wave) rz += Math.sin(t * 8) * 0.06;
    }
    const wantHop = happy > 0.4 && !this.has('happy') ? happy : 0;
    this.hop = approach(this.hop, wantHop, 6, dt);
    if (this.hop > 0.01) y += Math.abs(Math.sin(t * 9)) * 0.18 * h * this.hop;
    this.inner.position.y = y;
    this.inner.scale.set(this.baseScale.x * (2 - sy), this.baseScale.y * sy, this.baseScale.z * (2 - sy));
    this.inner.rotation.z = rz;
    this.inner.rotation.x = rx;

    // Gật đầu khi nói.
    this.talkW = approach(this.talkW, s.talk ? 1 : 0, 8, dt);
    if (this.head && this.talkW > 0.01) this.head.rotateX(Math.sin(t * 9) * 0.09 * this.talkW);
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
  tpl.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((look.hide && matchName(mesh.name, look.hide)) || (look.only && !matchName(mesh.name, look.only))) {
      drop.push(mesh);
      return;
    }
    const conv = (m: THREE.Material) => convertMaterial(m, look.material, look.colors?.[m.name]);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
    mesh.geometry.userData.shared = true;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  });
  for (const d of drop) d.removeFromParent();

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
  const height = look.height ?? (look.scale ? rawH * look.scale : baseHeight(entry, o) ?? rawH);
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
  entry.prepared.set(vi, prep);
  return prep;
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
  const off = look.offset ?? [0, 0, 0];
  inner.position.set(off[0], prep.baseY + off[1], off[2]);

  const root = new THREE.Group();
  root.name = entry.key;
  root.add(inner);

  const anim = new GlbAnimator(model, inner, prep, look);
  const rig: Rig = { root, kind: entry.spec.kind ?? 'biped', height: prep.height, animator: anim, head: anim.head };
  root.userData.rig = rig;
  root.userData.compacted = true;
  root.userData.glb = true;
  root.userData.dynamic = true;
  root.userData.tick = (dt: number, t: number) => anim.autoTick(dt, t);

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
