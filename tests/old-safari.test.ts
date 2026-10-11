import { describe, expect, it } from 'vitest';
import { sentencesOf } from '../src/english/gen-core';

/**
 * Máy đời cũ (iPhone 6s/7/SE đời đầu, iPad Air 2, iPad mini 4 – Safari 15.x): xem build.target trong vite.config.ts.
 * Lúc dựng, cú pháp JS mới được viết lại cho Safari 15.4 – trừ lookbehind trong regex: chỉ một cái là Safari dưới 16.4
 * không đọc được cả file mã game (màn hình đứng mãi ở "Đang chuẩn bị vương quốc...").
 */
const SRC = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });

/** Cách cắt câu cũ (có lookbehind) để so – Node đọc được. */
const oldSentences = (s: string) =>
  s
    .split(new RegExp('(?<=[.!?])\\s+'))
    .map((x) => x.trim())
    .filter(Boolean);

function rng(seed: number): () => number {
  let x = seed;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

describe('máy đời cũ (Safari 15.4)', () => {
  it('sentencesOf cắt câu y như cách cũ dùng lookbehind', () => {
    expect(sentencesOf('I like cats. Do you?  Yes!\nWe do.')).toEqual(['I like cats.', 'Do you?', 'Yes!', 'We do.']);
    expect(sentencesOf('Mr. Tom is 7... He runs!! ')).toEqual(['Mr.', 'Tom is 7...', 'He runs!!']);
    const r = rng(20240607);
    const parts = ['a', 'Tom', '7', '.', '!', '?', ',', ' ', '  ', '\n', '\t', '\u00a0', '"'];
    for (let n = 0; n < 5000; n++) {
      let s = '';
      const len = Math.floor(r() * 16);
      for (let i = 0; i < len; i++) s += parts[Math.floor(r() * parts.length)];
      expect(sentencesOf(s), JSON.stringify(s)).toEqual(oldSentences(s));
    }
  });

  it('mã nguồn không có lookbehind trong regex', () => {
    const files = Object.keys(SRC);
    expect(files.length).toBeGreaterThan(50);
    const bad = files.filter((f) => /\(\?<[=!]/.test(SRC[f]));
    expect(bad).toEqual([]);
  });
});
