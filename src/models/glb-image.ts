import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ImgReply, ImgRequest } from './glb-image-worker';

/**
 * Giải mã ảnh (texture) của GLB trong luồng phụ – chỉ trên WebKit từ bản 17: Safari máy Mac/iPhone/iPad và mọi trình
 * duyệt, khung xem trong ứng dụng (Zalo, Facebook...) trên iPhone/iPad.
 *
 * - WebKit giải mã ảnh của createImageBitmap(Blob) ngay trên luồng chính (ImageBitmap.cpp: createFromBuffer → setData):
 *   ảnh 1024² mất ~40–60 ms → giật khi GLB nạp ở nền lúc bé đang chơi. Chromium/Firefox vốn giải mã ở luồng khác:
 *   không cắm gì, không mở luồng phụ, chạy y như cũ.
 * - Chỉ thay bộ nạp ảnh ở nơi GLTFLoader đã chọn ImageBitmapLoader (Safari < 17, Chrome/Firefox trên iPhone dùng
 *   TextureLoader: giữ nguyên). Ảnh vẫn đi đúng đường của GLTFLoader (WebP, sampler, flipY...); chỉ bước
 *   createImageBitmap – cùng tùy chọn – chạy trong luồng phụ, nên điểm ảnh y hệt.
 * - Dự phòng: ảnh lỗi, ảnh rỗng (0×0) hoặc luồng phụ không trả lời → ảnh đó giải mã trên luồng chính như cũ; không mở
 *   được luồng phụ, hoặc lỗi ngay khi chưa giải mã được ảnh nào → một cảnh báo, rồi như cũ đến hết phiên. Rảnh 8 giây
 *   thì tắt luồng phụ (mở lại khi cần).
 * - Tệp đơn mở thẳng từ máy (file://): như cũ – trang gốc "null" thì luồng phụ của WebKit không đọc được Blob của trang.
 * - Thêm `?imgw=0` vào địa chỉ để tắt (so sánh khi kiểm tra).
 */

/**
 * Bản chính của WebKit: `Version/N`, không có thì `OS N_` của iPhone/iPad (khung xem trong ứng dụng như Zalo, Facebook
 * không ghi Version/); 0 = không phải WebKit (theo navigator.vendor) hoặc không rõ bản.
 */
export function webkitMajor(ua: string, vendor: string | undefined): number {
  if (vendor !== 'Apple Computer, Inc.') return 0;
  const m = /\bVersion\/(\d+)/.exec(ua) ?? /\((?:iPhone|iPad|iPod)\b[^)]*\bOS (\d+)_/.exec(ua);
  return m ? Number(m[1]) : 0;
}

const loc = typeof location !== 'undefined' ? location : undefined;
const off = !!loc && new URLSearchParams(loc.search).get('imgw') === '0';
/** Trang mở từ file:// (gốc "null"). */
const local = (!!loc && loc.protocol === 'file:') || globalThis.origin === 'null';
/** Máy này dùng luồng phụ giải mã ảnh: WebKit ≥ 17, có Worker và createImageBitmap, không tắt bằng `?imgw=0`. */
const wanted =
  !off &&
  !local &&
  typeof navigator !== 'undefined' &&
  webkitMajor(navigator.userAgent ?? '', navigator.vendor) >= 17 &&
  typeof Worker !== 'undefined' &&
  typeof createImageBitmap === 'function';

type WorkerCtor = new (options?: { name?: string }) => Worker;

/** Chờ luồng phụ trả lời tối đa 6 giây (tính lại mỗi lần có ảnh xong); rảnh 8 giây thì tắt luồng phụ. */
const HANG_MS = 6000;
const IDLE_MS = 8000;

let ctor: Promise<WorkerCtor | null> | null = null;
let worker: Worker | null = null;
/** Luồng phụ không dùng được: từ đó giải mã trên luồng chính như cũ đến hết phiên. */
let broken = false;
/** Luồng phụ đã giải mã được ít nhất một ảnh trong phiên này. */
let decoded = false;
let warned = false;
const waiting = new Map<number, (bmp: ImageBitmap | null) => void>();
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let due = 0;

/** Một cảnh báo cho cả phiên. */
function warn(why: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[glb] luồng phụ giải mã ảnh lỗi – giải mã trên luồng chính như cũ', why);
}

/** Tắt luồng phụ (có `why` = vì lỗi: thôi dùng đến hết phiên); ảnh đang chờ giải mã trên luồng chính. */
function stop(why?: unknown): void {
  if (why !== undefined) {
    broken = true;
    warn(why);
  }
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  for (const done of waiting.values()) done(null);
  waiting.clear();
}

/** Có ảnh đang chờ: canh luồng phụ (`fresh` = vừa có tiến triển, hạn mới); hết ảnh: tắt luồng phụ sau 8 giây rảnh. */
function arm(fresh: boolean): void {
  clearTimeout(timer);
  if (!waiting.size) {
    timer = setTimeout(() => stop(), IDLE_MS);
    return;
  }
  const now = performance.now();
  if (fresh) due = now + HANG_MS;
  timer = setTimeout(
    () => {
      // Hẹn giờ chạy trễ (luồng chính vừa bận lâu, trang bị ẩn): thư trả lời có thể đang xếp hàng – đợi thêm 1 giây.
      if (performance.now() - due > 1000) {
        due = performance.now() + 1000;
        arm(false);
      } else stop('không trả lời');
    },
    Math.max(0, due - now),
  );
}

function load(): Promise<WorkerCtor | null> {
  ctor ??= import('./glb-image-worker?worker&inline').then(
    (m) => m.default,
    (e: unknown) => {
      stop(e);
      return null;
    },
  );
  return ctor;
}

function open(Ctor: WorkerCtor): Worker {
  const w = new Ctor({ name: 'glb-image' });
  w.onmessage = (e: MessageEvent<ImgReply>) => {
    const r = e.data;
    const done = waiting.get(r.id);
    if (!done) {
      if ('bmp' in r) r.bmp.close();
      return;
    }
    waiting.delete(r.id);
    if ('bmp' in r && r.bmp.width > 0 && r.bmp.height > 0) {
      decoded = true;
      arm(true);
      done(r.bmp);
      return;
    }
    // Ảnh này không được (lỗi, rỗng): giải mã trên luồng chính. Luồng phụ không giải mã được gì, hoặc lỗi ngay khi chưa
    // giải mã được ảnh nào (lỗi của máy, không phải của ảnh) thì thôi dùng.
    if ('bmp' in r) r.bmp.close();
    done(null);
    const why = 'error' in r ? r.error : 'ảnh rỗng (0×0)';
    if (('error' in r && r.fatal) || !decoded) stop(why);
    else {
      warn(why);
      arm(true);
    }
  };
  w.onerror = (e) => {
    e.preventDefault();
    stop(e.message || 'error');
  };
  w.onmessageerror = () => stop('messageerror');
  return w;
}

/** Giải mã trong luồng phụ; null = không được (khi đó giải mã trên luồng chính như cũ). */
async function decode(blob: Blob, options: ImageBitmapOptions): Promise<ImageBitmap | null> {
  const Ctor = await load();
  if (broken || !Ctor) return null;
  try {
    worker ??= open(Ctor);
  } catch (e) {
    stop(e);
    return null;
  }
  const id = ++seq;
  const w = worker;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    try {
      w.postMessage({ id, blob, options } satisfies ImgRequest);
      arm(waiting.size === 1);
    } catch (e) {
      stop(e);
    }
  });
}

/** ImageBitmapLoader mà GLTFLoader đã chọn, chỉ khác: giải mã trong luồng phụ; không được thì làm đúng như bản gốc. */
class WorkerBitmapLoader extends THREE.ImageBitmapLoader {
  constructor(stock: THREE.ImageBitmapLoader) {
    super(stock.manager);
    this.crossOrigin = stock.crossOrigin;
    this.withCredentials = stock.withCredentials;
    this.path = stock.path;
    this.resourcePath = stock.resourcePath;
    this.requestHeader = stock.requestHeader;
    this.options = stock.options;
  }

  override load(url: string, onLoad?: (bmp: ImageBitmap) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void): void {
    if (broken) return super.load(url, onLoad, onProgress, onError);
    const full = this.manager.resolveURL(this.path + url);
    this.manager.itemStart(full);
    const init: RequestInit = { credentials: this.crossOrigin === 'anonymous' ? 'same-origin' : 'include', headers: this.requestHeader };
    void fetch(full, init)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => blob && decode(blob, { ...this.options, colorSpaceConversion: 'none' }))
      .catch(() => null)
      .then((bmp) => {
        if (!bmp) super.load(url, onLoad, onProgress, onError);
        else
          try {
            onLoad?.(bmp);
          } catch (e) {
            onError?.(e);
            this.manager.itemError(full);
          }
        this.manager.itemEnd(full);
      });
  }
}

/** Cắm vào GLTFLoader (một lần, lúc tạo): nơi GLTFLoader đã chọn ImageBitmapLoader thì giải mã ảnh trong luồng phụ. */
export function useImageWorker(loader: GLTFLoader): void {
  if (!wanted) return;
  loader.register((parser) => {
    const stock = parser.textureLoader;
    if (!broken && 'isImageBitmapLoader' in stock && stock.isImageBitmapLoader === true) parser.textureLoader = new WorkerBitmapLoader(stock);
    return { name: 'VQ_image_worker' };
  });
}

// Tải sẵn bản dựng luồng phụ (rất nhỏ) ngay từ đầu để ảnh của tệp GLB đầu tiên không phải chờ.
if (wanted) void load();
