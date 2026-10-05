import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Thứ tự tải mô hình AI (models/glb.ts) trên mạng chậm: bé (luôn ở giữa màn hình) tải trước nhất, khu vực sau;
 * vào thế giới thì ảnh bé ở màn tiêu đề / tạo hồ sơ nhường đường. Không giải nén GLB thật – chỉ kiểm tra tệp nào
 * được tải, lúc nào, ưu tiên cao hay thấp.
 */
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder(): void {}
    parseAsync(): Promise<unknown> {
      return Promise.resolve({ scene: null, animations: [] });
    }
  },
}));
vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({ MeshoptDecoder: {} }));

/** Một lần tải (fetch giả): gửi dữ liệu từng phần, xong hoặc bị hủy. */
interface Req {
  url: string;
  priority: string;
  signal: AbortSignal;
  /** Gửi n byte (lần đầu kèm đầu tệp GLB ghi tổng dung lượng). */
  send(n: number, total?: number): void;
  end(): void;
}

let reqs: Req[] = [];
let glb: typeof import('../src/models/glb');

function fakeFetch(url: string, init: RequestInit & { priority?: string }): Promise<Response> {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (ctrl = c) });
  reqs.push({
    url,
    priority: init.priority ?? 'auto',
    signal: init.signal!,
    send(n, total = n) {
      const b = new Uint8Array(n);
      if (!sent) {
        const dv = new DataView(b.buffer);
        dv.setUint32(0, 0x46546c67, true);
        dv.setUint32(4, 2, true);
        dv.setUint32(8, total, true);
      }
      sent += n;
      ctrl.enqueue(b);
    },
    end: () => ctrl.close(),
  });
  init.signal!.addEventListener('abort', () => ctrl.error(new DOMException('Đã hủy', 'AbortError')));
  return Promise.resolve(new Response(body));
}

const tick = () => new Promise((r) => setTimeout(r, 5));
const started = () => reqs.map((r) => r.url);
const req = (url: string) => reqs.filter((r) => r.url === url).at(-1)!;
async function finish(url: string): Promise<void> {
  const r = req(url);
  r.send(16);
  r.end();
  await tick();
}

beforeEach(async () => {
  reqs = [];
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.resetModules();
  glb = await import('../src/models/glb');
  for (const k of ['kid', 'npc1', 'npc2', 'gai', 'x']) glb.defineGlbModel(k, { src: `${k}.glb` });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tải mô hình AI: bé trước nhất (mạng chậm)', () => {
  it('first: tải bé trước, tệp khác chờ bé xong mới bắt đầu', async () => {
    const p = glb.ensureGlb(['npc1', 'kid', 'npc2'], { first: ['kid'] });
    await tick();
    expect(started()).toEqual(['kid.glb']);
    expect(req('kid.glb').priority).toBe('high');
    await finish('kid.glb');
    expect(glb.glbReady(['kid'])).toBe(true);
    expect(started()).toEqual(['kid.glb', 'npc1.glb', 'npc2.glb']);
    expect(req('npc1.glb').priority).toBe('high');
    await finish('npc1.glb');
    await finish('npc2.glb');
    await expect(p).resolves.toBe(true);
  });

  it('không có first: tải mọi tệp cùng lúc như cũ', async () => {
    const p = glb.ensureGlb(['npc1', 'kid']);
    await tick();
    expect(started()).toEqual(['npc1.glb', 'kid.glb']);
    await finish('npc1.glb');
    await finish('kid.glb');
    await expect(p).resolves.toBe(true);
  });

  it('tệp đang tải dở thì vẫn tải tiếp cùng lúc với bé', async () => {
    void glb.ensureGlb(['npc1']);
    await tick();
    const p = glb.ensureGlb(['kid', 'npc1', 'npc2'], { first: ['kid'] });
    await tick();
    expect(started()).toEqual(['npc1.glb', 'kid.glb']);
    await finish('kid.glb');
    expect(started()).toEqual(['npc1.glb', 'kid.glb', 'npc2.glb']);
    await finish('npc1.glb');
    await finish('npc2.glb');
    await expect(p).resolves.toBe(true);
  });

  it('quá hạn chờ khi bé chưa tải xong: phần còn lại tải dần ở nền, từng tệp, ưu tiên thấp', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = glb.ensureGlb(['kid', 'npc1', 'npc2'], { first: ['kid'], timeoutMs: 20 });
    await expect(p).resolves.toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(started()).toEqual(['kid.glb']);
    await finish('kid.glb');
    expect(started()).toEqual(['kid.glb', 'npc1.glb']);
    expect(req('npc1.glb').priority).toBe('low');
    await finish('npc1.glb');
    expect(started()).toEqual(['kid.glb', 'npc1.glb', 'npc2.glb']);
    expect(req('npc2.glb').priority).toBe('low');
    await finish('npc2.glb');
    expect(glb.glbReady(['kid', 'npc1', 'npc2'])).toBe(true);
  });

  it('trong lúc chờ bé, tệp nạp trước ở nền nhường đường và không chen vào trước khu vực', async () => {
    glb.prefetchGlb(['x']);
    await tick();
    expect(started()).toEqual(['x.glb']);
    expect(req('x.glb').priority).toBe('low');
    const p = glb.ensureGlb(['kid', 'npc1'], { first: ['kid'] });
    await tick();
    expect(req('x.glb').signal.aborted).toBe(true);
    expect(started()).toEqual(['x.glb', 'kid.glb']);
    await finish('kid.glb');
    expect(started()).toEqual(['x.glb', 'kid.glb', 'npc1.glb']);
    await finish('npc1.glb');
    await expect(p).resolves.toBe(true);
    // Khu vực xong: nạp trước ở nền tiếp tục.
    expect(started()).toEqual(['x.glb', 'kid.glb', 'npc1.glb', 'x.glb']);
    expect(req('x.glb').priority).toBe('low');
  });

  it('gọi ensureGlb liền nhau (vd. sở thú nạp từng con): tệp nạp trước đang xếp hàng không bị bắt đầu rồi hủy giữa chừng', async () => {
    const got: string[] = [];
    const loop = (async () => {
      for (const k of ['npc1', 'npc2', 'kid']) {
        await glb.ensureGlb([k]);
        got.push(k);
      }
    })();
    await tick();
    glb.prefetchGlb(['x']);
    await tick();
    expect(started()).toEqual(['npc1.glb']);
    await finish('npc1.glb');
    expect(started()).toEqual(['npc1.glb', 'npc2.glb']);
    await finish('npc2.glb');
    await finish('kid.glb');
    await loop;
    expect(got).toEqual(['npc1', 'npc2', 'kid']);
    // Hết người chờ: tệp nền bắt đầu – một lần, ưu tiên thấp, không bị hủy.
    expect(started()).toEqual(['npc1.glb', 'npc2.glb', 'kid.glb', 'x.glb']);
    expect(req('x.glb').priority).toBe('low');
    expect(reqs.some((r) => r.signal.aborted)).toBe(false);
    await finish('x.glb');
    expect(glb.glbLoaded('x')).toBe(true);
  });
});

describe('lowerGlb: vào thế giới thì ảnh bé ở màn tiêu đề / tạo hồ sơ nhường đường', () => {
  it('tệp chưa tải quá nửa tạm dừng (tải lại ở nền sau), tệp đã quá nửa thì tải tiếp', async () => {
    const pGai = glb.ensureGlb(['gai']);
    const pX = glb.ensureGlb(['x']);
    void glb.ensureGlb(['kid']);
    await tick();
    req('gai.glb').send(20, 100);
    req('x.glb').send(60, 100);
    await tick();
    glb.lowerGlb();
    const p = glb.ensureGlb(['kid', 'npc1'], { first: ['kid'] });
    await tick();
    expect(req('gai.glb').signal.aborted).toBe(true);
    expect(req('x.glb').signal.aborted).toBe(false);
    expect(req('kid.glb').signal.aborted).toBe(false);
    // Ảnh bé gái thôi chờ (giữ bóng bé tạm), không báo lỗi tệp.
    await expect(pGai).resolves.toBe(false);
    expect(glb.glbReady(['gai'])).toBe(false);
    await finish('kid.glb');
    expect(started()).toEqual(['gai.glb', 'x.glb', 'kid.glb', 'npc1.glb']);
    await finish('x.glb');
    await expect(pX).resolves.toBe(true);
    await finish('npc1.glb');
    await expect(p).resolves.toBe(true);
    // Rảnh mạng: bé gái tải lại ở nền.
    expect(started()).toEqual(['gai.glb', 'x.glb', 'kid.glb', 'npc1.glb', 'gai.glb']);
    expect(req('gai.glb').priority).toBe('low');
    await finish('gai.glb');
    expect(glb.glbLoaded('gai')).toBe(true);
  });

  it('mạng rất chậm: tệp khu vực còn đang tải từ màn tiêu đề (chưa quá nửa) đợi bé xong, tệp đã quá nửa tải tiếp', async () => {
    // Màn tiêu đề chờ quá hạn: npc1, npc2 vẫn đang tải; bấm vào chơi thì bé (chưa tải) cần trước nhất.
    void glb.ensureGlb(['npc1', 'npc2']);
    await tick();
    req('npc1.glb').send(20, 100);
    req('npc2.glb').send(60, 100);
    await tick();
    glb.lowerGlb();
    const p = glb.ensureGlb(['npc1', 'npc2', 'kid'], { first: ['kid'] });
    await tick();
    expect(req('npc1.glb').signal.aborted).toBe(true);
    expect(req('npc2.glb').signal.aborted).toBe(false);
    expect(started()).toEqual(['npc1.glb', 'npc2.glb', 'kid.glb']);
    await finish('kid.glb');
    expect(started()).toEqual(['npc1.glb', 'npc2.glb', 'kid.glb', 'npc1.glb']);
    expect(req('npc1.glb').priority).toBe('high');
    await finish('npc2.glb');
    await finish('npc1.glb');
    await expect(p).resolves.toBe(true);
  });
});
