import { describe, expect, it } from 'vitest';
import names from '../src/assets/models/ai-names.json';
import { DEFAULT_OUTFIT } from '../src/core/outfits';
import { CAST } from '../src/game/cast';
import { EVERY_ZONE_MODELS, MINI_MODELS, MINI_WITH_PLAYER, TITLE_MODELS, ZONE_LATE_MODELS, ZONE_MODELS, miniModels, modelsInStoryOrder, playerModels, zoneLateModels, zoneModels } from '../src/game/needs';

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

/** Các khóa mô hình (có thể là mô hình AI) mà tệp dùng: chuỗi 'npc_…', CAST.x, villager(i). */
function used(code: string): string[] {
  const c = strip(code);
  const out = new Set<string>();
  for (const m of c.matchAll(KEY_RE)) out.add(m[1]);
  for (const m of c.matchAll(/\bCAST\.(\w+)/g)) {
    expect(ART[m[1]], `CAST.${m[1]}`).toBeDefined();
    out.add(ART[m[1]]);
  }
  if (/\bvillager\(/.test(c)) out.add('npc_villager');
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

  it('màn hình tiêu đề', () => {
    expect(used(file('world/title.ts'))).toEqual(sorted(TITLE_MODELS));
  });

  it('nhân vật có ở mọi khu vực (world/zone.ts)', () => {
    expect(used(file('world/zone.ts'))).toEqual(sorted(EVERY_ZONE_MODELS));
  });

  it('mỗi khu vực có danh sách, đủ và không thừa', () => {
    expect(sorted(ZONE_FILES)).toEqual(sorted(Object.keys(ZONE_MODELS)));
    for (const id of ZONE_FILES) {
      const z = id as keyof typeof ZONE_MODELS;
      const u = used(file(`world/zones/${id}.ts`));
      const list = [...zoneModels(z), ...zoneLateModels(z)];
      expect(missing(u, list), `world/zones/${id}.ts dùng nhưng chưa ghi trong ZONE_MODELS.${id} / ZONE_LATE_MODELS.${id}`).toEqual([]);
      expect(missing([...ZONE_MODELS[z], ...zoneLateModels(z)], u), `ZONE_MODELS.${id} / ZONE_LATE_MODELS.${id} ghi thừa`).toEqual([]);
    }
  });

  it('thú tải sau: khu vực có thật, không trùng danh sách phải chờ, có trong thứ tự tải dần', () => {
    const all = modelsInStoryOrder();
    for (const [id, late] of Object.entries(ZONE_LATE_MODELS)) {
      expect(ZONE_FILES, id).toContain(id);
      const z = id as keyof typeof ZONE_MODELS;
      expect(late.filter((k) => zoneModels(z).includes(k)), `ZONE_LATE_MODELS.${id} trùng danh sách chờ`).toEqual([]);
      for (const k of late) expect(all, k).toContain(k);
    }
    expect(zoneModels('zoo').some((k) => k.startsWith('animal_')), 'thú trong chuồng không chặn việc vào Sở Thú').toBe(false);
  });

  it('mỗi trò chơi nhỏ có nhân vật đều có danh sách, đủ và không thừa', () => {
    const ids: string[] = [];
    const quiz = used(file('minigames/quiz.ts'));
    for (const p of GAME_FILES) {
      const code = SRC[p];
      const id = /defineMini\(\s*\{[\s\S]*?\bid:\s*'([\w-]+)'/.exec(code)?.[1];
      expect(id, p).toBeDefined();
      ids.push(id!);
      const u = sorted([...used(code), ...(/\bextends\s+QuizStub\b/.test(code) ? quiz : [])]);
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
      const u = used(code);
      if (u.length || DYNAMIC.test(strip(code))) bad.push(`${rel}: ${u.join(', ') || 'khóa ghép động'}`);
    }
    expect(bad).toEqual([]);
  });

  it('không ghép tên khóa mô hình động trong cảnh (bài kiểm tra không đọc được)', () => {
    const scenes = [...ZONE_FILES.map((id) => `../src/world/zones/${id}.ts`), ...GAME_FILES, '../src/world/title.ts', '../src/world/zone.ts'];
    for (const p of scenes) expect(DYNAMIC.test(strip(SRC[p])), p).toBe(false);
  });

  it('thứ tự tải dần: màn tiêu đề trước, rồi theo cốt truyện', () => {
    const all = modelsInStoryOrder();
    expect(all.slice(0, TITLE_MODELS.length)).toEqual([...TITLE_MODELS]);
    expect(all.indexOf(CAST.cu.art)).toBeLessThan(all.indexOf(CAST.robot.art));
    expect(all.indexOf(CAST.robot.art)).toBeLessThan(all.indexOf(CAST.he.art));
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
