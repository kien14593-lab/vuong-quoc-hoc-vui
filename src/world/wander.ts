import type { Body } from './collide';

/**
 * Các phép tính thuần (không cần cảnh 3D) cho NPC đi lang thang và camera câu đố:
 *  - chọn điểm đi tiếp không xuyên qua vật trang trí (luống hoa, bụi cây thấp...),
 *  - góc camera "qua vai" bé và tìm góc nhìn thoáng khi bị che.
 */

const DEG = Math.PI / 180;

/** Hiệu hai góc, đưa về (−π, π]. */
export function angDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Khoảng cách có dấu từ điểm (x,z) tới mép vật (âm = nằm trong). */
export function bodyDist(b: Body, x: number, z: number): number {
  const dx = x - b.x;
  const dz = z - b.z;
  if (b.kind === 'circle') return Math.hypot(dx, dz) - b.r;
  // Tọa độ cục bộ của hộp (giống World.inside)
  const ex = Math.abs(dx * b.c - dz * b.s) - b.hw;
  const ez = Math.abs(dx * b.s + dz * b.c) - b.hd;
  return ex > 0 || ez > 0 ? Math.hypot(Math.max(ex, 0), Math.max(ez, 0)) : Math.max(ex, ez);
}

/**
 * Đi thẳng từ a tới b với thân rộng bán kính `m` có chạm vật nào trong `bodies` không.
 * NPC lỡ đứng sát/đè lên một vật vẫn được đi ra xa, chỉ không được lấn sâu thêm.
 */
export function segmentClear(ax: number, az: number, bx: number, bz: number, bodies: readonly Body[], m: number): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 0.1));
  const minX = Math.min(ax, bx) - m;
  const maxX = Math.max(ax, bx) + m;
  const minZ = Math.min(az, bz) - m;
  const maxZ = Math.max(az, bz) + m;
  for (const b of bodies) {
    if (!b.on || b.x + b.r < minX || b.x - b.r > maxX || b.z + b.r < minZ || b.z - b.r > maxZ) continue;
    if (bodyDist(b, bx, bz) < m) return false;
    const lim = Math.min(m, bodyDist(b, ax, az) - 1e-3);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (bodyDist(b, ax + (bx - ax) * t, az + (bz - az) * t) < lim) return false;
    }
  }
  return true;
}

/** Chọn điểm đi lang thang: thử vài điểm ngẫu nhiên trong vùng tròn, lấy điểm đầu tiên `ok`. */
export function pickWanderTarget(
  w: { x: number; z: number; r: number },
  ok: (x: number, z: number) => boolean,
  rnd: () => number = Math.random,
  tries = 6,
): { x: number; z: number } | null {
  for (let i = 0; i < tries; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * w.r;
    const x = w.x + Math.cos(a) * r;
    const z = w.z + Math.sin(a) * r;
    if (ok(x, z)) return { x, z };
  }
  return null;
}

/** Góc camera đứng sau lưng bé nhìn về NPC (camera ở phía +Z khi yaw = 0, giống FollowCam). */
export function behindYaw(nx: number, nz: number, kx: number, kz: number): number {
  return Math.atan2(kx - nx, kz - nz);
}

/**
 * Góc camera "qua vai" khi bé nói chuyện với NPC: sau lưng bé, lệch sang một bên `off` để thấy mặt NPC
 * 3/4 mà bé không che. Chọn bên gần góc camera hiện tại (xoay ít nhất).
 */
export function shoulderYaw(nx: number, nz: number, kx: number, kz: number, cur: number, off = 40 * DEG): number {
  if (Math.hypot(kx - nx, kz - nz) < 0.05) return cur;
  const line = behindYaw(nx, nz, kx, kz);
  const a = line + off;
  const b = line - off;
  return Math.abs(angDiff(a, cur)) <= Math.abs(angDiff(b, cur)) ? a : b;
}

/** Thứ tự thử góc: `base`, rồi ±step, ±2·step… tới ±max; cùng độ lệch thì phía gần `prefer` trước. */
export function* yawOrder(base: number, prefer = base, step = 20 * DEG, max = 80 * DEG): Generator<number> {
  yield base;
  const side = angDiff(prefer, base) >= 0 ? 1 : -1;
  for (let k = step; k <= max + 1e-9; k += step) {
    yield base + side * k;
    yield base - side * k;
  }
}

/**
 * Tìm góc camera nhìn thoáng, chấm điểm từng góc theo `yawOrder` (điểm = số chỗ trên NPC/vật nhìn thấy):
 * lấy góc đầu tiên đạt `full`; không góc nào đạt thì lấy góc điểm cao nhất (gần `base` nhất);
 * mọi góc đều 0 điểm → null.
 */
export function bestYaw(base: number, score: (yaw: number) => number, full: number, prefer = base, step = 20 * DEG, max = 80 * DEG): number | null {
  let best: number | null = null;
  let top = 0;
  for (const y of yawOrder(base, prefer, step, max)) {
    const s = score(y);
    if (s >= full) return y;
    if (s > top) {
      top = s;
      best = y;
    }
  }
  return best;
}
