import type { Collider } from '../models/registry';

/**
 * Va chạm & tìm đường cho thế giới 3D (mặt phẳng XZ).
 *  - Vật cản: hình tròn / hộp xoay, có thể có "mặt trên" (top) để nhảy lên đứng.
 *  - Lưới địa hình (0.5 m): ô bị chặn bởi nước, ngoài biên...
 *  - Lưới tìm đường = địa hình + vật cản (đã nới theo bán kính nhân vật), A* 8 hướng + làm mượt.
 */
export interface Body {
  kind: 'circle' | 'box';
  x: number;
  z: number;
  /** Bán kính (hình tròn) hoặc bán kính bao (hộp). */
  r: number;
  hw: number;
  hd: number;
  c: number;
  s: number;
  /** Độ cao mặt trên có thể đứng; Infinity = tường. */
  top: number;
  on: boolean;
  tag?: string;
  /** Lưu dấu khi truy vấn (tránh trùng). */
  _q?: number;
}

const CELL = 4;
const key = (ix: number, iz: number) => (ix + 2048) * 8192 + (iz + 2048);

export interface Bounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export class World {
  readonly bodies: Body[] = [];
  private hash = new Map<number, Body[]>();
  private qstamp = 1;
  readonly res = 0.5;
  readonly w: number;
  readonly h: number;
  /** 1 = địa hình chặn (nước, vực, ngoài biên). */
  readonly terrain: Uint8Array;
  /** 1 = không đi được khi tìm đường. */
  private solid: Uint8Array;
  private solidDirty = true;
  /** Bán kính nhân vật dùng để nới vật cản khi tìm đường. */
  agentR = 0.42;

  constructor(readonly bounds: Bounds) {
    this.w = Math.ceil((bounds.maxX - bounds.minX) / this.res);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / this.res);
    this.terrain = new Uint8Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
  }

  /* ---------------- Vật cản ---------------- */
  add(b: Body): Body {
    this.bodies.push(b);
    this.insert(b);
    this.solidDirty = true;
    return b;
  }

  private insert(b: Body): void {
    const x0 = Math.floor((b.x - b.r) / CELL);
    const x1 = Math.floor((b.x + b.r) / CELL);
    const z0 = Math.floor((b.z - b.r) / CELL);
    const z1 = Math.floor((b.z + b.r) / CELL);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = key(ix, iz);
        let arr = this.hash.get(k);
        if (!arr) this.hash.set(k, (arr = []));
        arr.push(b);
      }
  }

  remove(b: Body): void {
    const i = this.bodies.indexOf(b);
    if (i < 0) return;
    this.bodies.splice(i, 1);
    for (const arr of this.hash.values()) {
      const j = arr.indexOf(b);
      if (j >= 0) arr.splice(j, 1);
    }
    this.markDirty(b);
  }

  /** Bật/tắt một vật cản (cửa mở, đá vỡ...). */
  setOn(b: Body, on: boolean): void {
    if (b.on === on) return;
    b.on = on;
    this.markDirty(b);
  }

  circle(x: number, z: number, r: number, top = Infinity, tag?: string): Body {
    return this.add({ kind: 'circle', x, z, r, hw: r, hd: r, c: 1, s: 0, top, on: true, tag });
  }

  box(x: number, z: number, w: number, d: number, rotY = 0, top = Infinity, tag?: string): Body {
    const hw = w / 2;
    const hd = d / 2;
    return this.add({ kind: 'box', x, z, r: Math.hypot(hw, hd), hw, hd, c: Math.cos(rotY), s: Math.sin(rotY), top, on: true, tag });
  }

  /** Đăng ký các vật cản khai báo trong mô hình (theo vị trí/góc/tỉ lệ đặt). */
  addColliders(cols: Collider[] | undefined, x: number, z: number, rotY = 0, scale = 1, tag?: string): Body[] {
    if (!cols) return [];
    const out: Body[] = [];
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    for (const col of cols) {
      const ax = (col.at?.[0] ?? 0) * scale;
      const az = (col.at?.[1] ?? 0) * scale;
      // Xoay quanh trục Y (giống Object3D.rotation.y)
      const wx = x + ax * c + az * s;
      const wz = z - ax * s + az * c;
      const top = col.top !== undefined ? col.top * scale : Infinity;
      if (col.kind === 'circle') out.push(this.circle(wx, wz, col.r * scale, top, tag));
      else out.push(this.box(wx, wz, col.w * scale, col.d * scale, rotY + ((col.rot ?? 0) * Math.PI) / 180, top, tag));
    }
    return out;
  }

  /** Các vật cản gần một điểm. */
  query(x: number, z: number, r: number, out: Body[] = []): Body[] {
    out.length = 0;
    const st = ++this.qstamp;
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL);
    const z1 = Math.floor((z + r) / CELL);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const arr = this.hash.get(key(ix, iz));
        if (!arr) continue;
        for (const b of arr) {
          if (b._q === st || !b.on) continue;
          b._q = st;
          out.push(b);
        }
      }
    return out;
  }

  /** Điểm (x,z) nằm trong vật cản b (nới thêm m)? */
  static inside(b: Body, x: number, z: number, m = 0): boolean {
    const dx = x - b.x;
    const dz = z - b.z;
    if (b.kind === 'circle') return dx * dx + dz * dz < (b.r + m) * (b.r + m);
    // Tọa độ cục bộ của hộp (nghịch đảo phép xoay Y)
    const lx = dx * b.c - dz * b.s;
    const lz = dx * b.s + dz * b.c;
    if (m <= 0) return Math.abs(lx) < b.hw + m && Math.abs(lz) < b.hd + m;
    const ex = Math.max(0, Math.abs(lx) - b.hw);
    const ez = Math.max(0, Math.abs(lz) - b.hd);
    return ex * ex + ez * ez < m * m;
  }

  private tmp: Body[] = [];

  /**
   * Đẩy hình tròn (x,z,r) ra khỏi các vật cản đang chặn ở độ cao y.
   * Trả về true nếu có va chạm.
   */
  resolve(p: { x: number; z: number }, r: number, y: number): boolean {
    let hit = false;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      const list = this.query(p.x, p.z, r + 3, this.tmp);
      for (const b of list) {
        if (y >= b.top - 0.06) continue;
        const dx = p.x - b.x;
        const dz = p.z - b.z;
        if (b.kind === 'circle') {
          const rr = b.r + r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.0001;
          const push = rr - d;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
          moved = hit = true;
        } else {
          const lx = dx * b.c - dz * b.s;
          const lz = dx * b.s + dz * b.c;
          const cx = Math.max(-b.hw, Math.min(b.hw, lx));
          const cz = Math.max(-b.hd, Math.min(b.hd, lz));
          let nx = lx - cx;
          let nz = lz - cz;
          const d2 = nx * nx + nz * nz;
          if (d2 >= r * r) continue;
          let px: number;
          let pz: number;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            px = (nx / d) * (r - d);
            pz = (nz / d) * (r - d);
          } else {
            // Tâm nằm trong hộp: đẩy ra theo cạnh gần nhất
            const ox = b.hw - Math.abs(lx);
            const oz = b.hd - Math.abs(lz);
            if (ox < oz) {
              nx = Math.sign(lx) || 1;
              px = nx * (ox + r);
              pz = 0;
            } else {
              nz = Math.sign(lz) || 1;
              px = 0;
              pz = nz * (oz + r);
            }
          }
          // Về tọa độ thế giới
          p.x += px * b.c + pz * b.s;
          p.z += -px * b.s + pz * b.c;
          moved = hit = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  /** Độ cao mặt đứng tại (x,z) cho nhân vật đang ở độ cao y (chỉ tính mặt trên thấp hơn y + bước). */
  groundAt(x: number, z: number, r: number, y: number, step = 0.12): number {
    let g = 0;
    const list = this.query(x, z, r + 3, this.tmp);
    for (const b of list) {
      if (b.top === Infinity || b.top > y + step) continue;
      if (World.inside(b, x, z, r * 0.35) && b.top > g) g = b.top;
    }
    return g;
  }

  /* ---------------- Lưới địa hình ---------------- */
  cellOf(x: number, z: number): number {
    const ix = Math.floor((x - this.bounds.minX) / this.res);
    const iz = Math.floor((z - this.bounds.minZ) / this.res);
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return -1;
    return iz * this.w + ix;
  }

  cellCenter(i: number, out: { x: number; z: number }): { x: number; z: number } {
    out.x = this.bounds.minX + ((i % this.w) + 0.5) * this.res;
    out.z = this.bounds.minZ + (Math.floor(i / this.w) + 0.5) * this.res;
    return out;
  }

  /** Đánh dấu địa hình bằng một hàm (true = chặn). */
  paintTerrain(fn: (x: number, z: number) => boolean | undefined, value = 1): void {
    const { minX, minZ } = this.bounds;
    for (let iz = 0; iz < this.h; iz++)
      for (let ix = 0; ix < this.w; ix++) {
        const x = minX + (ix + 0.5) * this.res;
        const z = minZ + (iz + 0.5) * this.res;
        if (fn(x, z)) this.terrain[iz * this.w + ix] = value;
      }
    this.solidDirty = true;
  }

  terrainBlocked(x: number, z: number): boolean {
    const i = this.cellOf(x, z);
    return i < 0 || this.terrain[i] === 1;
  }

  /** Hình tròn có chạm vào địa hình bị chặn không (kiểm tra 9 điểm). */
  circleBlocked(x: number, z: number, r: number): boolean {
    if (this.terrainBlocked(x, z)) return true;
    const k = r * 0.7071;
    return (
      this.terrainBlocked(x + r, z) ||
      this.terrainBlocked(x - r, z) ||
      this.terrainBlocked(x, z + r) ||
      this.terrainBlocked(x, z - r) ||
      this.terrainBlocked(x + k, z + k) ||
      this.terrainBlocked(x - k, z + k) ||
      this.terrainBlocked(x + k, z - k) ||
      this.terrainBlocked(x - k, z - k)
    );
  }

  /* ---------------- Tìm đường ---------------- */
  private markDirty(b: Body): void {
    if (this.solidDirty) return;
    this.rebuildSolid(b.x - b.r - 1, b.z - b.r - 1, b.x + b.r + 1, b.z + b.r + 1);
  }

  private rebuildSolid(x0 = this.bounds.minX, z0 = this.bounds.minZ, x1 = this.bounds.maxX, z1 = this.bounds.maxZ): void {
    const { minX, minZ } = this.bounds;
    const ix0 = Math.max(0, Math.floor((x0 - minX) / this.res));
    const iz0 = Math.max(0, Math.floor((z0 - minZ) / this.res));
    const ix1 = Math.min(this.w - 1, Math.ceil((x1 - minX) / this.res));
    const iz1 = Math.min(this.h - 1, Math.ceil((z1 - minZ) / this.res));
    const m = this.agentR;
    const list: Body[] = [];
    for (let iz = iz0; iz <= iz1; iz++)
      for (let ix = ix0; ix <= ix1; ix++) {
        const i = iz * this.w + ix;
        if (this.terrain[i]) {
          this.solid[i] = 1;
          continue;
        }
        const x = minX + (ix + 0.5) * this.res;
        const z = minZ + (iz + 0.5) * this.res;
        let s = 0;
        this.query(x, z, m + 0.5, list);
        for (const b of list) {
          if (b.top < 0.25) continue;
          if (World.inside(b, x, z, m)) {
            s = 1;
            break;
          }
        }
        this.solid[i] = s;
      }
  }

  private ensureSolid(): void {
    if (!this.solidDirty) return;
    this.solidDirty = false;
    this.rebuildSolid();
  }

  walkableCell(i: number): boolean {
    this.ensureSolid();
    return i >= 0 && this.solid[i] === 0;
  }

  walkable(x: number, z: number): boolean {
    return this.walkableCell(this.cellOf(x, z));
  }

  /** Ô đi được gần nhất (tìm theo vòng xoắn tới bán kính maxR mét). */
  nearestWalkable(x: number, z: number, maxR = 5): { x: number; z: number } | null {
    this.ensureSolid();
    const c = this.cellOf(x, z);
    if (c >= 0 && this.solid[c] === 0) return { x, z };
    const n = Math.ceil(maxR / this.res);
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    const ix0 = Math.floor((x - this.bounds.minX) / this.res);
    const iz0 = Math.floor((z - this.bounds.minZ) / this.res);
    for (let r = 1; r <= n; r++) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ix = ix0 + dx;
          const iz = iz0 + dz;
          if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) continue;
          const i = iz * this.w + ix;
          if (this.solid[i]) continue;
          const p = this.cellCenter(i, { x: 0, z: 0 });
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
      if (best) return best;
    }
    return null;
  }

  /** Đường thẳng giữa hai điểm có đi được không (kiểm tra theo bước nửa ô). */
  lineWalkable(ax: number, az: number, bx: number, bz: number): boolean {
    this.ensureSolid();
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / (this.res * 0.5)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const c = this.cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
      if (c < 0 || this.solid[c]) return false;
    }
    return true;
  }

  private gScore = new Float32Array(0);
  private came = new Int32Array(0);
  private stamp = new Uint32Array(0);
  private closed = new Uint32Array(0);
  private gen = 0;

  /** A* trên lưới, trả về danh sách điểm (đã làm mượt), hoặc null nếu không tới được. */
  findPath(ax: number, az: number, bx: number, bz: number, maxNodes = 40000): { x: number; z: number }[] | null {
    this.ensureSolid();
    const goalP = this.nearestWalkable(bx, bz, 4);
    if (!goalP) return null;
    const startP = this.nearestWalkable(ax, az, 2) ?? { x: ax, z: az };
    if (this.lineWalkable(startP.x, startP.z, goalP.x, goalP.z)) return [goalP];
    const N = this.w * this.h;
    if (this.gScore.length !== N) {
      this.gScore = new Float32Array(N);
      this.came = new Int32Array(N);
      this.stamp = new Uint32Array(N);
      this.closed = new Uint32Array(N);
    }
    const gen = ++this.gen;
    const s = this.cellOf(startP.x, startP.z);
    const g = this.cellOf(goalP.x, goalP.z);
    if (s < 0 || g < 0) return null;
    const W = this.w;
    const gx = g % W;
    const gz = Math.floor(g / W);
    const heur = (i: number) => {
      const dx = Math.abs((i % W) - gx);
      const dz = Math.abs(Math.floor(i / W) - gz);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    // Đống nhị phân (min-heap) theo f
    const heap: number[] = [];
    const fval: number[] = [];
    const push = (i: number, f: number) => {
      heap.push(i);
      fval.push(f);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (fval[p] <= fval[k]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        [fval[p], fval[k]] = [fval[k], fval[p]];
        k = p;
      }
    };
    const pop = (): number => {
      const top = heap[0];
      const li = heap.pop()!;
      const lf = fval.pop()!;
      if (heap.length) {
        heap[0] = li;
        fval[0] = lf;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && fval[l] < fval[m]) m = l;
          if (r < heap.length && fval[r] < fval[m]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          [fval[m], fval[k]] = [fval[k], fval[m]];
          k = m;
        }
      }
      return top;
    };
    this.stamp[s] = gen;
    this.gScore[s] = 0;
    this.came[s] = -1;
    push(s, heur(s));
    let found = false;
    let count = 0;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1];
    const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      const cur = pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === g) {
        found = true;
        break;
      }
      if (++count > maxNodes) break;
      const cx = cur % W;
      const cz = Math.floor(cur / W);
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k];
        const nz = cz + DZ[k];
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const ni = nz * W + nx;
        if (this.solid[ni] || this.closed[ni] === gen) continue;
        if (k >= 4 && (this.solid[cz * W + nx] || this.solid[nz * W + cx])) continue;
        const ng = this.gScore[cur] + (k >= 4 ? Math.SQRT2 : 1);
        if (this.stamp[ni] === gen && ng >= this.gScore[ni]) continue;
        this.stamp[ni] = gen;
        this.gScore[ni] = ng;
        this.came[ni] = cur;
        push(ni, ng + heur(ni));
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let c = g; c !== -1; c = this.came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => this.cellCenter(c, { x: 0, z: 0 }));
    pts[pts.length - 1] = goalP;
    // Làm mượt: kéo dây
    const out: { x: number; z: number }[] = [];
    let anchor = { x: ax, z: az };
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineWalkable(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j;
    }
    if (!out.length) out.push(goalP);
    return out;
  }

  /** Vẽ lưới đi được lên canvas (gỡ lỗi / bản đồ nhỏ). */
  debugCanvas(): HTMLCanvasElement {
    this.ensureSolid();
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) {
      const v = this.terrain[i] ? 40 : this.solid[i] ? 140 : 255;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/** Tiện ích: hướng nhìn (rotation.y) để đối tượng ở (x,z) quay mặt (+Z) về phía (tx,tz). */
export function yawTo(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(tx - x, tz - z);
}
