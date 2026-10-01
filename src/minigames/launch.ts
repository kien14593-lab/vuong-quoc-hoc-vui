import { engine } from '../engine/core';
import type { MiniGame, MiniResult } from './base';
import { miniDef } from './registry';

let running: MiniGame | null = null;

/**
 * Chạy một trò chơi nhỏ (thay cảnh 3D hiện tại). Khi trẻ chọn "Quay về" hoặc thoát,
 * gọi `onDone(kết quả | null)` – nơi gọi phải dựng lại cảnh trước đó bằng `engine.setStage`.
 * "Chơi lại" tự tạo lượt mới. `keepPrev`: giữ (không hủy) cảnh đang hiển thị để quay lại sau.
 */
export function runMini(id: string, onDone: (result: MiniResult | null) => void, o: { keepPrev?: boolean } = {}): boolean {
  const def = miniDef(id);
  if (!def) return false;
  let first = true;
  const start = () => {
    const game = def.create({
      exit: (result, again) => {
        if (running !== game) return;
        if (again) {
          start();
          return;
        }
        running = null;
        onDone(result);
      },
    });
    running = game;
    engine.setStage(game, { keepPrev: first && o.keepPrev });
    first = false;
    void game.begin();
  };
  start();
  return true;
}

/** Trò chơi nhỏ đang chạy (nếu có). */
export function currentMini(): MiniGame | null {
  return running;
}
