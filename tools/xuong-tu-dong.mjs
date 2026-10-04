/**
 * Dò xương tự động cho mô hình GLB trong Node – dùng đúng mã của game (src/models/autorig.ts) để công cụ xử lý
 * mô hình và lệnh kiểm tra ra cùng kết quả với game: bé "đi bằng chân" hay "nhún".
 *
 *   const rig = await napXuong();
 *   const ds = luoiDeDo(doc, xoay);         // các lưới tam giác (đã nhân ma trận nút, xoay quanh trục đứng)
 *   const kq = rig.autoRig(ds.map((x) => x.input));
 *   ghiTrongSo(doc, ds, kq);                // ghi _SKIN_INDEX, _SKIN_WEIGHT vào từng lưới
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'models', 'autorig.ts');
const TRIANGLES = 4;

const cached = new Map();

/** Nạp một tệp TypeScript không phụ thuộc tệp khác (Node mới chạy thẳng TypeScript; Node cũ: dịch bằng vite). */
export async function napTs(file) {
  if (cached.has(file)) return cached.get(file);
  let mod;
  if (process.features?.typescript) {
    mod = await import(pathToFileURL(file).href);
  } else {
    const { transformWithOxc } = await import('vite');
    const out = await transformWithOxc(fs.readFileSync(file, 'utf8'), file, { lang: 'ts' });
    mod = await import(`data:text/javascript;base64,${Buffer.from(out.code).toString('base64')}`);
  }
  cached.set(file, mod);
  return mod;
}

/** Nạp src/models/autorig.ts. */
export function napXuong() {
  return napTs(SRC);
}

/**
 * Các lưới tam giác của cảnh mặc định, tọa độ = ma trận nút × đỉnh, rồi xoay `xoay` độ quanh trục đứng
 * (đúng như game: nhóm glbInner xoay rotY). null nếu không ghi trọng số được (lưới dùng chung nhiều nút...).
 * @returns {{ node: any, prim: any, input: { pos: Float32Array, index: ArrayLike<number> | null } }[]}
 */
export function luoiDeDo(doc, xoay = 0) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const out = [];
  if (!scene) return out;
  const th = (xoay * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const e = [0, 0, 0];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== TRIANGLES) continue;
      const pa = prim.getAttribute('POSITION');
      if (!pa) continue;
      const n = pa.getCount();
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pa.getElement(i, e);
        const x = m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12];
        const y = m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13];
        const z = m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14];
        pos[3 * i] = x * cs + z * sn;
        pos[3 * i + 1] = y;
        pos[3 * i + 2] = -x * sn + z * cs;
      }
      const idx = prim.getIndices();
      out.push({ node, prim, input: { pos, index: idx ? idx.getArray() : null } });
    }
  });
  return out;
}

/** Mỗi lưới chỉ thuộc một nút (ghi trọng số theo lưới được). */
export function ghiDuoc(ds) {
  const seen = new Set();
  for (const { prim } of ds) {
    if (seen.has(prim)) return false;
    seen.add(prim);
  }
  return ds.length > 0;
}

/** Trọng số 0–1 → byte (tổng đúng 255 mỗi đỉnh). */
function toBytes(w) {
  const n = w.length / 4;
  const out = new Uint8Array(w.length);
  const fr = [0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    let s = 0;
    for (let k = 0; k < 4; k++) {
      const x = Math.max(0, w[4 * v + k]) * 255;
      out[4 * v + k] = Math.floor(x);
      fr[k] = x - Math.floor(x);
      s += out[4 * v + k];
    }
    if (s === 0) {
      out[4 * v] = 255;
      continue;
    }
    for (let rem = 255 - s; rem > 0; rem--) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (fr[k] > fr[best]) best = k;
      out[4 * v + best]++;
      fr[best] = -1;
      if (fr.every((f) => f < 0)) fr.fill(0);
    }
  }
  return out;
}

/** Ghi trọng số da (4 xương mỗi đỉnh) vào từng lưới: _SKIN_INDEX (byte), _SKIN_WEIGHT (byte chuẩn hóa). */
export function ghiTrongSo(doc, ds, kq) {
  const buf = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  ds.forEach(({ prim }, i) => {
    const sk = kq.skin[i];
    const old = [prim.getAttribute('_SKIN_INDEX'), prim.getAttribute('_SKIN_WEIGHT')];
    prim.setAttribute('_SKIN_INDEX', doc.createAccessor().setType('VEC4').setArray(new Uint8Array(sk.index)).setBuffer(buf));
    prim.setAttribute('_SKIN_WEIGHT', doc.createAccessor().setType('VEC4').setArray(toBytes(sk.weight)).setNormalized(true).setBuffer(buf));
    // Dò lại (mô hình đã lắp): bỏ trọng số cũ không còn lưới nào dùng.
    for (const a of old) if (a && a.listParents().length === 1) a.dispose();
  });
}

/** Đọc lại trọng số đã ghi (null nếu thiếu ở bất kỳ lưới nào). */
export function docTrongSo(ds) {
  const out = [];
  for (const { prim } of ds) {
    const a = prim.getAttribute('_SKIN_INDEX');
    const b = prim.getAttribute('_SKIN_WEIGHT');
    if (!a || !b) return null;
    const n = a.getCount();
    const index = new Uint8Array(n * 4);
    const weight = new Float32Array(n * 4);
    const e = [0, 0, 0, 0];
    for (let v = 0; v < n; v++) {
      a.getElement(v, e);
      index.set(e, v * 4);
      b.getElement(v, e);
      weight.set(e, v * 4);
    }
    out.push({ index, weight });
  }
  return out;
}

/** Tên khớp xương dễ hiểu (theo thứ tự AUTO_BONES). */
export const TEN_XUONG = ['thân', 'đầu', 'tay trái', 'tay phải', 'chân trái', 'chân phải'];
