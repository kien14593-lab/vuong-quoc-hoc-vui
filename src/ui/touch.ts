import { isTouchDevice } from '../core/device';

/** Ô nhập liệu: giữ nguyên cách chạm của trình duyệt (chọn chữ, kéo thanh trượt...). */
function editable(t: EventTarget | null): boolean {
  const el = t instanceof Element ? t : null;
  return !!el?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}

/**
 * Chạm trên iPhone / iPad: không để cả trang bị phóng to nhầm. Safari bỏ qua `user-scalable=no` nên phải chặn
 * cử chỉ chụm hai ngón của trang và cú chạm đúp. Chụm hai ngón để phóng to / thu nhỏ trong thế giới 3D vẫn dùng được
 * (world/camera.ts nhận sự kiện con trỏ, không dùng cử chỉ của trang).
 */
export function installTouchGuards(): void {
  const stop = (e: Event) => e.preventDefault();
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
  if (!isTouchDevice()) return;

  // Chạm đúp nhanh (bé bấm liên tiếp một nút): chặn phóng to, nhưng lần chạm thứ hai vẫn là một cú bấm.
  let multi = false;
  let startT = 0;
  let sx = 0;
  let sy = 0;
  let lastT = -1e9;
  let lastX = 0;
  let lastY = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      multi = e.touches.length > 1;
      if (multi) return;
      const t = e.touches[0];
      startT = performance.now();
      sx = t.clientX;
      sy = t.clientY;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (multi || e.touches.length > 0 || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const now = performance.now();
      if (now - startT > 300 || Math.hypot(t.clientX - sx, t.clientY - sy) > 10) {
        lastT = -1e9;
        return;
      }
      const dbl = now - lastT < 350 && Math.hypot(t.clientX - lastX, t.clientY - lastY) < 40;
      lastT = dbl ? -1e9 : now;
      lastX = t.clientX;
      lastY = t.clientY;
      if (!dbl || !e.cancelable || editable(e.target)) return;
      e.preventDefault();
      // Chặn chạm đúp thì trình duyệt cũng bỏ luôn cú "click" của lần chạm thứ hai – tự gửi lại đúng chỗ đó.
      const el = document.elementFromPoint(t.clientX, t.clientY);
      el?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY }),
      );
    },
    { passive: false },
  );
}
