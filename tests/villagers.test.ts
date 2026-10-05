import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import names from '../src/assets/models/ai-names.json';

/**
 * Dân làng: màn chơi gọi chung 'npc_villager' + { v }, mỗi người có khóa mô hình riêng (models/villagers.ts) để thay
 * từng người bằng mô hình AI riêng. Mô hình AI của dân làng không bắt cảnh chờ: cảnh hiện với mô hình dựng bằng code,
 * tải xong thì thay tại chỗ (world/late.ts loadLate, Actor.upgradeModel). Cảnh GLTF giả: hộp cao 1 m.
 */
const h = vi.hoisted(() => ({
  scenes: new Map<string, () => unknown>(),
  /** Các lần gọi warmUp (engine/core.ts) và cổng chờ (null: xong ngay). */
  warm: [] as { obj: unknown; o: { scene?: unknown; camera?: unknown } | undefined }[],
  gate: null as Promise<void> | null,
}));

vi.mock('../src/engine/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/engine/core')>()),
  warmUp: (obj: unknown, o?: { scene?: unknown; camera?: unknown }) => {
    h.warm.push({ obj, o });
    return h.gate ?? Promise.resolve();
  },
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder(): void {}
    parseAsync(buf: ArrayBuffer): Promise<unknown> {
      const make = h.scenes.get(new TextDecoder().decode(buf));
      return Promise.resolve({ scene: make?.(), animations: [] });
    }
  },
}));
vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({ MeshoptDecoder: {} }));

function boxScene(): THREE.Object3D {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.3).translate(0, 0.5, 0), new THREE.MeshStandardMaterial()));
  return scene;
}

let glb: typeof import('../src/models/glb');
let reg: typeof import('../src/models/registry');
let vil: typeof import('../src/models/villagers');
let cast: typeof import('../src/game/cast');
let Actor: typeof import('../src/world/actor').Actor;
let late: typeof import('../src/world/late');

/** Mô hình AI giả (chưa tải) cho một khóa. */
function fakeAi(key: string, height: number): void {
  h.scenes.set(`${key}.glb`, boxScene);
  glb.defineGlbModel(key, { src: `${key}.glb`, height });
}

/** Dân làng đang đứng trong cảnh. */
function npc(scene: THREE.Scene, v: number): InstanceType<typeof Actor> {
  const a = new Actor('npc_villager', { opts: { v } });
  scene.add(a.root);
  return a;
}

const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).toArray();
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(async () => {
  h.scenes.clear();
  h.warm.length = 0;
  h.gate = null;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(new Response(url))),
  );
  vi.resetModules();
  glb = await import('../src/models/glb');
  reg = await import('../src/models/registry');
  vil = await import('../src/models/villagers');
  cast = await import('../src/game/cast');
  await import('../src/models/npcs');
  ({ Actor } = await import('../src/world/actor'));
  late = await import('../src/world/late');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dân làng: mỗi người một khóa mô hình riêng', () => {
  it("'npc_villager' + { v } dựng khóa riêng của từng người, giống hệt trước (v quay vòng như cũ)", () => {
    expect(vil.VILLAGER_KEYS).toEqual(['npc_be_na', 'npc_anh_ti', 'npc_chi_mai', 'npc_be_bin', 'npc_ba_ba', 'npc_chu_tu']);
    vil.VILLAGER_KEYS.forEach((k, v) => {
      expect(reg.modelKeyFor('npc_villager', { v })).toBe(k);
      const m = reg.buildModel('npc_villager', { v });
      expect(m.userData.key).toBe(k);
      expect(m.userData.height).toBe(1.35);
      expect(size(m)).toEqual(size(reg.buildModel(k)));
      expect(reg.modelDef('npc_villager', { v })).toBe(reg.modelDef(k));
    });
    expect(size(reg.buildModel('npc_villager', { v: 1 }))).not.toEqual(size(reg.buildModel('npc_villager', { v: 3 })));
    expect(reg.modelKeyFor('npc_villager')).toBe('npc_be_na');
    expect(reg.modelKeyFor('npc_villager', { v: 6 })).toBe('npc_be_na');
    expect(reg.modelKeyFor('npc_villager', { v: -1 })).toBe('npc_chu_tu');
    expect(reg.modelKeyFor('npc_villager', { v: Number.NaN })).toBe('npc_be_na');
    expect(reg.modelKeyFor('npc_cat', { v: 2 })).toBe('npc_cat');
  });

  it('thư viện xem thử vẫn có khóa chung với 6 biến thể', () => {
    expect(reg.hasModel('npc_villager')).toBe(true);
    const def = reg.modelDef('npc_villager')!;
    expect(def.variants).toEqual([0, 1, 2, 3, 4, 5].map((v) => ({ v })));
    expect((def.height as (o: unknown) => number)({ v: 4 })).toBe(1.35);
    // Không ghi v: như v0 (Bé Na).
    expect(reg.modelRadius('npc_villager')).toBe(0.5);
  });

  it('vật cản và khung chân dung theo từng người (đo lẹm với bé), mô hình AI giữ nguyên', async () => {
    const fit = [0, 1, 2, 3, 4, 5].map((v) => [reg.modelRadius('npc_villager', { v }), reg.modelDef('npc_villager', { v })?.portrait]);
    expect(fit).toEqual([[0.5, 'bust'], [0.54, 'bust'], [0.65, 'bust'], [0.44, 'bust'], [0.58, 'head'], [0.8, 'head']]);
    fakeAi('npc_chu_tu', 1.95);
    await expect(glb.ensureGlb(['npc_chu_tu'])).resolves.toBe(true);
    expect(reg.buildModel('npc_villager', { v: 5 }).userData.glb).toBe(true);
    expect([reg.modelRadius('npc_villager', { v: 5 }), reg.modelDef('npc_villager', { v: 5 })?.portrait]).toEqual([0.8, 'head']);
  });

  it('lời thoại (cast.ts villager) và tên tệp mô hình AI khớp đúng người', () => {
    cast.VILLAGERS.forEach((p, i) => {
      const sp = cast.villager(i);
      expect(p.v).toBe(i);
      expect(reg.modelKeyFor(sp.art!, sp.artOpts ?? {})).toBe(vil.VILLAGER_KEYS[i]);
    });
    const files = names.keys as Record<string, string[]>;
    expect(files.npc_villager).toBeUndefined();
    expect(vil.VILLAGER_KEYS.map((k) => files[k]?.[0])).toEqual(['be-na', 'anh-ti', 'chi-mai', 'be-bin', 'ba-ba', 'chu-tu']);
  });

  it('mô hình AI của một người chỉ thay người đó', async () => {
    fakeAi('npc_chi_mai', 1.72);
    await expect(glb.ensureGlb(['npc_chi_mai'])).resolves.toBe(true);
    const all = vil.VILLAGER_KEYS.map((_, v) => reg.buildModel('npc_villager', { v }));
    expect(all.map((m) => !!m.userData.glb)).toEqual([false, false, true, false, false, false]);
    expect(all[2].userData.key).toBe('npc_chi_mai');
    expect(all[2].userData.height).toBeCloseTo(1.72);
    expect(all[1].userData.height).toBe(1.35);
  });
});

describe('mô hình AI tải sau (world/late.ts): thay tại chỗ khi tải xong, không bắt cảnh chờ', () => {
  /** Cảnh giả: thay mọi nhân vật dùng khóa vừa tải (như Zone.lateLoaded / màn tiêu đề). */
  function host(actors: InstanceType<typeof Actor>[], o: { gone?: () => boolean; hold?: () => boolean } = {}) {
    const swapped: string[] = [];
    return {
      swapped,
      gone: o.gone ?? (() => false),
      hold: o.hold,
      swap(key: string) {
        swapped.push(key);
        for (const a of actors) if (a.modelKey === key) a.upgradeModel();
      },
    };
  }

  /** fetch giả chờ lệnh: tệp chỉ về khi gọi `release(tên)`. */
  function heldFetch() {
    const waiting = new Map<string, () => void>();
    vi.mocked(fetch).mockImplementation((url) => new Promise((ok) => waiting.set(String(url), () => ok(new Response(String(url))))));
    const asked = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    const release = async (url: string) => {
      await vi.waitFor(() => expect(waiting.has(url)).toBe(true));
      waiting.get(url)!();
    };
    return { asked, release };
  }

  it('chỉ người có mô hình AI được thay; chiều cao mới; cảnh sau dựng ngay bằng mô hình AI', async () => {
    fakeAi('npc_chi_mai', 1.72);
    const scene = new THREE.Scene();
    const mai = npc(scene, 2);
    const ti = npc(scene, 1);
    expect(mai.modelKey).toBe('npc_chi_mai');
    expect(ti.modelKey).toBe('npc_anh_ti');
    const old = mai.model;
    expect(old.userData.glb).toBeUndefined();
    expect(old.userData.key).toBe('npc_chi_mai');
    // Đang hiện mô hình dựng bằng code → nhãn tên theo chiều cao của nó (không lơ lửng theo chiều cao mô hình AI).
    expect(mai.height).toBe(1.35);
    expect(mai.upgradeModel()).toBe(false);
    const h1 = host([mai, ti]);
    await late.loadLate(['npc_chi_mai', 'npc_anh_ti'], [], h1);
    expect(h1.swapped).toEqual(['npc_chi_mai']);
    expect(mai.model).not.toBe(old);
    expect(old.parent).toBeNull();
    expect(mai.model.userData.glb).toBe(true);
    expect(mai.model.userData.key).toBe('npc_chi_mai');
    expect(mai.height).toBeCloseTo(1.72);
    expect(mai.root.children).toEqual([mai.model]);
    expect(ti.model.userData.glb).toBeUndefined();
    expect(mai.upgradeModel()).toBe(false);
    const again = npc(scene, 2);
    expect(again.model.userData.glb).toBe(true);
    const h2 = host([again]);
    await late.loadLate(['npc_chi_mai'], [], h2);
    expect(h2.swapped).toEqual([]);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('chờ phần phải có tải xong trước; tải lần lượt theo thứ tự; đang tạm dừng thì chưa tải tệp tiếp theo', async () => {
    fakeAi('npc_rabbit', 1.7);
    fakeAi('npc_be_na', 1.35);
    fakeAi('npc_chi_mai', 1.72);
    const net = heldFetch();
    const scene = new THREE.Scene();
    const na = npc(scene, 0);
    const mai = npc(scene, 2);
    let hold = false;
    const must = glb.ensureGlb(['npc_rabbit']);
    const h1 = host([na, mai], { hold: () => hold });
    const run = late.loadLate(['npc_be_na', 'npc_chi_mai'], ['npc_rabbit'], h1);
    await tick();
    expect(net.asked()).toEqual(['npc_rabbit.glb']);
    hold = true;
    await net.release('npc_rabbit.glb');
    await expect(must).resolves.toBe(true);
    await new Promise((r) => setTimeout(r, 700));
    expect(net.asked()).toEqual(['npc_rabbit.glb']);
    hold = false;
    await net.release('npc_be_na.glb');
    await vi.waitFor(() => expect(h1.swapped).toEqual(['npc_be_na']));
    expect(na.model.userData.glb).toBe(true);
    expect(mai.model.userData.glb).toBeUndefined();
    await net.release('npc_chi_mai.glb');
    await run;
    expect(h1.swapped).toEqual(['npc_be_na', 'npc_chi_mai']);
    expect(mai.model.userData.glb).toBe(true);
    expect(net.asked()).toEqual(['npc_rabbit.glb', 'npc_be_na.glb', 'npc_chi_mai.glb']);
  });

  it('cảnh đã đóng giữa chừng: thôi, không thay', async () => {
    fakeAi('npc_be_na', 1.35);
    fakeAi('npc_chi_mai', 1.72);
    const net = heldFetch();
    const scene = new THREE.Scene();
    const na = npc(scene, 0);
    let gone = false;
    const h1 = host([na], { gone: () => gone });
    const run = late.loadLate(['npc_be_na', 'npc_chi_mai'], [], h1);
    gone = true;
    await net.release('npc_be_na.glb');
    await run;
    expect(h1.swapped).toEqual([]);
    expect(na.model.userData.glb).toBeUndefined();
    expect(net.asked()).toEqual(['npc_be_na.glb']);
  });

  it('tệp lỗi: giữ mô hình dựng bằng code, vẫn tải tiếp người sau; tắt GLB (glb=0): không tải gì', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 404 })));
    fakeAi('npc_ba_ba', 1.6);
    fakeAi('npc_be_bin', 1.3);
    const scene = new THREE.Scene();
    const ba = npc(scene, 4);
    const bin = npc(scene, 3);
    const h1 = host([ba, bin]);
    await late.loadLate(['npc_ba_ba', 'npc_be_bin'], [], h1);
    expect(h1.swapped).toEqual(['npc_be_bin']);
    expect(h.warm.map((w) => (w.obj as THREE.Object3D).userData.key)).toEqual(['npc_be_bin']);
    expect(ba.model.userData.glb).toBeUndefined();
    expect(bin.model.userData.glb).toBe(true);
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toEqual(['npc_ba_ba.glb', 'npc_be_bin.glb']);

    fakeAi('npc_chu_tu', 1.95);
    glb.setGlbEnabled(false);
    const tu = npc(scene, 5);
    const h2 = host([tu]);
    await late.loadLate(['npc_chu_tu'], [], h2);
    expect(h2.swapped).toEqual([]);
    expect(tu.upgradeModel()).toBe(false);
    expect(tu.model.userData.glb).toBeUndefined();
    expect(tu.height).toBe(1.35);
    expect(ba.height).toBe(1.35);
    expect(bin.height).toBeCloseTo(1.3);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(h.warm).toHaveLength(1);
  });

  it('chuẩn bị trước ảnh + shader (warmUp với cảnh và camera của cảnh) rồi mới thay; cảnh đóng trong lúc chờ: không thay', async () => {
    fakeAi('npc_be_na', 1.35);
    fakeAi('npc_chi_mai', 1.72);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const na = npc(scene, 0);
    const mai = npc(scene, 2);
    let gone = false;
    let open1 = () => {};
    let open2 = () => {};
    h.gate = new Promise<void>((r) => (open1 = r));
    const h1 = { ...host([na, mai], { gone: () => gone }), scene, camera };
    const run = late.loadLate(['npc_be_na', 'npc_chi_mai'], [], h1);
    await vi.waitFor(() => expect(h.warm).toHaveLength(1));
    const probe = h.warm[0].obj as THREE.Object3D;
    expect(probe.userData).toMatchObject({ glb: true, key: 'npc_be_na' });
    expect(probe.parent).toBeNull();
    expect(h.warm[0].o?.scene).toBe(scene);
    expect(h.warm[0].o?.camera).toBe(camera);
    await tick();
    expect(h1.swapped).toEqual([]);
    expect(na.model.userData.glb).toBeUndefined();
    h.gate = new Promise<void>((r) => (open2 = r));
    open1();
    await vi.waitFor(() => expect(h1.swapped).toEqual(['npc_be_na']));
    expect(na.model.userData.glb).toBe(true);
    expect(na.model).not.toBe(probe);
    await vi.waitFor(() => expect(h.warm).toHaveLength(2));
    expect((h.warm[1].obj as THREE.Object3D).userData.key).toBe('npc_chi_mai');
    gone = true;
    open2();
    await run;
    expect(h1.swapped).toEqual(['npc_be_na']);
    expect(mai.model.userData.glb).toBeUndefined();
  });

  it('tải tệp kế ngay lúc chuẩn bị tệp trước: tệp nạp nền không chen vào khe chờ warmUp rồi bị hủy, tải lại', async () => {
    fakeAi('npc_be_na', 1.35);
    fakeAi('npc_chi_mai', 1.72);
    fakeAi('npc_rabbit', 1.7);
    const net = heldFetch();
    const scene = new THREE.Scene();
    const na = npc(scene, 0);
    const mai = npc(scene, 2);
    let open = () => {};
    h.gate = new Promise<void>((r) => (open = r));
    const h1 = host([na, mai]);
    const run = late.loadLate(['npc_be_na', 'npc_chi_mai'], [], h1);
    glb.prefetchGlb(['npc_rabbit']);
    await net.release('npc_be_na.glb');
    await vi.waitFor(() => expect(h.warm).toHaveLength(1));
    // warmUp kéo dài qua nhiều khung hình: tệp kế đã đang tải, tệp nền chưa bắt đầu.
    await new Promise((r) => setTimeout(r, 20));
    expect(net.asked()).toEqual(['npc_be_na.glb', 'npc_chi_mai.glb']);
    h.gate = null;
    open();
    await net.release('npc_chi_mai.glb');
    await run;
    expect(h1.swapped).toEqual(['npc_be_na', 'npc_chi_mai']);
    // Hết phần tải sau: tệp nền bắt đầu – một lần, không bị hủy.
    await net.release('npc_rabbit.glb');
    expect(net.asked()).toEqual(['npc_be_na.glb', 'npc_chi_mai.glb', 'npc_rabbit.glb']);
    expect(vi.mocked(fetch).mock.calls.some((c) => (c[1] as RequestInit | undefined)?.signal?.aborted)).toBe(false);
  });

  it('đang nói chuyện / vui mừng thì bận (Zone.lateSwap đợi xong mới đổi mô hình)', () => {
    const a = new Actor('npc_villager', { opts: { v: 0 } });
    expect(a.busy).toBe(false);
    a.talking = true;
    expect(a.busy).toBe(true);
    a.talking = false;
    a.update(0.016, 10);
    a.celebrate(1.5);
    expect(a.busy).toBe(true);
    a.update(0.016, 11.4);
    expect(a.busy).toBe(true);
    a.update(0.016, 11.6);
    expect(a.busy).toBe(false);
  });
});