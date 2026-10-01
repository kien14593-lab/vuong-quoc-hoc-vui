/**
 * Bàn phím tự quản lý (không dùng bộ bắt phím của Phaser để ô nhập tên vẫn gõ được dấu cách).
 * Bỏ qua phím khi đang gõ trong ô nhập liệu.
 */
const down = new Set<string>();
const pressed = new Set<string>();

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

window.addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  down.add(e.code);
  if (!e.repeat) pressed.add(e.code);
});
window.addEventListener('keyup', (e) => {
  down.delete(e.code);
});
window.addEventListener('blur', () => {
  down.clear();
  pressed.clear();
});

export const keys = {
  isDown(...codes: string[]): boolean {
    return codes.some((c) => down.has(c));
  },
  /** Lấy (và xóa) một lần nhấn phím. */
  consume(...codes: string[]): boolean {
    let hit = false;
    for (const c of codes) {
      if (pressed.delete(c)) hit = true;
    }
    return hit;
  },
  clearPressed(): void {
    pressed.clear();
  },
  reset(): void {
    down.clear();
    pressed.clear();
  },
};

export const K = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  run: ['ShiftLeft', 'ShiftRight'],
  act: ['KeyE', 'Enter', 'NumpadEnter'],
  jump: ['Space'],
  map: ['KeyM'],
  bag: ['KeyB', 'KeyI'],
};

/** Cần điều khiển ảo (màn hình cảm ứng), giá trị -1..1. */
const virt = { x: 0, y: 0 };
export function setVirtualMove(x: number, y: number): void {
  virt.x = x;
  virt.y = y;
}

/** Đang dùng cần điều khiển ảo? (đẩy hết cỡ = chạy). */
export function virtualMag(): number {
  return Math.min(1, Math.hypot(virt.x, virt.y));
}

/** Vector di chuyển từ bàn phím / cần điều khiển ảo (độ dài ≤ 1). */
export function moveVector(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (keys.isDown(...K.left)) x -= 1;
  if (keys.isDown(...K.right)) x += 1;
  if (keys.isDown(...K.up)) y -= 1;
  if (keys.isDown(...K.down)) y += 1;
  x += virt.x;
  y += virt.y;
  const l = Math.hypot(x, y);
  if (l > 1) {
    x /= l;
    y /= l;
  }
  return { x, y };
}
