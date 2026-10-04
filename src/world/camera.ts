import * as THREE from 'three';
import { engine } from '../engine/core';
import { clamp, damp, dampAngle } from '../engine/tween';
import { inputBlocked } from '../ui/root';
import { keys, onInputReset } from './input';

/**
 * Camera nhìn chéo từ trên cao, bám theo nhân vật.
 *  - Kéo chuột/ngón tay (hoặc chuột phải) để xoay quanh nhân vật; kéo dọc để đổi độ cao góc nhìn.
 *  - Lăn chuột / chụm hai ngón để phóng to – thu nhỏ.
 *  - Phím Q / , và . để xoay 45°.
 *  - Chạm nhanh (không kéo) → `onTap` (đi tới / tương tác).
 */
export interface CamOpts {
  /** Góc xoay ban đầu (độ). 0 = camera ở phía +Z nhìn về -Z. */
  yaw?: number;
  /** Góc nhìn xuống (độ). */
  pitch?: number;
  dist?: number;
  minDist?: number;
  maxDist?: number;
  fov?: number;
  /** Độ cao điểm nhìn so với chân nhân vật. */
  lookY?: number;
}

const DEG = Math.PI / 180;
const DRAG_PX = 9;

export class FollowCam {
  readonly camera: THREE.PerspectiveCamera;
  yaw: number;
  yawGoal: number;
  pitch: number;
  pitchGoal: number;
  dist: number;
  distGoal: number;
  minDist: number;
  maxDist: number;
  lookY: number;
  readonly target = new THREE.Vector3();
  readonly goal = new THREE.Vector3();
  /** Gọi khi chạm nhanh lên cảnh (tọa độ client). */
  onTap: ((x: number, y: number) => void) | null = null;
  /** Đang điều khiển bằng kịch bản (tạm khóa kéo xoay). */
  locked = false;
  /** Đẩy nhân vật xuống thấp trên màn hình (tỉ lệ chiều cao màn hình) – nhường chỗ cho thẻ đề bài ở trên. */
  shiftGoal = 0;
  private shift = 0;
  private shakeA = 0;
  private shakeT = 0;
  private focus: { pos: THREE.Vector3; dist: number | null; k: number; goal: number } | null = null;
  private offs: (() => void)[] = [];
  private ptrs = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; btn: number }>();
  private dragging = false;
  private pinch0 = 0;
  private dist0 = 0;
  private tmp = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(o: CamOpts = {}) {
    this.camera = new THREE.PerspectiveCamera(o.fov ?? 38, engine.w / engine.h, 0.3, 320);
    this.yaw = this.yawGoal = (o.yaw ?? 0) * DEG;
    this.pitch = this.pitchGoal = (o.pitch ?? 50) * DEG;
    this.minDist = o.minDist ?? 9;
    this.maxDist = o.maxDist ?? 26;
    this.dist = this.distGoal = clamp(o.dist ?? 16, this.minDist, this.maxDist);
    this.lookY = o.lookY ?? 1.0;
    this.attach();
  }

  /** Đặt ngay (không trượt) vào vị trí bám theo. */
  snap(p: THREE.Vector3): void {
    this.goal.set(p.x, p.y + this.lookY, p.z);
    this.target.copy(this.goal);
    this.yaw = this.yawGoal;
    this.pitch = this.pitchGoal;
    this.dist = this.distGoal;
    this.place(0);
  }

  follow(p: THREE.Vector3): void {
    this.goal.set(p.x, p.y + this.lookY, p.z);
  }

  /** Xoay thêm một góc (độ), mượt. */
  rotate(deg: number): void {
    this.yawGoal += deg * DEG;
  }

  zoom(f: number): void {
    this.distGoal = clamp(this.distGoal * f, this.minDist, this.maxDist);
  }

  shake(amount = 0.25, dur = 0.4): void {
    this.shakeA = Math.max(this.shakeA, amount);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  /** Hướng camera nhìn tới (đã chiếu xuống mặt đất), dùng để quy đổi phím di chuyển. */
  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  right(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  /** Cảnh quay: lướt camera tới nhìn một điểm (chờ `hold` giây), rồi trả về. */
  async showPoint(pos: THREE.Vector3 | [number, number, number], o: { dist?: number; hold?: number; speed?: number } = {}): Promise<void> {
    const p = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone();
    this.focus = { pos: p, dist: o.dist ?? null, k: 0, goal: 1 };
    const speed = o.speed ?? 1.6;
    await this.waitFocus(1, speed);
    await new Promise((r) => setTimeout(r, (o.hold ?? 1.2) * 1000));
    if (this.focus) this.focus.goal = 0;
    await this.waitFocus(0, speed);
    this.focus = null;
  }

  /** Giữ camera nhìn một điểm cho đến khi gọi `release()`. */
  hold(pos: THREE.Vector3 | [number, number, number], dist?: number): void {
    const p = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone();
    this.focus = { pos: p, dist: dist ?? null, k: this.focus?.k ?? 0, goal: 1 };
  }

  async release(): Promise<void> {
    if (!this.focus) return;
    this.focus.goal = 0;
    await this.waitFocus(0, 1.6);
    this.focus = null;
  }

  private waitFocus(goal: number, _speed: number): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.focus || Math.abs(this.focus.k - goal) < 0.02) {
          if (this.focus) this.focus.k = goal;
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  update(dt: number): void {
    if (!inputBlocked() && !this.locked) {
      if (keys.consume('KeyQ', 'Comma')) this.rotate(-45);
      if (keys.consume('Period')) this.rotate(45);
      if (keys.consume('Equal', 'NumpadAdd')) this.zoom(0.85);
      if (keys.consume('Minus', 'NumpadSubtract')) this.zoom(1.18);
    }
    this.yaw = dampAngle(this.yaw, this.yawGoal, 9, dt);
    this.pitch = damp(this.pitch, this.pitchGoal, 9, dt);
    this.dist = damp(this.dist, this.distGoal, 8, dt);
    this.target.x = damp(this.target.x, this.goal.x, 7, dt);
    this.target.y = damp(this.target.y, this.goal.y, 5, dt);
    this.target.z = damp(this.target.z, this.goal.z, 7, dt);
    if (this.focus) this.focus.k = damp(this.focus.k, this.focus.goal, 3.2, dt);
    this.shift = damp(this.shift, this.shiftGoal, 3.5, dt);
    this.place(dt);
  }

  private place(dt: number): void {
    let dist = this.dist;
    this.look.copy(this.target);
    if (this.focus && this.focus.k > 0.001) {
      const k = this.focus.k * this.focus.k * (3 - 2 * this.focus.k);
      this.look.lerp(this.focus.pos, k);
      if (this.focus.dist) dist = dist + (this.focus.dist - dist) * k;
    }
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    if (Math.abs(this.shift) > 1e-4) {
      // Tịnh tiến cả camera theo trục "lên" của màn hình → cảnh trượt xuống, không đổi góc nhìn.
      const s = this.shift * 2 * dist * Math.tan((this.camera.fov * DEG) / 2);
      this.look.x -= Math.sin(this.yaw) * sp * s;
      this.look.y += cp * s;
      this.look.z -= Math.cos(this.yaw) * sp * s;
    }
    this.tmp.set(Math.sin(this.yaw) * cp * dist, sp * dist, Math.cos(this.yaw) * cp * dist);
    this.camera.position.copy(this.look).add(this.tmp);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, Math.min(1, this.shakeT * 3));
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      this.camera.position.z += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
    this.camera.lookAt(this.look);
  }

  /* ---------------- Điều khiển chuột / chạm ---------------- */
  private attach(): void {
    const el = engine.canvas;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      // Ngón tay / chuột đầu tiên của một lần chạm mới: bỏ các ngón cũ còn sót (lỡ mất sự kiện nhấc tay) để không bị "chụm" nhầm.
      if (e.isPrimary) {
        this.ptrs.clear();
        this.dragging = false;
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* bỏ qua */
      }
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), btn: e.button });
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        this.dist0 = this.distGoal;
        this.dragging = true;
      }
    };
    const move = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.ptrs.size >= 2) {
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch0 > 10 && !this.locked) this.distGoal = clamp((this.dist0 * this.pinch0) / Math.max(10, d), this.minDist, this.maxDist);
        return;
      }
      if (!this.dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > DRAG_PX) this.dragging = true;
      if (this.dragging && !this.locked && !inputBlocked()) {
        const s = 1 / Math.max(1, Math.min(engine.w, engine.h));
        this.yawGoal -= dx * s * 4.2;
        this.pitchGoal = clamp(this.pitchGoal + dy * s * 2.2, 28 * DEG, 78 * DEG);
      }
    };
    const up = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      this.ptrs.delete(e.pointerId);
      const quick = performance.now() - p.t < 600;
      if (!this.dragging && quick && p.btn === 0 && this.ptrs.size === 0) this.onTap?.(e.clientX, e.clientY);
      if (this.ptrs.size === 0) this.dragging = false;
    };
    const cancel = (e: PointerEvent) => {
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size === 0) this.dragging = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (this.locked || inputBlocked()) return;
      this.zoom(1 + clamp(e.deltaY, -200, 200) * 0.0011);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    el.addEventListener('wheel', wheel, { passive: false });
    this.offs.push(
      () => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('lostpointercapture', cancel);
        el.removeEventListener('wheel', wheel);
      },
      onInputReset(() => {
        this.ptrs.clear();
        this.dragging = false;
      }),
    );
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.ptrs.clear();
    this.onTap = null;
  }
}
