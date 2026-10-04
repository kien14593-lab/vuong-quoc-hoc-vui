import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readVec3, type LodData, type LodReply, type LodRequest } from '../src/world/lod-core';

/**
 * Rút gọn lưới LOD (world/lod.ts) trong luồng phụ (world/lod-worker.ts): kết quả phải giống hệt cách cũ (rút gọn ngay
 * trên luồng chính, đọc đỉnh bằng getX của three) tới từng chỉ mục, dù đi đường luồng phụ hay đường dự phòng
 * (máy không có luồng phụ, luồng phụ hỏng hoặc báo lỗi).
 */

// Bản "luồng phụ" lúc kiểm thử chỉ là hàm dựng Worker toàn cục (luồng phụ giả bên dưới).
vi.mock('../src/world/lod-worker?worker&inline', () => ({
  default: class {
    constructor(options?: { name?: string }) {
      return new (globalThis as unknown as { Worker: new (url: string, o?: unknown) => object }).Worker('lod-worker', options);
    }
  },
}));

type Mode = 'ok' | 'error' | 'reply-error';
let mode: Mode = 'ok';
let workers: FakeWorker[] = [];
const owners = new Map<number, FakeWorker>();
/** Bộ nhận thư của mã thật world/lod-worker.ts. */
let handle: (e: { data: LodRequest }) => Promise<void>;

/** Luồng phụ giả: chạy đúng mã world/lod-worker.ts trong cùng tiến trình; thư đi/về được chép (và chuyển giao) như thật. */
class FakeWorker {
  onmessage: ((e: { data: LodReply }) => void) | null = null;
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  replies: LodReply[] = [];
  constructor() {
    workers.push(this);
  }
  postMessage(msg: LodRequest, transfer: Transferable[]): void {
    const data = structuredClone(msg, { transfer });
    setTimeout(() => {
      if (this.terminated) return;
      if (mode === 'error') this.onerror?.({ message: 'hỏng', preventDefault() {} });
      else if (mode === 'reply-error') this.deliver({ id: data.id, error: 'hỏng' }, []);
      else {
        owners.set(data.id, this);
        void handle({ data });
      }
    }, 0);
  }
  deliver(msg: LodReply, transfer: Transferable[]): void {
    const data = structuredClone(msg, { transfer });
    this.replies.push(data);
    setTimeout(() => !this.terminated && this.onmessage?.({ data }), 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

/** Cách làm trước khi có luồng phụ (chép nguyên văn, bỏ phần nhường máy): đáp án đúng. */
function reference(src: THREE.BufferGeometry, S: typeof MeshoptSimplifier): LodData {
  const pos = src.getAttribute('position');
  const index = src.getIndex()!;
  const n = pos.count;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    P[i * 3] = pos.getX(i);
    P[i * 3 + 1] = pos.getY(i);
    P[i * 3 + 2] = pos.getZ(i);
  }
  const nor = src.getAttribute('normal');
  let N: Float32Array | null = null;
  if (nor) {
    N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      N[i * 3] = nor.getX(i);
      N[i * 3 + 1] = nor.getY(i);
      N[i * 3 + 2] = nor.getZ(i);
    }
  }
  const I = new Uint32Array(index.count);
  for (let i = 0; i < I.length; i++) I[i] = index.getX(i);
  const scale = S.getScale(P, 3);
  const target = (k: number) => Math.max(3, Math.floor((I.length * k) / 3) * 3);
  const smooth = (k: number, cap: number) => (N ? S.simplifyWithAttributes(I, P, 3, N, 3, [0.5, 0.5, 0.5], null, target(k), cap) : S.simplify(I, P, 3, target(k), cap));
  const parts: [Uint32Array, number][] = [[I, 0]];
  parts.push(smooth(0.5, 0.01));
  parts.push(smooth(0.25, 0.02));
  parts.push(S.simplifySloppy(I, P, 3, null, 1200 * 3, 1));
  parts.push(S.simplifySloppy(I, P, 3, null, 800 * 3, 1));
  const total = parts.reduce((s, [a]) => s + a.length, 0);
  const all = n < 65536 ? new Uint16Array(total) : new Uint32Array(total);
  const levels: LodData['levels'] = [];
  let at = 0;
  for (const [a, e] of parts) {
    all.set(a, at);
    levels.push({ start: at, count: a.length, err: e * scale });
    at += a.length;
  }
  return { index: all, levels };
}

/** Gồ ghề theo pháp tuyến để giới hạn sai lệch của các mức mịn thật sự có tác dụng (lưới trơn tới đích số tam giác trước). */
function bumpy<T extends THREE.BufferGeometry>(g: T, amp: number): T {
  const p = g.attributes.position;
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const d = amp * Math.sin(i * 1.3) * Math.cos(i * 0.481);
    p.setXYZ(i, p.getX(i) + nr.getX(i) * d, p.getY(i) + nr.getY(i) * d, p.getZ(i) + nr.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

/** Giống GLB của công cụ: vị trí Int16 và pháp tuyến Int8 chuẩn hóa, xen kẽ bước 4; chỉ mục 16 bit. */
function glbLike(): THREE.BufferGeometry {
  const g = bumpy(new THREE.TorusKnotGeometry(1, 0.35, 160, 24), 0.1);
  const n = g.attributes.position.count;
  const p = new Int16Array(n * 4);
  const q = new Int8Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      p[i * 4 + c] = Math.round((g.attributes.position.getComponent(i, c) / 2) * 32767);
      q[i * 4 + c] = Math.round(g.attributes.normal.getComponent(i, c) * 127);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(p, 4), 3, 0, true));
  out.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(q, 4), 3, 0, true));
  out.setAttribute('uv', g.attributes.uv);
  out.setIndex(new THREE.BufferAttribute(new Uint16Array(g.index!.array), 1));
  return out;
}

/** Số thực, không pháp tuyến (rút gọn chỉ theo vị trí). */
function noNormals(): THREE.BufferGeometry {
  const g = bumpy(new THREE.SphereGeometry(1, 64, 32), 0.1);
  g.deleteAttribute('normal');
  return g;
}

/** Trên 65535 đỉnh: chỉ mục các mức là 32 bit. */
function big(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(4, 4, 256, 256);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * Math.cos(p.getY(i) * 2) * 0.3);
  g.computeVertexNormals();
  return g;
}

function bytes(a: ArrayBufferView): Buffer {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength);
}

function expectSame(mesh: THREE.Mesh, want: LodData): void {
  const got = mesh.geometry.index!.array;
  expect(got.constructor).toBe(want.index.constructor);
  expect(bytes(got).equals(bytes(want.index))).toBe(true);
  expect(mesh.geometry.drawRange.start).toBe(0);
  expect(mesh.geometry.drawRange.count).toBe(want.levels[0].count);
  expect(mesh.userData.lod).toBe(true);
}

function shared(g: THREE.BufferGeometry): THREE.Mesh {
  g.userData.shared = true;
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial());
}

async function loadLod(withWorker: boolean): Promise<typeof import('../src/world/lod')> {
  vi.resetModules();
  if (withWorker) vi.stubGlobal('Worker', FakeWorker);
  return import('../src/world/lod');
}

describe('LOD: rút gọn lưới trong luồng phụ, kết quả y hệt cách cũ', () => {
  const S = MeshoptSimplifier;
  const cases = [
    ['GLB lượng tử hóa xen kẽ', glbLike],
    ['không pháp tuyến', noNormals],
    ['trên 65535 đỉnh', big],
  ] as const;
  const want = new Map<string, LodData>();

  beforeAll(async () => {
    await S.ready;
    for (const [name, make] of cases) want.set(name, reference(make(), S));
    const scope = {
      onmessage: null as unknown as typeof handle,
      postMessage: (msg: LodReply, transfer?: Transferable[]) => owners.get(msg.id)!.deliver(msg, transfer ?? []),
    };
    vi.stubGlobal('self', scope);
    await import('../src/world/lod-worker');
    handle = scope.onmessage;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mode = 'ok';
    workers = [];
    owners.clear();
  });

  it('đọc đỉnh y hệt getX/getY/getZ của three với mọi kiểu dữ liệu', async () => {
    const { lodJob } = await loadLod(false);
    const n = 40;
    const ints = (len: number, lo: number, hi: number) => Array.from({ length: len }, (_, i) => (i % 7 === 0 ? lo : i % 11 === 0 ? hi : lo + ((i * 7919) % (hi - lo + 1))));
    const floats = (len: number) => Array.from({ length: len }, (_, i) => Math.sin(i * 1.7) * 3.3);
    const ib = (a: THREE.TypedArray, stride: number, offset: number, normalized: boolean) => new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(a, stride), 3, offset, normalized);
    const attrs: [string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute][] = [
      ['Float32', new THREE.Float32BufferAttribute(floats(n * 3), 3)],
      ['Float32 chuẩn hóa', new THREE.BufferAttribute(new Float32Array(floats(n * 3)), 3, true)],
      ['Int16 chuẩn hóa xen kẽ', ib(new Int16Array(ints(n * 4, -32768, 32767)), 4, 0, true)],
      ['Int8 chuẩn hóa xen kẽ, lệch 1', ib(new Int8Array(ints(n * 4, -128, 127)), 4, 1, true)],
      ['Float32 xen kẽ (sau vị trí)', ib(new Float32Array(floats(n * 6)), 6, 3, false)],
      ['Uint16 chuẩn hóa', new THREE.BufferAttribute(new Uint16Array(ints(n * 3, 0, 65535)), 3, true)],
      ['Uint8 chuẩn hóa', new THREE.BufferAttribute(new Uint8Array(ints(n * 3, 0, 255)), 3, true)],
      ['Uint8Clamped chuẩn hóa', new THREE.BufferAttribute(new Uint8ClampedArray(ints(n * 3, 0, 255)), 3, true)],
      ['Int32 chuẩn hóa', new THREE.BufferAttribute(new Int32Array(ints(n * 3, -2147483648, 2147483647)), 3, true)],
      ['Uint32 chuẩn hóa', new THREE.BufferAttribute(new Uint32Array(ints(n * 3, 0, 4294967295)), 3, true)],
      ['Int16 không chuẩn hóa', new THREE.BufferAttribute(new Int16Array(ints(n * 3, -32768, 32767)), 3)],
      ['số thực 16 bit', new THREE.Float16BufferAttribute(floats(n * 3), 3)],
      ['Float64', new THREE.BufferAttribute(new Float64Array(floats(n * 3)), 3)],
    ];
    for (const [name, attr] of attrs) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', attr);
      g.setAttribute('normal', attr);
      g.setIndex([0, 1, 2]);
      const job = lodJob(g)!;
      const expected = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        expected[i * 3] = attr.getX(i);
        expected[i * 3 + 1] = attr.getY(i);
        expected[i * 3 + 2] = attr.getZ(i);
      }
      expect(Array.from(readVec3(job.pos, n)), name).toEqual(Array.from(expected));
      expect(Array.from(readVec3(job.nor!, n)), name).toEqual(Array.from(expected));
    }
  });

  it('đường luồng phụ: giống hệt cách cũ; mảng đỉnh gốc không bị chuyển đi; dùng lại một luồng phụ', async () => {
    const { addLod } = await loadLod(true);
    for (const [name, make] of cases) {
      const geo = make();
      const mesh = shared(geo);
      expect(await addLod(mesh), name).toBe(1);
      expectSame(mesh, want.get(name)!);
      const reply = workers[0].replies.at(-1)!;
      expect('levels' in reply && reply.levels, name).toEqual(want.get(name)!.levels);
      for (const a of [geo.attributes.position, geo.attributes.normal, geo.index!]) if (a) expect(a.array.byteLength, name).toBeGreaterThan(0);
    }
    expect(workers.length).toBe(1);
  });

  it('máy không có luồng phụ: rút gọn trên luồng chính, kết quả y hệt', async () => {
    const { addLod } = await loadLod(false);
    for (const [name, make] of cases) {
      const mesh = shared(make());
      expect(await addLod(mesh), name).toBe(1);
      expectSame(mesh, want.get(name)!);
    }
    expect(workers.length).toBe(0);
  });

  it('luồng phụ hỏng: chuyển hẳn sang luồng chính, kết quả y hệt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { addLod } = await loadLod(true);
    mode = 'error';
    for (const [name, make] of cases) {
      const mesh = shared(make());
      expect(await addLod(mesh), name).toBe(1);
      expectSame(mesh, want.get(name)!);
    }
    expect(workers.length).toBe(1);
    expect(workers[0].terminated).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('luồng phụ báo lỗi một việc: việc đó làm trên luồng chính, việc sau vẫn gửi luồng phụ', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { addLod } = await loadLod(true);
    mode = 'reply-error';
    const first = shared(glbLike());
    expect(await addLod(first)).toBe(1);
    expectSame(first, want.get('GLB lượng tử hóa xen kẽ')!);
    expect(warn).toHaveBeenCalledTimes(1);
    mode = 'ok';
    const second = shared(noNormals());
    expect(await addLod(second)).toBe(1);
    expectSame(second, want.get('không pháp tuyến')!);
    expect(workers.length).toBe(1);
    expect(workers[0].replies.at(-1)).toHaveProperty('levels');
  });

  it('dữ liệu lạ: luồng phụ trả lời lỗi thay vì im lặng', async () => {
    const posted: LodReply[] = [];
    owners.set(99, { deliver: (m: LodReply) => posted.push(m) } as unknown as FakeWorker);
    const bad = { array: new Float64Array(9), stride: 3, offset: 0, normalized: true } as unknown as LodRequest['pos'];
    await handle({ data: { id: 99, count: 3, pos: bad, nor: null, index: new Uint16Array([0, 1, 2]) } });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toHaveProperty('error');
  });
});
