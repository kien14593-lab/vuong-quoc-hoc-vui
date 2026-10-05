import { h } from './dom';

/**
 * Lớp giao diện HTML phủ toàn cửa sổ (trên canvas 3D).
 * Hệ tọa độ "logic" thiết kế cho 1920×1080 rồi co giãn theo cửa sổ:
 *   s0 = min(W/1920, H/1080)  (máy tính, iPad nằm ngang: dùng đúng tỉ lệ này)
 *   s  = max(s0, min(16/30, W/1280, H/640))
 * Màn hình nhỏ (điện thoại, iPad dựng đứng) được phóng to thêm để chữ thường (30px logic) ≥ 16px thật;
 * khi đó vùng logic nhỏ hơn 1920×1080 (nhỏ nhất ~1280×640) và <html> có lớp `ui-compact`
 * (+ `ui-short` khi vùng logic thấp) để compact.css xếp lại bố cục cho vừa.
 * Kích thước logic = W/s × H/s; các thành phần neo theo góc/cạnh bằng CSS.
 *
 * iPhone/iPad (viewport-fit=cover): hình 3D phủ kín màn hình, còn W×H ở trên là "vùng an toàn" – trừ tai thỏ
 * và vạch Home (env(safe-area-inset-*)). Mỗi lớp giao diện lùi vào bằng --sa-t/r/b/l (px logic); nền phủ toàn
 * màn hình (hộp thoại, màn chuyển cảnh...) tự lấn ra lại. Máy tính: phần lề này bằng 0.
 */
export type LayerName = 'world' | 'hud' | 'panel' | 'dialog' | 'modal' | 'fx' | 'toast' | 'top';
const ORDER: LayerName[] = ['world', 'hud', 'panel', 'dialog', 'modal', 'fx', 'toast', 'top'];

export const BASE_W = 1920;
export const BASE_H = 1080;
/** Vùng logic nhỏ nhất khi phóng to cho màn hình nhỏ. */
const FIT_W = 1280;
const FIT_H = 640;
/** Tỉ lệ tối đa được phóng thêm: chữ 30px logic → 16px thật. */
const MAX_BOOST = 16 / 30;
/** Vùng logic thấp hơn mức này thì gắn lớp `ui-short` (điện thoại nằm ngang). */
const SHORT_H = 900;

/** Tỉ lệ giao diện cho cửa sổ W×H (CSS px). */
export function scaleFor(W: number, H: number): { s: number; compact: boolean } {
  const s0 = Math.min(W / BASE_W, H / BASE_H);
  const s = Math.max(s0, Math.min(MAX_BOOST, W / FIT_W, H / FIT_H));
  return { s, compact: s > s0 * 1.001 };
}

/** Lề an toàn (tai thỏ, vạch Home) – trên/phải/dưới/trái. */
export interface Insets {
  t: number;
  r: number;
  b: number;
  l: number;
}
const NO_INSETS: Insets = { t: 0, r: 0, b: 0, l: 0 };

export interface UILayout {
  s: number;
  compact: boolean;
  /** Toàn cửa sổ (px logic) – kích thước #ui-root. */
  rootW: number;
  rootH: number;
  /** Vùng an toàn (px logic) – nơi đặt giao diện (uiSize, --ui-w/--ui-h). */
  w: number;
  h: number;
  /** Lề an toàn (px logic). */
  sa: Insets;
}

/** Bố cục giao diện cho cửa sổ W×H (CSS px) có lề an toàn `ins` (CSS px): tỉ lệ tính theo vùng an toàn. */
export function layoutFor(W: number, H: number, ins: Insets = NO_INSETS): UILayout {
  const sw = Math.max(1, W - ins.l - ins.r);
  const sh = Math.max(1, H - ins.t - ins.b);
  const { s, compact } = scaleFor(sw, sh);
  return {
    s,
    compact,
    rootW: W / s,
    rootH: H / s,
    w: sw / s,
    h: sh / s,
    sa: { t: ins.t / s, r: ins.r / s, b: ins.b / s, l: ins.l / s },
  };
}

const layers = new Map<LayerName, HTMLElement>();
let root: HTMLElement;
let probe: HTMLElement | null = null;
let scale = 1;
let lw = BASE_W;
let lh = BASE_H;
let sa: Insets = NO_INSETS;
let resyncTimer = 0;
const resizeFns = new Set<() => void>();

export function uiRoot(): HTMLElement {
  return root;
}

export function layer(name: LayerName): HTMLElement {
  return layers.get(name)!;
}

export function uiScale(): number {
  return scale;
}

/** Kích thước logic hiện tại của vùng giao diện (vùng an toàn – không gồm tai thỏ/vạch Home). */
export function uiSize(): { w: number; h: number; s: number } {
  return { w: lw, h: lh, s: scale };
}

/** Lề an toàn hiện tại (px logic): mép trên-trái vùng giao diện cách mép cửa sổ (sa.l, sa.t). */
export function uiInsets(): Insets {
  return sa;
}

/** Đăng ký hàm chạy khi cửa sổ đổi kích thước. Trả về hàm hủy. */
export function onUIResize(fn: () => void): () => void {
  resizeFns.add(fn);
  return () => resizeFns.delete(fn);
}

export function initUI(): void {
  root = document.getElementById('ui-root')!;
  for (const name of ORDER) {
    const el = h(`div.layer.layer-${name}`);
    root.appendChild(el);
    layers.set(name, el);
  }
  // Phần tử ẩn đọc env(safe-area-inset-*) (xem #safe-area-probe trong main.css).
  probe = h('div#safe-area-probe', { 'aria-hidden': 'true' });
  document.body.appendChild(probe);
  const later = () => {
    sync();
    // iOS đôi khi cập nhật lề an toàn sau sự kiện resize/xoay máy → đồng bộ lại một lần nữa.
    window.clearTimeout(resyncTimer);
    resyncTimer = window.setTimeout(sync, 350);
  };
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);
  later();
}

function readInsets(): Insets {
  if (!probe) return NO_INSETS;
  const cs = getComputedStyle(probe);
  const px = (v: string) => Math.max(0, parseFloat(v) || 0);
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}

/** Đồng bộ tỉ lệ của lớp giao diện với cửa sổ. */
export function sync(): void {
  if (!root) return;
  const W = Math.max(1, window.innerWidth);
  const H = Math.max(1, window.innerHeight);
  const fit = layoutFor(W, H, readInsets());
  scale = fit.s;
  lw = fit.w;
  lh = fit.h;
  sa = fit.sa;
  root.style.width = `${fit.rootW}px`;
  root.style.height = `${fit.rootH}px`;
  root.style.transform = `scale(${scale})`;
  const de = document.documentElement;
  const ds = de.style;
  ds.setProperty('--ui-scale', String(scale));
  ds.setProperty('--ui-w', `${lw}px`);
  ds.setProperty('--ui-h', `${lh}px`);
  ds.setProperty('--sa-t', `${sa.t}px`);
  ds.setProperty('--sa-r', `${sa.r}px`);
  ds.setProperty('--sa-b', `${sa.b}px`);
  ds.setProperty('--sa-l', `${sa.l}px`);
  de.classList.toggle('ui-compact', fit.compact);
  de.classList.toggle('ui-short', fit.compact && lh < SHORT_H);
  for (const fn of resizeFns) fn();
}

/* ---------------- Khóa điều khiển nhân vật khi đang mở giao diện ---------------- */
const blockers = new Set<string>();
let blockSeq = 0;

export function pushBlock(tag = 'ui'): string {
  const id = `${tag}:${++blockSeq}`;
  blockers.add(id);
  return id;
}

export function popBlock(id: string): void {
  blockers.delete(id);
}

export function inputBlocked(): boolean {
  return blockers.size > 0;
}

export function clearBlocks(): void {
  blockers.clear();
}

/** Chuyển tọa độ màn hình (clientX/Y) sang tọa độ logic của giao diện. */
export function toLogical(clientX: number, clientY: number): { x: number; y: number } {
  const r = root.getBoundingClientRect();
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
}

/** Tọa độ điểm ảnh của canvas (CSS px) → tọa độ logic. */
export function pxToLogical(x: number, y: number): { x: number; y: number } {
  return { x: x / scale, y: y / scale };
}
