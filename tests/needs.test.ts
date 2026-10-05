import { describe, expect, it } from 'vitest';
import names from '../src/assets/models/ai-names.json';
import { DEFAULT_OUTFIT } from '../src/core/outfits';
import type { ZoneId } from '../src/core/state';
import { CAST } from '../src/game/cast';
import { BEAR_FREE_ZONES, EVERY_ZONE_MODELS, MINI_MODELS, MINI_WITH_PLAYER, TITLE_LATE_MODELS, TITLE_MODELS, ZONE_LATE_MODELS, ZONE_MODELS, miniModels, modelsInStoryOrder, playerModels, zoneLateModels, zoneModels } from '../src/game/needs';
import { VILLAGER_KEYS, villagerKey } from '../src/models/villagers';

/**
 * Mô hình AI chỉ được tải cho cảnh cần nó (game/needs.ts). Kiểm tra bằng cách đọc mã nguồn: mọi nhân vật/con thú
 * có thể thay bằng mô hình AI (ai-names.json) xuất hiện trong một khu vực / trò chơi nhỏ / màn tiêu đề phải có tên
 * trong danh sách của cảnh đó – nếu không, nhân vật mới sẽ lặng lẽ hiện bằng mô hình dựng bằng code.
 */
const SRC = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
const file = (rel: string) => {
  const code = SRC[`../src/${rel}`];
  if (code === undefined) throw new Error(`không thấy src/${rel}`);
  return code;
};

const KEYS = Object.keys(names.keys);
const KEY_RE = new RegExp(`['"\`](${KEYS.join('|')})['"\`]`, 'g');
const ART: Record<string, string> = Object.fromEntries(Object.entries(CAST).map(([id, c]) => [id, c.art]));
const DYNAMIC = /['"`](npc|pet|animal)_\$\{|['"`](npc|pet|animal)_['"`]\s*\+|\bCAST\[/;

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Số đầu mỗi dòng của mảng [[v, …], …] mà `.forEach(([v, …]) => …)` gần nhất trước vị trí `at` duyệt qua (viết ngay tại chỗ hoặc khai báo `const tên = [...]`). */
function forEachRows(c: string, at: number, where: string): number[] {
  const f = c.lastIndexOf('.forEach(([v', at);
  if (f < 0) throw new Error(`${where}: không biết dân làng nào (v) – ghi rõ { v: số }`);
  const before = c.slice(0, f).trimEnd();
  let from: number;
  let to: number;
  if (before.endsWith(']')) {
    to = before.length;
    let depth = 0;
    for (from = to - 1; from >= 0; from--) {
      if (before[from] === ']') depth++;
      else if (before[from] === '[' && --depth === 0) break;
    }
  } else {
    const id = /(\w+)$/.exec(before)?.[1];
    const decl = id ? new RegExp(`\\b(?:const|let)\\s+${id}\\b[^=]*=\\s*\\[`).exec(c) : null;
    if (!decl) throw new Error(`${where}: không thấy mảng dân làng trước .forEach`);
    from = decl.index + decl[0].length - 1;
    let depth = 0;
    for (to = from; to < c.length; to++) {
      if (c[to] === '[') depth++;
      else if (c[to] === ']' && --depth === 0) break;
    }
    to++;
  }
  const rows = [...c.slice(from, to).matchAll(/\[\s*(\d+)\s*,/g)].map((m) => +m[1]);
  if (!rows.length) throw new Error(`${where}: mảng dân làng rỗng`);
  return rows;
}

/**
 * Dân làng mà tệp dùng – khóa riêng của từng người (models/villagers.ts): villager(số), 'npc_villager' kèm
 * { v: số } (hoặc `?? số`), hoặc v lấy từ từng dòng của mảng [[v, …], …].forEach(([v, …]) => …).
 */
function villagersUsed(c: string, where: string): string[] {
  const vs = new Set<number>();
  for (const m of c.matchAll(/\bvillager\((\w+)\)/g)) {
    if (/^\d+$/.test(m[1])) vs.add(+m[1]);
    else for (const v of forEachRows(c, m.index!, where)) vs.add(v);
  }
  const at = [...c.matchAll(/['"`]npc_villager['"`]/g)].map((m) => m.index!);
  at.forEach((i, n) => {
    const win = c.slice(i, Math.min(at[n + 1] ?? c.length, i + 400));
    const obj = /\{\s*v\s*(?::\s*([^,}]*?))?\s*[,}]/.exec(win);
    const val = obj?.[1];
    const num = val === undefined ? undefined : (/^(\d+)$/.exec(val) ?? /\?\?\s*(\d+)$/.exec(val))?.[1];
    if (obj && val === undefined) for (const v of forEachRows(c, i, where)) vs.add(v);
    else if (num !== undefined) vs.add(+num);
    else throw new Error(`${where}: 'npc_villager' không ghi rõ { v: số } – bài kiểm tra không biết là dân làng nào`);
  });
  return [...vs].map((v) => villagerKey(v));
}

/** Các khóa mô hình (có thể là mô hình AI) mà tệp dùng: chuỗi 'npc_…', CAST.x, dân làng (villager(i), 'npc_villager' + { v }). */
function used(code: string, where = 'tệp'): string[] {
  const c = strip(code);
  const out = new Set<string>();
  for (const m of c.matchAll(KEY_RE)) out.add(m[1]);
  for (const m of c.matchAll(/\bCAST\.(\w+)/g)) {
    expect(ART[m[1]], `CAST.${m[1]}`).toBeDefined();
    out.add(ART[m[1]]);
  }
  for (const k of villagersUsed(c, where)) out.add(k);
  return [...out].sort();
}

const sorted = (a: Iterable<string>) => [...new Set(a)].sort();
const missing = (need: string[], have: Iterable<string>) => need.filter((k) => !new Set(have).has(k));

const ZONE_FILES = Object.keys(SRC)
  .map((p) => /^\.\.\/src\/world\/zones\/(\w+)\.ts$/.exec(p)?.[1])
  .filter((id): id is string => !!id && id !== 'index');
const GAME_FILES = Object.keys(SRC).filter((p) => /^\.\.\/src\/minigames\/games\/\w+\.ts$/.test(p));

describe('mô hình cần cho từng cảnh (needs.ts)', () => {
  it('các danh sách chỉ ghi khóa có thật (ai-names.json)', () => {
    for (const k of modelsInStoryOrder()) expect(KEYS, k).toContain(k);
  });

  it('màn hình tiêu đề (dân làng ở danh sách tải sau)', () => {
    expect(used(file('world/title.ts'), 'world/title.ts')).toEqual(sorted([...TITLE_MODELS, ...TITLE_LATE_MODELS]));
  });

  it('nhân vật có ở mọi khu vực (world/zone.ts)', () => {
    expect(used(file('world/zone.ts'), 'world/zone.ts')).toEqual(sorted(EVERY_ZONE_MODELS));
  });

  it('Chú Gấu không vào nhà, lâu đài (game/story.ts bearFollows): hai nơi đó không chờ tải Chú Gấu, nơi khác vẫn chờ', () => {
    expect(file('game/story.ts')).toMatch(/BEAR_FREE_ZONES\.includes\(zone\)/);
    expect(sorted([...BEAR_FREE_ZONES])).toEqual(['castle', 'house']);
    for (const id of ZONE_FILES) {
      const z = id as ZoneId;
      expect(zoneModels(z).includes(CAST.gau.art), id).toBe(!BEAR_FREE_ZONES.includes(z));
    }
  });

  it('mỗi khu vực có danh sách, đủ và không thừa', () => {
    expect(sorted(ZONE_FILES)).toEqual(sorted(Object.keys(ZONE_MODELS)));
    for (const id of ZONE_FILES) {
      const z = id as ZoneId;
      const u = used(file(`world/zones/${id}.ts`), `world/zones/${id}.ts`);
      const list = [...zoneModels(z), ...zoneLateModels(z)];
      expect(missing(u, list), `world/zones/${id}.ts dùng nhưng chưa ghi trong ZONE_MODELS.${id} / ZONE_LATE_MODELS.${id}`).toEqual([]);
      expect(missing([...ZONE_MODELS[z], ...zoneLateModels(z)], u), `ZONE_MODELS.${id} / ZONE_LATE_MODELS.${id} ghi thừa`).toEqual([]);
    }
  });

  it('tải sau (thú trong chuồng, dân làng): khu vực có thật, không trùng danh sách phải chờ, có trong thứ tự tải dần', () => {
    const all = modelsInStoryOrder();
    for (const [id, late] of Object.entries(ZONE_LATE_MODELS)) {
      expect(ZONE_FILES, id).toContain(id);
      const z = id as keyof typeof ZONE_MODELS;
      expect(late.filter((k) => zoneModels(z).includes(k)), `ZONE_LATE_MODELS.${id} trùng danh sách chờ`).toEqual([]);
      for (const k of late) expect(all, k).toContain(k);
    }
    expect(TITLE_LATE_MODELS.filter((k) => TITLE_MODELS.includes(k)), 'TITLE_LATE_MODELS trùng danh sách chờ').toEqual([]);
    expect(zoneModels('zoo').some((k) => k.startsWith('animal_')), 'thú trong chuồng không chặn việc vào Sở Thú').toBe(false);
  });

  it('dân làng không bắt màn tiêu đề / khu vực chờ (luôn ở danh sách tải sau)', () => {
    const V = new Set<string>(VILLAGER_KEYS);
    expect([...TITLE_MODELS, ...EVERY_ZONE_MODELS, ...Object.values(ZONE_MODELS).flat()].filter((k) => V.has(k))).toEqual([]);
  });

  it('đọc đúng dân làng nào ở đâu (không còn khóa chung npc_villager)', () => {
    expect(KEYS).not.toContain('npc_villager');
    const v = (rel: string) => used(file(rel), rel).filter((k) => VILLAGER_KEYS.includes(k as never));
    expect(v('world/title.ts')).toEqual(sorted(['npc_be_na', 'npc_chi_mai']));
    expect(v('world/zones/village.ts')).toEqual(sorted(['npc_be_na', 'npc_anh_ti', 'npc_chi_mai', 'npc_ba_ba']));
    expect(v('world/zones/park.ts')).toEqual(sorted(['npc_be_na', 'npc_chi_mai', 'npc_be_bin', 'npc_chu_tu']));
    expect(v('world/zones/zoo.ts')).toEqual(['npc_chu_tu']);
    expect(v('world/zones/castle.ts')).toEqual(sorted(['npc_anh_ti', 'npc_be_bin', 'npc_ba_ba']));
    expect(v('minigames/games/number_match.ts')).toEqual(['npc_anh_ti']);
    expect(() => used(`this.npc('npc_villager', 1, 2, { name: 'x' });`, 'mẫu')).toThrow(/không ghi rõ/);
  });

  it('mỗi trò chơi nhỏ có nhân vật đều có danh sách, đủ và không thừa', () => {
    const ids: string[] = [];
    const quiz = used(file('minigames/quiz.ts'));
    for (const p of GAME_FILES) {
      const code = SRC[p];
      const id = /defineMini\(\s*\{[\s\S]*?\bid:\s*'([\w-]+)'/.exec(code)?.[1];
      expect(id, p).toBeDefined();
      ids.push(id!);
      const u = sorted([...used(code, p), ...(/\bextends\s+QuizStub\b/.test(code) ? quiz : [])]);
      expect(missing(u, miniModels(id!)), `${p} dùng nhưng chưa ghi trong MINI_MODELS.${id}`).toEqual([]);
      expect(missing(miniModels(id!), u), `MINI_MODELS.${id} ghi thừa`).toEqual([]);
    }
    expect(missing(Object.keys(MINI_MODELS), ids), 'MINI_MODELS có trò chơi không tồn tại').toEqual([]);
  });

  it('không tệp nào khác tự dựng nhân vật mà không qua danh sách', () => {
    // Được phép: nơi khai báo (cast, needs, models, vật phẩm thú cưng), lời chú thích, lớp đố vui dùng chung.
    const ALLOW = [/^game\/(cast|needs)\.ts$/, /^models\//, /^core\/items\.ts$/, /^minigames\/quiz\.ts$/];
    const bad: string[] = [];
    for (const [p, code] of Object.entries(SRC)) {
      const rel = p.replace('../src/', '');
      if (/^world\/zones\/\w+\.ts$/.test(rel) || /^minigames\/games\//.test(rel) || rel === 'world/title.ts' || rel === 'world/zone.ts') continue;
      if (ALLOW.some((r) => r.test(rel))) continue;
      const u = used(code, rel);
      if (u.length || DYNAMIC.test(strip(code))) bad.push(`${rel}: ${u.join(', ') || 'khóa ghép động'}`);
    }
    expect(bad).toEqual([]);
  });

  it('không ghép tên khóa mô hình động trong cảnh (bài kiểm tra không đọc được)', () => {
    const scenes = [...ZONE_FILES.map((id) => `../src/world/zones/${id}.ts`), ...GAME_FILES, '../src/world/title.ts', '../src/world/zone.ts'];
    for (const p of scenes) expect(DYNAMIC.test(strip(SRC[p])), p).toBe(false);
  });

  it('thứ tự tải dần: màn tiêu đề trước, rồi theo cốt truyện; dân làng cuối cùng, người ở làng trước', () => {
    const all = modelsInStoryOrder();
    const n = TITLE_MODELS.length;
    expect(all.slice(0, n)).toEqual([...TITLE_MODELS]);
    expect(all.indexOf(CAST.cu.art)).toBeLessThan(all.indexOf(CAST.robot.art));
    expect(all.indexOf(CAST.robot.art)).toBeLessThan(all.indexOf(CAST.he.art));
    // Dân làng (cảnh tự tải khi vào – world/late.ts) không chen trước nhân vật của các khu vực sau.
    const V = all.filter((k) => VILLAGER_KEYS.includes(k as never));
    expect(sorted(V)).toEqual(sorted(VILLAGER_KEYS));
    expect(all.slice(-V.length)).toEqual(V);
    expect(all.indexOf(CAST.hiepsi.art)).toBeLessThan(all.indexOf(V[0]));
    expect(sorted(V.slice(0, zoneLateModels('village').length))).toEqual(sorted(zoneLateModels('village')));
    expect(zoneModels('forest', 'pet_fox')).toEqual(expect.arrayContaining([CAST.cu.art, CAST.gau.art, 'pet_fox']));
  });
});

describe('bé (người chơi) – mô hình theo hồ sơ', () => {
  const boy = { kid: 'trai' as const, outfit: DEFAULT_OUTFIT };
  const girl = { kid: 'gai' as const, outfit: 'outfit_khong_co' };

  it('bé mặc bộ đồ đang chọn (bộ đồ không có cho bé → đồ thường ngày); chưa có hồ sơ → không cần', () => {
    expect(playerModels(boy)).toEqual(['player_trai']);
    expect(playerModels(girl)).toEqual(['player_gai']);
    expect(playerModels(null)).toEqual([]);
    expect(playerModels()).toEqual([]);
  });

  it('mọi khu vực đều có bé', () => {
    for (const id of ZONE_FILES) {
      const z = id as keyof typeof ZONE_MODELS;
      expect(zoneModels(z, null, girl), id).toContain('player_gai');
      expect(zoneModels(z, 'pet_dog', boy), id).toEqual(expect.arrayContaining(['player_trai', 'pet_dog']));
      expect(zoneModels(z).some((k) => k.startsWith('player_')), id).toBe(false);
    }
  });

  it('trò chơi nhỏ có bé (khóa \'player\') ghi trong MINI_WITH_PLAYER, đủ và không thừa', () => {
    const withPlayer: string[] = [];
    for (const p of GAME_FILES) {
      const code = strip(SRC[p]);
      const id = /defineMini\(\s*\{[\s\S]*?\bid:\s*'([\w-]+)'/.exec(code)![1];
      if (/['"`]player['"`]/.test(code)) withPlayer.push(id);
      const keys = miniModels(id, boy);
      expect(keys.includes('player_trai'), id).toBe(MINI_WITH_PLAYER.includes(id as never));
      expect(miniModels(id).some((k) => k.startsWith('player_')), id).toBe(false);
    }
    expect(sorted(withPlayer)).toEqual(sorted(MINI_WITH_PLAYER));
  });

  it('không tải sẵn bé cùng nhân vật cốt truyện (bé tải theo hồ sơ)', () => {
    expect(modelsInStoryOrder().filter((k) => k.startsWith('player_'))).toEqual([]);
  });
});
