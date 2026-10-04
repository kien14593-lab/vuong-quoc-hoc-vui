import * as state from '../core/state';
import { speak, voiceInfo } from '../core/speech';
import { engine } from '../engine/core';
import { dialogOpen } from '../ui/dialog';
import { questionOpen, solveOpenQuestion } from '../ui/question';
import { solveActivePick } from '../world/zone';
import { currentZone, enterWorld, goZone } from './app';

const key = (code: string, k = code) => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key: k, bubbles: true }));
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code, key: k, bubbles: true }));
};

/** Công cụ gỡ lỗi trên console trình duyệt: window.__vq */
export function installDebug(): void {
  const api = {
    engine,
    state,
    get p() {
      return state.hasProfile() ? state.profile() : null;
    },
    get zone() {
      return currentZone();
    },
    coins: (n = 100) => state.addCoins(n),
    xp: (n = 100) => state.addXp(n),
    stars: (n = 1) => state.addStars(n),
    tickets: (n = 1) => state.addTickets(n),
    flag: (k: string, v: boolean | number | string = true) => state.setFlag(k, v),
    go: (zone: state.ZoneId, spawn?: string) => (state.hasProfile() ? void goZone(zone, spawn ?? 'start') : undefined),
    enter: (zone?: state.ZoneId, spawn?: string) => void enterWorld({ zone, spawn }),
    pos: () => {
      const z = currentZone();
      return z ? { zone: z.id, x: +z.player.pos.x.toFixed(2), z: +z.player.pos.z.toFixed(2) } : null;
    },
    /** Dịch chuyển người chơi tới (x, z). */
    tp: (x: number, z: number) => currentZone()?.player.setPos(x, z),
    /** Đi bộ (tìm đường) tới (x, z). */
    walk: (x: number, z: number) => {
      const zn = currentZone();
      return zn ? zn.player.goTo(x, z, zn.world) : Promise.resolve(false);
    },
    /** Trả lời đúng câu hỏi đang hiện (cả thử thách "chọn bằng hành động"). */
    solve: () => solveOpenQuestion() || solveActivePick(),
    /** Qua lời thoại tiếp theo (phím Enter). */
    next: () => key('Enter'),
    /** Chọn phương án thứ n trong hộp lựa chọn. */
    pick: (n: number) => key(`Digit${n}`, String(n)),
    /** Đọc thử một câu bằng giọng của nhân vật `who` (mã trong core/voice-profiles.ts; bỏ trống = giọng dẫn chuyện). */
    speak: (text: string, who?: string) => speak(text, { who, force: true }),
    /** Các giọng đọc đang dùng trên máy này. */
    voices: () => voiceInfo(),
    /** Nhấn phím tương tác (E). */
    act: () => key('KeyE', 'e'),
    /** Tự qua hội thoại, trả lời đúng, chọn phương án `choice` trong `sec` giây. */
    auto: async (sec = 6, choice = 1) => {
      const end = performance.now() + sec * 1000;
      while (performance.now() < end) {
        if (questionOpen()) solveOpenQuestion();
        else if (document.querySelector('.dialog.has-choices')) key(`Digit${choice}`, String(choice));
        else if (dialogOpen()) key('Enter');
        await new Promise((r) => setTimeout(r, 160));
      }
    },
  };
  (window as unknown as { __vq: typeof api }).__vq = api;
}
