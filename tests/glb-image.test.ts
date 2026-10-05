import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImgReply, ImgRequest } from '../src/models/glb-image-worker';

/**
 * Giải mã ảnh của GLB trong luồng phụ (models/glb-image.ts + glb-image-worker.ts): chỉ WebKit ≥ 17 và chỉ nơi
 * GLTFLoader đã chọn ImageBitmapLoader; trình duyệt khác không cắm gì, không mở luồng phụ. Mọi trục trặc của luồng phụ
 * → ảnh đó giải mã trên luồng chính như cũ (luồng phụ hỏng hẳn: một cảnh báo, rồi như cũ đến hết phiên).
 */

const state = vi.hoisted(() => ({ imports: 0, importFails: false }));

const WORKER = '../src/models/glb-image-worker?worker&inline';
/** Bản "luồng phụ" lúc kiểm thử chỉ là hàm dựng Worker toàn cục (luồng phụ giả bên dưới). */
function workerModule() {
  state.imports++;
  if (state.importFails) throw new Error('mất mạng');
  return {
    default: class {
      constructor(options?: { name?: string }) {
        return new (globalThis as unknown as { Worker: new (url: string, o?: unknown) => object }).Worker('glb-image-worker', options);
      }
    },
  };
}
vi.mock('../src/models/glb-image-worker?worker&inline', () => {
  throw new Error('dùng vi.doMock trong setup()');
});

type Mode = 'ok' | 'reply-error' | 'empty' | 'fatal' | 'onerror' | 'hang' | 'hold' | 'throw';
let mode: Mode = 'ok';
let workers: FakeWorker[] = [];
let attempts = 0;
const owners = new Map<number, FakeWorker>();
/** Bộ nhận thư của mã thật models/glb-image-worker.ts. */
let handle: (e: { data: ImgRequest }) => Promise<void>;
/** Đang chạy mã luồng phụ (để biết ảnh được giải mã ở đâu). */
let inWorker = false;

interface FakeBitmap {
  width: number;
  height: number;
  where: 'main' | 'worker';
  type: string;
  options: ImageBitmapOptions;
  closed: boolean;
  close(): void;
}
let made: FakeBitmap[] = [];

/** createImageBitmap giả: ghi lại nơi gọi (luồng chính / luồng phụ), loại ảnh và tùy chọn. */
function fakeCib(blob: Blob, options: ImageBitmapOptions): Promise<FakeBitmap> {
  const where = inWorker ? 'worker' : 'main';
  const n = where === 'worker' && mode === 'empty' ? 0 : 4;
  const b: FakeBitmap = { width: n, height: n, where, type: blob.type, options, closed: false, close: () => void (b.closed = true) };
  made.push(b);
  return Promise.resolve(b);
}

/** Luồng phụ giả: chạy đúng mã models/glb-image-worker.ts trong cùng tiến trình; thư đi được chép như thật. */
class FakeWorker {
  onmessage: ((e: { data: ImgReply }) => void) | null = null;
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  posted: ImgRequest[] = [];
  held: ImgReply[] = [];
  constructor(
    _url: string,
    public options?: { name?: string },
  ) {
    attempts++;
    if (mode === 'throw') throw new DOMException('không mở được', 'SecurityError');
    workers.push(this);
  }
  postMessage(msg: ImgRequest): void {
    const data = structuredClone(msg);
    this.posted.push(data);
    setTimeout(() => {
      if (this.terminated) return;
      if (mode === 'onerror') this.onerror?.({ message: 'hỏng', preventDefault() {} });
      else if (mode === 'reply-error') this.deliver({ id: data.id, error: 'hỏng' });
      else if (mode !== 'hang') {
        owners.set(data.id, this);
        const keep = globalThis.createImageBitmap;
        if (mode === 'fatal') (globalThis as { createImageBitmap?: unknown }).createImageBitmap = undefined;
        inWorker = true;
        void handle({ data });
        inWorker = false;
        globalThis.createImageBitmap = keep;
      }
    }, 0);
  }
  deliver(msg: ImgReply): void {
    if (mode === 'hold') this.held.push(msg);
    else setTimeout(() => !this.terminated && this.onmessage?.({ data: msg }), 0);
  }
  /** Trả các thư đang giữ (chế độ 'hold'). */
  release(): void {
    for (const m of this.held.splice(0)) if (!this.terminated) this.onmessage?.({ data: m });
  }
  terminate(): void {
    this.terminated = true;
  }
}

const APPLE = 'Apple Computer, Inc.';
const GOOGLE = 'Google Inc.';
const mac = (tail: string) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) ${tail}`;
const ios = (os: string, tail: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${tail}`;
const SAFARI_IOS_17 = ios('17_0', 'Version/17.0 Mobile/15E148 Safari/604.1');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type Kind = 'worker' | 'ImageBitmapLoader' | 'TextureLoader';
type TexLoader = THREE.ImageBitmapLoader | THREE.TextureLoader;

/** Nạp lại models/glb-image.ts với trình duyệt giả, cắm vào một GLTFLoader thật; trả về bộ nạp ảnh GLTFLoader dùng. */
async function setup(ua: string, vendor: string, o: { search?: string; protocol?: string; origin?: string; noWorker?: boolean } = {}) {
  vi.resetModules();
  // Đăng ký lại = mã luồng phụ được "tải" lại cho bản glb-image mới (resetModules không xóa mô-đun giả).
  vi.doMock(WORKER, workerModule);
  vi.stubGlobal('navigator', { userAgent: ua, vendor });
  vi.stubGlobal('createImageBitmap', vi.fn(fakeCib));
  if (!o.noWorker) vi.stubGlobal('Worker', FakeWorker);
  if (o.search !== undefined || o.protocol) vi.stubGlobal('location', { search: o.search ?? '', protocol: o.protocol ?? 'https:' });
  if (o.origin) vi.stubGlobal('origin', o.origin);
  const mod = await import('../src/models/glb-image');
  const loader = new GLTFLoader();
  const base = (loader as unknown as { pluginCallbacks: unknown[] }).pluginCallbacks.length;
  mod.useImageWorker(loader);
  const plugin = (loader as unknown as { pluginCallbacks: unknown[] }).pluginCallbacks.length > base;
  let seen!: TexLoader;
  loader.register((p) => {
    seen = p.textureLoader;
    return { name: 'spy' };
  });
  /** Nạp một tệp GLB (rỗng) bằng bộ nạp này: bộ nạp ảnh của lần nạp đó. */
  const parse = async (): Promise<{ textureLoader: TexLoader; kind: Kind }> => {
    await loader.parseAsync(JSON.stringify({ asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }), '');
    return { textureLoader: seen, kind: seen.constructor.name === 'WorkerBitmapLoader' ? 'worker' : (seen.constructor.name as Kind) };
  };
  return { mod, loader, plugin, parse, ...(await parse()) };
}

/** Một ảnh nhúng như GLTFLoader làm với bufferView: Blob → địa chỉ blob:. */
function png(): string {
  return URL.createObjectURL(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }));
}

function loadVia(l: TexLoader, url = png()): Promise<FakeBitmap> {
  return new Promise((res, rej) => (l as THREE.ImageBitmapLoader).load(url, (b) => res(b as unknown as FakeBitmap), undefined, rej));
}

/** Đợi (thời gian thật) tới khi điều kiện đúng – dùng khi hẹn giờ đang giả. */
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !ok(); i++) await new Promise((r) => setImmediate(r));
  expect(ok()).toBe(true);
}

beforeAll(async () => {
  const scope = {
    onmessage: null as unknown as typeof handle,
    postMessage: (msg: ImgReply) => owners.get(msg.id)!.deliver(msg),
  };
  vi.stubGlobal('self', scope);
  await import('../src/models/glb-image-worker');
  handle = scope.onmessage;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mode = 'ok';
  workers = [];
  attempts = 0;
  made = [];
  owners.clear();
  state.imports = 0;
  state.importFails = false;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('chọn đường theo trình duyệt (GLTFLoader thật)', () => {
  // [tên, UA, navigator.vendor, bộ nạp ảnh GLTFLoader dùng, có cắm thêm không]
  const cases: [string, string, string, Kind, boolean][] = [
    ['Safari macOS 17', mac('Version/17.0 Safari/605.1.15'), APPLE, 'worker', true],
    ['Safari macOS 26', mac('Version/26.0 Safari/605.1.15'), APPLE, 'worker', true],
    ['iPadOS (UA như máy Mac)', mac('Version/17.4 Safari/605.1.15'), APPLE, 'worker', true],
    ['Safari iOS 17', SAFARI_IOS_17, APPLE, 'worker', true],
    ['Zalo iOS 17', ios('17_1_2', 'Mobile/15E148 Zalo iOS/565 ZaloTheme/light ZaloLanguage/vn'), APPLE, 'worker', true],
    ['Facebook iOS 17', ios('17_0', 'Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.33.116;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBLC/vi_VN]'), APPLE, 'worker', true],
    ['Edge iOS 17 (có Version/)', ios('17_0', 'Version/17.0 EdgiOS/118.0.2088.68 Mobile/15E148 Safari/605.1.15'), APPLE, 'worker', true],
    ['Zalo iOS 16', ios('16_6', 'Mobile/15E148 Zalo iOS/565 ZaloTheme/light ZaloLanguage/vn'), APPLE, 'ImageBitmapLoader', false],
    ['Facebook iOS 16', ios('16_6', 'Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.33.116;FBSN/iOS;FBSV/16.6;FBLC/vi_VN]'), APPLE, 'ImageBitmapLoader', false],
    ['Safari iOS 16', ios('16_6', 'Version/16.6 Mobile/15E148 Safari/604.1'), APPLE, 'TextureLoader', false],
    ['Safari macOS 16', mac('Version/16.6 Safari/605.1.15'), APPLE, 'TextureLoader', false],
    ['Chrome iOS 17 (CriOS)', ios('17_0', 'CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1'), APPLE, 'TextureLoader', true],
    ['Firefox iOS 17 (FxiOS)', ios('17_0', 'FxiOS/119.0 Mobile/15E148 Safari/605.1.15'), APPLE, 'TextureLoader', true],
    ['khung xem ứng dụng trên Mac (không rõ bản)', mac('').trim(), APPLE, 'ImageBitmapLoader', false],
    ['Chrome', CHROME, GOOGLE, 'ImageBitmapLoader', false],
    ['Edge', `${CHROME} Edg/120.0.0.0`, GOOGLE, 'ImageBitmapLoader', false],
    ['Chrome macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', GOOGLE, 'ImageBitmapLoader', false],
    ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', '', 'ImageBitmapLoader', false],
    ['Chrome Android', 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', GOOGLE, 'ImageBitmapLoader', false],
  ];

  it.each(cases)('%s', async (_name, ua, vendor, want, plugin) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(ua, vendor);
    expect(s.kind).toBe(want);
    expect(s.plugin).toBe(plugin);
    // Không cắm thêm: không cả tải mã luồng phụ.
    expect(state.imports).toBe(plugin ? 1 : 0);
    if (want !== 'TextureLoader') {
      const bmp = await loadVia(s.textureLoader);
      expect(bmp.where).toBe(want === 'worker' ? 'worker' : 'main');
    }
    expect(workers.length).toBe(want === 'worker' ? 1 : 0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('webkitMajor: chỉ tin navigator.vendor của WebKit; Version/ trước, rồi OS N_ của iPhone/iPad/iPod', async () => {
    const { webkitMajor } = await import('../src/models/glb-image');
    expect(webkitMajor(SAFARI_IOS_17, APPLE)).toBe(17);
    expect(webkitMajor(SAFARI_IOS_17, GOOGLE)).toBe(0);
    expect(webkitMajor(SAFARI_IOS_17, '')).toBe(0);
    expect(webkitMajor(ios('18_2', 'Mobile/15E148 Zalo iOS/565'), APPLE)).toBe(18);
    expect(webkitMajor('Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', APPLE)).toBe(17);
    expect(webkitMajor('Mozilla/5.0 (iPod touch; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', APPLE)).toBe(17);
    // "Mac OS X 10_15_7" không phải bản iOS.
    expect(webkitMajor(mac('').trim(), APPLE)).toBe(0);
    expect(webkitMajor(mac('Version/26.1 Safari/605.1.15'), APPLE)).toBe(26);
  });

  it('?imgw=0: Safari 17 cũng chạy y như cũ (không cắm, không luồng phụ)', async () => {
    const s = await setup(SAFARI_IOS_17, APPLE, { search: '?imgw=0' });
    expect(s.kind).toBe('ImageBitmapLoader');
    expect(s.plugin).toBe(false);
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    expect(workers.length).toBe(0);
    expect(state.imports).toBe(0);
  });

  it('máy không có Worker: y như cũ', async () => {
    const s = await setup(SAFARI_IOS_17, APPLE, { noWorker: true });
    expect(s.kind).toBe('ImageBitmapLoader');
    expect(s.plugin).toBe(false);
    expect((await loadVia(s.textureLoader)).where).toBe('main');
  });

  it('tệp đơn mở từ file:// (trang gốc "null"): Safari 17 cũng y như cũ – luồng phụ WebKit không đọc được Blob của trang', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const o of [{ protocol: 'file:' }, { protocol: 'https:', origin: 'null' }]) {
      const s = await setup(SAFARI_IOS_17, APPLE, o);
      expect(s.kind).toBe('ImageBitmapLoader');
      expect(s.plugin).toBe(false);
      expect((await loadVia(s.textureLoader)).where).toBe('main');
    }
    expect(workers.length).toBe(0);
    expect(state.imports).toBe(0);
    expect(warn).not.toHaveBeenCalled();
    // Trang http(s) bình thường vẫn dùng luồng phụ.
    const web = await setup(SAFARI_IOS_17, APPLE, { protocol: 'https:', origin: 'https://kien14593-lab.github.io' });
    expect(web.kind).toBe('worker');
  });
});

describe('WebKit: giải mã ảnh trong luồng phụ', () => {
  it('ảnh giải mã trong luồng phụ, đúng tùy chọn của ImageBitmapLoader; một luồng phụ cho nhiều ảnh', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    const bmps = await Promise.all([loadVia(s.textureLoader), loadVia(s.textureLoader), loadVia(s.textureLoader)]);
    for (const b of bmps) {
      expect(b.where).toBe('worker');
      expect(b.type).toBe('image/png');
      expect(b.options).toEqual({ premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    }
    expect(made.filter((b) => b.where === 'main')).toHaveLength(0);
    expect(workers).toHaveLength(1);
    expect(workers[0].options).toEqual({ name: 'glb-image' });
    expect(workers[0].posted).toHaveLength(3);
    expect(warn).not.toHaveBeenCalled();
  });

  it('GLTFLoader thật: ảnh trong bufferView đi qua luồng phụ; texture y hệt khi tắt (?imgw=0)', async () => {
    const img = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const bin = new Uint8Array(pos.byteLength + img.length);
    bin.set(new Uint8Array(pos.buffer), 0);
    bin.set(img, pos.byteLength);
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: `data:application/octet-stream;base64,${Buffer.from(bin).toString('base64')}`, byteLength: bin.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
        { buffer: 0, byteOffset: pos.byteLength, byteLength: img.length },
      ],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
      images: [{ bufferView: 1, mimeType: 'image/png', name: 'anh' }],
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33648 }],
      textures: [{ source: 0, sampler: 0 }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    });
    const run = async (search?: string) => {
      const s = await setup(SAFARI_IOS_17, APPLE, { search });
      vi.stubGlobal('self', globalThis);
      // FileLoader (bộ đệm data:) báo tiến độ bằng ProgressEvent – Node không có.
      vi.stubGlobal(
        'ProgressEvent',
        class {
          constructor(
            readonly type: string,
            init?: object,
          ) {
            Object.assign(this, init);
          }
        },
      );
      const g = await s.loader.parseAsync(gltf, '');
      let map: THREE.Texture | null = null;
      g.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) map = ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).map;
      });
      return map! as THREE.Texture;
    };
    const on = await run();
    const off = await run('?imgw=0');
    expect((on.image as FakeBitmap).where).toBe('worker');
    expect((off.image as FakeBitmap).where).toBe('main');
    const look = (t: THREE.Texture) => ({
      name: t.name,
      flipY: t.flipY,
      colorSpace: t.colorSpace,
      wrapS: t.wrapS,
      wrapT: t.wrapT,
      magFilter: t.magFilter,
      minFilter: t.minFilter,
      generateMipmaps: t.generateMipmaps,
      mimeType: t.userData.mimeType,
      size: [(t.image as FakeBitmap).width, (t.image as FakeBitmap).height],
      options: (t.image as FakeBitmap).options,
    });
    expect(look(on)).toEqual(look(off));
    expect(look(on)).toMatchObject({ flipY: false, colorSpace: THREE.SRGBColorSpace, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.MirroredRepeatWrapping });
  });

  it('luồng phụ báo lỗi một ảnh (sau khi đã giải mã được ảnh khác): ảnh đó giải mã trên luồng chính, ảnh sau vẫn gửi luồng phụ; một cảnh báo', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    expect((await loadVia(s.textureLoader)).where).toBe('worker');
    mode = 'reply-error';
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    mode = 'ok';
    expect((await loadVia(s.textureLoader)).where).toBe('worker');
    expect(workers).toHaveLength(1);
    expect(workers[0].posted).toHaveLength(4);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('ảnh rỗng (0×0) từ luồng phụ: bỏ (close), giải mã lại trên luồng chính', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    expect((await loadVia(s.textureLoader)).where).toBe('worker');
    mode = 'empty';
    const b = await loadVia(s.textureLoader);
    expect(b.where).toBe('main');
    expect(b.width).toBe(4);
    const empty = made.filter((m) => m.where === 'worker' && m.width === 0);
    expect(empty).toHaveLength(1);
    expect(empty[0].closed).toBe(true);
    mode = 'ok';
    expect((await loadVia(s.textureLoader)).where).toBe('worker');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('luồng phụ không trả lời 6 giây: ảnh đang chờ giải mã trên luồng chính, thôi dùng luồng phụ đến hết phiên', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mode = 'hang';
    let got: FakeBitmap | undefined;
    void loadVia(s.textureLoader).then((b) => (got = b));
    await until(() => workers[0]?.posted.length === 1);
    await vi.advanceTimersByTimeAsync(5900);
    expect(got).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    await until(() => got !== undefined);
    expect(got!.where).toBe('main');
    expect(workers[0].terminated).toBe(true);
    vi.useRealTimers();
    mode = 'ok';
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    expect(attempts).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('hẹn giờ chạy trễ (luồng chính vừa bận lâu): đợi thêm, không bỏ ảnh luồng phụ đã giải mã xong', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mode = 'hold';
    let got: FakeBitmap | undefined;
    void loadVia(s.textureLoader).then((b) => (got = b));
    await until(() => workers[0]?.posted.length === 1);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => workers[0].held.length === 1);
    // Luồng chính bận 9 giây: hẹn 6 giây chạy trễ 3 giây, thư trả lời còn xếp hàng phía sau.
    now = 9000;
    await vi.advanceTimersByTimeAsync(6000);
    expect(workers[0].terminated).toBe(false);
    workers[0].release();
    await until(() => got !== undefined);
    expect(got!.where).toBe('worker');
    expect(warn).not.toHaveBeenCalled();
  });

  it('rảnh 8 giây: tắt luồng phụ, ảnh sau mở luồng phụ mới (không phải lỗi)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let got: FakeBitmap | undefined;
    void loadVia(s.textureLoader).then((b) => (got = b));
    await until(() => workers[0]?.posted.length === 1);
    await vi.advanceTimersByTimeAsync(10);
    await until(() => got !== undefined);
    expect(got!.where).toBe('worker');
    await vi.advanceTimersByTimeAsync(7900);
    expect(workers[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(workers[0].terminated).toBe(true);
    vi.useRealTimers();
    expect((await loadVia(s.textureLoader)).where).toBe('worker');
    expect(workers).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });

  const broken: [string, Mode][] = [
    ['không dựng được luồng phụ', 'throw'],
    ['luồng phụ lỗi lúc chạy (onerror)', 'onerror'],
    ['luồng phụ không có createImageBitmap', 'fatal'],
    ['lỗi ngay ảnh đầu (vd. WebKit không cho luồng phụ đọc Blob)', 'reply-error'],
    ['ảnh đầu rỗng (0×0)', 'empty'],
  ];
  it.each(broken)('%s: một cảnh báo, ảnh giải mã trên luồng chính đến hết phiên', async (_name, m) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await setup(SAFARI_IOS_17, APPLE);
    mode = m;
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    mode = 'ok';
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    // Tệp GLB sau: giữ ImageBitmapLoader gốc.
    const next = await s.parse();
    expect(next.kind).toBe('ImageBitmapLoader');
    expect((await loadVia(next.textureLoader)).where).toBe('main');
    expect(attempts).toBe(1);
    for (const w of workers) expect(w.terminated).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('không tải được mã luồng phụ: một cảnh báo, như cũ', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.importFails = true;
    const s = await setup(SAFARI_IOS_17, APPLE);
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    expect((await loadVia(s.textureLoader)).where).toBe('main');
    const next = await s.parse();
    expect(next.kind).toBe('ImageBitmapLoader');
    expect((await loadVia(next.textureLoader)).where).toBe('main');
    expect(attempts).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('mã luồng phụ: ảnh hỏng thì trả lời lỗi thay vì im lặng', async () => {
    const posted: ImgReply[] = [];
    const sink = { deliver: (m: ImgReply) => posted.push(m) } as unknown as FakeWorker;
    owners.set(99, sink);
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new DOMException('ảnh hỏng', 'InvalidStateError')));
    await handle({ data: { id: 99, blob: new Blob([new Uint8Array(4)]), options: {} } });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toHaveProperty('error');
    expect(posted[0]).not.toHaveProperty('fatal');
  });
});
