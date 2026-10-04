/** Kiểu cho tools/luoi-bong.mjs (để kiểm thử TypeScript nhập được). */
import type { Document, Primitive } from '@gltf-transform/core';

export declare const PHIEN_BAN: number;
export declare const SAI_SO: number;
export declare function laLuoiBong(prim: Primitive): boolean;
export declare function boLuoiBong(doc: Document): number;
export declare function coLuoiBong(doc: Document): boolean;
export declare function saiLech(pos: Float32Array, goc: ArrayLike<number>, bong: ArrayLike<number>, tran?: number): number;
export interface KetQuaLuoiBong {
  /** Số tam giác của lưới thật. */
  trisGoc: number;
  /** Số tam giác của lưới bóng. */
  tris: number;
  /** Độ lệch lớn nhất đo được (mét). */
  lech: number;
  /** Sai số meshoptimizer báo (mét). */
  err: number;
  /** Số phần lưới. */
  parts: number;
  /** Số phần lưới giảm được. */
  made: number;
}
export declare function lamLuoiBong(doc: Document, chieuCao?: number): Promise<KetQuaLuoiBong | null>;
