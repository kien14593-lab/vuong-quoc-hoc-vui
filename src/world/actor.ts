import * as THREE from 'three';
import { disposeTree } from '../engine/merge';
import { dampAngle } from '../engine/tween';
import { glbLoaded } from '../models/glb';
import { buildModel, collectTicks, modelKeyFor } from '../models/registry';
import { animateRig, rigOf, type AnimState, type Rig } from '../models/rig';
import { yawTo, type Body, type World } from './collide';
import { pickWanderTarget, segmentClear } from './wander';

/**
 * Nhân vật/thú di chuyển được trong thế giới (NPC, thú cưng, người chơi).
 * `root` là khung chứa (vị trí, hướng); mô hình nằm bên trong để hoạt cảnh khung xương
 * (nhún nhảy, hop) không đè lên vị trí.
 */
export interface ActorOpts {
  opts?: Record<string, unknown>;
  x?: number;
  z?: number;
  y?: number;
  /** Hướng (độ), 0 = nhìn về +Z. */
  rot?: number;
  scale?: number;
  /** Tốc độ đi (m/giây). */
  speed?: number;
  radius?: number;
}

export interface Wander {
  x: number;
  z: number;
  r: number;
  /** Thời điểm đi tiếp. */
  next: number;
  pause: [number, number];
  /** Vật trang trí không chắn bé (luống hoa, bụi cây thấp...): NPC chọn điểm đến không đi xuyên qua. */
  avoid?: readonly Body[];
}

const tmpV = new THREE.Vector3();
/** Bé rời khỏi vùng gần quá khoảng này (giây) thì thôi đứng chờ, bắt đầu đếm giờ đi tiếp. */
const HEED_GAP = 0.25;

export class Actor {
  readonly root = new THREE.Group();
  model: THREE.Object3D;
  rig?: Rig;
  readonly anim: AnimState = { t: 0, dt: 0, move: 0 };
  yaw = 0;
  yawGoal = 0;
  speed: number;
  radius: number;
  height: number;
  /** Đường đi đang theo (các điểm x,z). */
  path: { x: number; z: number }[] | null = null;
  wander: Wander | null = null;
  /** Đang nói chuyện (miệng/đầu chuyển động). */
  talking = false;
  waving = false;
  /** Giữ vui mừng tới thời điểm này. */
  happyUntil = 0;
  /** Không cho người chơi đi xuyên qua. */
  solid = true;
  /** Đứng yên tại chỗ (không bị đẩy). */
  fixed = false;
  private ticks: ((dt: number, t: number) => void)[];
  private arrive: ((ok: boolean) => void) | null = null;
  private stuckT = 0;
  private lastD = Infinity;
  private t = 0;
  /** Lần cuối bé ở gần (xem `attend`), vị trí bé lúc đó, và số giây chờ trước khi đi tiếp. */
  private heedT = -Infinity;
  private heedX = 0;
  private heedZ = 0;
  private resume = 2.5;
  /** Tỉ lệ riêng của nhân vật này (opts.scale), áp lại khi đổi mô hình. */
  private readonly scaleK: number;
  /** Tùy chọn dựng mô hình (để dựng lại khi thay mô hình AI tải sau). */
  private readonly opts: Record<string, unknown>;

  constructor(
    readonly key: string,
    o: ActorOpts = {},
  ) {
    this.opts = o.opts ?? {};
    this.model = buildModel(key, this.opts);
    this.rig = rigOf(this.model);
    const s = (this.scaleK = o.scale ?? 1);
    this.model.scale.multiplyScalar(s);
    this.root.add(this.model);
    this.root.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    this.yaw = this.yawGoal = ((o.rot ?? 0) * Math.PI) / 180;
    this.root.rotation.y = this.yaw;
    this.speed = o.speed ?? 2.2;
    this.radius = (o.radius ?? 0.45) * s;
    this.height = ((this.model.userData.height as number | undefined) ?? 1.6) * s;
    this.ticks = collectTicks(this.model);
    this.root.userData.actor = this;
    this.root.userData.dynamic = true;
  }

  get pos(): THREE.Vector3 {
    return this.root.position;
  }

  /** Đổi mô hình (ví dụ người chơi thay trang phục). */
  swapModel(next: THREE.Object3D): THREE.Object3D {
    const old = this.model;
    // Không chép scale của mô hình cũ: mô hình dựng bằng code có thể tự thu nhỏ gốc (vd. cánh cụt con 0.78).
    next.scale.multiplyScalar(this.scaleK);
    this.root.remove(old);
    this.root.add(next);
    this.model = next;
    this.rig = rigOf(next);
    this.ticks = collectTicks(next);
    this.height = ((next.userData.height as number | undefined) ?? 1.6) * this.scaleK;
    return old;
  }

  /** Khóa mô hình thật (dân làng 'npc_villager' + { v } → khóa riêng của từng người, models/villagers.ts). */
  get modelKey(): string {
    return modelKeyFor(this.key, this.opts);
  }

  /** Đang nói chuyện / đố / vui mừng: chưa thay mô hình tải sau (để xong mới thay). */
  get busy(): boolean {
    return this.talking || this.t < this.happyUntil;
  }

  /**
   * Mô hình AI tải sau (world/late.ts – cảnh không chờ) vừa xong: dựng lại và thay ngay tại chỗ.
   * Trả về true nếu đã thay; false nếu đang dùng mô hình AI rồi, hoặc tệp chưa tải/tải lỗi (giữ nguyên mô hình cũ).
   */
  upgradeModel(): boolean {
    if (this.model.userData.glb || !glbLoaded(this.modelKey)) return false;
    const next = buildModel(this.key, this.opts);
    if (!next.userData.glb) {
      disposeTree(next);
      return false;
    }
    disposeTree(this.swapModel(next));
    return true;
  }

  setPos(x: number, z: number, y = this.root.position.y): void {
    this.root.position.set(x, y, z);
  }

  /** Quay mặt về điểm (x,z). `instant`: quay ngay. */
  face(x: number, z: number, instant = false): void {
    this.yawGoal = yawTo(this.root.position.x, this.root.position.z, x, z);
    if (instant) this.yaw = this.root.rotation.y = this.yawGoal;
  }

  faceYaw(deg: number, instant = false): void {
    this.yawGoal = (deg * Math.PI) / 180;
    if (instant) this.yaw = this.root.rotation.y = this.yawGoal;
  }

  /** Đi tới (x,z): dùng tìm đường nếu có `world`. Promise trả true khi tới nơi. */
  walkTo(x: number, z: number, world?: World | null): Promise<boolean> {
    this.stop(false);
    let path: { x: number; z: number }[] | null = [{ x, z }];
    if (world) path = world.findPath(this.root.position.x, this.root.position.z, x, z) ?? [{ x, z }];
    this.path = path;
    this.stuckT = 0;
    this.lastD = Infinity;
    return new Promise((r) => (this.arrive = r));
  }

  stop(ok = false): void {
    this.path = null;
    const a = this.arrive;
    this.arrive = null;
    a?.(ok);
  }

  celebrate(sec = 1.6): void {
    this.happyUntil = Math.max(this.happyUntil, this.t + sec);
  }

  /**
   * Bé đang ở gần (khu vực gọi mỗi khung hình): NPC đi lang thang đứng lại, quay dần về phía bé
   * và không bỏ đi; bé đi xa thì 2–3 giây sau mới đi tiếp.
   */
  attend(x: number, z: number): void {
    if (this.t - this.heedT > HEED_GAP) this.resume = 2 + Math.random();
    this.heedT = this.t;
    this.heedX = x;
    this.heedZ = z;
  }

  get moving(): boolean {
    return !!this.path;
  }

  /** Chuyển động theo đường đi; trả về vận tốc (m/s) đã đi để hoạt cảnh. */
  protected followPath(dt: number): number {
    if (!this.path || !this.path.length) return 0;
    const p = this.root.position;
    const tgt = this.path[0];
    const dx = tgt.x - p.x;
    const dz = tgt.z - p.z;
    const d = Math.hypot(dx, dz);
    const last = this.path.length === 1;
    const reach = last ? 0.12 : 0.45;
    if (d <= reach) {
      this.path.shift();
      if (!this.path.length) this.stop(true);
      return this.speed * 0.5;
    }
    const step = Math.min(d, this.speed * dt);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    this.yawGoal = Math.atan2(dx, dz);
    // Kẹt (bị chặn quá lâu) → bỏ qua điểm này
    if (d > this.lastD - 0.002) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastD = d;
    if (this.stuckT > 1.2) {
      this.path.shift();
      this.stuckT = 0;
      this.lastD = Infinity;
      if (!this.path.length) this.stop(false);
    }
    return step / Math.max(dt, 1e-4);
  }

  update(dt: number, t: number, world?: World | null): void {
    this.t = t;
    let v = 0;
    const w = this.wander;
    const heed = !!w && !this.talking && t - this.heedT < HEED_GAP;
    if (heed) {
      if (this.path) this.stop(false);
      this.yawGoal = yawTo(this.root.position.x, this.root.position.z, this.heedX, this.heedZ);
      w.next = this.heedT + this.resume;
    } else if (this.path) v = this.followPath(dt);
    else if (w && t >= w.next && !this.talking) {
      const p = this.root.position;
      const avoid = w.avoid?.length ? w.avoid : null;
      const clear = (x: number, z: number) => !avoid || segmentClear(p.x, p.z, x, z, avoid, this.radius);
      const ok = (x: number, z: number) => (!world || world.lineWalkable(p.x, p.z, x, z)) && clear(x, z);
      // Không điểm nào hợp lệ: như cũ thì về tâm vùng – trừ khi đường về tâm xuyên vật trang trí.
      const tgt = pickWanderTarget(w, ok) ?? (clear(w.x, w.z) ? { x: w.x, z: w.z } : null);
      const rest = () => w.pause[0] + Math.random() * (w.pause[1] - w.pause[0]);
      if (!tgt) w.next = t + rest();
      else {
        w.next = Infinity;
        void this.walkTo(tgt.x, tgt.z).then(() => {
          // Bị ngắt giữa chừng (nói chuyện, đứng chờ bé) thì lịch đã được đặt lại – không ghi đè.
          if (this.wander === w && w.next === Infinity) w.next = this.t + rest();
        });
      }
    }
    this.yaw = dampAngle(this.yaw, this.yawGoal, heed ? 5 : 10, dt);
    this.root.rotation.y = this.yaw;
    this.animateModel(dt, t, v);
  }

  protected animateModel(dt: number, t: number, speed: number, extra: Partial<AnimState> = {}): void {
    const a = this.anim;
    a.t = t;
    a.dt = dt;
    a.move = Math.min(1.4, speed / 2.6);
    a.run = speed > 4.6;
    a.air = false;
    a.talk = this.talking;
    a.wave = this.waving;
    a.happy = t < this.happyUntil ? 1 : 0;
    Object.assign(a, extra);
    if (this.rig) animateRig(this.rig, a);
    for (const fn of this.ticks) fn(dt, t);
  }

  /** Vị trí đầu (để đặt nhãn / camera nhìn). */
  headPos(out = tmpV): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.height, this.root.position.z);
  }

  dispose(): void {
    this.stop(false);
    this.root.removeFromParent();
  }
}

/** Thú cưng chạy theo người chơi. */
export class Follower extends Actor {
  /** Góc lệch so với phía sau người dẫn (radian, dương = bên trái). */
  side: number;
  /** Khoảng cách đứng sau người dẫn (m). */
  dist: number;
  private farT = 0;

  constructor(
    key: string,
    private leader: Actor,
    o: ActorOpts & { side?: number; dist?: number } = {},
  ) {
    super(key, { speed: 4, radius: 0.3, ...o });
    this.solid = false;
    this.side = o.side ?? 0.6;
    this.dist = o.dist ?? 1.3;
  }

  update(dt: number, t: number, world?: World | null): void {
    const p = this.root.position;
    const l = this.leader.root.position;
    // Đứng chếch phía sau – bên trái người chơi
    const back = this.leader.yaw + Math.PI + this.side;
    const gx = l.x + Math.sin(back) * this.dist;
    const gz = l.z + Math.cos(back) * this.dist;
    const dx = gx - p.x;
    const dz = gz - p.z;
    const d = Math.hypot(dx, dz);
    let v = 0;
    this.farT = d > 3.2 ? this.farT + dt : 0;
    if (d > 9 || this.farT > 1.6) {
      const w = world?.nearestWalkable(gx, gz, 2) ?? { x: gx, z: gz };
      p.set(w.x, l.y, w.z);
      this.farT = 0;
    } else if (d > 0.35) {
      const sp = Math.min(9, 1.5 + d * 2.4);
      const step = Math.min(d, sp * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      v = step / Math.max(dt, 1e-4);
      this.yawGoal = Math.atan2(dx, dz);
      // Không đi xuyên tường/hàng rào; kẹt lâu thì tự nhảy tới cạnh người dẫn (ở trên).
      if (world) world.resolve(p, this.radius, p.y);
    } else {
      this.yawGoal = yawTo(p.x, p.z, l.x, l.z);
    }
    p.y += (l.y - p.y) * Math.min(1, dt * 8);
    this.yaw = dampAngle(this.yaw, this.yawGoal, 8, dt);
    this.root.rotation.y = this.yaw;
    this.animateModel(dt, t, v);
  }
}
