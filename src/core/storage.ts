import { SAVE_PREFIX } from '../config';

/** Lưu trữ cục bộ an toàn: nếu localStorage không dùng được thì dùng bộ nhớ tạm. */
const memory = new Map<string, string>();

function available(): boolean {
  try {
    const k = `${SAVE_PREFIX}.__test`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const hasLS = typeof localStorage !== 'undefined' && available();

export const storage = {
  persistent: hasLS,
  get(key: string): string | null {
    const k = `${SAVE_PREFIX}.${key}`;
    if (hasLS) {
      try {
        return localStorage.getItem(k);
      } catch {
        return memory.get(k) ?? null;
      }
    }
    return memory.get(k) ?? null;
  },
  set(key: string, value: string): void {
    const k = `${SAVE_PREFIX}.${key}`;
    if (hasLS) {
      try {
        localStorage.setItem(k, value);
        return;
      } catch (err) {
        console.warn('[storage] không lưu được, dùng bộ nhớ tạm', err);
      }
    }
    memory.set(k, value);
  },
  remove(key: string): void {
    const k = `${SAVE_PREFIX}.${key}`;
    if (hasLS) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* bỏ qua */
      }
    }
    memory.delete(k);
  },
  getJSON<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },
};
