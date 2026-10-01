import { h } from './dom';

/**
 * Lớp giao diện HTML phủ toàn cửa sổ (trên canvas 3D).
 * Hệ tọa độ "logic" có cạnh nhỏ nhất bằng 1920×1080 rồi co giãn theo cửa sổ:
 *   s = min(W/1920, H/1080), kích thước logic = W/s × H/s.
 * Các thành phần neo theo góc/cạnh bằng CSS nên màn hình rộng/hẹp đều hợp lý.
 */
export type LayerName = 'world' | 'hud' | 'panel' | 'dialog' | 'modal' | 'fx' | 'toast' | 'top';
const ORDER: LayerName[] = ['world', 'hud', 'panel', 'dialog', 'modal', 'fx', 'toast', 'top'];

export const BASE_W = 1920;
export const BASE_H = 1080;

const layers = new Map<LayerName, HTMLElement>();
let root: HTMLElement;
let scale = 1;
let lw = BASE_W;
let lh = BASE_H;
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

/** Kích thước logic hiện tại của giao diện. */
export function uiSize(): { w: number; h: number; s: number } {
  return { w: lw, h: lh, s: scale };
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
  window.addEventListener('resize', sync);
  sync();
}

/** Đồng bộ tỉ lệ của lớp giao diện với cửa sổ. */
export function sync(): void {
  if (!root) return;
  const W = Math.max(1, window.innerWidth);
  const H = Math.max(1, window.innerHeight);
  scale = Math.min(W / BASE_W, H / BASE_H);
  lw = W / scale;
  lh = H / scale;
  root.style.width = `${lw}px`;
  root.style.height = `${lh}px`;
  root.style.transform = `scale(${scale})`;
  const ds = document.documentElement.style;
  ds.setProperty('--ui-scale', String(scale));
  ds.setProperty('--ui-w', `${lw}px`);
  ds.setProperty('--ui-h', `${lh}px`);
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
