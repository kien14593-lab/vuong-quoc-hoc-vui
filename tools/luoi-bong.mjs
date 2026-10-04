/**
 * Lưới bóng của bé (nhân vật chính) và bộ đồ – công cụ xử lý mô hình (tools/xu-ly-mo-hinh.mjs) làm sẵn khi lắp.
 *
 * Mỗi khung hình, ngoài lần vẽ chính, trò chơi còn vẽ bé thêm 2 lần: vẽ bóng đổ dưới nắng và vẽ hình bóng tím khi
 * bé đi sau nhà, cây. Hai lần đó không cần chi tiết: lưới bóng là lưới thưa hơn nhiều, dùng chung đỉnh với lưới thật
 * (chỉ thêm danh sách tam giác riêng), lệch so với lưới thật không quá SAI_SO (1 cm ở chiều cao thật của bé) – bóng
 * và hình bóng trông y như cũ mà đỡ vẽ phần lớn tam giác.
 *
 * Trong tệp .glb: cạnh mỗi phần lưới của bé có thêm một phần lưới bóng (primitive) với extras.proxy = PHIEN_BAN,
 * dùng chung POSITION, NORMAL với phần lưới thật, vật liệu "bong" trong suốt hoàn toàn (mở tệp bằng trình xem GLB
 * khác cũng không thấy). Trò chơi (src/models/glb.ts) tách lưới bóng ra khi nạp.
 *
 *   await lamLuoiBong(doc, 1.7);   // sau meshopt(): làm (lại) lưới bóng; null nếu không đáng làm
 *   coLuoiBong(doc);               // tệp đã có lưới bóng đúng phiên bản chưa
 *   boLuoiBong(doc);               // bỏ lưới bóng (trước khi xử lý lại)
 */
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

/** Đổi khi cách làm lưới bóng thay đổi: mô hình đã lắp sẽ được làm lại lưới bóng ở lần chạy công cụ sau. */
export const PHIEN_BAN = 1;
/** Lệch tối đa cho phép so với lưới thật (mét, ở chiều cao thật của bé). */
export const SAI_SO = 0.01;
const TRIANGLES = 4;
/** Lưới bóng phải bỏ được ít nhất một nửa số tam giác mới đáng làm. */
const TOI_DA = 0.5;
/** Khoảng cách rải điểm đo trên tam giác lưới bóng (mét). */
const BUOC_DO = 0.015;

/** Phần lưới này là lưới bóng. */
export function laLuoiBong(prim) {
  return Boolean(prim.getExtras()?.proxy);
}

/** Phần lưới làm được lưới bóng: tam giác, có chỉ số, có POSITION. */
function hopLe(prim) {
  return prim.getMode() === TRIANGLES && Boolean(prim.getIndices()) && Boolean(prim.getAttribute('POSITION')) && !laLuoiBong(prim);
}

/** Bỏ mọi lưới bóng (cùng chỉ số, vật liệu không còn ai dùng). Trả về số phần đã bỏ. */
export function boLuoiBong(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      if (!laLuoiBong(p)) continue;
      const idx = p.getIndices();
      const mat = p.getMaterial();
      mesh.removePrimitive(p);
      p.dispose();
      // Chỉ còn Root giữ → không ai dùng nữa.
      if (idx && idx.listParents().length <= 1) idx.dispose();
      if (mat && mat.listParents().length <= 1) mat.dispose();
      n++;
    }
  }
  return n;
}

/** Tệp đã có lưới bóng đúng phiên bản cho mọi phần lưới làm được. */
export function coLuoiBong(doc) {
  let co = false;
  for (const mesh of doc.getRoot().listMeshes()) {
    const prims = mesh.listPrimitives();
    const bong = prims.filter(laLuoiBong);
    const that = prims.filter((p) => !laLuoiBong(p));
    for (const b of bong) {
      if (b.getExtras().proxy !== PHIEN_BAN) return false;
      const pos = b.getAttribute('POSITION');
      if (!pos || !that.some((p) => p.getAttribute('POSITION') === pos)) return false;
      co = true;
    }
    for (const p of that) {
      if (hopLe(p) && !bong.some((b) => b.getAttribute('POSITION') === p.getAttribute('POSITION'))) return false;
    }
  }
  return co;
}

/* ------------------------------------------------------------------ */
/* Đo độ lệch giữa hai lưới                                             */
/* ------------------------------------------------------------------ */

/** Lưới ô vuông cạnh `o` chứa các tam giác (dạng nén CSR: start[ô]..start[ô+1] trong list). */
function chiaO(pos, tri, o) {
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < tri.length; i++) {
    const v = 3 * tri[i];
    x0 = Math.min(x0, pos[v]);
    x1 = Math.max(x1, pos[v]);
    y0 = Math.min(y0, pos[v + 1]);
    y1 = Math.max(y1, pos[v + 1]);
    z0 = Math.min(z0, pos[v + 2]);
    z1 = Math.max(z1, pos[v + 2]);
  }
  const nx = Math.max(1, Math.floor((x1 - x0) / o) + 1);
  const ny = Math.max(1, Math.floor((y1 - y0) / o) + 1);
  const nz = Math.max(1, Math.floor((z1 - z0) / o) + 1);
  const g = { x0, y0, z0, o, nx, ny, nz, start: new Uint32Array(nx * ny * nz + 1), list: null };
  const cell = (val, lo, n) => Math.min(n - 1, Math.max(0, Math.floor((val - lo) / o)));
  const range = (t) => {
    const a = 3 * tri[t];
    const b = 3 * tri[t + 1];
    const c = 3 * tri[t + 2];
    return [
      cell(Math.min(pos[a], pos[b], pos[c]), x0, nx),
      cell(Math.max(pos[a], pos[b], pos[c]), x0, nx),
      cell(Math.min(pos[a + 1], pos[b + 1], pos[c + 1]), y0, ny),
      cell(Math.max(pos[a + 1], pos[b + 1], pos[c + 1]), y0, ny),
      cell(Math.min(pos[a + 2], pos[b + 2], pos[c + 2]), z0, nz),
      cell(Math.max(pos[a + 2], pos[b + 2], pos[c + 2]), z0, nz),
    ];
  };
  for (let pass = 0; pass < 2; pass++) {
    const at = pass ? g.start.slice() : null;
    for (let t = 0; t < tri.length; t += 3) {
      const [xa, xb, ya, yb, za, zb] = range(t);
      for (let x = xa; x <= xb; x++)
        for (let y = ya; y <= yb; y++)
          for (let z = za; z <= zb; z++) {
            const c = (x * ny + y) * nz + z;
            if (pass) g.list[at[c]++] = t / 3;
            else g.start[c + 1]++;
          }
    }
    if (!pass) {
      for (let c = 0; c < nx * ny * nz; c++) g.start[c + 1] += g.start[c];
      g.list = new Uint32Array(g.start[nx * ny * nz]);
    }
  }
  return g;
}

/** Bình phương khoảng cách từ điểm p tới tam giác abc (điểm gần nhất – Ericson, Real-Time Collision Detection). */
function kc2(px, py, pz, pos, a, b, c) {
  const ax = pos[a];
  const ay = pos[a + 1];
  const az = pos[a + 2];
  const abx = pos[b] - ax;
  const aby = pos[b + 1] - ay;
  const abz = pos[b + 2] - az;
  const acx = pos[c] - ax;
  const acy = pos[c + 1] - ay;
  const acz = pos[c + 2] - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
  const bpx = px - pos[b];
  const bpy = py - pos[b + 1];
  const bpz = pz - pos[b + 2];
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    const x = apx - v * abx;
    const y = apy - v * aby;
    const z = apz - v * abz;
    return x * x + y * y + z * z;
  }
  const cpx = px - pos[c];
  const cpy = py - pos[c + 1];
  const cpz = pz - pos[c + 2];
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    const x = apx - w * acx;
    const y = apy - w * acy;
    const z = apz - w * acz;
    return x * x + y * y + z * z;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const x = bpx - w * (pos[c] - pos[b]);
    const y = bpy - w * (pos[c + 1] - pos[b + 1]);
    const z = bpz - w * (pos[c + 2] - pos[b + 2]);
    return x * x + y * y + z * z;
  }
  const s = va + vb + vc;
  // Tam giác suy biến (diện tích ~0): lấy đỉnh gần nhất (không bao giờ đo thiếu).
  if (!(s > 0)) return Math.min(apx * apx + apy * apy + apz * apz, bpx * bpx + bpy * bpy + bpz * bpz, cpx * cpx + cpy * cpy + cpz * cpz);
  const v = vb / s;
  const w = vc / s;
  const x = apx - abx * v - acx * w;
  const y = apy - aby * v - acy * w;
  const z = apz - abz * v - acz * w;
  return x * x + y * y + z * z;
}

/**
 * Bộ đo khoảng cách từ một điểm tới lưới `tri` (tối đa `tran`). Dừng sớm khi đã thấy tam giác gần hơn `du`
 * (điểm đó không làm độ lệch lớn nhất tăng thêm).
 */
function boDo(pos, tri, tran) {
  const g = chiaO(pos, tri, tran);
  const stamp = new Int32Array(tri.length / 3).fill(-1);
  let q = 0;
  return (px, py, pz, du) => {
    q++;
    const ix = Math.floor((px - g.x0) / g.o);
    const iy = Math.floor((py - g.y0) / g.o);
    const iz = Math.floor((pz - g.z0) / g.o);
    const xa = Math.max(0, ix - 1);
    const xb = Math.min(g.nx - 1, ix + 1);
    const ya = Math.max(0, iy - 1);
    const yb = Math.min(g.ny - 1, iy + 1);
    const za = Math.max(0, iz - 1);
    const zb = Math.min(g.nz - 1, iz + 1);
    const du2 = du * du;
    let best = tran * tran;
    for (let x = xa; x <= xb; x++)
      for (let y = ya; y <= yb; y++)
        for (let z = za; z <= zb; z++) {
          const c = (x * g.ny + y) * g.nz + z;
          for (let k = g.start[c]; k < g.start[c + 1]; k++) {
            const t = g.list[k];
            if (stamp[t] === q) continue;
            stamp[t] = q;
            const d = kc2(px, py, pz, pos, 3 * tri[3 * t], 3 * tri[3 * t + 1], 3 * tri[3 * t + 2]);
            if (d < best) {
              best = d;
              if (best <= du2) return Math.sqrt(best);
            }
          }
        }
    return Math.sqrt(best);
  };
}

/**
 * Độ lệch lớn nhất (hai chiều) giữa lưới gốc `goc` và lưới bóng `bong` (cùng mảng đỉnh `pos`, đơn vị mét):
 * đỉnh và tâm tam giác của lưới gốc → lưới bóng; điểm rải đều trên tam giác lưới bóng → lưới gốc.
 * Lệch từ `tran` trở lên trả về `tran`.
 */
export function saiLech(pos, goc, bong, tran = 0.02) {
  let du = 0;
  // Chiều 1: lưới gốc → lưới bóng.
  const toiBong = boDo(pos, bong, tran);
  const dung = new Uint8Array(pos.length / 3);
  for (let i = 0; i < goc.length; i++) dung[goc[i]] = 1;
  for (let v = 0; v < dung.length; v++) {
    if (!dung[v]) continue;
    du = Math.max(du, toiBong(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], du));
    if (du >= tran) return tran;
  }
  for (let t = 0; t < goc.length; t += 3) {
    const a = 3 * goc[t];
    const b = 3 * goc[t + 1];
    const c = 3 * goc[t + 2];
    du = Math.max(du, toiBong((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3, du));
    if (du >= tran) return tran;
  }
  // Chiều 2: lưới bóng → lưới gốc (góc tam giác là đỉnh gốc – bỏ qua).
  const toiGoc = boDo(pos, goc, tran);
  const len = (i, j) => Math.hypot(pos[i] - pos[j], pos[i + 1] - pos[j + 1], pos[i + 2] - pos[j + 2]);
  for (let t = 0; t < bong.length; t += 3) {
    const a = 3 * bong[t];
    const b = 3 * bong[t + 1];
    const c = 3 * bong[t + 2];
    const n = Math.max(2, Math.ceil(Math.max(len(a, b), len(b, c), len(c, a)) / BUOC_DO));
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        if ((i === 0 && j === 0) || i === n || j === n) continue;
        const u = i / n;
        const w = j / n;
        const r = 1 - u - w;
        du = Math.max(
          du,
          toiGoc(r * pos[a] + u * pos[b] + w * pos[c], r * pos[a + 1] + u * pos[b + 1] + w * pos[c + 1], r * pos[a + 2] + u * pos[b + 2] + w * pos[c + 2], du),
        );
        if (du >= tran) return tran;
      }
    }
  }
  return du;
}

/* ------------------------------------------------------------------ */
/* Làm lưới bóng                                                        */
/* ------------------------------------------------------------------ */

/**
 * Làm (lại) lưới bóng cho mọi phần lưới của cảnh mặc định. Gọi SAU meshopt() (meshopt sắp xếp lại đỉnh).
 * `chieuCao`: chiều cao của nhân vật trong trò chơi (mét) – để đo độ lệch bằng mét thật.
 * Phần lưới không giảm được trong SAI_SO thì lưới bóng dùng lại chính danh sách tam giác gốc.
 * Trả về null (và không có lưới bóng) khi lưới bóng không bỏ được ít nhất một nửa số tam giác.
 * @returns {Promise<{ trisGoc: number, tris: number, lech: number, err: number, parts: number, made: number } | null>}
 */
export async function lamLuoiBong(doc, chieuCao = 1.7) {
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
  boLuoiBong(doc);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) return null;
  const parts = [];
  const seen = new Set();
  const e = [0, 0, 0];
  let lo = Infinity;
  let hi = -Infinity;
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (!hopLe(prim) || seen.has(prim)) continue;
      seen.add(prim);
      const pa = prim.getAttribute('POSITION');
      const n = pa.getCount();
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pa.getElement(i, e);
        pos[3 * i] = m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12];
        pos[3 * i + 1] = m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13];
        pos[3 * i + 2] = m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14];
        lo = Math.min(lo, pos[3 * i + 1]);
        hi = Math.max(hi, pos[3 * i + 1]);
      }
      parts.push({ mesh, prim, pos });
    }
  });
  if (!parts.length || !(hi > lo)) return null;
  const k = chieuCao / (hi - lo);
  let trisGoc = 0;
  let tris = 0;
  let lech = 0;
  let err = 0;
  let made = 0;
  for (const p of parts) {
    for (let i = 0; i < p.pos.length; i++) p.pos[i] *= k;
    const src = p.prim.getIndices().getArray();
    // Hàn đỉnh trùng vị trí (đường nối UV) để giảm được qua đường nối, và chỉ đưa đỉnh đang dùng cho bộ giảm: đỉnh
    // trùng còn sót trong mảng làm bộ giảm tưởng là đường nối và khóa lại (chỉ giảm được một nửa).
    const remap = MeshoptSimplifier.generatePositionRemap(p.pos, 3);
    const moi = new Int32Array(remap.length).fill(-1);
    const goc = [];
    const wc = new Uint32Array(src.length);
    for (let i = 0; i < src.length; i++) {
      const v = remap[src[i]];
      if (moi[v] < 0) {
        moi[v] = goc.length;
        goc.push(v);
      }
      wc[i] = moi[v];
    }
    const pc = new Float32Array(goc.length * 3);
    goc.forEach((v, j) => pc.set(p.pos.subarray(3 * v, 3 * v + 3), 3 * j));
    trisGoc += src.length / 3;
    // Thưa nhất mà vẫn lệch ≤ SAI_SO: thử sai số mục tiêu giảm dần.
    p.best = null;
    for (let i = 0, muc = SAI_SO; i < 15 && !p.best; i++, muc *= 0.85) {
      const [dc, e2] = MeshoptSimplifier.simplify(wc, pc, 3, 0, muc, ['ErrorAbsolute', 'Prune']);
      if (!dc.length || dc.length > src.length * TOI_DA) break;
      const d = saiLech(pc, wc, dc);
      if (d > SAI_SO) continue;
      const dst = new Uint32Array(dc.length);
      for (let j = 0; j < dc.length; j++) dst[j] = goc[dc[j]];
      p.best = { dst, err: e2, lech: d };
    }
    if (p.best) {
      made++;
      tris += p.best.dst.length / 3;
      lech = Math.max(lech, p.best.lech);
      err = Math.max(err, p.best.err);
    } else tris += src.length / 3;
  }
  if (!made || tris > trisGoc * TOI_DA) return null;
  const buf = root.listBuffers()[0] ?? doc.createBuffer();
  const mat = doc.createMaterial('bong').setAlphaMode('BLEND').setBaseColorFactor([1, 1, 1, 0]).setExtras({ proxy: PHIEN_BAN });
  for (const p of parts) {
    let acc = p.prim.getIndices();
    if (p.best) {
      // Thứ tự tam giác thân thiện bộ nhớ đệm đỉnh (nén nhỏ hơn) nhưng giữ nguyên số hiệu đỉnh gốc.
      const ids = p.best.dst.slice();
      const [order] = MeshoptEncoder.reorderMesh(ids, true, true);
      const inv = new Uint32Array(order.length);
      for (let v = 0; v < order.length; v++) if (order[v] !== 0xffffffff) inv[order[v]] = v;
      for (let i = 0; i < ids.length; i++) ids[i] = inv[ids[i]];
      const count = p.prim.getAttribute('POSITION').getCount();
      acc = doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(count <= 65535 ? new Uint16Array(ids) : ids)
        .setBuffer(p.prim.getIndices().getBuffer() ?? buf);
    }
    const bong = doc
      .createPrimitive()
      .setMode(TRIANGLES)
      .setIndices(acc)
      .setAttribute('POSITION', p.prim.getAttribute('POSITION'))
      .setMaterial(mat)
      .setExtras({ proxy: PHIEN_BAN, lech: p.best ? Number(p.best.lech.toFixed(4)) : 0 });
    // Dùng chung pháp tuyến: không tốn thêm dữ liệu, và trình nạp không phải tạo vật liệu tô phẳng riêng.
    const nrm = p.prim.getAttribute('NORMAL');
    if (nrm) bong.setAttribute('NORMAL', nrm);
    p.mesh.addPrimitive(bong);
  }
  return { trisGoc, tris, lech, err, parts: parts.length, made };
}
