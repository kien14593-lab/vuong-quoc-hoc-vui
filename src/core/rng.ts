/** Bộ sinh số ngẫu nhiên có thể gieo hạt (mulberry32) và các tiện ích chọn ngẫu nhiên. */
export type RandFn = () => number;

export function mulberry32(seed: number): RandFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(public next: RandFn = Math.random) {}

  static seeded(seed: number | string): Rng {
    return new Rng(mulberry32(typeof seed === 'string' ? hashString(seed) : seed));
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  /** Số nguyên trong đoạn [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Lấy n phần tử khác nhau. */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle([...arr]).slice(0, n);
  }
}

/** RNG dùng chung cho gameplay (không gieo hạt). */
export const rng = new Rng();
