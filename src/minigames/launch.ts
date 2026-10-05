import { engine } from '../engine/core';
import type { MiniGame, MiniResult } from './base';
import { miniDef } from './registry';

let running: MiniGame | null = null;

export interface RunOpts {
  /** Giữ (không hủy) cảnh đang hiển thị để quay lại sau. */
  keepPrev?: boolean;
  /** Lượt đầu (đang che màn): chờ dựng cảnh + chuẩn bị GPU tối đa chừng này ms rồi mới lên sân khấu (MiniGame.prepare). */
  warmMs?: number;
  /** Lượt đầu vừa lên sân khấu (sau `engine.setStage`) – nơi gọi mở màn che. */
  shown?: () => void;
}

/**
 * Chạy một trò chơi nhỏ (thay cảnh 3D hiện tại). Khi trẻ chọn "Quay về" hoặc thoát,
 * gọi `onDone(kết quả | null)` – nơi gọi phải dựng lại cảnh trước đó bằng `engine.setStage`.
 * "Chơi lại" tự tạo lượt mới (dựng xong mới thay lượt cũ: shader còn đó, dùng lại được).
 * Dựng lỗi: báo lỗi rồi `onDone(null)` (không kẹt sau màn che).
 */
export function runMini(id: string, onDone: (result: MiniResult | null) => void, o: RunOpts = {}): boolean {
  const def = miniDef(id);
  if (!def) return false;
  const start = async (first: boolean): Promise<void> => {
    let game: MiniGame | null = null;
    try {
      const g = (game = def.create({
        exit: (result, again) => {
          if (running !== g) return;
          if (again) {
            void start(false);
            return;
          }
          running = null;
          onDone(result);
        },
      }));
      running = g;
      await g.prepare(first ? (o.warmMs ?? 0) : 0);
      if (running !== g) return g.dispose();
      engine.setStage(g, { keepPrev: first && o.keepPrev });
      void g.begin();
      if (first) o.shown?.();
    } catch (e) {
      console.error(`[mini] không mở được trò "${id}"`, e);
      game?.dispose();
      running = null;
      onDone(null);
    }
  };
  void start(true);
  return true;
}

/** Trò chơi nhỏ đang chạy (nếu có). */
export function currentMini(): MiniGame | null {
  return running;
}
