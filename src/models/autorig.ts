/**
 * Tự dựng khung xương cho nhân vật người dạng chibi tạo bằng AI (tệp GLB không có xương) để bé đi, chạy,
 * vẫy tay, nhảy, reo mừng thật bằng tay chân – không cần Mixamo hay dịch vụ gắn xương trả phí.
 *
 * Yêu cầu mô hình: tư thế chữ A (tay dang ~45°, hở dưới nách), hai chân tách rời (hở giữa hai chân),
 * chân ở y = 0, mặt nhìn về +Z, bên trái nhân vật là +X (đúng hệ tọa độ gốc của mô hình đã chuẩn hóa).
 *
 * Cách làm (chỉ dùng bóng nhìn từ phía trước – nhanh, không phụ thuộc cấu trúc lưới):
 *  1. Chiếu các tam giác lên mặt phẳng XY → lưới bóng (mỗi ô ~ chiều cao / 240).
 *  2. Tìm đường giữa, đáy háng (đỉnh khe giữa hai chân), trục từng chân, nách (đỉnh khe dưới tay),
 *     trục tay, vai, cổ (chỗ thắt hẹp nhất dưới cái đầu to).
 *  3. Gán nhãn từng ô: thân / đầu / tay trái / tay phải / chân trái / chân phải; làm mềm ranh giới theo
 *     khoảng cách đi bên trong bóng (không "nhảy" qua khe hở → tay không dính hông, hai chân không dính nhau).
 *  4. Trọng số da của mỗi đỉnh = nội suy từ lưới.
 * Kết quả: 6 xương theo thứ tự AUTO_BONES (thân xoay quanh hông, đầu quanh cổ, tay quanh vai, chân quanh khớp háng),
 * điều khiển bằng `animateRig` như nhân vật dựng bằng code. Không đủ điều kiện (váy dài che kín chân, tay áp sát
 * thân...) thì `ok = false` và mô hình dùng hoạt cảnh nhún nhảy không xương như các nhân vật AI khác.
 */

export type V3 = [number, number, number];

/** Thứ tự xương (chỉ số trong skinIndex). */
export const AUTO_BONES = ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const;
const BODY = 0;
const HEAD = 1;
const ARM_L = 2;
const ARM_R = 3;
const LEG_L = 4;
const LEG_R = 5;
const NB = 6;

export interface AutoRigMesh {
  /** Vị trí đỉnh (x,y,z liên tiếp) trong hệ gốc mô hình, đơn vị mét. */
  pos: Float32Array;
  /** Chỉ số tam giác (null = không đánh chỉ số). */
  index: ArrayLike<number> | null;
}

export interface AutoRigOpts {
  /** Số ô theo chiều cao (mặc định 240). */
  res?: number;
  /** Giữ lưới nhãn để xem thử (trang dev/rig). */
  debug?: boolean;
}

/** Các điểm neo đo từ hình dáng (mét, hệ gốc mô hình, tư thế chữ A lúc tạo). */
export interface AutoRigAnchors {
  /** Tâm đầu và bán kính theo x (ngang), y (dọc), z (sâu). */
  head: V3;
  headR: V3;
  /** Đỉnh đầu (y). */
  headTop: number;
  /** Mặt trước của mặt (z lớn nhất quanh tâm mặt). */
  faceZ: number;
  neck: V3;
  /** Ngực: độ cao, mặt trước / sau (z), nửa bề ngang thân (không tính tay). */
  chestY: number;
  chestFrontZ: number;
  chestBackZ: number;
  chestHalfW: number;
  shoulderL: V3;
  shoulderR: V3;
  /** Bàn tay (điểm thấp nhất của tay). */
  handL: V3;
  handR: V3;
  pelvis: V3;
}

export interface AutoRigDebug {
  W: number;
  R: number;
  cell: number;
  x0: number;
  y0: number;
  /** Nhãn từng ô (-1 = trống). */
  lab: Int8Array;
  /** Trọng số từng ô (6 số mỗi ô). */
  wts: Float32Array;
  /** Vòng tròn đầu (tâm cột, tâm hàng, bán kính – đơn vị ô). */
  headCircle: [number, number, number];
}

/** Số đo để phát hiện phần lạ gắn vào tay chân (đuôi, áo choàng, váy xòe...). Tay/chân: [trái, phải]. */
export interface AutoRigMetrics {
  /** Độ cao đáy háng (đỉnh khe giữa hai chân) / chiều cao. */
  crotch: number;
  /** Tỉ lệ ô của vùng chân/tay nằm ngoài ống chân/tay khi nhìn từ phía trước. */
  legExtra: [number, number];
  armExtra: [number, number];
  /** Tỉ lệ đỉnh của chân/tay nằm xa phía sau/trước ống chân/tay khi nhìn ngang. */
  legDepth: [number, number];
  armDepth: [number, number];
}

export type AutoRigWarnCode = 'low-crotch' | 'leg-extra' | 'leg-depth' | 'arm-extra' | 'arm-depth';
/** Lý do không dựng được xương: không thấy khe giữa hai chân / dưới tay trái / dưới tay phải / cổ. */
export type AutoRigFail = 'legs' | 'armL' | 'armR' | 'neck';

export interface AutoRigWarning {
  code: AutoRigWarnCode;
  /** 'L' = bên trái nhân vật (+X), 'R' = bên phải. */
  side?: 'L' | 'R';
  value: number;
}

export interface AutoRigResult {
  ok: boolean;
  /** Lý do không dựng được (rỗng khi ok). */
  fail: AutoRigFail[];
  /** Ghi chú khi dò (để gỡ lỗi). */
  notes: string[];
  /** Cảnh báo: dựng được xương nhưng có phần lạ sẽ cử động theo tay chân (xem rigReport). */
  warnings: AutoRigWarning[];
  metrics: AutoRigMetrics;
  height: number;
  legs: boolean;
  arms: boolean;
  joints: { pelvis: V3; neck: V3; shoulderL: V3; shoulderR: V3; hipL: V3; hipR: V3 };
  /** Góc hạ tay sát thân hơn mà bàn tay không chạm hông (rad, tay trái / phải). */
  relax: [number, number];
  /** Góc tay so với phương thẳng đứng trong tư thế lúc tạo (rad, tay trái / phải). */
  armAngle: [number, number];
  /** Trọng số da theo từng lưới: 4 xương mỗi đỉnh. */
  skin: { index: Uint8Array; weight: Float32Array }[];
  anchors: AutoRigAnchors;
  debug?: AutoRigDebug;
  /** Thời gian phân tích (ms). */
  ms: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

interface Run {
  s: number;
  e: number;
}

/** Hàng đợi ưu tiên nhỏ (đống nhị phân) cho Dijkstra trên lưới. */
class Heap {
  private k: number[] = [];
  private d: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, dist: number): void {
    const k = this.k;
    const d = this.d;
    let i = k.length;
    k.push(key);
    d.push(dist);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p] <= dist) break;
      k[i] = k[p];
      d[i] = d[p];
      i = p;
    }
    k[i] = key;
    d[i] = dist;
  }
  pop(): [number, number] {
    const k = this.k;
    const d = this.d;
    const topK = k[0];
    const topD = d[0];
    const lk = k.pop()!;
    const ld = d.pop()!;
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && d[r] < d[l] ? r : l;
        if (d[c] >= ld) break;
        k[i] = k[c];
        d[i] = d[c];
        i = c;
      }
      k[i] = lk;
      d[i] = ld;
    }
    return [topK, topD];
  }
}

const NB8: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Khoảng cách đi trong bóng (ô, 8 hướng) tới vùng nguồn, chỉ đi qua các ô `pass`; tối đa `maxD`.
 * Nguồn: các ô `src` kề với ô `pass` (khoảng cách 0).
 */
function geodesic(W: number, R: number, src: (k: number) => boolean, pass: (k: number) => boolean, maxD: number): Float32Array {
  const dist = new Float32Array(W * R).fill(Infinity);
  const heap = new Heap();
  for (let j = 1; j < R - 1; j++) {
    for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (!src(k)) continue;
      for (const [di, dj] of NB8) {
        if (pass(k + dj * W + di)) {
          dist[k] = 0;
          heap.push(k, 0);
          break;
        }
      }
    }
  }
  while (heap.size) {
    const [k, d] = heap.pop();
    if (d > dist[k]) continue;
    const i = k % W;
    const j = (k - i) / W;
    for (const [di, dj, w] of NB8) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= W || jj >= R) continue;
      const kk = jj * W + ii;
      const nd = d + w;
      if (nd > maxD || nd >= dist[kk] || !pass(kk)) continue;
      dist[kk] = nd;
      heap.push(kk, nd);
    }
  }
  return dist;
}

/** Khoảng cách từ mỗi ô trong bóng tới ô trống gần nhất (chamfer 1–√2, đơn vị ô). */
function insideDist(fill: Uint8Array, W: number, R: number): Float32Array {
  const d = new Float32Array(W * R);
  const S = Math.SQRT2;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= W || j >= R ? 0 : d[j * W + i]);
  for (let k = 0; k < d.length; k++) d[k] = fill[k] ? 1e9 : 0;
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + S, at(i + 1, j - 1) + S);
    }
  }
  for (let j = R - 1; j >= 0; j--) {
    for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + S, at(i - 1, j + 1) + S);
    }
  }
  return d;
}

/** Bình phương tối thiểu x = a + b·y. */
function fitLine(ys: number[], xs: number[]): [number, number] {
  const n = ys.length;
  if (!n) return [0, 0];
  let sy = 0;
  let sx = 0;
  for (let i = 0; i < n; i++) {
    sy += ys[i];
    sx += xs[i];
  }
  const my = sy / n;
  const mx = sx / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (ys[i] - my) * (xs[i] - mx);
    den += (ys[i] - my) ** 2;
  }
  const b = den > 1e-9 ? num / den : 0;
  return [mx - b * my, b];
}

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};

export function autoRig(meshes: AutoRigMesh[], o: AutoRigOpts = {}): AutoRigResult {
  const t0 = now();
  const notes: string[] = [];

  /* ---------------- 1. Lưới bóng nhìn từ phía trước ---------------- */
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of meshes) {
    const p = m.pos;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
    }
  }
  const H = Math.max(1e-3, maxY - minY);
  const RES = o.res ?? 240;
  const c = H / RES;
  const PAD = 3;
  const x0 = minX - PAD * c;
  const y0 = minY - PAD * c;
  const W = Math.ceil((maxX - minX) / c) + 2 * PAD + 1;
  const R = Math.ceil(H / c) + 2 * PAD + 1;
  const N = W * R;
  const fill = new Uint8Array(N);
  const zLo = new Float32Array(N).fill(Infinity);
  const zHi = new Float32Array(N).fill(-Infinity);
  // Tọa độ ô: tâm ô (i, j) ứng với u = i, v = j.
  const U = (x: number) => (x - x0) / c - 0.5;
  const V = (y: number) => (y - y0) / c - 0.5;
  const X = (u: number) => x0 + (u + 0.5) * c;
  const Y = (v: number) => y0 + (v + 0.5) * c;

  for (const m of meshes) {
    const p = m.pos;
    const idx = m.index;
    const nt = idx ? Math.floor(idx.length / 3) : Math.floor(p.length / 9);
    for (let t = 0; t < nt; t++) {
      const a = idx ? idx[3 * t] : 3 * t;
      const b = idx ? idx[3 * t + 1] : 3 * t + 1;
      const cc = idx ? idx[3 * t + 2] : 3 * t + 2;
      const ax = U(p[3 * a]);
      const ay = V(p[3 * a + 1]);
      const bx = U(p[3 * b]);
      const by = V(p[3 * b + 1]);
      const cx = U(p[3 * cc]);
      const cy = V(p[3 * cc + 1]);
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      const sg = area > 0 ? 1 : -1;
      const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx)));
      const i1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy)));
      const j1 = Math.min(R - 1, Math.floor(Math.max(ay, by, cy)));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (((bx - ax) * (j - ay) - (by - ay) * (i - ax)) * sg < -1e-6) continue;
          if (((cx - bx) * (j - by) - (cy - by) * (i - bx)) * sg < -1e-6) continue;
          if (((ax - cx) * (j - cy) - (ay - cy) * (i - cx)) * sg < -1e-6) continue;
          fill[j * W + i] = 1;
        }
      }
    }
    for (let v = 0; v < p.length; v += 3) {
      const k = Math.round(V(p[v + 1])) * W + Math.round(U(p[v]));
      fill[k] = 1;
      if (p[v + 2] < zLo[k]) zLo[k] = p[v + 2];
      if (p[v + 2] > zHi[k]) zHi[k] = p[v + 2];
    }
  }
  // Lấp lỗ thủng 1 ô.
  for (let j = 1; j < R - 1; j++) {
    for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (!fill[k] && ((fill[k - 1] && fill[k + 1]) || (fill[k - W] && fill[k + W]))) fill[k] = 2;
    }
  }

  // Các đoạn liền trên từng hàng.
  const runs: Run[][] = [];
  let top = 0;
  for (let j = 0; j < R; j++) {
    const row: Run[] = [];
    let s = -1;
    for (let i = 0; i <= W; i++) {
      const f = i < W && fill[j * W + i];
      if (f && s < 0) s = i;
      else if (!f && s >= 0) {
        row.push({ s, e: i - 1 });
        s = -1;
      }
    }
    runs.push(row);
    if (row.length) top = j;
  }
  const runAt = (j: number, i: number) => runs[j]?.find((r) => r.s <= i && i <= r.e);
  /** Đoạn gần cột i nhất trên hàng j. */
  const runNear = (j: number, i: number) => {
    let best: Run | undefined;
    let bd = Infinity;
    for (const r of runs[j] ?? []) {
      const d = i < r.s ? r.s - i : i > r.e ? i - r.e : 0;
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  };
  /** z nhỏ nhất / lớn nhất của các đỉnh trong các ô thỏa điều kiện. */
  const zSpan = (j0: number, j1: number, ok: (i: number, j: number) => boolean): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = Math.max(0, j0); j <= Math.min(R - 1, j1); j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (!fill[k] || zLo[k] === Infinity || !ok(i, j)) continue;
        if (zLo[k] < lo) lo = zLo[k];
        if (zHi[k] > hi) hi = zHi[k];
      }
    }
    return [lo, hi];
  };
  const zMid = (span: [number, number], dflt = 0) => (span[0] <= span[1] ? (span[0] + span[1]) / 2 : dflt);

  /* ---------------- 2. Đường giữa & háng ---------------- */
  let sx = 0;
  let sn = 0;
  for (let j = 0; j < R; j++) {
    for (const r of runs[j]) {
      sx += ((r.s + r.e) / 2) * (r.e - r.s + 1);
      sn += r.e - r.s + 1;
    }
  }
  let mid = sn ? sx / sn : W / 2;
  let crotch = -1;
  let gapCol = Math.round(mid);
  {
    let bestLen = 0;
    const limit = Math.floor(R * 0.6);
    for (let col = Math.round(mid) - 6; col <= Math.round(mid) + 6; col++) {
      if (col < 0 || col >= W) continue;
      let len = 0;
      let runLen = 0;
      let topRow = -1;
      for (let j = 0; j < limit; j++) {
        if (!fill[j * W + col]) runLen++;
        else {
          if (runLen > len && j - runLen <= R * 0.3) {
            len = runLen;
            topRow = j;
          }
          runLen = 0;
        }
      }
      if (len > bestLen) {
        bestLen = len;
        crotch = topRow;
        gapCol = col;
      }
    }
    if (bestLen < R * 0.04) {
      notes.push(`không thấy khe giữa hai chân (dài ${bestLen} ô)`);
      crotch = -1;
    }
  }
  const legs = crotch > 0;
  // Tâm khe giữa hai chân (ngay dưới háng) = đường giữa chính xác hơn.
  if (legs) {
    const cs: number[] = [];
    for (let j = Math.max(PAD, crotch - Math.round(R * 0.12)); j < crotch; j++) {
      let s = gapCol;
      let e = gapCol;
      if (fill[j * W + gapCol]) continue;
      while (s > 0 && !fill[j * W + s - 1]) s--;
      while (e < W - 1 && !fill[j * W + e + 1]) e++;
      if (s > 0 && e < W - 1) cs.push((s + e) / 2);
    }
    if (cs.length) mid = median(cs);
    // Háng chính xác: hàng đầu tiên có bóng tại đường giữa (tính từ đáy khe).
    const mc = Math.round(mid);
    let j = crotch - 2;
    while (j > 0 && fill[j * W + mc]) j--;
    while (j < R - 1 && !fill[j * W + mc]) j++;
    crotch = j;
  }
  const midC = Math.round(mid);

  /* ---------------- 3. Chân ---------------- */
  interface HipInfo {
    a: number;
    b: number;
    w: number;
    x: number;
    y: number;
    z: number;
    /** Nửa bề ngang tính từ đường giữa tới mép ngoài chân (ô). */
    outer: number;
  }
  const hip: HipInfo[] = [];
  if (legs) {
    for (const side of [1, -1]) {
      const ys: number[] = [];
      const xs: number[] = [];
      const ws: number[] = [];
      const j0 = Math.max(PAD, Math.round(crotch * 0.35));
      for (let j = j0; j < crotch; j++) {
        // Đoạn liền kề khe giữa về phía `side`.
        const row = runs[j];
        let leg: Run | undefined;
        if (side > 0) leg = row.find((r) => r.s > mid);
        else for (const r of row) if (r.e < mid) leg = r;
        if (!leg) continue;
        ys.push(j);
        xs.push((leg.s + leg.e) / 2);
        ws.push(leg.e - leg.s + 1);
      }
      const [a, b] = fitLine(ys, xs);
      const nTop = Math.max(1, Math.round(ws.length * 0.3));
      const w = ws.slice(-nTop).reduce((s, v) => s + v, 0) / nTop || R * 0.1;
      hip.push({ a, b, w, x: 0, y: 0, z: 0, outer: 0 });
    }
    const wAvg = (hip[0].w + hip[1].w) / 2;
    const hipRow = crotch + 0.3 * wAvg;
    for (const [n, side] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const h = hip[n];
      h.y = hipRow;
      h.x = h.a + h.b * hipRow;
      if (side * (h.x - mid) < h.w * 0.25) h.x = mid + side * h.w * 0.25;
      h.outer = Math.abs(h.x - mid) + h.w / 2;
      h.z = zMid(
        zSpan(crotch - Math.round(R * 0.08), crotch - 1, (i) => side * (i - mid) > 0),
        0,
      );
    }
  }

  /* ---------------- 4. Tay ---------------- */
  interface ArmInfo {
    r0: number;
    r1: number;
    /** Ranh giới thân | tay từng hàng (giữa khe). */
    cut: Map<number, number>;
    a: number;
    b: number;
    d: number;
    sx: number;
    sy: number;
    sz: number;
    dir: [number, number];
    reach: number;
    torsoEdge: number;
  }
  const arms: (ArmInfo | null)[] = [];
  const jLo = legs ? Math.max(PAD, crotch - Math.round(R * 0.3)) : Math.round(R * 0.1);
  const jHi = Math.round(R * 0.85);
  const coreOf = (j: number): Run | undefined => {
    if (!legs || j >= crotch) return runAt(j, midC) ?? runNear(j, midC);
    // Dưới háng: lõi = hai ống chân kề khe giữa.
    const row = runs[j];
    const L = row.find((r) => r.s > mid);
    let Rr: Run | undefined;
    for (const r of row) if (r.e < mid) Rr = r;
    if (!L && !Rr) return undefined;
    return { s: (Rr ?? L)!.s, e: (L ?? Rr)!.e };
  };
  for (const side of [1, -1]) {
    const lat = new Map<number, Run>();
    const cut = new Map<number, number>();
    for (let j = jLo; j <= jHi; j++) {
      const core = coreOf(j);
      if (!core) continue;
      const row = runs[j];
      let r: Run | undefined;
      if (side > 0) r = row.find((x) => x.s > core.e);
      else for (const x of row) if (x.e < core.s) r = x;
      if (r) {
        lat.set(j, r);
        cut.set(j, side > 0 ? (core.e + r.s) / 2 : (r.e + core.s) / 2);
      }
    }
    // Dải hàng liên tiếp có tay tách khỏi thân: chọn dải dài nhất có đỉnh (nách) trên háng.
    let best: [number, number] | null = null;
    let j = jLo;
    while (j <= jHi) {
      if (!lat.has(j)) {
        j++;
        continue;
      }
      const s = j;
      while (lat.has(j + 1)) j++;
      const e = j;
      j++;
      const okTop = e > (legs ? crotch : R * 0.3) && e < R * 0.8;
      // Nách: khe phải khép lại ngay phía trên (tay nối vào thân). Tai, đuôi… kết thúc giữa khoảng trống.
      const cc = Math.round(cut.get(e)!);
      const closes = e + 2 < R && (fill[(e + 1) * W + cc] > 0 || fill[(e + 2) * W + cc] > 0);
      if (okTop && closes && e - s + 1 >= R * 0.05 && (!best || e - s > best[1] - best[0])) best = [s, e];
    }
    if (!best) {
      notes.push(`không thấy khe dưới tay ${side > 0 ? 'trái' : 'phải'}`);
      arms.push(null);
      continue;
    }
    const [r0, r1] = best;
    const ys: number[] = [];
    const xs: number[] = [];
    const ws: number[] = [];
    for (let jj = Math.round(r0 + (r1 - r0) * 0.25); jj <= r1; jj++) {
      const r = lat.get(jj)!;
      ys.push(jj);
      xs.push((r.s + r.e) / 2);
      ws.push(r.e - r.s + 1);
    }
    const [a, b] = fitLine(ys, xs);
    const cosA = 1 / Math.sqrt(1 + b * b);
    const d = (ws.reduce((s, v) => s + v, 0) / ws.length) * cosA;
    const core = coreOf(r1)!;
    const torsoEdge = side > 0 ? core.e : core.s;
    // Vai: nơi trục tay đi vào cạnh thân (giới hạn trong khoảng hợp lý trên nách).
    let syy = Math.abs(b) > 0.05 ? (torsoEdge + 0.5 - a) / b : r1 + 0.6 * d;
    syy = clamp(syy, r1 + 0.3 * d, r1 + 0.9 * d);
    const sxx = a + b * syy;
    const sz = zMid(
      zSpan(r1 - Math.round(d), r1, (i, jj) => side * (i - (cut.get(jj) ?? mid)) > 0),
      0,
    );
    // Hướng dọc theo tay (từ vai xuống bàn tay).
    const len = Math.sqrt(1 + b * b);
    const dir: [number, number] = [-b / len, -1 / len];
    arms.push({ r0, r1, cut, a, b, d, sx: sxx, sy: syy, sz, dir, reach: 0.75 * d, torsoEdge });
  }
  const armOk = !!arms[0] && !!arms[1];

  /* ---------------- 5. Cổ & đầu ---------------- */
  const coreW = new Float32Array(R);
  for (let j = 0; j < R; j++) {
    const r = runAt(j, midC) ?? runNear(j, midC);
    coreW[j] = r ? r.e - r.s + 1 : 0;
  }
  const sw = (j: number) => {
    let s = 0;
    let n = 0;
    for (let k = j - 2; k <= j + 2; k++) {
      if (k < 0 || k >= R) continue;
      s += coreW[k];
      n++;
    }
    return n ? s / n : 0;
  };
  const armTop = Math.max(arms[0]?.r1 ?? 0, arms[1]?.r1 ?? 0, legs ? crotch : 0);
  // Cổ phải cao hơn khớp vai.
  const shTop = Math.max(armTop, Math.ceil(arms[0]?.sy ?? 0), Math.ceil(arms[1]?.sy ?? 0));
  // Đầu = khối tròn lớn đầu tiên tính từ đỉnh xuống: đường tròn nội tiếp lớn nhất trong bóng
  // (bỏ qua chóp nhỏ như quả bông trên mũ).
  const din = insideDist(fill, W, R);
  const D = new Float32Array(R);
  const Dc = new Float32Array(R);
  for (let j = 0; j < R; j++) {
    const r = runAt(j, midC) ?? runNear(j, midC);
    if (!r) continue;
    for (let i = r.s; i <= r.e; i++) {
      const v = din[j * W + i];
      if (v > D[j]) {
        D[j] = v;
        Dc[j] = i;
      }
    }
  }
  const Ds = (j: number) => {
    let s = 0;
    let n = 0;
    for (let k = j - 2; k <= j + 2; k++) {
      if (k < 0 || k >= R) continue;
      s += D[k];
      n++;
    }
    return n ? s / n : 0;
  };
  let dMax = 0;
  for (let j = top; j > shTop; j--) dMax = Math.max(dMax, Ds(j));
  let hc = -1;
  for (let j = top; j > shTop; j--) {
    if (Ds(j) < 0.75 * dMax) continue;
    hc = j;
    while (hc - 1 > shTop && Ds(hc - 1) > Ds(hc)) hc--;
    break;
  }
  const hr = hc > 0 ? Ds(hc) : 0;
  let neck = -1;
  if (hc > 0) {
    // Cổ: hàng hẹp nhất gần đáy vòng tròn đầu (ưu tiên nhẹ đúng đáy vòng tròn khi thân thẳng đuột).
    const want = hc - hr;
    const lo = Math.max(shTop + 1, Math.round(hc - 1.35 * hr));
    const hi = Math.round(hc - 0.55 * hr);
    let best = Infinity;
    for (let j = hi; j >= lo; j--) {
      const s = sw(j) + 0.2 * Math.abs(j - want);
      if (s < best) {
        best = s;
        neck = j;
      }
    }
  }
  if (neck < 0) {
    neck = Math.round(shTop + (top - shTop) * 0.35);
    notes.push('không thấy cổ – ước lượng');
  }
  const neckZ = zMid(zSpan(neck - 2, neck + 2, (i) => Math.abs(i - mid) < coreW[neck] / 2 + 1), 0);
  // Hộp sọ: bề ngang đo ở hàng tâm vòng tròn đầu (tai, bím tóc thường tách khỏi đầu ở đó), giới hạn theo bán kính
  // vòng tròn để bím tóc / tai / búi tóc dính liền không làm đầu "to" ra (mũ, kính sẽ quá rộng, quá cao).
  const headH = Math.max(1, top - neck);
  const hcRow = hc > neck && hc <= top ? hc : Math.round(neck + headH / 2);
  const hrC = hc > 0 ? hr : headH / 2;
  const skullHalf = clamp(coreW[hcRow] / 2, hrC * 0.85, hrC * 1.3);
  const headHalfW = skullHalf * c;
  const inSkull = (i: number) => Math.abs(i - mid) < skullHalf + 1;
  const headSpan = zSpan(neck + 1, top, inSkull);
  // Mặt trước: mũi / má ở nửa dưới đầu (giữa miệng và mắt), chỉ các cột giữa mặt.
  const faceSpan = zSpan(Math.round(neck + headH * 0.18), Math.round(neck + headH * 0.5), (i) => Math.abs(i - mid) < skullHalf * 0.35 + 1);

  /* ---------------- 6. Nhãn từng ô ---------------- */
  const lab = new Int8Array(N).fill(-1);
  const hipL: HipInfo | undefined = hip[0];
  const hipR: HipInfo | undefined = hip[1];
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!fill[k]) continue;
      let L = -1;
      if (j >= neck) L = HEAD;
      else if (armOk) {
        for (let n = 0; n < 2 && L < 0; n++) {
          const A = arms[n]!;
          const side = n === 0 ? 1 : -1;
          if (j >= A.r0 && j <= A.r1) {
            const cu = A.cut.get(j);
            if (cu !== undefined && side * (i - cu) > 0) L = n === 0 ? ARM_L : ARM_R;
          } else if (j > A.r1 && side * (i - mid) > 0) {
            const dx = i - A.sx;
            const dy = j - A.sy;
            const t = dx * A.dir[0] + dy * A.dir[1];
            const q = Math.abs(dx * A.dir[1] - dy * A.dir[0]);
            if (t > 0 && q < A.reach) L = n === 0 ? ARM_L : ARM_R;
          }
        }
      }
      if (L < 0 && legs && hipL && hipR) {
        const side = i > mid ? 1 : -1;
        const h = side > 0 ? hipL : hipR;
        const f = clamp(Math.abs(i - mid) / Math.max(1, h.outer), 0, 1);
        const bound = crotch + (h.y - crotch) * f;
        if (j < bound) L = side > 0 ? LEG_L : LEG_R;
      }
      lab[k] = L < 0 ? BODY : L;
    }
  }

  /* ---------------- 7. Làm mềm ranh giới → trọng số từng ô ---------------- */
  const sigma = new Float32Array(NB);
  sigma[HEAD] = 0.018 * RES;
  const dArm = armOk ? (arms[0]!.d + arms[1]!.d) / 2 : RES * 0.06;
  sigma[ARM_L] = sigma[ARM_R] = clamp(0.4 * dArm, 0.012 * RES, 0.03 * RES);
  sigma[LEG_L] = sigma[LEG_R] = 0.022 * RES;
  const wts = new Float32Array(N * NB);
  {
    const m = new Float32Array(N * NB);
    for (let bn = 1; bn < NB; bn++) {
      const sg = sigma[bn];
      const maxD = sg + 1;
      const isB = (k: number) => lab[k] === bn;
      const notB = (k: number) => lab[k] >= 0 && lab[k] !== bn;
      const dOut = geodesic(W, R, isB, notB, maxD);
      const dIn = geodesic(W, R, notB, isB, maxD);
      for (let k = 0; k < N; k++) {
        if (lab[k] < 0) continue;
        const s = lab[k] === bn ? Math.min(dIn[k], maxD) - 0.5 : -(Math.min(dOut[k], maxD) - 0.5);
        m[k * NB + bn] = smooth(-sg, sg, s);
      }
    }
    for (let k = 0; k < N; k++) {
      if (lab[k] < 0) continue;
      let sum = 0;
      for (let bn = 1; bn < NB; bn++) sum += m[k * NB + bn];
      if (sum > 1) {
        for (let bn = 1; bn < NB; bn++) wts[k * NB + bn] = m[k * NB + bn] / sum;
      } else {
        for (let bn = 1; bn < NB; bn++) wts[k * NB + bn] = m[k * NB + bn];
        wts[k * NB + BODY] = 1 - sum;
      }
    }
  }

  /* ---------------- 8. Góc hạ tay (bàn tay không chạm hông) ---------------- */
  const relax: [number, number] = [0, 0];
  if (armOk) {
    for (let n = 0; n < 2; n++) {
      const A = arms[n]!;
      const side = n === 0 ? 1 : -1;
      const own = n === 0 ? ARM_L : ARM_R;
      const cells: [number, number][] = [];
      const jMax = A.r0 + (A.r1 - A.r0) * 0.6;
      for (let j = A.r0; j <= jMax; j++) {
        const cu = A.cut.get(j);
        if (cu === undefined) continue;
        for (let i = 0; i < W; i++) if (fill[j * W + i] && side * (i - cu) > 0) cells.push([i, j]);
      }
      // Vật cản: phần còn lại (dưới nách), nới rộng một khoảng an toàn ~2 cm.
      const mg = Math.max(1, Math.round(0.012 * RES));
      const ob = new Uint8Array(N);
      const jCap = A.r1 - (A.r1 - A.r0) * 0.25;
      for (let j = 0; j < jCap; j++) {
        for (let i = 0; i < W; i++) {
          const k = j * W + i;
          if (lab[k] < 0 || lab[k] === own) continue;
          for (let dj = -mg; dj <= mg; dj++) {
            const jj = j + dj;
            if (jj < 0 || jj >= R) continue;
            for (let di = -mg; di <= mg; di++) {
              const ii = i + di;
              if (ii >= 0 && ii < W) ob[jj * W + ii] = 1;
            }
          }
        }
      }
      const sgn = -side;
      let ok = 0;
      for (let phi = 0.01; phi <= 0.9; phi += 0.01) {
        const cs = Math.cos(sgn * phi);
        const sn = Math.sin(sgn * phi);
        let hits = 0;
        for (const [i, j] of cells) {
          const dx = i - A.sx;
          const dy = j - A.sy;
          const ii = Math.round(A.sx + dx * cs - dy * sn);
          const jj = Math.round(A.sy + dx * sn + dy * cs);
          if (ii < 0 || jj < 0 || ii >= W || jj >= R) continue;
          if (ob[jj * W + ii]) hits++;
        }
        if (hits > Math.max(2, cells.length * 0.004)) break;
        ok = phi;
      }
      relax[n] = clamp(ok - 0.03, 0, 0.7);
    }
  }

  /* ---------------- 9. Trọng số từng đỉnh ---------------- */
  const skin = meshes.map((m) => {
    const p = m.pos;
    const nv = p.length / 3;
    const index = new Uint8Array(nv * 4);
    const weight = new Float32Array(nv * 4);
    const acc = new Float32Array(NB);
    for (let v = 0; v < nv; v++) {
      const u = U(p[3 * v]);
      const w = V(p[3 * v + 1]);
      const i0 = Math.floor(u);
      const j0 = Math.floor(w);
      const fu = u - i0;
      const fw = w - j0;
      acc.fill(0);
      let ws = 0;
      for (let q = 0; q < 4; q++) {
        const di = q & 1;
        const dj = q >> 1;
        const ii = i0 + di;
        const jj = j0 + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= R) continue;
        const k = jj * W + ii;
        if (lab[k] < 0) continue;
        const f = (di ? fu : 1 - fu) * (dj ? fw : 1 - fw);
        if (f <= 0) continue;
        ws += f;
        for (let bn = 0; bn < NB; bn++) acc[bn] += f * wts[k * NB + bn];
      }
      if (ws < 1e-6) {
        const k = Math.round(w) * W + Math.round(u);
        if (lab[k] >= 0) for (let bn = 0; bn < NB; bn++) acc[bn] = wts[k * NB + bn];
        else acc[BODY] = 1;
      }
      // 4 xương nặng nhất.
      const order = [0, 1, 2, 3, 4, 5].sort((x, y) => acc[y] - acc[x]);
      let tot = 0;
      for (let q = 0; q < 4; q++) tot += acc[order[q]];
      for (let q = 0; q < 4; q++) {
        index[v * 4 + q] = order[q];
        weight[v * 4 + q] = tot > 0 ? acc[order[q]] / tot : q === 0 ? 1 : 0;
      }
    }
    return { index, weight };
  });

  /* ---------------- 10. Khớp & điểm neo (mét) ---------------- */
  const P = (u: number, v: number, z: number): V3 => [X(u), Y(v), z];
  const hipZ = hipL && hipR ? (hipL.z + hipR.z) / 2 : neckZ;
  const pelvis: V3 = hipL ? P(mid, hipL.y, hipZ) : P(mid, armTop * 0.55, hipZ);
  const jHipL: V3 = hipL ? P(hipL.x, hipL.y, hipL.z) : pelvis;
  const jHipR: V3 = hipR ? P(hipR.x, hipR.y, hipR.z) : pelvis;
  const neckP: V3 = P(mid, neck, neckZ);
  const sh = (n: number): V3 => {
    const A = arms[n];
    return A ? P(A.sx, A.sy, A.sz) : P(mid + (n === 0 ? 1 : -1) * coreW[neck], neck - RES * 0.04, neckZ);
  };
  const hand = (n: number): V3 => {
    const A = arms[n];
    if (!A) return sh(n);
    const r = runs[A.r0].find((x) => (n === 0 ? x.s > (A.cut.get(A.r0) ?? mid) : x.e < (A.cut.get(A.r0) ?? mid)));
    const side = n === 0 ? 1 : -1;
    const z = zMid(zSpan(A.r0, A.r0 + Math.round(RES * 0.05), (i, j) => side * (i - (A.cut.get(j) ?? mid)) > 0), A.sz);
    return P(r ? (r.s + r.e) / 2 : A.a + A.b * A.r0, A.r0, z);
  };
  const chestJ = armOk ? Math.round(Math.max(arms[0]!.r1, arms[1]!.r1) * 0.6 + neck * 0.4) : Math.round(neck - RES * 0.08);
  const torsoHalf = armOk ? ((arms[0]!.torsoEdge - arms[1]!.torsoEdge + 1) / 2) * c : coreW[neck] * c;
  const chestSpan = zSpan(chestJ - 2, chestJ + 2, (i) => Math.abs(i - mid) * c < torsoHalf * 0.6);
  const anchors: AutoRigAnchors = {
    head: [X(mid), Y(neck + headH / 2), zMid(headSpan, neckZ)],
    headR: [headHalfW, (headH / 2) * c, headSpan[0] <= headSpan[1] ? (headSpan[1] - headSpan[0]) / 2 : headHalfW],
    headTop: Y(top) + c / 2,
    faceZ: faceSpan[1] > -Infinity ? faceSpan[1] : zMid(headSpan, 0) + headHalfW,
    neck: neckP,
    chestY: Y(chestJ),
    chestFrontZ: chestSpan[1] > -Infinity ? chestSpan[1] : neckZ + torsoHalf,
    chestBackZ: chestSpan[0] < Infinity ? chestSpan[0] : neckZ - torsoHalf,
    chestHalfW: torsoHalf,
    shoulderL: sh(0),
    shoulderR: sh(1),
    handL: hand(0),
    handR: hand(1),
    pelvis,
  };

  /* ---------------- 11. Số đo phần lạ (đuôi, áo choàng, váy xòe...) ---------------- */
  const metrics: AutoRigMetrics = {
    crotch: legs ? (Y(crotch) - minY) / H : 0,
    legExtra: [0, 0],
    armExtra: [0, 0],
    legDepth: [0, 0],
    armDepth: [0, 0],
  };
  // Ống chân nhìn từ trước: đoạn liền kề khe giữa trên từng hàng dưới háng. Bề ngang chuẩn = chân hẹp hơn
  // (đuôi, vạt áo dính vào một chân làm chân đó "to" ra).
  const mains: Map<number, Run>[] = [new Map(), new Map()];
  let wRef = 0;
  if (legs) {
    const wMed: number[] = [];
    for (let n = 0; n < 2; n++) {
      const ws: number[] = [];
      for (let j = PAD; j < crotch; j++) {
        let main: Run | undefined;
        if (n === 0) main = runs[j].find((r) => r.s > mid);
        else for (const r of runs[j]) if (r.e < mid) main = r;
        if (!main) continue;
        mains[n].set(j, main);
        ws.push(main.e - main.s + 1);
      }
      ws.sort((a, b) => a - b);
      wMed.push(median(ws.slice(Math.floor(ws.length * 0.25), Math.ceil(ws.length * 0.75))) || 1);
    }
    wRef = Math.min(wMed[0], wMed[1]);
    for (let n = 0; n < 2; n++) {
      const own = n === 0 ? LEG_L : LEG_R;
      let all = 0;
      let extra = 0;
      for (let j = PAD; j < crotch; j++) {
        const main = mains[n].get(j);
        let inMain = 0;
        for (let i = 0; i < W; i++) {
          if (lab[j * W + i] !== own) continue;
          all++;
          if (main && i >= main.s && i <= main.e) inMain++;
          else extra++;
        }
        extra += Math.max(0, inMain - 1.6 * wRef - 1);
      }
      metrics.legExtra[n] = all ? extra / all : 0;
    }
  }
  if (armOk) {
    for (let n = 0; n < 2; n++) {
      const A = arms[n]!;
      const own = n === 0 ? ARM_L : ARM_R;
      let all = 0;
      let extra = 0;
      for (let k = 0; k < N; k++) {
        if (lab[k] !== own) continue;
        all++;
        const i = k % W;
        const j = (k - i) / W;
        const q = Math.abs((i - A.sx) * A.dir[1] - (j - A.sy) * A.dir[0]);
        if (q > 0.9 * A.d + 1) extra++;
      }
      metrics.armExtra[n] = all ? extra / all : 0;
    }
  }
  // Nhìn ngang: đỉnh thuộc chân/tay (trọng số ≥ 0,5) nằm xa phía sau/trước trục chân/tay (đuôi, vạt áo choàng, váy
  // xòe sẽ đung đưa theo chân). Trục chân lấy ở lõi ống chân (sát khe giữa, dưới háng, trên bàn chân).
  {
    const yCrotch = legs ? Y(crotch) - 2 * c : -Infinity;
    const yFoot = legs ? minY + (yCrotch - minY) * 0.3 : -Infinity;
    const zs: number[][] = [[], [], [], []];
    const ys: number[][] = [[], [], [], []];
    const core: number[][] = [[], [], [], []];
    meshes.forEach((m, mi) => {
      const sk = skin[mi];
      const p = m.pos;
      for (let v = 0; v < p.length / 3; v++) {
        const b = sk.index[v * 4];
        if (b < ARM_L || sk.weight[v * 4] < 0.5) continue;
        const q = b - ARM_L;
        const y = p[3 * v + 1];
        if (q >= 2) {
          const j = Math.round(V(y));
          const i = U(p[3 * v]);
          const main = mains[q - 2].get(j);
          if (main && y >= yFoot && (q === 2 ? i >= main.s - 0.5 && i <= main.s + wRef : i <= main.e + 0.5 && i >= main.e - wRef)) core[q].push(p[3 * v + 2]);
        } else core[q].push(p[3 * v + 2]);
        zs[q].push(p[3 * v + 2]);
        ys[q].push(y);
      }
    });
    for (let q = 0; q < 4; q++) {
      const z = zs[q];
      if (z.length < 20) continue;
      const isLeg = q >= 2;
      const n = q & 1;
      const zc = core[q].length >= 10 ? median(core[q]) : median(z);
      const dia = (isLeg ? wRef : arms[n]?.d ?? 0) * c;
      if (!(dia > 0)) continue;
      let far = 0;
      for (let i = 0; i < z.length; i++) {
        const dz = z[i] - zc;
        // Mũi giày chìa ra trước.
        if (dz < -1.1 * dia || dz > (isLeg && ys[q][i] < yFoot ? 2.2 : 1.1) * dia) far++;
      }
      (isLeg ? metrics.legDepth : metrics.armDepth)[n] = far / z.length;
    }
  }
  const fail: AutoRigFail[] = [];
  if (!legs) fail.push('legs');
  if (!arms[0]) fail.push('armL');
  if (!arms[1]) fail.push('armR');
  if (!(neck > armTop)) fail.push('neck');
  const ok = !fail.length;
  const res: AutoRigResult = {
    ok,
    fail,
    notes,
    warnings: rigWarnings(ok, metrics),
    metrics,
    height: H,
    legs,
    arms: armOk,
    joints: { pelvis, neck: neckP, shoulderL: sh(0), shoulderR: sh(1), hipL: jHipL, hipR: jHipR },
    relax,
    armAngle: [arms[0] ? Math.atan(Math.abs(arms[0].b)) : 0, arms[1] ? Math.atan(Math.abs(arms[1].b)) : 0],
    skin,
    anchors,
    ms: 0,
  };
  if (o.debug) res.debug = { W, R, cell: c, x0, y0, lab, wts, headCircle: [hc > 0 ? Dc[hc] : midC, hc, hr] };
  res.ms = now() - t0;
  return res;
}

/* ------------------------------------------------------------------ */
/* Cảnh báo & kết luận "đi bằng chân" hay "nhún" (dùng chung cho game,  */
/* công cụ xử lý mô hình và lệnh kiểm tra)                              */
/* ------------------------------------------------------------------ */

/** Ngưỡng cảnh báo / quyết định nhún. */
export const RIG_LIMITS = {
  /** Đáy háng thấp hơn tỉ lệ này của chiều cao → cảnh báo váy, áo choàng dài che chân. */
  crotchWarn: 0.12,
  /** Thấp hơn nữa → chân quá ngắn để bước: nhún. */
  crotchHop: 0.06,
  /** Tỉ lệ phần lạ dính vào tay/chân (nhìn trước / nhìn ngang) → cảnh báo. */
  extra: 0.05,
  depth: 0.05,
};

function rigWarnings(ok: boolean, m: AutoRigMetrics): AutoRigWarning[] {
  const out: AutoRigWarning[] = [];
  if (!ok) return out;
  if (m.crotch < RIG_LIMITS.crotchWarn) out.push({ code: 'low-crotch', value: m.crotch });
  const sets = [
    ['leg-extra', m.legExtra, RIG_LIMITS.extra],
    ['leg-depth', m.legDepth, RIG_LIMITS.depth],
    ['arm-extra', m.armExtra, RIG_LIMITS.extra],
    ['arm-depth', m.armDepth, RIG_LIMITS.depth],
  ] as const;
  for (const [code, v, lim] of sets) {
    for (let n = 0; n < 2; n++) if (v[n] > lim) out.push({ code, side: n === 0 ? 'L' : 'R', value: v[n] });
  }
  return out;
}

export interface RigVerdict {
  /** true = đi bằng chân (xương tự dựng); false = nhún nhảy như các nhân vật AI khác. */
  walk: boolean;
  /** Giải thích cho cô (tiếng Việt): lý do và cách sửa; rỗng khi mọi thứ ổn. */
  lines: string[];
}

const SIDE_VI = { L: 'trái của bé (bên phải ảnh)', R: 'phải của bé (bên trái ảnh)' } as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Kết luận từ kết quả dò: bé đi bằng chân hay nhún, kèm lý do và cách sửa. */
export function rigReport(r: Pick<AutoRigResult, 'ok' | 'fail' | 'warnings' | 'metrics'>): RigVerdict {
  const lines: string[] = [];
  if (!r.ok) {
    if (r.fail.includes('legs'))
      lines.push('Không thấy khe hở giữa hai chân (váy dài hoặc áo choàng che kín chân?). Cách sửa: hai chân tách rời, hở rõ giữa hai chân; váy, áo choàng ngắn trên đầu gối.');
    for (const s of ['L', 'R'] as const) {
      if (r.fail.includes(s === 'L' ? 'armL' : 'armR'))
        lines.push(`Không thấy khe hở dưới tay ${SIDE_VI[s]} (tay áp sát người, tay áo rộng hoặc áo choàng che kín nách?). Cách sửa: tay dang chéo xuống khoảng 45°, hở rõ dưới mỗi nách.`);
    }
    if (r.fail.includes('neck')) lines.push('Không tìm được cổ (đầu thấp hơn vai?). Cách sửa: đứng thẳng, đầu ở trên hai vai, mặt nhìn thẳng phía trước.');
    return { walk: false, lines };
  }
  if (r.metrics.crotch < RIG_LIMITS.crotchHop) {
    lines.push(`Khe giữa hai chân chỉ bắt đầu ở ${pct(r.metrics.crotch)} chiều cao (váy hoặc áo choàng gần chạm đất): chân quá ngắn để bước. Cách sửa: váy, áo choàng ngắn trên đầu gối.`);
    return { walk: false, lines };
  }
  const seen = new Set<string>();
  for (const w of r.warnings) {
    if (w.code === 'low-crotch') {
      lines.push(`Khe giữa hai chân bắt đầu thấp (${pct(w.value)} chiều cao): váy hoặc áo choàng che phần trên của chân nên chân chỉ cử động từ mép váy trở xuống. Đẹp hơn khi váy, áo choàng ngắn trên đầu gối.`);
      continue;
    }
    const leg = w.code.startsWith('leg');
    const id = `${leg}${w.side}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const side = SIDE_VI[w.side ?? 'L'];
    lines.push(
      leg
        ? `Có phần lạ dính vào chân ${side} (đuôi, vạt áo choàng, váy xòe...): phần đó sẽ đung đưa theo bước chân. Cách sửa: bỏ đuôi, áo choàng dài hoặc để chúng không chạm vào chân.`
        : `Có phần lạ dính vào tay ${side} (tay áo rộng, vạt áo choàng, đồ cầm tay...): phần đó sẽ đung đưa theo tay. Cách sửa: tay không cầm gì, tay áo gọn, áo choàng hẹp và chỉ dài tới thắt lưng.`,
    );
  }
  return { walk: true, lines };
}

/** Phiên bản cách dò xương: tăng khi đổi thuật toán để công cụ dò lại mô hình cũ. */
export const RIG_VERSION = 2;

/**
 * Kết quả dò xương lưu sẵn trong config.json (công cụ xử lý mô hình tính trước, trọng số da nằm trong GLB:
 * thuộc tính _SKIN_INDEX, _SKIN_WEIGHT). Tọa độ: hệ của mô hình gốc đã xoay `rotY` độ quanh trục đứng, chưa co giãn.
 */
export interface BakedRig {
  v: number;
  rotY: number;
  ok: boolean;
  walk: boolean;
  fail: AutoRigFail[];
  warnings: AutoRigWarning[];
  metrics: AutoRigMetrics;
  height: number;
  joints: AutoRigResult['joints'];
  relax: [number, number];
  armAngle: [number, number];
  anchors: AutoRigAnchors;
}

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
const roundDeep = <T>(x: T): T =>
  (typeof x === 'number' ? r5(x) : Array.isArray(x) ? x.map(roundDeep) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, roundDeep(v)])) : x) as T;

/** Gói kết quả dò để lưu (bỏ trọng số từng đỉnh, làm tròn số). */
export function bakeRig(res: AutoRigResult, rotY: number): BakedRig {
  return roundDeep({
    v: RIG_VERSION,
    rotY,
    ok: res.ok,
    walk: rigReport(res).walk,
    fail: res.fail,
    warnings: res.warnings,
    metrics: res.metrics,
    height: res.height,
    joints: res.joints,
    relax: res.relax,
    armAngle: res.armAngle,
    anchors: res.anchors,
  });
}

type Placeable = Pick<AutoRigResult, 'joints' | 'anchors' | 'height'>;

/** Đưa khớp và điểm neo sang hệ khác: p' = s·p + t (co giãn đều rồi dời). */
export function placeRig<T extends Placeable>(r: T, s: number, t: V3): T {
  const P = (p: V3): V3 => [s * p[0] + t[0], s * p[1] + t[1], s * p[2] + t[2]];
  const J = r.joints;
  const A = r.anchors;
  return {
    ...r,
    height: r.height * s,
    joints: { pelvis: P(J.pelvis), neck: P(J.neck), shoulderL: P(J.shoulderL), shoulderR: P(J.shoulderR), hipL: P(J.hipL), hipR: P(J.hipR) },
    anchors: {
      head: P(A.head),
      headR: [A.headR[0] * s, A.headR[1] * s, A.headR[2] * s],
      headTop: A.headTop * s + t[1],
      faceZ: A.faceZ * s + t[2],
      neck: P(A.neck),
      chestY: A.chestY * s + t[1],
      chestFrontZ: A.chestFrontZ * s + t[2],
      chestBackZ: A.chestBackZ * s + t[2],
      chestHalfW: A.chestHalfW * s,
      shoulderL: P(A.shoulderL),
      shoulderR: P(A.shoulderR),
      handL: P(A.handL),
      handR: P(A.handR),
      pelvis: P(A.pelvis),
    },
  };
}