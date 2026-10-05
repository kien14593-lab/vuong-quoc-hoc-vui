import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Thứ tự tải mô hình AI (models/glb.ts) trên mạng chậm: bé (luôn ở giữa màn hình) tải trước nhất, khu vực sau;
 * vào thế giới thì ảnh bé ở màn tiêu đề / tạo hồ sơ nhường đường. Không giải nén GLB thật – chỉ kiểm tra tệp nào
 * được tải, lúc nào, ưu tiên cao hay thấp.
 */
const parse = vi.hoisted(() => ({ gate: null as Promise<void> | null }));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder(): void {}
    parseAsync(): Promise<unknown> {
      return (parse.gate ?? Promise.resolve()).then(() => ({ scene: null, animations: [] }));
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
  parse.gate = null;
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

  it('tệp ưu tiên thấp chưa quá nửa mà cảnh mới cần: đợi bé xong rồi tải lại ở ưu tiên cao; tệp đã quá nửa tải tiếp', async () => {
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

  it('vào khu vực (game/app.ts goZone): tệp khu vực còn đang tải từ màn tiêu đề tải tiếp cùng lúc với bé, không tải lại từ đầu', async () => {
    // Màn tiêu đề chờ quá hạn: npc1 (mới 20%), npc2 vẫn đang tải; bấm vào chơi ngay – khu vực cần npc1, npc2 và bé.
    void glb.ensureGlb(['npc1', 'npc2']);
    await tick();
    req('npc1.glb').send(20, 100);
    req('npc2.glb').send(60, 100);
    await tick();
    glb.lowerGlb(['npc1', 'npc2', 'kid']);
    const p = glb.ensureGlb(['npc1', 'npc2', 'kid'], { first: ['kid'] });
    await tick();
    expect(req('npc1.glb').signal.aborted).toBe(false);
    expect(req('npc2.glb').signal.aborted).toBe(false);
    expect(req('kid.glb').priority).toBe('high');
    await finish('npc1.glb');
    await finish('kid.glb');
    await finish('npc2.glb');
    await expect(p).resolves.toBe(true);
    expect(started()).toEqual(['npc1.glb', 'npc2.glb', 'kid.glb']);
  });

  it('vào khu vực quá hạn mà bé chưa xong (game/app.ts KID_GRACE_MS): chờ riêng bé thêm – dùng tiếp lần tải bé, tệp khu vực vẫn tải tiếp', async () => {
    void glb.ensureGlb(['npc1']);
    await tick();
    req('npc1.glb').send(20, 100);
    await tick();
    glb.lowerGlb(['npc1', 'kid']);
    await expect(glb.ensureGlb(['npc1', 'kid'], { first: ['kid'], timeoutMs: 20, quiet: true })).resolves.toBe(false);
    const grace = glb.ensureGlb(['kid'], { timeoutMs: 1000, quiet: true });
    await tick();
    expect(req('npc1.glb').signal.aborted).toBe(false);
    await finish('kid.glb');
    await expect(grace).resolves.toBe(true);
    expect(started()).toEqual(['npc1.glb', 'kid.glb']);
    await finish('npc1.glb');
    expect(glb.glbReady(['npc1', 'kid'])).toBe(true);
  });

  it('vào khu vực: bé vừa xong thì thú cưng tải ngay (game/app.ts goZone) – tệp nạp nền không chen vào khe hở rồi bị hủy', async () => {
    glb.prefetchGlb(['x']);
    await tick();
    const go = (async () => {
      await glb.ensureGlb(['kid'], { first: ['kid'], timeoutMs: 20, quiet: true });
      await glb.ensureGlb(['kid'], { timeoutMs: 1000, quiet: true });
      void glb.ensureGlb(['npc2']);
    })();
    await tick();
    expect(req('x.glb').signal.aborted).toBe(true);
    await new Promise((r) => setTimeout(r, 30));
    await finish('kid.glb');
    await go;
    expect(started()).toEqual(['x.glb', 'kid.glb', 'npc2.glb']);
    await finish('npc2.glb');
    // Hết người chờ: tệp nền tải lại – một lần, ưu tiên thấp.
    expect(started()).toEqual(['x.glb', 'kid.glb', 'npc2.glb', 'x.glb']);
    expect(req('x.glb').priority).toBe('low');
    expect(req('x.glb').signal.aborted).toBe(false);
  });

  it('keep: tệp cảnh sắp vào cũng cần (vd. dân làng tải từ màn tiêu đề) tải tiếp, không bỏ phần đã tải', async () => {
    void glb.ensureGlb(['npc2', 'x']);
    await tick();
    req('npc2.glb').send(20, 100);
    req('x.glb').send(20, 100);
    await tick();
    glb.lowerGlb(['npc2']);
    const p = glb.ensureGlb(['kid', 'npc1'], { first: ['kid'] });
    await tick();
    expect(req('npc2.glb').signal.aborted).toBe(false);
    expect(req('x.glb').signal.aborted).toBe(true);
    await finish('kid.glb');
    await finish('npc1.glb');
    await expect(p).resolves.toBe(true);
    // Cảnh mới hỏi tệp đang tải dở: dùng tiếp lần tải đó, không tải lại từ đầu.
    const q = glb.ensureGlb(['npc2']);
    await finish('npc2.glb');
    await expect(q).resolves.toBe(true);
    expect(reqs.filter((r) => r.url === 'npc2.glb')).toHaveLength(1);
  });

  it('quiet: chờ ngắn có chủ ý (thay tại chỗ sau) – quá hạn không ghi cảnh báo', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(glb.ensureGlb(['npc1'], { timeoutMs: 20, quiet: true })).resolves.toBe(false);
    expect(warn).not.toHaveBeenCalled();
    await finish('npc1.glb');
    expect(glb.glbReady(['npc1'])).toBe(true);
  });
});

describe('preloadGlb inOrder: màn hình tiêu đề tải lần lượt từng mô hình (main.ts)', () => {
  it('từng tệp theo thứ tự, ưu tiên cao: tệp sau bắt đầu ngay khi tệp trước tải về xong', async () => {
    const prog: number[] = [];
    const p = glb.preloadGlb(['npc1', 'npc2', 'x'], { inOrder: true, onProgress: (f) => prog.push(f) });
    await tick();
    expect(started()).toEqual(['npc1.glb']);
    expect(req('npc1.glb').priority).toBe('high');
    await finish('npc1.glb');
    expect(started()).toEqual(['npc1.glb', 'npc2.glb']);
    expect(req('npc2.glb').priority).toBe('high');
    await finish('npc2.glb');
    expect(started()).toEqual(['npc1.glb', 'npc2.glb', 'x.glb']);
    await finish('x.glb');
    await p;
    expect(glb.glbReady(['npc1', 'npc2', 'x'])).toBe(true);
    expect(prog.every((f, i) => i === 0 || f >= prog[i - 1])).toBe(true);
    expect(prog.at(-1)).toBe(1);
  });

  it('quá hạn chờ: tệp đang tải tải tiếp, không bắt đầu tệp mới (world/title.ts loadLate tải phần còn lại)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await glb.preloadGlb(['npc1', 'npc2'], { inOrder: true, timeoutMs: 20, quiet: true });
    expect(warn).not.toHaveBeenCalled();
    expect(started()).toEqual(['npc1.glb']);
    expect(req('npc1.glb').signal.aborted).toBe(false);
    await finish('npc1.glb');
    await tick();
    expect(glb.glbReady(['npc1'])).toBe(true);
    expect(started()).toEqual(['npc1.glb']);
  });

  it('quá hạn chờ khi hẹn giờ báo sớm hơn đồng hồ (performance.now): vẫn không bắt đầu tệp mới', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(performance.now());
    await glb.preloadGlb(['npc1', 'npc2'], { inOrder: true, timeoutMs: 20, quiet: true });
    expect(started()).toEqual(['npc1.glb']);
  });

  it('không đợi giải nén: tệp trước đang giải nén thì tệp sau đã tải (mở lại trang – bộ nhớ đệm – giải nén song song)', async () => {
    let open!: () => void;
    parse.gate = new Promise<void>((r) => (open = r));
    const p = glb.preloadGlb(['npc1', 'npc2'], { inOrder: true });
    await tick();
    expect(started()).toEqual(['npc1.glb']);
    await finish('npc1.glb');
    expect(glb.glbReady(['npc1'])).toBe(false);
    expect(started()).toEqual(['npc1.glb', 'npc2.glb']);
    await finish('npc2.glb');
    let over = false;
    void p.then(() => (over = true));
    await tick();
    expect(over).toBe(false);
    open();
    await p;
    expect(glb.glbReady(['npc1', 'npc2'])).toBe(true);
  });

  it('tệp đến không chậm (mạng 4G / Wi-Fi tốt, mở lại trang – bộ nhớ đệm): các tệp còn lại tải cùng lúc, không chờ từng tệp', async () => {
    const p = glb.preloadGlb(['npc1', 'npc2', 'x'], { inOrder: true });
    await tick();
    expect(started()).toEqual(['npc1.glb']);
    const r = req('npc1.glb');
    r.send(4 << 20);
    r.end();
    await tick();
    expect(started()).toEqual(['npc1.glb', 'npc2.glb', 'x.glb']);
    await finish('npc2.glb');
    await finish('x.glb');
    await p;
    expect(glb.glbReady(['npc1', 'npc2', 'x'])).toBe(true);
  });

  it('không có inOrder: tải mọi tệp cùng lúc như cũ (trang xem thử)', async () => {
    const p = glb.preloadGlb(['npc1', 'npc2']);
    await tick();
    expect(started()).toEqual(['npc1.glb', 'npc2.glb']);
    await finish('npc1.glb');
    await finish('npc2.glb');
    await p;
    expect(glb.glbReady(['npc1', 'npc2'])).toBe(true);
  });
});
