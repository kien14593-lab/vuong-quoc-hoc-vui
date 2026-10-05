import type { Body } from './collide';

/**
 * Các phép tính thuần (không cần cảnh 3D) cho NPC đi lang thang:
 * chọn điểm đi tiếp không xuyên qua vật trang trí (luống hoa, bụi cây thấp...).
 */

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
