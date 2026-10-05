import * as THREE from 'three';
import { sfx } from '../core/audio';
import { item } from '../core/items';
import type { Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { damp } from '../engine/tween';
import type { PlayerOpts } from '../models/character';
import { buildModel } from '../models/registry';
import { Actor } from './actor';
import type { FollowCam } from './camera';
import type { World } from './collide';
import { K, keys, moveVector, virtualMag } from './input';

/**
 * Nhân vật người chơi: đi bằng phím (theo hướng camera) hoặc chạm/nhấp để đi tới,
 * Shift để chạy, Space để nhảy; ván trượt giúp đi nhanh hơn.
 * Có "bóng xuyên tường": khi bị cây/nhà che, vẫn thấy hình bóng nhân vật.
 */
const WALK = 4.6;
const RUN = 7.2;
const GRAV = 24;
const JUMP_V = 7.6;

const xrayMat = new THREE.MeshBasicMaterial({
  color: '#7a63ff',
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  depthFunc: THREE.GreaterDepth,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
});
xrayMat.userData.shared = true;

/**
 * Đánh dấu stencil cho các lưới nhân vật + thêm lớp hình bóng vẽ khi bị che.
 * Bé AI có lưới bóng (bản rút gọn, glb.ts): hình bóng vẽ bằng lưới bóng cho nhẹ (chỉ là bóng mờ, lệch dưới 1 cm).
 */
function addXray(root: THREE.Object3D): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.xray && !m.userData.shadowProxy) meshes.push(m);
  });
  const cloned = new Map<THREE.Material, THREE.Material>();
  for (const m of meshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mt) => {
      let c = cloned.get(mt);
      if (!c) {
        c = mt.clone();
        c.userData = { ...mt.userData, shared: false };
        c.stencilWrite = true;
        c.stencilRef = 1;
        c.stencilFunc = THREE.AlwaysStencilFunc;
        c.stencilZPass = THREE.ReplaceStencilOp;
        cloned.set(mt, c);
      }
      return c;
    });
    m.material = Array.isArray(m.material) ? next : next[0];
    const proxy = m.children.find((c) => c.userData.shadowProxy) as THREE.Mesh | undefined;
    const geo = proxy?.geometry ?? m.geometry;
    const sm = m as THREE.SkinnedMesh;
    let x: THREE.Mesh;
    if (sm.isSkinnedMesh) {
      // Bé AI có xương: hình bóng cũng uốn theo xương (cùng bộ xương, ma trận gắn & khung bao – khỏi tính lại từng đỉnh).
      const xs = new THREE.SkinnedMesh(geo, xrayMat);
      xs.bind(sm.skeleton, sm.bindMatrix);
      xs.frustumCulled = false;
      xs.boundingBox = sm.boundingBox?.clone() ?? null;
      xs.boundingSphere = sm.boundingSphere?.clone() ?? null;
      x = xs;
    } else x = new THREE.Mesh(geo, xrayMat);
    x.userData.xray = true;
    x.renderOrder = 50;
    x.castShadow = false;
    x.receiveShadow = false;
    x.raycast = () => {};
    m.add(x);
  }
}

/** Dựng mô hình bé (chưa gắn vào cảnh): có thể chuẩn bị trước (warmUp) rồi mới thay bằng `Player.refresh`. */
export function buildLook(kid: Kid, eq: Equipped): THREE.Object3D {
  const next = buildModel<PlayerOpts>('player', { kid, eq });
  addXray(next);
  return next;
}

/** Bỏ một mô hình bé: hủy vật liệu riêng (vật liệu dùng chung giữ lại). */
export function disposeLook(old: THREE.Object3D): void {
  old.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.xray) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) if (!mt.userData.shared) mt.dispose();
    }
  });
}

export class Player extends Actor {
  vy = 0;
  grounded = true;
  readonly vel = new THREE.Vector3();
  /** Đang bị kịch bản điều khiển (cắt cảnh) – bỏ qua phím. */
  scripted = false;
  board: THREE.Object3D | null = null;
  private stepT = 0;
  private airT = 0;
  private tmpF = new THREE.Vector3();
  private tmpR = new THREE.Vector3();
  private tmpP = { x: 0, z: 0 };

  constructor(kid: Kid, eq: Equipped, o: { x?: number; z?: number; rot?: number } = {}) {
    super('player', { opts: { kid, eq } satisfies PlayerOpts, x: o.x, z: o.z, rot: o.rot, speed: WALK, radius: 0.42 });
    addXray(this.model);
    this.setBoard(!!eq.board, eq.board);
  }

  /** Thay bé (trai/gái), bộ đồ, mũ, balo, phụ kiện. `next`: mô hình dựng sẵn bằng `buildLook` (đã chuẩn bị trước). */
  refresh(kid: Kid, eq: Equipped, next = buildLook(kid, eq)): void {
    disposeLook(this.swapModel(next));
    this.setBoard(!!eq.board, eq.board);
  }

  setBoard(on: boolean, id: string | null = null): void {
    if (this.board) {
      this.board.removeFromParent();
      this.board = null;
    }
    this.model.position.y = 0;
    if (!on) return;
    const color = (id && item(id)?.color) || undefined;
    this.board = buildModel('board_skate', color ? { color } : {});
    this.board.position.y = 0.02;
    this.root.add(this.board);
    this.model.position.y = 0.16;
  }

  get speedMul(): number {
    return this.board ? 1.3 : 1;
  }

  /** Điều khiển mỗi khung hình. `blocked`: đang mở giao diện (không nhận phím). */
  control(dt: number, t: number, cam: FollowCam, world: World, blocked: boolean): void {
    const p = this.root.position;
    let wantX = 0;
    let wantZ = 0;
    let running = false;
    if (!blocked && !this.scripted) {
      const mv = moveVector();
      const mag = Math.hypot(mv.x, mv.y);
      if (mag > 0.06) {
        if (this.path) this.stop(false);
        cam.forward(this.tmpF);
        cam.right(this.tmpR);
        wantX = (this.tmpR.x * mv.x - this.tmpF.x * mv.y) / mag;
        wantZ = (this.tmpR.z * mv.x - this.tmpF.z * mv.y) / mag;
        const vm = virtualMag();
        running = keys.isDown(...K.run) || vm > 0.92;
        const sp = (running ? RUN : WALK) * this.speedMul * (vm > 0 ? Math.max(0.45, Math.min(1, mag * 1.15)) : 1);
        wantX *= sp;
        wantZ *= sp;
      }
      if (keys.consume(...K.jump)) this.jump();
    } else if (blocked && !this.scripted && this.path) {
      // Mở giao diện thì dừng tự đi
      this.stop(false);
    }

    // Đi theo đường (chạm để đi / kịch bản)
    if (this.path && !wantX && !wantZ) {
      const tgt = this.path[0];
      const dx = tgt.x - p.x;
      const dz = tgt.z - p.z;
      const d = Math.hypot(dx, dz);
      const last = this.path.length === 1;
      if (d < (last ? 0.15 : 0.5)) {
        this.path.shift();
        if (!this.path.length) this.stop(true);
      } else {
        const sp = (this.scripted ? this.speed : WALK * 1.08) * this.speedMul;
        const k = last ? Math.min(1, d / 0.6) : 1;
        wantX = (dx / d) * sp * Math.max(0.35, k);
        wantZ = (dz / d) * sp * Math.max(0.35, k);
      }
    }

    // Vận tốc mượt
    const acc = this.grounded ? 16 : 6;
    this.vel.x = damp(this.vel.x, wantX, acc, dt);
    this.vel.z = damp(this.vel.z, wantZ, acc, dt);
    if (!wantX && !wantZ && Math.abs(this.vel.x) + Math.abs(this.vel.z) < 0.05) this.vel.set(0, 0, 0);

    // Di chuyển + va chạm
    const nx = p.x + this.vel.x * dt;
    const nz = p.z + this.vel.z * dt;
    const r = this.radius;
    const tp = this.tmpP;
    tp.x = nx;
    tp.z = nz;
    world.resolve(tp, r, p.y);
    if (world.circleBlocked(tp.x, tp.z, r * 0.8)) {
      // Trượt theo từng trục
      tp.x = nx;
      tp.z = p.z;
      world.resolve(tp, r, p.y);
      if (world.circleBlocked(tp.x, tp.z, r * 0.8)) {
        tp.x = p.x;
        tp.z = nz;
        world.resolve(tp, r, p.y);
        if (world.circleBlocked(tp.x, tp.z, r * 0.8)) {
          tp.x = p.x;
          tp.z = p.z;
        }
      }
    }
    const moved = Math.hypot(tp.x - p.x, tp.z - p.z) / Math.max(dt, 1e-4);
    p.x = tp.x;
    p.z = tp.z;
    // Kẹt khi đang tự đi → bỏ
    if (this.path && moved < 0.2 && Math.hypot(wantX, wantZ) > 1) {
      this.airT += dt;
      if (this.airT > 0.8) {
        this.airT = 0;
        this.path.shift();
        if (!this.path.length) this.stop(false);
      }
    }

    // Trọng lực + mặt đứng
    const ground = world.groundAt(p.x, p.z, r, p.y + 0.01);
    if (!this.grounded || p.y > ground + 0.01) {
      this.vy -= GRAV * dt;
      p.y += this.vy * dt;
      if (p.y <= ground) {
        p.y = ground;
        if (!this.grounded && this.vy < -2) sfx('land');
        this.vy = 0;
        this.grounded = true;
      } else this.grounded = false;
    } else {
      p.y = ground;
      this.vy = 0;
      this.grounded = true;
    }

    // Hướng mặt
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > 0.3) this.yawGoal = Math.atan2(this.vel.x, this.vel.z);
    this.yaw = dampAngleFast(this.yaw, this.yawGoal, dt);
    this.root.rotation.y = this.yaw;

    // Tiếng bước chân
    if (this.grounded && moved > 0.5) {
      this.stepT -= dt * (moved / WALK);
      if (this.stepT <= 0) {
        this.stepT = 0.36;
        sfx('step');
      }
    }
    if (this.board) this.board.rotation.z = this.grounded ? Math.sin(t * 6) * 0.02 * Math.min(1, moved / 3) : 0;
    this.animateModel(dt, t, this.board ? Math.min(moved, 1.2) : moved, { air: !this.grounded, ride: !!this.board, run: running && moved > 4 });
  }

  /** Nhảy (nếu đang đứng trên mặt đất). */
  jump(): boolean {
    if (!this.grounded || this.scripted) return false;
    this.vy = JUMP_V;
    this.grounded = false;
    sfx('jump');
    return true;
  }

  /** Đi tới một điểm (chạm để đi). */
  goTo(x: number, z: number, world: World): Promise<boolean> {
    return this.walkTo(x, z, world);
  }
}

function dampAngleFast(a: number, b: number, dt: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-14 * dt));
}
