import * as THREE from 'three';
import { DEFAULT_OUTFIT, playerKey, type Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { disposeTree } from '../engine/merge';
import type { PlayerOpts } from '../models/character';
import { ensureGlb, glbReady } from '../models/glb';
import { kidModelKey } from '../models/kid';
import { buildModel, hasModel } from '../models/registry';

/**
 * Ảnh chân dung 3D (data URL) của nhân vật/NPC/vật phẩm – dùng cho hộp thoại, HUD, cửa hàng, túi đồ.
 * Dùng một bộ vẽ nhỏ riêng (nền trong suốt) để không đụng tới khung hình chính.
 */
export type Framing = 'head' | 'bust' | 'full';

export interface PortraitOpts {
  /** Cạnh ảnh (px). */
  size?: number;
  /** Góc xoay mô hình (độ): 0 = nhìn thẳng, 90 = nghiêng phải, 180 = sau lưng. */
  yaw?: number;
  framing?: Framing;
  /** Góc camera nhìn xuống (độ). */
  pitch?: number;
  /** Tùy chọn khi dựng mô hình. */
  opts?: Record<string, unknown>;
  /** Phóng to thêm (1 = vừa khít). */
  zoom?: number;
}

let R: THREE.WebGLRenderer | null = null;
let failed = false;
let scene: THREE.Scene;
let cam: THREE.PerspectiveCamera;
const cache = new Map<string, string>();
const box = new THREE.Box3();
const size3 = new THREE.Vector3();
const center = new THREE.Vector3();

function ensure(): boolean {
  if (R) return true;
  if (failed) return false;
  try {
    const canvas = document.createElement('canvas');
    R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.NeutralToneMapping;
    R.setPixelRatio(1);
    R.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', () => {
      R = null;
      failed = true;
    });
  } catch {
    failed = true;
    return false;
  }
  scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#f4fbff', '#e8dcc6', 1.75);
  const key = new THREE.DirectionalLight('#fff3e2', 2.1);
  key.position.set(-2.5, 4, 5);
  const rim = new THREE.DirectionalLight('#e4ecff', 0.9);
  rim.position.set(3, 2.5, -3);
  const amb = new THREE.AmbientLight('#ffffff', 0.3);
  scene.add(hemi, key, rim, amb);
  cam = new THREE.PerspectiveCamera(24, 1, 0.05, 80);
  return true;
}

/** Vẽ một đối tượng (không lưu đệm). Đối tượng được trả lại nguyên vẹn (không hủy). */
export function renderPortrait(obj: THREE.Object3D, o: PortraitOpts = {}): string {
  if (!ensure() || !R) return '';
  const px = Math.round(o.size ?? 256);
  if (R.domElement.width !== px || R.domElement.height !== px) R.setSize(px, px, false);
  const holder = new THREE.Group();
  holder.add(obj);
  holder.rotation.y = ((o.yaw ?? 0) * Math.PI) / 180;
  scene.add(holder);
  holder.updateMatrixWorld(true);
  box.setFromObject(obj, true);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  box.getSize(size3);
  box.getCenter(center);
  const hgt = Math.max(0.05, size3.y);
  const framing = o.framing ?? 'bust';
  let y0 = box.min.y;
  let y1 = box.max.y + hgt * 0.03;
  if (framing === 'head') y0 = box.min.y + hgt * 0.52;
  else if (framing === 'bust') y0 = box.min.y + hgt * 0.3;
  else y0 = box.min.y - hgt * 0.04;
  const span = y1 - y0;
  const wide = Math.max(size3.x, size3.z);
  const fit = framing === 'full' ? Math.max(span, wide * 0.92) : Math.max(span, Math.min(wide, span * 1.25) * 0.9);
  const fov = (cam.fov * Math.PI) / 180;
  const dist = ((fit / 2) * 1.08) / Math.tan(fov / 2) / (o.zoom ?? 1) + wide * 0.5;
  const pitch = ((o.pitch ?? 6) * Math.PI) / 180;
  const cy = (y0 + y1) / 2;
  cam.position.set(center.x, cy + Math.sin(pitch) * dist, center.z + Math.cos(pitch) * dist);
  cam.lookAt(center.x, cy, center.z);
  cam.updateProjectionMatrix();
  R.render(scene, cam);
  let url = '';
  try {
    url = R.domElement.toDataURL('image/png');
  } catch {
    url = '';
  }
  scene.remove(holder);
  holder.remove(obj);
  return url;
}

function cached(k: string, make: () => THREE.Object3D | null, o: PortraitOpts, keep = true): string {
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  const obj = make();
  if (!obj) return '';
  const url = renderPortrait(obj, o);
  disposeTree(obj);
  if (cache.size > 400) cache.clear();
  if (url && keep) cache.set(k, url);
  return url;
}

/** Chân dung theo khóa mô hình (NPC, thú cưng, đồ vật...). */
export function modelPortrait(key: string, o: PortraitOpts = {}): string {
  if (!hasModel(key)) return '';
  const k = JSON.stringify(['m', key, o]);
  // Mô hình AI chưa tải xong: vẽ tạm bằng mô hình dựng bằng code nhưng không lưu (lần sau vẽ lại bằng mô hình AI).
  const ready = glbReady([key]);
  if (!ready) void ensureGlb([key]);
  return cached(k, () => buildModel(key, o.opts ?? {}), o, ready);
}

/* ------------------------------------------------------------------ */
/* Chân dung bé (người chơi)                                            */
/* ------------------------------------------------------------------ */

/** Đồ hiện trên chân dung bé (thú cưng, ván trượt không vẽ). */
type Dress = Pick<Partial<Equipped>, 'outfit' | 'hat' | 'backpack' | 'acc'>;

function dressOf(eq: Partial<Equipped>): Dress {
  return { outfit: eq.outfit ?? DEFAULT_OUTFIT, hat: eq.hat ?? null, backpack: eq.backpack ?? null, acc: eq.acc ?? null };
}

/**
 * Chân dung bé (trai/gái) mặc bộ đồ, đội mũ, đeo balo, phụ kiện. Mô hình AI của bộ đồ chưa tải xong → '' và bắt đầu tải
 * (không vẽ tạm bé dựng bằng code) – dùng `setPlayerPortrait` để tự thay ảnh khi tải xong.
 * Tệp lỗi / tắt mô hình AI → chân dung bé dựng bằng code.
 */
export function playerPortrait(kid: Kid, eq: Partial<Equipped>, o: PortraitOpts = {}): string {
  const key = playerKey(kid, eq.outfit);
  if (!glbReady([key])) {
    void ensureGlb([key]);
    return '';
  }
  const dress = dressOf(eq);
  const k = JSON.stringify(['p', kid, dress, kidModelKey({ kid, eq: dress }) ?? 'code', o]);
  return cached(k, () => buildModel<PlayerOpts>('player', { kid, eq: dress }), o);
}

/** Bóng bé tạm (SVG) khi chờ tải mô hình AI: 'head' = đầu + vai, còn lại = cả người. */
export function playerPlaceholder(framing: Framing = 'full'): string {
  const body =
    framing === 'head'
      ? '<circle cx="50" cy="44" r="27"/><path d="M14 100c2-20 17-30 36-30s34 10 36 30z"/>'
      : '<circle cx="50" cy="26" r="17"/><path d="M30 92V60c0-9 9-16 20-16s20 7 20 16v32z"/><path d="M27 50l-9 22M73 50l9 22" stroke="#d5cce6" stroke-width="7" stroke-linecap="round"/>';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#d5cce6">${body}</svg>`)}`;
}

let reqSeq = 0;

/**
 * Đặt chân dung bé vào thẻ ảnh. Mô hình AI chưa tải xong: hiện bóng bé tạm (hoặc giữ ảnh bé đang có) và nhấp nháy nhẹ
 * (lớp `.portrait-wait`), tải xong thì tự thay. Gọi nhiều lần liên tiếp (bấm thử nhiều bộ đồ) chỉ lấy lần cuối.
 */
export function setPlayerPortrait(img: HTMLImageElement, kid: Kid, eq: Partial<Equipped>, o: PortraitOpts = {}): void {
  const tok = String(++reqSeq);
  img.dataset.portraitReq = tok;
  const show = (url: string) => {
    if (img.src !== url) img.src = url;
    img.dataset.portraitReal = '1';
    img.classList.remove('portrait-wait');
  };
  const url = playerPortrait(kid, eq, o);
  if (url) return show(url);
  if (img.dataset.portraitReal !== '1') img.src = playerPlaceholder(o.framing);
  img.classList.add('portrait-wait');
  void ensureGlb([playerKey(kid, eq.outfit)]).then(() => {
    if (img.dataset.portraitReq !== tok) return;
    // Tải bị tạm dừng (vd. đã vào thế giới, ảnh này không cần nữa): giữ bóng bé tạm, không tải lại.
    const u = glbReady([playerKey(kid, eq.outfit)]) ? playerPortrait(kid, eq, o) : '';
    if (u) show(u);
    else img.classList.remove('portrait-wait');
  });
}

/** Xóa bộ nhớ đệm (ví dụ khi người chơi thay đồ – không bắt buộc vì khóa đã gồm trang phục). */
export function clearPortraits(): void {
  cache.clear();
}
