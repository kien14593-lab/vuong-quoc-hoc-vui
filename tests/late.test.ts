import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Thay mô hình tại chỗ (world/late.ts): cảnh không chờ (hoặc chờ quá hạn) thì tạm dùng mô hình dựng bằng code, tệp nào
 * tải xong thì thay ngay – sau phần phải có, theo thứ tự, không thay lúc cảnh đang tạm dừng / đã đóng.
 * Tải tệp giả: tệp chỉ xong khi bài kiểm tra gọi land().
 */
const h = vi.hoisted(() => {
  const loaded = new Set<string>();
  const waiting = new Map<string, Array<() => void>>();
  return {
    loaded,
    waiting,
    asked: [] as string[],
    warmed: [] as string[],
    land(k: string): void {
      loaded.add(k);
      for (const r of waiting.get(k) ?? []) r();
      waiting.delete(k);
    },
  };
});

vi.mock('../src/models/glb', () => ({
  glbReady: (keys: Iterable<string>) => [...keys].every((k) => h.loaded.has(k)),
  glbLoaded: (k: string) => h.loaded.has(k),
  ensureGlb: (keys: Iterable<string>) => {
    const ks = [...keys].filter((k) => !h.loaded.has(k));
    h.asked.push(ks.join('+'));
    return Promise.all(ks.map((k) => new Promise<void>((r) => h.waiting.set(k, [...(h.waiting.get(k) ?? []), r])))).then(() => true);
  },
}));
vi.mock('../src/models/registry', () => ({ buildModel: (k: string) => ({ name: k, userData: { glb: h.loaded.has(k) } }) }));
vi.mock('../src/engine/core', () => ({
  warmUp: (o: { name: string }) => {
    h.warmed.push(o.name);
    return Promise.resolve();
  },
}));
vi.mock('../src/ui/dom', () => ({ wait: () => new Promise((r) => setTimeout(r, 1)) }));

const { loadLate } = await import('../src/world/late');
const flush = () => new Promise((r) => setTimeout(r, 20));

let swaps: string[];
let held: boolean;
let gone: boolean;
const host = {
  gone: () => gone,
  hold: () => held,
  swap: (k: string) => void swaps.push(k),
};

beforeEach(() => {
  h.loaded.clear();
  h.waiting.clear();
  h.asked.length = 0;
  h.warmed.length = 0;
  swaps = [];
  held = false;
  gone = false;
});

describe('thay mô hình tại chỗ (late.ts)', () => {
  it('đợi phần phải có (bé trước), rồi tải lần lượt và thay từng mô hình ngay khi tệp xong', async () => {
    h.loaded.add('a');
    const done = loadLate(['a', 'b', 'c'], ['kid', 'm'], host, ['kid']);
    await flush();
    expect(h.asked).toEqual(['kid+m']);
    h.land('kid');
    await flush();
    expect(h.asked).toEqual(['kid+m']);
    h.land('m');
    await flush();
    // 'a' đã tải lúc dựng cảnh: nhân vật đã dùng mô hình AI – không thay lại.
    expect(h.asked).toEqual(['kid+m', 'b']);
    expect(swaps).toEqual([]);
    h.land('b');
    await flush();
    expect(h.warmed).toEqual(['b']);
    expect(swaps).toEqual(['b']);
    // Tệp kế đã bắt đầu tải ngay (không để khe hở).
    expect(h.asked).toEqual(['kid+m', 'b', 'c']);
    h.land('c');
    await done;
    await flush();
    expect(swaps).toEqual(['b', 'c']);
  });

  it('thay theo thứ tự tệp xong: tệp đang tải song song từ trước không phải đợi tệp đứng trước', async () => {
    const done = loadLate(['b', 'c'], [], host);
    await flush();
    expect(h.asked).toEqual(['b']);
    // 'c' đang tải từ trước (vd. lúc khởi động màn hình tiêu đề) và xong trước 'b'.
    h.land('c');
    await new Promise((r) => setTimeout(r, 300));
    expect(swaps).toEqual(['c']);
    h.land('b');
    await done;
    await flush();
    expect(swaps).toEqual(['c', 'b']);
    // 'c' đã xong: không tải lại.
    expect(h.asked).toEqual(['b']);
  });

  it('mọi khóa đã tải: không làm gì', async () => {
    h.loaded.add('a');
    await loadLate(['a'], ['m'], host);
    expect(h.asked).toEqual([]);
    expect(swaps).toEqual([]);
  });

  it('cảnh đang tạm dừng (trò chơi nhỏ, đang rời đi): chưa tải tiếp, chưa thay; chơi tiếp thì thay', async () => {
    held = true;
    const done = loadLate(['b'], [], host);
    await flush();
    expect(h.asked).toEqual([]);
    // Tệp xong nhờ việc khác (vd. trò chơi nhỏ cần): vẫn chưa thay khi cảnh còn khuất.
    h.land('b');
    await flush();
    expect(swaps).toEqual([]);
    expect(h.warmed).toEqual([]);
    held = false;
    await done;
    await new Promise((r) => setTimeout(r, 30));
    expect(swaps).toEqual(['b']);
  });

  it('đang tạm dừng lúc tệp vừa xong: đợi chơi tiếp mới chuẩn bị và thay', async () => {
    const done = loadLate(['b'], [], host);
    await flush();
    expect(h.asked).toEqual(['b']);
    held = true;
    h.land('b');
    await flush();
    expect(swaps).toEqual([]);
    held = false;
    await done;
    await flush();
    expect(swaps).toEqual(['b']);
  });

  it('cảnh đã đóng: thôi hẳn, không thay', async () => {
    const done = loadLate(['b', 'c'], ['m'], host);
    await flush();
    gone = true;
    h.land('m');
    await done;
    expect(h.asked).toEqual(['m']);
    expect(swaps).toEqual([]);
  });
});
