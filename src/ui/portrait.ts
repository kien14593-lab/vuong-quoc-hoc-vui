import * as THREE from 'three';
import type { Equipped, Look } from '../core/state';
import { disposeTree } from '../engine/merge';
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

function cached(k: string, make: () => THREE.Object3D | null, o: PortraitOpts): string {
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  const obj = make();
  if (!obj) return '';
  const url = renderPortrait(obj, o);
  disposeTree(obj);
  if (cache.size > 400) cache.clear();
  if (url) cache.set(k, url);
  return url;
}

/** Chân dung theo khóa mô hình (NPC, thú cưng, đồ vật...). */
export function modelPortrait(key: string, o: PortraitOpts = {}): string {
  if (!hasModel(key)) return '';
  const k = JSON.stringify(['m', key, o]);
  return cached(k, () => buildModel(key, o.opts ?? {}), o);
}

/** Chân dung người chơi theo ngoại hình + trang phục. */
export function playerPortrait(look: Look, eq: Equipped, o: PortraitOpts = {}): string {
  const k = JSON.stringify(['p', look, eq, o]);
  return cached(k, () => buildModel('player', { look, eq }), o);
}

/** Xóa bộ nhớ đệm (ví dụ khi người chơi thay đồ – không bắt buộc vì khóa đã gồm trang phục). */
export function clearPortraits(): void {
  cache.clear();
}
