import * as THREE from 'three';
import { audio, sfx, type TrackId } from '../core/audio';
import { bus } from '../core/events';
import { playerKey } from '../core/outfits';
import { addCoins, addKeys, addStars, addTickets, giveItem, hasProfile, isCollected, level, markCollected, profile, setPosition, type ZoneId } from '../core/state';
import { engine, warmUp, type Quality, type Stage } from '../engine/core';
import { Fx } from '../engine/fx';
import { setupLights, setupSky, type LightMood, type LightRig } from '../engine/lighting';
import { bakeStatic, disposeTree } from '../engine/merge';
import { bearFollows, markVisited, storyObjective } from '../game/story';
import { CAST } from '../game/cast';
import { playerModels, zoneLateModels, zoneModels } from '../game/needs';
import { cancelOwner, tween, wait, type Ease, type Handle } from '../engine/tween';
import type { Question } from '../math/types';
import type { MiniInfo, MiniResult } from '../minigames/base';
import { ask, promptCard, type AskOptions, type AskResult } from '../ui/question';
import type { Stage as AnswerStage } from '../game/challenge';
import { miniDef, miniName, miniTitle } from '../minigames/registry';
import { ensureGlb, glbReady } from '../models/glb';
import { buildModel, collectTicks, modelRadius, type Collider } from '../models/registry';
import type { Speaker } from '../ui/dialog';
import { say } from '../ui/dialog';
import type { Child } from '../ui/dom';
import { hud } from '../ui/hud';
import { coinIcon } from '../ui/icons';
import { inputBlocked } from '../ui/root';
import { toast } from '../ui/toast';
import { Actor, Follower } from './actor';
import { FollowCam } from './camera';
import { World, type Body } from './collide';
import { K, keys } from './input';
import { Labels, type Label } from './labels';
import { loadLate, type LateHost } from './late';
import { nav } from './nav';
import { buildLook, disposeLook, Player } from './player';
import { inArea, Terrain, TERRAIN_COLORS, waterUniforms, type Area } from './terrain';
import { angDiff, behindYaw, bestYaw, shoulderYaw } from './wander';

/**
 * NỀN TẢNG KHU VỰC (zone) – mỗi khu vực trong thế giới (Làng, Rừng, Mê cung...) kế thừa `Zone`
 * và chỉ cần viết `build()` dùng các hàm trợ giúp:
 *
 *   place(key, x, z, {rot, scale, ...})   đặt mô hình (tự thêm vật cản, giữ chỗ trên nền)
 *   scatter([...keys], n, vùng)           rải cây/đá/hoa ngẫu nhiên tránh đường đi, nước, chỗ đã giữ
 *   border([...keys])                     viền cây quanh mép khu vực
 *   npc(key, x, z, {name, talk, ...})     NPC có tên, nói chuyện khi lại gần bấm E / chạm
 *   interact({x, z, r, label, run})       điểm tương tác bất kỳ (hộp đếm, cầu, cửa...)
 *   pickup('star', x, z, {id})            vật phẩm nhặt được (sao, xu, chìa khóa, vé...)
 *   portal(x, z, 'forest', 'from_village', {label, lock})   lối đi sang khu vực khác
 *   miniSpot('fishing', x, z)             điểm chơi trò chơi nhỏ
 *
 * Hệ tọa độ: mặt đất là mặt phẳng XZ, Y hướng lên, đơn vị mét. Camera mặc định ở phía +Z
 * nhìn về -Z (−Z là "phía trên màn hình"). Góc `rot` tính bằng độ, 0 = mô hình quay mặt về +Z (về phía camera).
 * Vùng chơi là hình chữ nhật bo góc tâm (0,0) kích thước 2·hw × 2·hd; ngoài vùng (lề) chỉ để trang trí.
 */
export type Spawn = string | { x: number; z: number };

export interface SpawnPoint {
  x: number;
  z: number;
  /** Hướng nhìn (độ). 180 = quay lưng về camera (nhìn vào khu vực). */
  rot?: number;
}

export interface ZoneConfig {
  id: ZoneId;
  title: string;
  icon: string;
  sub?: string;
  music: TrackId;
  area: Area;
  /** Lề trang trí bên ngoài vùng chơi (m). */
  margin?: number;
  /** Màu nền cỏ/sàn. */
  ground?: string;
  /** [màu trời trên, màu chân trời]. */
  sky?: [string, string];
  fog?: [number, number];
  mood?: Partial<LightMood>;
  cam?: { yaw?: number; pitch?: number; dist?: number; minDist?: number; maxDist?: number };
  seed?: number;
  /** Điểm xuất hiện; bắt buộc có 'start'. */
  spawns: Record<string, SpawnPoint>;
}

export interface Interactable {
  id: string;
  x: number;
  z: number;
  /** Bán kính kích hoạt (m). */
  r: number;
  label: string;
  icon: string;
  run: () => void | Promise<void>;
  enabled?: () => boolean;
  /** Đối tượng 3D để chạm/nhấp chọn. */
  obj?: THREE.Object3D;
  /** Vị trí đi theo một nhân vật (NPC đi lang thang). */
  follow?: Actor;
  /** Tự chạy khi bước vào vùng (không cần bấm). */
  auto?: boolean;
  /** Ưu tiên khi nhiều điểm chồng nhau. */
  prio?: number;
  inside?: boolean;
}

export interface PlaceOpts {
  /** Góc xoay (độ). */
  rot?: number;
  scale?: number;
  y?: number;
  opts?: Record<string, unknown>;
  /** Thêm vật cản từ mô hình (mặc định có). */
  collide?: boolean;
  /** Không gộp lưới (để di chuyển/ẩn/hoạt cảnh sau này). */
  dynamic?: boolean;
  /** Bán kính giữ chỗ trên nền (không rải cây vào); false = không giữ. Mặc định theo kích thước vật cản. */
  reserve?: number | false;
  tag?: string;
  name?: string;
}

export interface ScatterOpts {
  /** Tâm + bán kính vùng tròn, hoặc tâm + nửa rộng/sâu. Mặc định: cả vùng chơi. */
  x?: number;
  z?: number;
  r?: number;
  hw?: number;
  hd?: number;
  /** Khoảng cách tối thiểu giữa các vật. */
  gap?: number;
  /** Tránh đường đi thêm (m). */
  pathGap?: number;
  scale?: [number, number];
  collide?: boolean;
  opts?: (i: number) => Record<string, unknown>;
  y?: number;
}

export type PickupKind = 'star' | 'coin' | 'key' | 'ticket' | 'heart' | 'apple' | 'banana' | 'fish' | 'gift';

export interface NpcOpts {
  name: string;
  color?: string;
  opts?: Record<string, unknown>;
  rot?: number;
  scale?: number;
  /**
   * Bán kính thân (m, chưa nhân `scale`) để đẩy người chơi ra, không cho lẹm vào nhân vật.
   * Mặc định lấy vật cản tròn của mô hình (Bác Voi 0.7, Chú Gấu 0.65, Thỏ Bông 0.45). Khác `r` (vùng bấm nói chuyện).
   */
  radius?: number;
  /** Đi lang thang trong bán kính này (m). */
  wander?: number;
  talk?: (npc: Npc) => void | Promise<void>;
  /** Chữ trên nút hành động (mặc định "Nói chuyện"). */
  action?: string;
  icon?: string;
  r?: number;
  enabled?: () => boolean;
  /** Dấu trên đầu: '!' có việc mới, '?' đang làm, '★' xong. */
  mark?: () => '' | '!' | '?' | '★';
  /** Chỉ xuất hiện khi điều kiện đúng (kiểm tra lại mỗi khi tiến trình thay đổi). */
  visible?: () => boolean;
}

export interface Npc {
  actor: Actor;
  label: Label;
  speaker: Speaker;
  inter: Interactable;
  opts: NpcOpts;
}

/** Một lựa chọn "bằng hành động" trong thế giới (hòn đá, cánh cửa, quả bóng...). */
export interface PickSpot {
  /** Giá trị so khớp đáp án – thường là `q.choices[i].value`. */
  value: string;
  x: number;
  z: number;
  /** Bán kính kích hoạt (mặc định 1.5 m). */
  r?: number;
  /** Chữ trên nút hành động (mặc định "Chọn <value>"). */
  label?: string;
  icon?: string;
  /** Đối tượng 3D để chạm/nhấp chọn. */
  obj?: THREE.Object3D;
  /** Bước vào là chọn ngay (đá kê chân, ô sàn) thay vì bấm nút. */
  auto?: boolean;
  /** Chữ trên nhãn đáp án (khi bật `tags`); mặc định = nhãn của lựa chọn. `false` = không gắn nhãn cho chỗ này. */
  tag?: string | false;
}

export interface PickOpts {
  src: string;
  speaker?: Speaker | null;
  title?: string;
  icon?: string;
  /** Hiện hình minh họa của câu hỏi trên thẻ đề bài. */
  showVisual?: boolean;
  rewards?: boolean;
  /** Vùng thử thách: khi người chơi đi ra ngoài, thẻ đề bài tạm ẩn (thử thách vẫn còn). */
  area?: { x: number; z: number; r: number };
  /**
   * Gắn nhãn đáp án chữ to, luôn quay về camera, phía trên mỗi chỗ chọn (cửa quay lưng, vật nhỏ...).
   * `true` = cao 2.4 m; số = độ cao (m). Chỗ đã chọn sai được làm mờ; chỗ đúng hóa xanh.
   */
  tags?: boolean | number;
  /** Chọn sai (rung vật, mở phòng nhỏ, Robot nói...). Có thể async – điều khiển bị khóa trong lúc chạy. */
  onWrong?: (spot: PickSpot, stage: AnswerStage) => void | Promise<void>;
  /** Chọn đúng (trước khi thẻ đề bài đóng). */
  onRight?: (spot: PickSpot) => void | Promise<void>;
}

export interface PickResult {
  spot: PickSpot;
  attempts: number;
  xp: number;
  coins: number;
}

let activePick: (() => boolean) | null = null;
/** (Gỡ lỗi) Chọn đúng trong thử thách "bằng hành động" đang diễn ra. */
export function solveActivePick(): boolean {
  return activePick?.() ?? false;
}

interface PickupRec {
  obj: THREE.Object3D;
  id?: string;
  kind: PickupKind;
  amount: number;
  y: number;
  phase: number;
  onPick?: () => void;
  taken: boolean;
}

interface PortalRec {
  x: number;
  z: number;
  r: number;
  to: ZoneId;
  spawn: string;
  lock?: () => string | null;
  armed: boolean;
  label: Label;
  obj: THREE.Object3D;
  text: string;
}

const PICK_ICON: Record<Exclude<PickupKind, 'coin'>, string> = { star: '⭐', key: '🗝️', ticket: '🎟️', heart: '💖', apple: '🍎', banana: '🍌', fish: '🐟', gift: '🎁' };
/** Biểu tượng bay lên khi nhặt; đồng xu là hình vẽ (ui/icons.ts) vì emoji đồng xu không hiện trên Windows 10. */
const pickIcon = (k: PickupKind): Child => (k === 'coin' ? coinIcon() : PICK_ICON[k]);
const UP = new THREE.Vector3(0, 1, 0);
/**
 * Camera câu đố nhìn vào ngực NPC: tỉ lệ chiều cao tính từ chân (nhân vật chibi đầu to nên ngực thấp).
 * Chiều cao đọc lúc bắt đầu câu đố vì mô hình AI có thể tải muộn và thay mô hình tạm.
 */
const QUIZ_FOCUS_K = 0.35;
/** Hai chỗ trên NPC phải nhìn thấy được: mặt và thân (tỉ lệ chiều cao). */
const QUIZ_SIGHT_K = [0.78, 0.4];
/** Vật liệu che được tầm nhìn (giống cách camera vẽ: bỏ vật ẩn, gần như trong suốt, không ghi màu). */
const solidMat = (m: THREE.Material | THREE.Material[]): boolean =>
  (Array.isArray(m) ? m : [m]).some((x) => x && x.visible !== false && x.colorWrite !== false && !(x.transparent && x.opacity < 0.5));

export abstract class Zone implements Stage {
  readonly scene = new THREE.Scene();
  cam!: FollowCam;
  lights!: LightRig;
  fx!: Fx;
  terrain!: Terrain;
  world!: World;
  labels!: Labels;
  player!: Player;
  pet: Follower | null = null;
  readonly actors: Actor[] = [];
  readonly npcs: Npc[] = [];
  readonly inters: Interactable[] = [];
  /** Chân các vật trang trí không chắn bé (đặt với collide: false): NPC đi lang thang tránh đi xuyên qua. */
  readonly decor: Body[] = [];
  /** Đang chạy một tương tác (hội thoại, câu hỏi...). */
  busy = false;
  /** Tạm dừng (đang chơi mini-game). */
  paused = false;
  /** Đang rời khu vực. */
  leaving = false;
  protected readonly statics = new THREE.Group();
  protected readonly dynamics = new THREE.Group();
  protected rnd: () => number;
  private pickups: PickupRec[] = [];
  private portals: PortalRec[] = [];
  private ticks: ((dt: number, t: number) => void)[] = [];
  private unblocks: ((x: number, z: number) => boolean)[] = [];
  private blocks: ((x: number, z: number) => boolean)[] = [];
  private built = false;
  private disposed = false;
  private offs: (() => void)[] = [];
  private saveT = 0;
  private lastSave = { x: NaN, z: NaN };
  private near: Interactable | null = null;
  private pendingInter: Interactable | null = null;
  private ray = new THREE.Raycaster();
  /** Tia kiểm tra camera câu đố có bị che không (riêng, không dùng chung tia chọn bằng chuột). */
  private sightRay = new THREE.Raycaster();
  private plane = new THREE.Plane(UP, 0);
  private lookTimer = 0;
  private lookTok = 0;
  private entered = false;

  constructor(
    readonly cfg: ZoneConfig,
    protected spawnReq: Spawn = 'start',
  ) {
    let s = (cfg.seed ?? 7) * 7919 + 13;
    this.rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  get camera(): THREE.PerspectiveCamera {
    return this.cam.camera;
  }

  get id(): ZoneId {
    return this.cfg.id;
  }

  /* ================= Vòng đời ================= */
  /** Dựng nội dung khu vực (gọi các hàm place/npc/portal...). */
  protected abstract build(): void;
  /** Sau khi đã có người chơi (đặt thú cưng, sự kiện mở đầu...). */
  protected afterBuild?(): void;
  /** Mỗi lần khu vực hiện ra (lần đầu `first` = true, hoặc quay về từ mini-game). */
  protected onEnter?(first: boolean): void;
  /** Cập nhật riêng mỗi khung hình. */
  protected tick?(dt: number, t: number): void;
  /** Mục tiêu hiện tại hiển thị trên HUD (null = dùng mục tiêu chung của cốt truyện). */
  objective?(): { text: string; icon?: string } | null;

  /** Dựng toàn bộ khu vực. Gọi một lần ngay sau khi tạo. */
  init(): this {
    const c = this.cfg;
    const margin = c.margin ?? 14;
    this.cam = new FollowCam({ yaw: c.cam?.yaw ?? 0, pitch: c.cam?.pitch ?? 50, dist: c.cam?.dist ?? 17, minDist: c.cam?.minDist ?? 9, maxDist: c.cam?.maxDist ?? 28 });
    setupSky(this.scene, c.sky?.[0] ?? '#9fd8f7', c.sky?.[1] ?? '#e6f5e3', c.fog?.[0] ?? 52, c.fog?.[1] ?? 120);
    this.lights = setupLights(this.scene, engine.quality, 26);
    if (c.mood) this.lights.mood(c.mood);
    this.fx = new Fx(this.scene);
    this.terrain = new Terrain(c.area, margin, c.ground ?? TERRAIN_COLORS.grass, c.seed ?? 1);
    this.world = new World({ minX: -c.area.hw - 2, minZ: -c.area.hd - 2, maxX: c.area.hw + 2, maxZ: c.area.hd + 2 });
    this.labels = new Labels(this.cam.camera);
    this.dynamics.name = 'dynamics';
    this.scene.add(this.dynamics);

    this.build();

    const t = this.terrain;
    this.world.paintTerrain((x, z) => !inArea(c.area, x, z, 0.3) || t.waterDist(x, z) < 0.3);
    for (const fn of this.blocks) this.world.paintTerrain(fn, 1);
    for (const fn of this.unblocks) this.world.paintTerrain(fn, 0);
    this.scene.add(t.buildGround());
    const water = t.buildWater();
    if (water) {
      water.userData.noBake = true;
      this.scene.add(water);
    }
    const baked = bakeStatic(this.statics, 24);
    this.scene.add(baked.group);
    this.ticks.push(...collectTicks(baked.group));

    const sp = this.resolveSpawn(this.spawnReq);
    const p = profile();
    this.player = new Player(p.kid, p.equipped, { x: sp.x, z: sp.z, rot: sp.rot });
    this.scene.add(this.player.root);
    this.makePet();
    // Mạng chậm, chờ quá hạn lúc chuyển cảnh: tạm dùng bé có sẵn, tải xong bé AI (mặc bộ đồ đang chọn) thì tự thay.
    if (!glbReady([playerKey(p.kid, p.equipped.outfit)])) this.onLook();
    // Sinh ra ngoài vùng cổng là đủ: quay lại ngay vẫn đi qua được (độ trễ r+0.6 chỉ dùng khi bị cổng khóa đẩy ra).
    for (const pt of this.portals) pt.armed = Math.hypot(sp.x - pt.x, sp.z - pt.z) > pt.r + 0.15;
    this.cam.snap(this.player.pos);
    this.cam.onTap = (x, y) => this.onTap(x, y);
    this.offs.push(
      bus.on('look', () => {
        clearTimeout(this.lookTimer);
        this.lookTimer = window.setTimeout(() => this.onLook(), 40);
      }),
      bus.on('quest', () => this.refreshMarks()),
      bus.on('inventory', () => this.refreshMarks()),
      bus.on('wallet', () => this.refreshMarks()),
    );
    this.built = true;
    this.afterBuild?.();
    this.loadLate();
    return this;
  }

  /**
   * Mô hình AI chưa tải xong lúc vào khu vực – khu vực không chờ lâu (game/app.ts ZONE_WAIT_MS): tạm dùng mô hình dựng bằng
   * code, tải xong tệp nào thì thay ngay tại chỗ (lateLoaded). Bé (onLook) trước nhất, rồi nhân vật của khu vực + Chú Gấu
   * chưa tải kịp, rồi – sau mọi mô hình phải có, kể cả thú cưng (makePet) – phần tải sau của khu vực (game/needs.ts
   * ZONE_LATE_MODELS: thú trong chuồng, dân làng). Đang chơi trò chơi nhỏ / đang rời khu vực thì chưa tải tệp tiếp theo;
   * rời hẳn thì thôi (phần còn lại tải dần ở nền).
   */
  private loadLate(): void {
    const p = hasProfile() ? profile() : null;
    const me = p ? { kid: p.kid, outfit: p.equipped.outfit } : null;
    const pet = p?.equipped.pet ?? null;
    const kid = playerModels(me);
    const must = zoneModels(this.id, pet, me);
    const host: LateHost = {
      gone: () => this.disposed,
      // Vừa dựng xong, đang chuẩn bị trước lúc mở màn (game/app.ts goZone warmUp – tạm dừng nhưng chưa vào): vẫn tải tiếp,
      // mạng không nghỉ (khe hở thì tệp nạp nền chen vào rồi bị hủy); thay sau màn che thì không lấp lánh.
      hold: () => this.leaving || (this.paused && this.entered),
      scene: this.scene,
      camera: this.camera,
      swap: (key) => this.lateLoaded(key),
    };
    const missed = loadLate(must.filter((k) => k !== pet && !kid.includes(k)), kid, host);
    const late = zoneLateModels(this.id);
    if (late.length) void missed.then(() => loadLate(late, must, host, kid));
  }

  /** Nhân vật chờ đổi sang mô hình AI vừa tải (lateSwap), kèm nhãn tên và độ cao nhãn trên đỉnh đầu. */
  private readonly lateWait = new Map<Actor, { label: Label; dy: number }>();
  private lateTick = false;

  /** Tệp tải sau `key` vừa xong: NPC (và Chú Gấu đi cùng) dùng mô hình này đổi sang mô hình AI. */
  protected lateLoaded(key: string): void {
    for (const n of this.npcs) if (n.actor.modelKey === key) this.lateWait.set(n.actor, { label: n.label, dy: 0.5 });
    if (this.buddy && this.buddyLabel && this.buddy.modelKey === key) this.lateWait.set(this.buddy, { label: this.buddyLabel, dy: 0.45 });
    this.lateSwap();
    if (this.lateWait.size && !this.lateTick) {
      this.lateTick = true;
      this.addTick(() => {
        if (this.lateWait.size) this.lateSwap();
      });
    }
  }

  /**
   * Đổi mô hình cho nhân vật đang chờ – không đổi giữa lúc đang nói chuyện, đố hay vui mừng (để xong mới đổi); nhãn tên
   * và dấu nhiệm vụ theo chiều cao mới, lấp lánh nhẹ lúc đổi.
   */
  private lateSwap(): void {
    for (const [a, w] of this.lateWait) {
      if (this.busy || a.busy) continue;
      this.lateWait.delete(a);
      if (!a.upgradeModel()) continue;
      w.label.o.y = a.height + w.dy;
      if (a.root.visible && !this.paused) this.fx.burst('sparkle', [a.pos.x, a.pos.y + a.height * 0.55, a.pos.z], { count: 10, speed: 1.8, up: 1.6, spread: 0.35 });
    }
  }

  /** Khu vực bắt đầu hiển thị (lần đầu hoặc quay về sau mini-game). */
  enter(): void {
    const first = !this.entered;
    this.entered = true;
    this.paused = false;
    this.leaving = false;
    this.cam.locked = false;
    this.labels.root.style.display = '';
    for (const el of this.pickCards) el.classList.remove('off-zone');
    keys.clearPressed();
    audio.music(this.cfg.music);
    markVisited(this.cfg.id);
    hud.show();
    if (first) hud.banner(this.cfg.icon, this.cfg.title, this.cfg.sub ?? '');
    this.refreshMarks();
    this.onEnter?.(first);
  }

  /** Tạm dừng (trước khi chuyển sang mini-game). */
  pause(): void {
    this.paused = true;
    this.cam.locked = true;
    this.player.stop(false);
    this.player.vel.set(0, 0, 0);
    this.labels.root.style.display = 'none';
    for (const el of this.pickCards) el.classList.add('off-zone');
    hud.setAction(null);
    hud.hide();
  }

  private resolveSpawn(s: Spawn): { x: number; z: number; rot: number } {
    const sp = this.cfg.spawns;
    const start = sp.start ?? { x: 0, z: 0, rot: 180 };
    const pt: SpawnPoint = typeof s === 'string' ? (sp[s] ?? start) : { x: s.x, z: s.z, rot: start.rot };
    const w = this.world.nearestWalkable(pt.x, pt.z, 6) ?? this.world.nearestWalkable(start.x, start.z, 8) ?? start;
    return { x: w.x, z: w.z, rot: pt.rot ?? 180 };
  }

  /* ================= Trợ giúp dựng cảnh ================= */
  /** Đặt một mô hình. */
  place(key: string, x: number, z: number, o: PlaceOpts = {}): THREE.Object3D {
    const obj = buildModel(key, o.opts ?? {});
    const s = o.scale ?? 1;
    obj.position.set(x, o.y ?? 0, z);
    obj.rotation.y = ((o.rot ?? 0) * Math.PI) / 180;
    if (s !== 1) obj.scale.multiplyScalar(s);
    const cols = obj.userData.colliders as Collider[] | undefined;
    if (o.collide !== false) obj.userData.bodies = this.world.addColliders(cols, x, z, obj.rotation.y, s, o.tag);
    else if (cols?.length && !this.built && Math.abs(o.y ?? 0) < 0.3) {
      const d = World.shapes(cols, x, z, obj.rotation.y, s, key);
      obj.userData.decor = d;
      this.decor.push(...d);
    }
    const rr = o.reserve === false ? 0 : (o.reserve ?? footprint(cols, s));
    if (rr > 0) this.terrain.reserve(x, z, rr);
    if (o.name) obj.name = o.name;
    if (o.dynamic || this.built) {
      obj.userData.dynamic = true;
      this.dynamics.add(obj);
      this.ticks.push(...collectTicks(obj));
    } else this.statics.add(obj);
    return obj;
  }

  /** Bật/tắt vật cản của một mô hình đã đặt (ví dụ đá đã vỡ, cửa đã mở). */
  setSolid(obj: THREE.Object3D, on: boolean): void {
    for (const b of (obj.userData.bodies as Body[] | undefined) ?? []) this.world.setOn(b, on);
  }

  /** Gỡ hẳn một mô hình động. */
  removeObj(obj: THREE.Object3D): void {
    for (const b of (obj.userData.bodies as Body[] | undefined) ?? []) this.world.remove(b);
    for (const b of (obj.userData.decor as Body[] | undefined) ?? []) {
      const i = this.decor.indexOf(b);
      if (i >= 0) this.decor.splice(i, 1);
    }
    obj.removeFromParent();
    disposeTree(obj);
  }

  /** Rải ngẫu nhiên các mô hình (cây, đá, hoa...) tránh đường đi, nước và chỗ đã giữ. */
  scatter(keyList: string[], n: number, o: ScatterOpts = {}): THREE.Object3D[] {
    const a = this.cfg.area;
    const out: THREE.Object3D[] = [];
    const gap = o.gap ?? 1.6;
    let tries = n * 30;
    while (out.length < n && tries-- > 0) {
      let x: number;
      let z: number;
      if (o.r !== undefined) {
        const ang = this.rnd() * Math.PI * 2;
        const d = Math.sqrt(this.rnd()) * o.r;
        x = (o.x ?? 0) + Math.cos(ang) * d;
        z = (o.z ?? 0) + Math.sin(ang) * d;
      } else {
        const hw = o.hw ?? a.hw - 0.8;
        const hd = o.hd ?? a.hd - 0.8;
        x = (o.x ?? 0) + (this.rnd() * 2 - 1) * hw;
        z = (o.z ?? 0) + (this.rnd() * 2 - 1) * hd;
      }
      if (!inArea(a, x, z, 0.6)) continue;
      if (this.terrain.onPath(x, z, o.pathGap ?? 0.9)) continue;
      if (this.terrain.isReserved(x, z, gap * 0.5)) continue;
      if (this.terrain.waterDist(x, z) < 1.2) continue;
      const key = keyList[Math.floor(this.rnd() * keyList.length)];
      const sc = o.scale ? o.scale[0] + this.rnd() * (o.scale[1] - o.scale[0]) : 1;
      out.push(this.place(key, x, z, { rot: this.rnd() * 360, scale: sc, collide: o.collide, reserve: gap * 0.5, opts: o.opts?.(out.length), y: o.y }));
    }
    return out;
  }

  /** Viền cây/bụi dày quanh mép ngoài vùng chơi (trong phần lề). */
  border(keyList: string[], o: { band?: number; step?: number; scale?: [number, number]; skip?: (x: number, z: number) => boolean } = {}): void {
    const a = this.cfg.area;
    const band = o.band ?? 9;
    const step = o.step ?? 2.7;
    const W = a.hw + band;
    const D = a.hd + band;
    for (let x = -W; x <= W; x += step)
      for (let z = -D; z <= D; z += step) {
        const jx = x + (this.rnd() - 0.5) * step * 0.8;
        const jz = z + (this.rnd() - 0.5) * step * 0.8;
        if (inArea(a, jx, jz, -1.2)) continue;
        if (!inArea({ hw: W, hd: D, r: a.r + band }, jx, jz, 0)) continue;
        if (this.terrain.isReserved(jx, jz, 0) || this.terrain.onPath(jx, jz, 1.2)) continue;
        if (this.terrain.waterDist(jx, jz) < 1.4) continue;
        if (o.skip?.(jx, jz)) continue;
        const key = keyList[Math.floor(this.rnd() * keyList.length)];
        const [s0, s1] = o.scale ?? [0.95, 1.35];
        this.place(key, jx, jz, { rot: this.rnd() * 360, scale: s0 + this.rnd() * (s1 - s0), collide: false, reserve: false });
      }
  }

  /** Cho phép đi trên vùng nước/địa hình bị chặn (cầu, bến...). Gọi trong build(). */
  protected unblock(fn: (x: number, z: number) => boolean): void {
    if (this.built) this.world.paintTerrain(fn, 0);
    else this.unblocks.push(fn);
  }

  /** Chặn thêm địa hình (vực, tường vô hình...). */
  protected block(fn: (x: number, z: number) => boolean): void {
    if (this.built) this.world.paintTerrain(fn, 1);
    else this.blocks.push(fn);
  }

  /** Thêm hàm cập nhật mỗi khung hình (hoạt cảnh riêng). Trả về hàm hủy. */
  addTick(fn: (dt: number, t: number) => void): () => void {
    this.ticks.push(fn);
    return () => {
      const i = this.ticks.indexOf(fn);
      if (i >= 0) this.ticks.splice(i, 1);
    };
  }

  /** Nhãn chữ cố định trong thế giới (biển tên khu, chỉ dẫn...). */
  sign(x: number, z: number, text: string, o: { y?: number; cls?: string; maxDist?: number } = {}): Label {
    return this.labels.add({ pos: new THREE.Vector3(x, 0, z), y: o.y ?? 2.6, text, cls: o.cls ?? 'sign', maxDist: o.maxDist ?? 34 });
  }

  /** Thêm NPC. */
  npc(key: string, x: number, z: number, o: NpcOpts): Npc {
    const actor = new Actor(key, { opts: o.opts, x, z, rot: o.rot ?? 0, scale: o.scale, radius: o.radius ?? modelRadius(key, o.opts) });
    actor.fixed = !o.wander;
    if (o.wander) actor.wander = { x, z, r: o.wander, next: engine.t + 2 + this.rnd() * 4, pause: [2.5, 6], avoid: this.decor };
    this.scene.add(actor.root);
    this.actors.push(actor);
    this.terrain.reserve(x, z, (o.wander ?? 0) + 1.2);
    const label = this.labels.add({ obj: actor.root, y: actor.height + 0.5, text: o.name, cls: 'npc', maxDist: 36 });
    if (o.color) label.el.style.setProperty('--name-bg', o.color);
    const speaker: Speaker = { name: o.name, art: key, artOpts: o.opts, color: o.color };
    const npc = { actor, label, speaker, opts: o } as Npc;
    const baseRot = o.rot ?? 0;
    npc.inter = this.interact({
      id: `npc:${key}:${o.name}`,
      x,
      z,
      r: o.r ?? 2.3,
      label: o.action ?? 'Nói chuyện',
      icon: o.icon ?? '💬',
      obj: actor.root,
      follow: actor,
      enabled: () => (o.visible ? o.visible() : true) && (o.enabled ? o.enabled() : true),
      run: async () => {
        const pp = this.player.pos;
        const w = actor.wander;
        actor.wander = null;
        actor.stop(false);
        actor.face(pp.x, pp.z);
        this.player.face(actor.pos.x, actor.pos.z);
        actor.talking = true;
        try {
          await o.talk?.(npc);
        } finally {
          actor.talking = false;
          if (w) {
            w.next = engine.t + 2.5;
            actor.wander = w;
          } else actor.faceYaw(baseRot);
        }
      },
    });
    this.npcs.push(npc);
    return npc;
  }

  /** Thêm điểm tương tác. */
  interact(it: Omit<Interactable, 'inside'>): Interactable {
    const rec = it as Interactable;
    this.inters.push(rec);
    return rec;
  }

  removeInteract(it: Interactable): void {
    const i = this.inters.indexOf(it);
    if (i >= 0) this.inters.splice(i, 1);
    if (this.near === it) this.near = null;
  }

  /** Vật phẩm nhặt được. `id` để chỉ nhặt một lần (lưu vào hồ sơ). */
  pickup(kind: PickupKind, x: number, z: number, o: { id?: string; y?: number; amount?: number; onPick?: () => void } = {}): THREE.Object3D | null {
    if (o.id && isCollected(o.id)) return null;
    const obj = buildModel(`pickup_${kind}`);
    const y = o.y ?? 0.95;
    obj.position.set(x, y, z);
    obj.userData.dynamic = true;
    this.dynamics.add(obj);
    this.terrain.reserve(x, z, 0.9);
    this.pickups.push({ obj, id: o.id, kind, amount: o.amount ?? 1, y, phase: this.rnd() * 6, onPick: o.onPick, taken: false });
    return obj;
  }

  /** Lối sang khu vực khác. `lock()` trả về lời nhắn nếu còn khóa. */
  portal(x: number, z: number, to: ZoneId, spawn: string, o: { label: string; lock?: () => string | null; r?: number; rot?: number }): void {
    const obj = this.place('exit_marker', x, z, { dynamic: true, collide: false, reserve: 3.5, rot: o.rot });
    const label = this.labels.add({ obj, y: 2.5, text: `➜ ${o.label}`, cls: 'portal', maxDist: 44 });
    this.portals.push({ x, z, r: o.r ?? 1.25, to, spawn, lock: o.lock, armed: true, label, obj, text: o.label });
  }

  /** Điểm chơi trò chơi nhỏ: mô hình + nhãn + nút "Chơi". Trò chưa đủ cấp hiện ổ khóa. */
  miniSpot(id: string, x: number, z: number, o: { model?: string; rot?: number; r?: number; opts?: Record<string, unknown>; scale?: number; y?: number; onDone?: (r: MiniResult | null) => void } = {}): Interactable | null {
    const def = miniDef(id);
    if (!def) return null;
    const info = def.info;
    const obj = o.model ? this.place(o.model, x, z, { rot: o.rot, opts: o.opts, scale: o.scale, dynamic: true }) : undefined;
    const label = this.labels.add({ pos: new THREE.Vector3(x, 0, z), y: o.y ?? (obj ? ((obj.userData.height as number | undefined) ?? 2) * (o.scale ?? 1) + 0.6 : 1.6), text: miniTitle(info), cls: 'minigame', maxDist: 34 });
    this.miniLabels.push({ label, info });
    return this.interact({
      id: `mini:${id}`,
      x,
      z,
      r: o.r ?? 2.6,
      label: `Chơi: ${miniName(info)}`,
      icon: '🎮',
      obj,
      run: async () => {
        if (level() < info.unlock) {
          sfx('error');
          toast(`Trò "${miniName(info)}" mở khi bạn đạt cấp ${info.unlock}. Cố lên nhé!`, { icon: '🔒', tone: 'warn', ms: 3200 });
          return;
        }
        const r = await this.playMini(id);
        o.onDone?.(r);
      },
    });
  }

  private miniLabels: { label: Label; info: MiniInfo }[] = [];

  /** Chơi một mini-game rồi quay lại đúng chỗ cũ. */
  async playMini(id: string): Promise<MiniResult | null> {
    this.pause();
    return nav.mini(id);
  }

  /** Cửa / lối vào (bấm để đi): ví dụ cửa nhà, cửa hàng. */
  door(x: number, z: number, to: ZoneId, spawn: string, o: { label: string; icon?: string; r?: number; lock?: () => string | null; obj?: THREE.Object3D }): Interactable {
    return this.interact({
      id: `door:${to}:${spawn}`,
      x,
      z,
      r: o.r ?? 1.6,
      label: o.label,
      icon: o.icon ?? '🚪',
      obj: o.obj,
      prio: 1,
      run: () => {
        const msg = o.lock?.() ?? null;
        if (msg) {
          sfx('error');
          toast(msg, { icon: '🔒', tone: 'warn', ms: 3400 });
          return;
        }
        sfx('door');
        this.leaving = true;
        nav.go(to, spawn);
      },
    });
  }

  /** Độ dời điểm nhìn (m, ngược hướng nhìn) để điểm cần xem nằm ở nửa trên màn hình – phía trên bảng câu hỏi. */
  private topShift(dist: number): number {
    const fov = (this.cam.camera.fov * Math.PI) / 180;
    return (0.4 * dist * Math.tan(fov / 2)) / Math.max(0.3, Math.sin(this.cam.pitch));
  }

  /** Giữ camera sao cho điểm (x,y,z) hiện ở nửa trên màn hình – phía trên bảng câu hỏi. `yaw`: hướng camera sẽ nhìn. */
  focusTop(x: number, y: number, z: number, dist = 12, yaw = this.cam.yaw): void {
    const d = this.topShift(dist);
    this.cam.hold([x + Math.sin(yaw) * d, y, z + Math.cos(yaw) * d], dist);
  }

  /**
   * Hỏi một câu hỏi ngay trong thế giới (camera nhìn vào đồ vật liên quan). Luôn kết thúc khi trẻ chọn đúng.
   * `focus` là NPC (`npc.actor`) thì camera nhìn vào chỗ NPC đang đứng, đứng chéo sau vai bé (thấy mặt NPC 3/4)
   * và né vật che (tán cây, hàng rào...); hỏi xong camera xoay về hướng cũ.
   */
  async quiz(q: Question, o: AskOptions, focus?: Actor | THREE.Object3D | [number, number, number], dist = 12): Promise<AskResult> {
    const prev = this.cam.yawGoal;
    let setYaw: number | null = null;
    if (focus) {
      const obj = Array.isArray(focus) || focus instanceof Actor ? null : focus;
      const actor = focus instanceof Actor ? focus : obj ? (this.actors.find((a) => a.root === obj) ?? null) : null;
      // Đọc vị trí và chiều cao lúc bắt đầu hỏi: NPC đi lang thang, mô hình AI có thể vừa thay mô hình tạm.
      let p: THREE.Vector3;
      if (actor) p = new THREE.Vector3(actor.pos.x, actor.pos.y + QUIZ_FOCUS_K * actor.height, actor.pos.z);
      else if (obj) {
        p = obj.getWorldPosition(new THREE.Vector3());
        p.y += 0.6;
      } else p = new THREE.Vector3(...(focus as [number, number, number]));
      const yaw = this.quizYaw(p, dist, actor, actor?.root ?? obj);
      if (yaw !== null) {
        setYaw = prev + angDiff(yaw, prev);
        this.cam.yawGoal = setYaw;
        this.focusTop(p.x, p.y, p.z, dist, yaw);
      } else this.focusTop(p.x, p.y, p.z, dist);
    }
    try {
      return await ask(q, o);
    } finally {
      if (focus) {
        // Trả camera về hướng bé đang xem trước câu đố (trừ khi hướng đã bị đổi giữa chừng).
        if (setYaw !== null && this.cam.yawGoal === setYaw) this.cam.yawGoal = prev;
        await this.cam.release();
      }
    }
  }

  /**
   * Chọn hướng camera cho câu đố, chỉ tính một lần lúc bắt đầu hỏi (bắn tia từ vị trí camera dự kiến tới chỗ cần xem).
   *  - NPC: góc chéo sau vai bé; bị che thì thử lệch ±20°… ±80°, lấy góc gần nhất thấy rõ cả mặt lẫn thân.
   *  - Đồ vật / điểm cố định: giữ hướng hiện tại nếu thấy rõ, chỉ xoay khi bị che.
   * Trả về null = giữ nguyên hướng hiện tại (không góc nào tốt hơn).
   */
  quizYaw(p: THREE.Vector3, dist: number, actor: Actor | null, subject: THREE.Object3D | null): number | null {
    const skip = new Set<THREE.Object3D>([this.player.root, this.fx.root]);
    if (this.pet) skip.add(this.pet.root);
    if (this.buddy) skip.add(this.buddy.root);
    if (subject) skip.add(subject);
    // Điểm cố định thường nằm ngay trong NPC đứng đó (Nhà Vua...): NPC đó không tính là vật che.
    else for (const a of this.actors) if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 1) skip.add(a.root);
    const meshes: THREE.Object3D[] = [];
    const layers = this.cam.camera.layers;
    const walk = (o: THREE.Object3D): void => {
      if (!o.visible || skip.has(o)) return;
      const m = o as THREE.Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean; count?: number };
      if (m.isMesh && !m.isSkinnedMesh && o.layers.test(layers) && solidMat(m.material) && !(m.isInstancedMesh && m.count === 0)) meshes.push(o);
      for (const c of o.children) walk(c);
    };
    walk(this.scene);
    const targets = actor
      ? QUIZ_SIGHT_K.map((k) => new THREE.Vector3(actor.pos.x, actor.pos.y + k * actor.height, actor.pos.z))
      : [p.clone()];
    // Chủ thể đã bỏ khỏi danh sách nên tia được đi sát tới nơi; điểm cố định có thể nằm lọt trong vật → chừa 0.5 m.
    const margin = subject ? 0.05 : 0.5;
    const d = this.topShift(dist);
    const cp = Math.cos(this.cam.pitch);
    const sp = Math.sin(this.cam.pitch);
    const eye = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const ray = this.sightRay;
    const hits: THREE.Intersection[] = [];
    const memo = new Map<number, number>();
    const score = (yaw: number): number => {
      const key = Math.round(angDiff(yaw, 0) * 1e4);
      const known = memo.get(key);
      if (known !== undefined) return known;
      const sx = Math.sin(yaw);
      const sz = Math.cos(yaw);
      eye.set(p.x + sx * (d + dist * cp), p.y + dist * sp, p.z + sz * (d + dist * cp));
      let n = 0;
      for (const t of targets) {
        dir.subVectors(t, eye);
        const len = dir.length();
        ray.set(eye, dir.divideScalar(len));
        ray.far = Math.max(0, len - margin);
        let hit = false;
        for (const m of meshes) {
          hits.length = 0;
          m.raycast(ray, hits);
          if (hits.length) {
            hit = true;
            break;
          }
        }
        if (!hit) n++;
      }
      memo.set(key, n);
      return n;
    };
    const full = targets.length;
    const cur = this.cam.yawGoal;
    if (!actor) {
      if (score(cur) >= full) return null;
      const y = bestYaw(cur, score, full);
      return y !== null && score(y) > score(cur) ? y : null;
    }
    const kid = this.player.pos;
    const base = shoulderYaw(actor.pos.x, actor.pos.z, kid.x, kid.z, cur);
    const y = bestYaw(base, score, full, behindYaw(actor.pos.x, actor.pos.z, kid.x, kid.z));
    if (y === null || (score(y) < full && score(cur) >= score(y))) return null;
    return y;
  }

  /**
   * Thử thách "chọn bằng hành động": thẻ đề bài hiện ở trên, mỗi lựa chọn là một chỗ trong thế giới
   * (bước lên hòn đá, đi qua cánh cửa, ném quả bóng...). Sai thì có phản hồi + gợi ý như bảng câu hỏi;
   * kết thúc (và ghi nhận + thưởng) khi trẻ chọn đúng.
   *
   * Người chơi phải đi lại được trong lúc thử thách, vì vậy KHÔNG `await` hàm này bên trong một tương
   * tác đang chạy – hãy gọi `void this.pick(...).then(...)` rồi để tương tác kết thúc.
   */
  pick(q: Question, spots: PickSpot[], o: PickOpts): Promise<PickResult> {
    const card = promptCard(q, { src: o.src, speaker: o.speaker, title: o.title, icon: o.icon, showVisual: o.showVisual });
    this.pickCards.add(card.el);
    if (this.paused) card.el.classList.add('off-zone');
    const right = (v: string) => v === q.answer || !!q.accept?.includes(v);
    const textOf = (v: string) => q.choices.find((c) => c.value === v)?.label ?? v;
    const tagY = typeof o.tags === 'number' ? o.tags : 2.4;
    const tags = new Map<PickSpot, Label>();
    if (o.tags) {
      const group = `pick:${o.src}`;
      for (const s of spots) {
        if (s.tag === false) continue;
        tags.set(s, this.labels.add({ pos: [s.x, 0, s.z], y: tagY, text: s.tag ?? textOf(s.value), cls: 'answer', maxDist: 40, clampTop: true, z: 1000, spread: group }));
      }
    }
    const dropTags = () => {
      for (const l of tags.values()) l.remove();
      tags.clear();
    };
    return new Promise((resolve) => {
      let done = false;
      const inters: Interactable[] = [];
      let offTick: () => void = () => undefined;
      const cleanup = () => {
        done = true;
        for (const it of inters) this.removeInteract(it);
        offTick();
        if (activePick === solve) activePick = null;
        const i = this.offs.indexOf(onDispose);
        if (i >= 0) this.offs.splice(i, 1);
      };
      const closeCard = () => {
        this.pickCards.delete(card.el);
        card.close();
      };
      const onDispose = () => {
        if (done) return;
        cleanup();
        dropTags();
        closeCard();
      };
      const choose = async (s: PickSpot) => {
        if (done) return;
        const r = card.submit(s.value);
        if (r.correct) {
          cleanup();
          tags.get(s)?.el.classList.add('right');
          const res = card.finish({ rewards: o.rewards });
          try {
            await o.onRight?.(s);
          } finally {
            dropTags();
            closeCard();
            resolve({ spot: s, attempts: Math.max(1, card.tracker.attempts), xp: res.xp, coins: res.coins });
          }
        } else {
          tags.get(s)?.el.classList.add('tried');
          await o.onWrong?.(s, r.stage);
        }
      };
      spots.forEach((s, i) => {
        inters.push(
          this.interact({
            id: `pick:${o.src}:${i}`,
            x: s.x,
            z: s.z,
            r: s.r ?? 1.5,
            label: s.label ?? `Chọn ${textOf(s.value)}`,
            icon: s.icon ?? '👉',
            obj: s.obj,
            auto: s.auto,
            prio: 2,
            run: () => choose(s),
          }),
        );
      });
      if (o.area) {
        const a = o.area;
        offTick = this.addTick(() => {
          if (done) return;
          const p = this.player.pos;
          const inside = Math.hypot(p.x - a.x, p.z - a.z) <= a.r;
          card.el.classList.toggle('away', !inside);
        });
      }
      const solve = () => {
        const s = spots.find((sp) => right(sp.value));
        if (!s || done) return false;
        void this.runInteract({ id: 'pick:debug', x: s.x, z: s.z, r: 0, label: '', icon: '', run: () => choose(s) });
        return true;
      };
      activePick = solve;
      this.offs.push(onDispose);
    });
  }

  private pickCards = new Set<HTMLElement>();

  /**
   * Mép dưới (px) của thẻ đề bài `pick()` đang hiện (0 nếu không có). Thẻ che phần trên màn hình → camera hạ
   * khung hình và nhãn đáp án được giữ ngay dưới thẻ để luôn đọc được các lựa chọn phía trước.
   */
  private pickCardBottom(): number {
    let bottom = 0;
    for (const el of this.pickCards) {
      if (el.classList.contains('away') || el.classList.contains('off-zone') || !el.isConnected) continue;
      bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
    }
    return bottom;
  }

  /** Hoạt cảnh gắn với khu vực (tự hủy khi rời khu vực). */
  tween(dur: number, fn: (k: number) => void, o: { ease?: Ease; delay?: number } = {}): Handle {
    return tween(dur, fn, { ...o, owner: this });
  }

  /** Chờ theo thời gian trò chơi. */
  wait(sec: number): Handle {
    return wait(sec, this);
  }

  /* ================= Cập nhật ================= */
  update(dt: number, t: number): void {
    if (this.paused || this.disposed) return;
    const blocked = this.busy || this.leaving || inputBlocked();
    this.player.control(dt, t, this.cam, this.world, blocked);
    const pp = this.player.pos;
    for (const a of this.actors) {
      a.update(dt, t, this.world);
      if (!a.solid) continue;
      const dx = pp.x - a.pos.x;
      const dz = pp.z - a.pos.z;
      const rr = a.radius + this.player.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6 && pp.y < a.pos.y + a.height * 0.8) {
        const d = Math.sqrt(d2);
        pp.x += (dx / d) * (rr - d);
        pp.z += (dz / d) * (rr - d);
      }
    }
    this.pet?.update(dt, t, this.world);
    this.buddy?.update(dt, t, this.world);
    for (const fn of this.ticks) fn(dt, t);
    this.updatePickups(dt, t);
    if (!blocked) this.updatePortals();
    this.updateInteract(blocked);
    this.tick?.(dt, t);
    const cardBottom = this.pickCardBottom();
    this.cam.shiftGoal = cardBottom > 0 ? Math.min(0.18, Math.max(0, cardBottom / Math.max(1, window.innerHeight) - 0.24)) : 0;
    this.labels.topInset = cardBottom;
    this.cam.follow(pp);
    this.cam.update(dt);
    this.lights.follow(pp);
    this.fx.update(dt);
    this.labels.update();
    waterUniforms.uTime.value = t;
    this.saveT += dt;
    if (this.saveT > 2 && hasProfile()) {
      this.saveT = 0;
      if (!(Math.abs(pp.x - this.lastSave.x) + Math.abs(pp.z - this.lastSave.z) < 0.5)) {
        this.lastSave = { x: pp.x, z: pp.z };
        setPosition(this.cfg.id, pp.x, pp.z);
      }
    }
  }

  private updatePickups(dt: number, t: number): void {
    const p = this.player.pos;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.obj.rotation.y += dt * 2.4;
      pk.obj.position.y = pk.y + Math.sin(t * 2.6 + pk.phase) * 0.12;
      const dx = p.x - pk.obj.position.x;
      const dz = p.z - pk.obj.position.z;
      if (dx * dx + dz * dz < 1.15 * 1.15 && Math.abs(p.y + 0.9 - pk.y) < 1.4) this.collect(pk);
    }
  }

  private collect(pk: PickupRec): void {
    pk.taken = true;
    if (pk.id) markCollected(pk.id);
    const pos = pk.obj.position.clone();
    const n = pk.amount;
    switch (pk.kind) {
      case 'star':
        addStars(n);
        sfx('star');
        break;
      case 'coin':
        addCoins(n);
        sfx('coin');
        break;
      case 'key':
        addKeys(n);
        sfx('unlock');
        break;
      case 'ticket':
        addTickets(n);
        sfx('star');
        break;
      case 'heart':
        sfx('pop');
        break;
      default:
        giveItem(pk.kind, n);
        sfx('pop');
    }
    this.fx.burst(pk.kind === 'star' ? 'star' : pk.kind === 'heart' ? 'heart' : 'sparkle', pos, { count: 16 });
    this.fx.ring(new THREE.Vector3(pos.x, 0, pos.z), { color: '#fff3a0' });
    this.labels.float(pos, pk.kind === 'heart' ? '💖' : [`+${n} `, pickIcon(pk.kind)], 'gold');
    pk.obj.removeFromParent();
    disposeTree(pk.obj);
    pk.onPick?.();
    this.refreshMarks();
  }

  private updatePortals(): void {
    const p = this.player.pos;
    for (const pt of this.portals) {
      const d = Math.hypot(p.x - pt.x, p.z - pt.z);
      if (d > pt.r + 0.6) {
        pt.armed = true;
        continue;
      }
      if (!pt.armed || d > pt.r) continue;
      pt.armed = false;
      const msg = pt.lock?.() ?? null;
      if (msg) {
        sfx('error');
        toast(msg, { icon: '🔒', tone: 'warn', ms: 3600 });
        this.player.stop(false);
        this.player.vel.set(0, 0, 0);
        let dx = p.x - pt.x;
        let dz = p.z - pt.z;
        let l = Math.hypot(dx, dz);
        if (l < 0.05) {
          dx = -pt.x;
          dz = -pt.z;
          l = Math.hypot(dx, dz) || 1;
        }
        const tgt = this.world.nearestWalkable(pt.x + (dx / l) * (pt.r + 1.2), pt.z + (dz / l) * (pt.r + 1.2), 4);
        if (tgt) void this.player.goTo(tgt.x, tgt.z, this.world);
        continue;
      }
      sfx('whoosh');
      this.leaving = true;
      this.player.stop(false);
      hud.setAction(null);
      nav.go(pt.to, pt.spawn);
      return;
    }
  }

  private interPos(it: Interactable): { x: number; z: number } {
    return it.follow ? { x: it.follow.pos.x, z: it.follow.pos.z } : { x: it.x, z: it.z };
  }

  private updateInteract(blocked: boolean): void {
    const p = this.player.pos;
    let best: Interactable | null = null;
    let bd = Infinity;
    for (const it of this.inters) {
      if (it.enabled && !it.enabled()) {
        it.inside = false;
        continue;
      }
      const ip = this.interPos(it);
      const d = Math.hypot(p.x - ip.x, p.z - ip.z);
      // NPC đi lang thang đứng chờ khi bé tới gần (bán kính nói chuyện + 1 m).
      if (it.follow?.wander && d <= it.r + 1) it.follow.attend(p.x, p.z);
      const inside = d <= it.r;
      if (it.auto) {
        if (!inside) it.inside = false;
        else if (!it.inside && !blocked) {
          it.inside = true;
          void this.runInteract(it);
          return;
        }
        continue;
      }
      if (!inside) continue;
      const score = d - (it.prio ?? 0) * 10;
      if (score < bd) {
        bd = score;
        best = it;
      }
    }
    this.near = blocked ? null : best;
    const near = this.near;
    if (near) {
      hud.setAction({ label: near.label, icon: near.icon, press: () => void this.runInteract(near) });
      if (keys.consume(...K.act)) void this.runInteract(near);
    } else {
      hud.setAction(null);
      // Bỏ lần nhấn E khi không đứng gần gì (tránh tự kích hoạt khi đi tới gần sau đó).
      keys.consume(...K.act);
    }
  }

  /** Chạy một tương tác (khóa điều khiển cho tới khi xong). */
  async runInteract(it: Interactable): Promise<void> {
    if (this.busy || this.paused || this.leaving) return;
    this.busy = true;
    this.pendingInter = null;
    this.player.stop(false);
    this.player.vel.set(0, 0, 0);
    hud.setAction(null);
    try {
      await it.run();
    } catch (e) {
      console.error(e);
    } finally {
      this.busy = false;
      keys.clearPressed();
      if (!this.disposed) this.refreshMarks();
    }
  }

  /** Chạm/nhấp lên cảnh: chọn NPC/đồ vật, hoặc đi tới chỗ chạm. */
  private onTap(cx: number, cy: number): void {
    if (this.busy || this.paused || this.leaving || inputBlocked() || engine.stage !== this) return;
    const rect = engine.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    const objs: THREE.Object3D[] = [];
    const map = new Map<THREE.Object3D, Interactable>();
    for (const it of this.inters) {
      if (!it.obj || it.auto || (it.enabled && !it.enabled())) continue;
      objs.push(it.obj);
      map.set(it.obj, it);
    }
    const hits = objs.length ? this.ray.intersectObjects(objs, true) : [];
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !map.has(o)) o = o.parent;
      const it = o ? map.get(o) : undefined;
      if (it) {
        this.tapInteract(it);
        return;
      }
    }
    const tgt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, tgt)) return;
    const w = this.world.nearestWalkable(tgt.x, tgt.z, 3);
    if (!w) return;
    this.fx.ring([w.x, 0.03, w.z], { color: '#ffffff', r0: 0.15, r1: 0.85, dur: 0.45 });
    this.pendingInter = null;
    void this.player.goTo(w.x, w.z, this.world);
  }

  private tapInteract(it: Interactable): void {
    const p = this.player.pos;
    const ip = this.interPos(it);
    const d = Math.hypot(p.x - ip.x, p.z - ip.z);
    if (d <= it.r) {
      void this.runInteract(it);
      return;
    }
    const k = Math.min(d, it.r * 0.6) / d;
    const tx = ip.x + (p.x - ip.x) * k;
    const tz = ip.z + (p.z - ip.z) * k;
    this.pendingInter = it;
    this.fx.ring([tx, 0.03, tz], { color: '#ffe066', r0: 0.15, r1: 0.85, dur: 0.45 });
    void this.player.goTo(tx, tz, this.world).then(() => {
      if (this.pendingInter !== it) return;
      this.pendingInter = null;
      const q = this.interPos(it);
      if (Math.hypot(this.player.pos.x - q.x, this.player.pos.z - q.z) <= it.r + 0.4 && !inputBlocked()) void this.runInteract(it);
    });
  }

  /** Cập nhật dấu trên đầu NPC, khóa lối đi, mục tiêu HUD. */
  refreshMarks(): void {
    if (!this.built || this.disposed || !hasProfile()) return;
    for (const n of this.npcs) {
      const vis = n.opts.visible ? n.opts.visible() : true;
      if (n.actor.root.visible !== vis) {
        n.actor.root.visible = vis;
        n.actor.solid = vis;
        n.label.show(vis);
      }
      n.label.setMark(vis ? (n.opts.mark?.() ?? '') : '');
    }
    for (const pt of this.portals) {
      const locked = !!pt.lock?.();
      pt.label.setText(`${locked ? '🔒' : '➜'} ${pt.text}`);
      pt.label.el.classList.toggle('locked', locked);
    }
    for (const m of this.miniLabels) {
      const locked = level() < m.info.unlock;
      m.label.setText(locked ? `🔒 ${miniName(m.info)} · cấp ${m.info.unlock}` : miniTitle(m.info));
      m.label.el.classList.toggle('locked', locked);
    }
    const ob = this.objective?.() ?? storyObjective();
    hud.objective(ob?.text ?? null, ob?.icon ?? '📜');
    this.syncBuddy();
  }

  /* ================= Nhân vật ================= */
  /** Chú Gấu đi cùng người chơi trong hành trình tới Sở Thú. */
  buddy: Follower | null = null;
  /** Vị trí Chú Gấu xuất hiện lần tới (ví dụ chỗ Gấu đang đứng trước khi bắt đầu đi theo). */
  protected buddyFrom: { x: number; z: number } | null = null;
  private buddyLabel: Label | null = null;
  private buddyInter: Interactable | null = null;

  /** Có cho Chú Gấu đi theo ở khu vực này không (khu vực có thể tự đặt Gấu đứng yên thay vì đi theo). */
  protected wantsBuddy(): boolean {
    return bearFollows(this.cfg.id);
  }

  /** Lời Chú Gấu nói khi bấm nói chuyện lúc đi cùng (khu vực có thể thay). */
  protected buddyTalk(): Promise<void> {
    const ob = storyObjective();
    return say(CAST.gau, ob ? [`Mình cùng làm nhé: ${ob.text.toLowerCase()}!`, 'Bạn giỏi lắm, mình tin bạn làm được!'] : 'Cảm ơn bạn đã đi cùng mình!');
  }

  private syncBuddy(): void {
    const want = this.wantsBuddy();
    if (want && !this.buddy) {
      const p = this.player.pos;
      const from = this.buddyFrom ?? { x: p.x + 1.2, z: p.z + 1 };
      this.buddyFrom = null;
      const b = new Follower(CAST.gau.art, this.player, { x: from.x, z: from.z, side: -0.75, dist: 1.9, scale: 0.9 });
      b.face(p.x, p.z, true);
      this.scene.add(b.root);
      this.buddy = b;
      this.buddyLabel = this.labels.add({ obj: b.root, y: b.height + 0.45, text: CAST.gau.name, cls: 'npc small', maxDist: 30 });
      this.buddyLabel.el.style.setProperty('--name-bg', CAST.gau.color);
      this.buddyInter = this.interact({
        id: 'buddy',
        x: 0,
        z: 0,
        r: 2.6,
        prio: -5,
        label: `Hỏi ${CAST.gau.name}`,
        icon: '🐻',
        obj: b.root,
        follow: b,
        run: async () => {
          b.face(this.player.pos.x, this.player.pos.z);
          b.talking = true;
          try {
            await this.buddyTalk();
          } finally {
            b.talking = false;
          }
        },
      });
    } else if (!want && this.buddy) {
      this.buddyLabel?.remove();
      if (this.buddyInter) this.removeInteract(this.buddyInter);
      this.lateWait.delete(this.buddy);
      this.buddy.dispose();
      disposeTree(this.buddy.root);
      this.buddy = null;
      this.buddyLabel = null;
      this.buddyInter = null;
    }
  }

  private makePet(): void {
    const id = hasProfile() ? profile().equipped.pet : null;
    if (this.pet && this.pet.key === id) return;
    if (this.pet) {
      this.pet.dispose();
      disposeTree(this.pet.root);
      this.pet = null;
    }
    if (!id) return;
    const p = this.player.pos;
    const pet = new Follower(id, this.player, { x: p.x - 1, z: p.z + 0.8 });
    this.pet = pet;
    this.scene.add(pet.root);
    // Mạng chậm (mới nhận nuôi, mô hình AI chưa tải): tạm dùng thú dựng bằng code, tải xong thì thay ngay tại chỗ
    // (chuẩn bị trước ảnh + shader để lúc thay không bị khựng).
    if (!glbReady([id]))
      void ensureGlb([id]).then(async (ok) => {
        const live = () => !this.disposed && this.pet === pet && hasProfile() && profile().equipped.pet === id;
        if (!ok || !live()) return;
        const next = buildModel(id);
        if (!next.userData.glb) {
          disposeTree(next);
          return;
        }
        await warmUp(next, { camera: this.camera, scene: this.scene });
        disposeTree(live() ? pet.swapModel(next) : next);
      });
  }

  private onLook(): void {
    if (this.disposed || !hasProfile()) return;
    const p = profile();
    // Bộ đồ mới chưa tải: chờ tải xong mới thay (không hiện tạm bé dựng bằng code); đổi liên tục thì chỉ lấy lần cuối.
    const key = playerKey(p.kid, p.equipped.outfit);
    const tok = ++this.lookTok;
    const ok = () => tok === this.lookTok && !this.disposed && hasProfile();
    const go = async () => {
      if (!ok()) return;
      const q = profile();
      const next = buildLook(q.kid, q.equipped);
      // Chuẩn bị trước ảnh + shader của bé mới: thay vào là đi tiếp ngay, không khựng.
      await warmUp(next, { camera: this.camera, scene: this.scene });
      if (!ok()) {
        disposeLook(next);
        return;
      }
      this.player.refresh(q.kid, q.equipped, next);
      this.makePet();
    };
    if (glbReady([key])) void go();
    else {
      this.makePet();
      void ensureGlb([key]).then(go);
    }
  }

  /** Cảnh quay ngắn: camera lướt tới một điểm rồi quay lại. */
  showPoint(x: number, y: number, z: number, hold = 1.4, dist?: number): Promise<void> {
    return this.cam.showPoint([x, y, z], { hold, dist });
  }

  /** Bong bóng lời nói phía trên một NPC/đối tượng. */
  bubble(obj: THREE.Object3D, text: string, y = 2.4, ms = 2800): void {
    this.labels.bubble(obj, text, y, ms);
  }

  onResize(): void {
    /* camera do engine cập nhật */
  }

  onQuality(q: Quality): void {
    this.lights.setQuality(q);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelOwner(this);
    clearTimeout(this.lookTimer);
    for (const off of [...this.offs]) off();
    this.offs = [];
    hud.setAction(null);
    this.cam.dispose();
    this.labels.dispose();
    this.player?.dispose();
    this.pet?.dispose();
    this.buddy?.dispose();
    for (const a of this.actors) a.dispose();
    this.fx.dispose();
    this.scene.traverse((o) => {
      if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
    });
    disposeTree(this.scene);
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.scene.clear();
  }
}

/** Bán kính giữ chỗ ước lượng từ vật cản của mô hình. */
function footprint(cols: Collider[] | undefined, s: number): number {
  if (!cols || !cols.length) return 0.6 * s;
  let r = 0;
  for (const c of cols) {
    const off = Math.hypot(c.at?.[0] ?? 0, c.at?.[1] ?? 0);
    const rr = c.kind === 'circle' ? c.r : Math.hypot(c.w, c.d) / 2;
    r = Math.max(r, off + rr);
  }
  return (r + 0.4) * s;
}
