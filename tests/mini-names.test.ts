import { describe, expect, it } from 'vitest';
import { MINI_ORDER, miniName, miniTitle } from '../src/minigames/registry';

/**
 * Biển trò chơi nhỏ, sảnh trò chơi, màn mờ, thanh tiêu đề… hiện tên trò chơi cạnh một biểu tượng. Một số tên có sẵn
 * emoji ở đầu ('🧩 Ghép số…'), một số không ('Đồng hồ bí ẩn') – mọi nơi phải dùng miniName/miniTitle để luôn có đúng
 * một biểu tượng. Đọc mã nguồn (không nạp trò chơi: chúng kéo theo three.js, CSS, âm thanh).
 */
const GAMES = import.meta.glob<string>('../src/minigames/games/*.ts', { query: '?raw', import: 'default', eager: true });
const SRC = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });

const icons = (s: string) => s.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;

type Info = { id: string; name: string; icon: string; unlock: number };

function infos(): Info[] {
  const out: Info[] = [];
  for (const code of Object.values(GAMES)) {
    const at = code.indexOf('defineMini(');
    if (at < 0) continue;
    const block = code.slice(at);
    const str = (k: string) => block.match(new RegExp(`\\b${k}:\\s*'([^']*)'`))?.[1] ?? '';
    out.push({ id: str('id'), name: str('name'), icon: str('icon'), unlock: Number(block.match(/\bunlock:\s*(\d+)/)?.[1]) });
  }
  return out;
}

describe('tên trò chơi nhỏ: đúng một biểu tượng', () => {
  const list = infos();

  it('đọc được đủ các trò chơi', () => {
    expect(list.map((i) => i.id).sort()).toEqual([...MINI_ORDER].sort());
  });

  for (const info of list) {
    it(info.id, () => {
      expect(icons(info.icon), 'icon').toBe(1);
      expect(icons(miniName(info)), 'miniName').toBe(0);
      expect(miniName(info)).toBe(miniName(info).trim());
      const title = miniTitle(info);
      expect(title.startsWith(`${info.icon} `), title).toBe(true);
      expect(icons(title), title).toBe(1);
      const locked = `🔒 ${miniName(info)} · cấp ${info.unlock}`;
      expect(icons(locked), locked).toBe(1);
    });
  }

  it('chỉ registry.ts đọc thẳng info.name (nơi khác dùng miniName/miniTitle)', () => {
    const raw: string[] = [];
    for (const [path, code] of Object.entries(SRC)) {
      if (path.endsWith('/minigames/registry.ts')) continue;
      for (const line of code.split('\n')) if (/\binfo\.name\b/.test(line)) raw.push(`${path}: ${line.trim()}`);
    }
    expect(raw).toEqual([]);
  });
});
