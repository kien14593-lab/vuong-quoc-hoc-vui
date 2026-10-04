import { describe, expect, it } from 'vitest';
import { emojiIssues } from './emoji12';

/**
 * Máy tính ở trường thường chạy Windows 10: font emoji chỉ tới Emoji 12.0. Emoji mới hơn (🪙 xu, 🪨 đá, 🪵 gỗ…)
 * hiện thành ô vuông trống – ví dụ câu đếm "4 + 3 tấm ván" không còn hình nào để đếm. Kiểm tra toàn bộ mã nguồn.
 */
const SOURCES = {
  ...import.meta.glob<string>('../src/**/*.{ts,css,html,json}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../index.html', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../public/**/*.{html,json,webmanifest,txt,js,css,svg}', { query: '?raw', import: 'default', eager: true }),
};

const lineOf = (text: string, at: number) => Array.from(text).slice(0, at).join('').split('\n').length;

describe('quy tắc emoji Windows 10 (≤ Emoji 12.0)', () => {
  it('chặn emoji mới, cờ và chuỗi ghép mới', () => {
    for (const bad of ['🪙', '🪨', '🪵', '🫐', '🛻', '🥲', '🦭', '🧋', '🪴', '🫶', '🇻🇳', '🐈‍⬛', '🐻‍❄️', '❤️‍🔥', '😮‍💨', '🧑‍🍳', '🧔‍♀️', '🍋‍🟩', '🐦‍⬛', '👩🏻‍❤️‍👨🏼', '💏🏻']) {
      expect(emojiIssues(`a ${bad} b`).length, bad).toBeGreaterThan(0);
    }
  });

  it('cho phép emoji tới 12.0', () => {
    for (const ok of ['⭐', '🟫', '🌑', '💰', '🍎', '🦒', '🦩', '🥱', '🪐', '🪀', '🪁', '🛕', '🛺', '🟢', '🧑‍🤝‍🧑', '👩‍🍳', '🐕‍🦺', '👨‍👩‍👧', '🏳️‍🌈', '👍🏽', '🗝️', '🎟️', 'Tiếng Việt có dấu: ằ ẫ ữ ợ']) {
      expect(emojiIssues(`a ${ok} b`), ok).toEqual([]);
    }
  });

  it('mã nguồn, index.html và public/ chỉ dùng emoji hiện được trên Windows 10', () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('../index.html');
    const bad: string[] = [];
    for (const [file, text] of Object.entries(SOURCES)) {
      for (const e of emojiIssues(text)) bad.push(`${file.replace('../', '')}:${lineOf(text, e.at)} ${e.text} – ${e.reason}`);
    }
    expect(bad).toEqual([]);
  });
});
