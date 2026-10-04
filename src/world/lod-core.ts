import type { MeshoptSimplifier } from 'meshoptimizer/simplifier';

/**
 * Phần rút gọn lưới dùng chung cho luồng phụ (world/lod-worker.ts) và luồng chính (dự phòng, world/lod.ts).
 * Không dùng three: dữ liệu đỉnh được gửi ở dạng thô (mảng số + bước nhảy) và đọc lại y hệt
 * BufferAttribute.getX/getY/getZ của three, nên hai đường cho cùng một kết quả tới từng số.
 */

export type Simplifier = typeof MeshoptSimplifier;

export type Numbers = Float32Array | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array;

/** Một thuộc tính đỉnh dạng thô: thành phần c của đỉnh i nằm ở array[i * stride + offset + c]. */
export interface RawAttr {
  array: Numbers;
  stride: number;
  offset: number;
  normalized: boolean;
}

export interface Level {
  start: number;
  count: number;
  /** Sai lệch hình học lớn nhất (đơn vị cục bộ của lưới). */
  err: number;
}

export interface LodJob {
  /** Số đỉnh. */
  count: number;
  pos: RawAttr;
  nor: RawAttr | null;
  index: Uint8Array | Uint16Array | Uint32Array;
}

export interface LodData {
  /** Chỉ mục mọi mức nối liền nhau: [gốc | 50% | 25% | bóng 1 | bóng 2]. */
  index: Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
  levels: Level[];
}

/** Thư gửi luồng phụ và thư trả lời. */
export type LodRequest = LodJob & { id: number };
export type LodReply = { id: number } & (LodData | { error: string });

export const KINDS: readonly unknown[] = [Float32Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array];

/** Giống MathUtils.denormalize của three. */
function denormalizer(array: Numbers): (v: number) => number {
  switch (array.constructor) {
    case Float32Array:
      return (v) => v;
    case Uint32Array:
      return (v) => v / 4294967295.0;
    case Uint16Array:
      return (v) => v / 65535.0;
    case Uint8Array:
    case Uint8ClampedArray:
      return (v) => v / 255.0;
    case Int32Array:
      return (v) => Math.max(v / 2147483647.0, -1.0);
    case Int16Array:
      return (v) => Math.max(v / 32767.0, -1.0);
    case Int8Array:
      return (v) => Math.max(v / 127.0, -1.0);
    default:
      throw new Error('[lod] kiểu dữ liệu đỉnh lạ');
  }
}

/** Đọc n véc-tơ 3 thành phần ra mảng số thực 32 bit (như getX/getY/getZ của three). */
export function readVec3(a: RawAttr, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const { array, stride, offset } = a;
  const f = a.normalized ? denormalizer(array) : null;
  for (let i = 0; i < n; i++) {
    const k = i * stride + offset;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = f ? f(array[k + c]) : array[k + c];
  }
  return out;
}

/**
 * Rút gọn một lưới thành mọi mức chi tiết. `pause` (chỉ dùng trên luồng chính) nhường máy cho khung hình
 * giữa các lần rút gọn.
 */
export async function lodLevels(S: Simplifier, job: LodJob, pause?: () => Promise<void>): Promise<LodData> {
  const n = job.count;
  const P = readVec3(job.pos, n);
  const N = job.nor ? readVec3(job.nor, n) : null;
  const I = new Uint32Array(job.index);
  const scale = S.getScale(P, 3);
  const target = (k: number) => Math.max(3, Math.floor((I.length * k) / 3) * 3);
  const smooth = (k: number, cap: number) => (N ? S.simplifyWithAttributes(I, P, 3, N, 3, [0.5, 0.5, 0.5], null, target(k), cap) : S.simplify(I, P, 3, target(k), cap));
  const steps = [() => smooth(0.5, 0.01), () => smooth(0.25, 0.02), () => S.simplifySloppy(I, P, 3, null, 1200 * 3, 1), () => S.simplifySloppy(I, P, 3, null, 800 * 3, 1)];

  const parts: [Uint32Array, number][] = [[I, 0]];
  for (const step of steps) {
    if (pause) await pause();
    parts.push(step());
  }

  const total = parts.reduce((s, [a]) => s + a.length, 0);
  const index = n < 65536 ? new Uint16Array(total) : new Uint32Array(total);
  const levels: Level[] = [];
  let at = 0;
  for (const [a, e] of parts) {
    index.set(a, at);
    levels.push({ start: at, count: a.length, err: e * scale });
    at += a.length;
  }
  return { index, levels };
}
