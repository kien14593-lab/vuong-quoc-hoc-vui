/** Bộ phát sự kiện có kiểu, dùng để các hệ thống (trạng thái, giao diện, thế giới) giao tiếp lỏng lẻo. */
type Handler<T> = (payload: T) => void;

export class Emitter<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(key: K, fn: Handler<E[K]>): () => void {
    let set = this.map.get(key);
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(fn);
    return () => this.off(key, fn);
  }

  off<K extends keyof E>(key: K, fn: Handler<E[K]>): void {
    this.map.get(key)?.delete(fn);
  }

  emit<K extends keyof E>(key: K, payload: E[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] lỗi khi xử lý sự kiện "${String(key)}"`, err);
      }
    }
  }
}

export interface GameEvents extends Record<string, unknown> {
  /** Tiền tệ / vật phẩm đếm được thay đổi (xu, sao, vé, chìa khóa). */
  wallet: { coins: number; stars: number; tickets: number; keys: number };
  xp: { xp: number; level: number };
  levelup: { level: number };
  badge: { id: string };
  quest: { id: string };
  look: Record<string, never>;
  inventory: { id: string };
  profile: { id: string | null };
  settings: Record<string, never>;
  /** Một câu trả lời vừa được ghi nhận. */
  answer: { topic: string; firstTry: boolean };
}

export const bus = new Emitter<GameEvents>();
