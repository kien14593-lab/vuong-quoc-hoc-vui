import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeVoice {
  name: string;
  lang: string;
  localService: boolean;
}
interface FakeUtt {
  text: string;
  voice: FakeVoice | null;
  lang: string;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

// Giả lập Web Speech API trước khi nạp speech.ts (speech.ts chọn giọng ngay khi được nạp).
const h = vi.hoisted(() => {
  const st = {
    voices: [] as FakeVoice[],
    spoken: [] as FakeUtt[],
    cancels: 0,
    handlers: [] as (() => void)[],
    settings: { voice: true, voiceRate: 1 },
    grade: 1,
    duck: [] as boolean[],
  };
  class Utt {
    voice = null;
    lang = '';
    rate = 1;
    pitch = 1;
    onstart = null;
    onend = null;
    onerror = null;
    constructor(public text: string) {}
  }
  const g = globalThis as Record<string, unknown>;
  g.SpeechSynthesisUtterance = Utt;
  g.speechSynthesis = {
    getVoices: () => st.voices,
    speak: (u: FakeUtt) => st.spoken.push(u),
    cancel: () => {
      st.cancels++;
    },
    addEventListener: (_: string, f: () => void) => st.handlers.push(f),
  };
  return st;
});

vi.mock('../src/core/audio', () => ({ audio: { setDuck: (d: boolean) => h.duck.push(d) } }));
vi.mock('../src/core/state', () => ({
  getSettings: () => h.settings,
  hasProfile: () => true,
  profile: () => ({ grade: h.grade }),
}));

import { Rng } from '../src/core/rng';
import { canListen, hasEnglishVoice, hasVietnameseVoice, speak, speakEnglish, stopSpeech } from '../src/core/speech';
import { hasEnglish, plainText, rankVoices, speechText, splitLang, type VoiceLike } from '../src/core/voices';
import { ALL_TOPICS, TOPICS } from '../src/math/curriculum';
import { generate } from '../src/math/engine';
import { ballsQuestion, scripted, type BeatId } from '../src/math/scripted';
import type { Grade, Question } from '../src/math/types';
import { setMathRng } from '../src/math/util';

const GRADES: Grade[] = [1, 2, 3, 4, 5];

/** speechText() trước khi có Tiếng Anh (bản sao nguyên văn) – lời đọc tiếng Việt phải giữ y như cũ. */
function oldSpeechText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/(\d)\s*\+\s*(\d)/g, '$1 cộng $2')
    .replace(/(\d)\s*[−-]\s*(\d)/g, '$1 trừ $2')
    .replace(/(\d)\s*[×x]\s*(\d)/g, '$1 nhân $2')
    .replace(/(\d)\s*:\s*(\d)/g, '$1 chia $2')
    .replace(/=\s*\?/g, 'bằng bao nhiêu')
    .replace(/=/g, ' bằng ')
    .replace(/\?{2,}/g, '?')
    .replace(/…/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cách chọn giọng tiếng Việt trước đây (bản sao nguyên văn). */
function oldPickVoice<T extends VoiceLike>(voices: T[]): T | null {
  const vi = voices.filter((v) => v.lang.toLowerCase().startsWith('vi'));
  return (
    vi.find((v) => /natural|online/i.test(v.name) && /hoaimy|hoài my|female|nữ/i.test(v.name)) ??
    vi.find((v) => /natural|online/i.test(v.name)) ??
    vi.find((v) => /hoaimy|an\b/i.test(v.name)) ??
    vi[0] ??
    null
  );
}

const textsOf = (q: Question) => [q.prompt, q.context ?? '', q.speech, q.hint, ...q.steps, ...q.choices.map((c) => c.label)];

const BEATS: BeatId[] = [
  'villageBoxes', 'shopFruit', 'forestBridge', 'forestRock', 'bearBridge', 'bearStones', 'mazeDoor',
  'coaster', 'balls', 'wheel', 'giraffe', 'monkey', 'penguins',
];

function mathCorpus(): string[] {
  const out = ['5 + 3 = ?', '12 − 4 = ?', '7 - 2 = 5', '3 × 4 = 12', '2x3', '12 : 3 = ?', 'Gì vậy??', 'Đợi chút…', '🐱 Mèo có 3 + 2 con cá 🐟'];
  for (const g of GRADES) {
    for (const t of ALL_TOPICS) {
      for (let L = 1; L <= TOPICS[t].maxLevel; L++) {
        for (let s = 0; s < 3; s++) {
          setMathRng(Rng.seeded(`speech|${g}|${t}|${L}|${s}`));
          out.push(...textsOf(generate(t, L, { grade: g })));
        }
      }
    }
    setMathRng(Rng.seeded(`speech|beats|${g}`));
    for (const b of BEATS) out.push(...textsOf(scripted(b, { grade: g })));
    out.push(...textsOf(ballsQuestion({ grade: g })));
  }
  return out.filter(Boolean);
}

describe('voices.ts – chuẩn hóa lời đọc', () => {
  it('Tiếng Việt: đọc y như trước trên mọi câu hỏi Toán', () => {
    const corpus = mathCorpus();
    expect(corpus.length).toBeGreaterThan(5000);
    const diff = corpus.filter((s) => s.includes('«') || speechText(s, 'vi') !== oldSpeechText(s) || speechText(s) !== oldSpeechText(s));
    expect(diff.slice(0, 10)).toEqual([]);
  });

  it('Tiếng Việt: bỏ dấu «» quanh từ tiếng Anh', () => {
    expect(speechText('Từ «cat» nghĩa là gì?', 'vi')).toBe('Từ cat nghĩa là gì?');
  });

  it('Tiếng Anh: không đọc ký hiệu Toán bằng tiếng Việt', () => {
    expect(speechText('5 + 3 = ?', 'en')).toBe('5 + 3 = ?');
    expect(speechText('It is 7:30.', 'en')).toBe('It is 7:30.');
    expect(speechText('a 2x3 box', 'en')).toBe('a 2x3 box');
    for (const s of ['5 + 3 = ?', 'It is 7:30.', 'ten - two']) expect(speechText(s, 'en')).not.toMatch(/cộng|trừ|nhân|chia|bằng/);
  });

  it('Tiếng Anh: bỏ emoji, «», đọc chỗ trống, đánh vần, chữ viết tắt và chữ cái đứng riêng', () => {
    expect(speechText('«apple» 🍎', 'en')).toBe('apple');
    expect(speechText('I ___ a cat.', 'en')).toBe('I ... a cat.');
    expect(speechText('a-p-p-l-e', 'en')).toBe('A, P, P, L, E');
    expect(speechText('a yo-yo and a T-shirt', 'en')).toBe('a yo-yo and a T-shirt');
    expect(speechText('red / blue', 'en')).toBe('red. blue');
    expect(speechText('I like IT and PE.', 'en')).toBe('I like I.T. and P.E.');
    expect(speechText('b', 'en')).toBe('B');
    expect(speechText('the letter b', 'en')).toBe('the letter B');
    expect(speechText('a bird', 'en')).toBe('a bird');
  });

  it('splitLang: phần «…» là tiếng Anh, bỏ đoạn chỉ có dấu câu hoặc emoji', () => {
    expect(splitLang('Chọn hình đúng: «cat» 🐱')).toEqual([
      { text: 'Chọn hình đúng:', lang: 'vi' },
      { text: 'cat', lang: 'en' },
    ]);
    expect(splitLang('«Hello!»')).toEqual([{ text: 'Hello!', lang: 'en' }]);
    expect(splitLang('«cat» ?')).toEqual([{ text: 'cat', lang: 'en' }]);
    expect(splitLang('Nghe: «» «b», rồi «c».')).toEqual([
      { text: 'Nghe:', lang: 'vi' },
      { text: 'b', lang: 'en' },
      { text: ', rồi', lang: 'vi' },
      { text: 'c', lang: 'en' },
    ]);
    expect(splitLang('Không có tiếng Anh')).toEqual([{ text: 'Không có tiếng Anh', lang: 'vi' }]);
    expect(hasEnglish('Từ «cat»')).toBe(true);
    expect(hasEnglish('5 + 3 = ?')).toBe(false);
    expect(plainText('Chọn «cat» nhé')).toBe('Chọn cat nhé');
  });
});

const V = (name: string, lang: string, localService = true): VoiceLike => ({ name, lang, localService });
const EN_VOICES = [
  V('Microsoft David - English (United States)', 'en-US'),
  V('Microsoft Zira - English (United States)', 'en-US'),
  V('Google US English', 'en-US', false),
  V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false),
  V('Microsoft Hazel - English (United Kingdom)', 'en-GB'),
  V('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', false),
  V('Microsoft Guy Online (Natural) - English (United States)', 'en_US', false),
  V('Microsoft Ana Online (Natural) - English (United States)', 'en-US', false),
  V('Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', 'vi-VN', false),
  V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN'),
  V('Karen', 'en-AU'),
];
const VI_VOICES = [
  V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN'),
  V('Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', 'vi-VN', false),
  V('Microsoft NamMinh Online (Natural) - Vietnamese (Vietnam)', 'vi-VN', false),
  V('Google Tiếng Việt', 'vi-VN', false),
  V('Linh', 'vi_VN'),
];

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

function subsets<T>(a: T[]): T[][] {
  return a.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);
}

describe('voices.ts – chọn giọng', () => {
  it('Tiếng Anh khi có mạng: giọng tự nhiên trước, Zira/David/Mark là dự phòng', () => {
    expect(rankVoices(EN_VOICES, 'en', true).map((v) => v.name.split(' ')[1] ?? v.name)).toEqual([
      'Aria', 'Sonia', 'Guy', 'US', 'Ana', 'Hazel', 'David', 'Zira', 'Karen',
    ]);
  });

  it('Tiếng Anh khi mất mạng: giọng cục bộ của máy trước', () => {
    expect(rankVoices(EN_VOICES, 'en', false).map((v) => v.name.split(' ')[1] ?? v.name)).toEqual([
      'Hazel', 'David', 'Zira', 'Karen', 'Aria', 'Sonia', 'Guy', 'US', 'Ana',
    ]);
  });

  it('Tiếng Việt: giọng đầu tiên giống hệt cách chọn cũ (mọi tổ hợp, mọi thứ tự)', () => {
    let n = 0;
    for (const set of subsets(VI_VOICES)) {
      for (const list of permutations([...set, EN_VOICES[0]])) {
        expect(rankVoices(list, 'vi', true)[0] ?? null).toBe(oldPickVoice(list));
        n++;
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('Tiếng Việt khi mất mạng: ưu tiên giọng cục bộ', () => {
    expect(rankVoices(VI_VOICES, 'vi', false)[0].name).toBe('Microsoft An - Vietnamese (Vietnam)');
    expect(rankVoices([VI_VOICES[1], VI_VOICES[4]], 'vi', false)[0].name).toBe('Linh');
  });

  it('Chỉ lấy giọng đúng ngôn ngữ', () => {
    expect(rankVoices(VI_VOICES, 'en')).toEqual([]);
    expect(rankVoices(EN_VOICES, 'vi').every((v) => v.lang.startsWith('vi'))).toBe(true);
  });
});

const VI = V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN');
const EN_NET = V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false);
const EN_LOCAL = V('Microsoft Zira - English (United States)', 'en-US');

function setVoices(list: VoiceLike[]): void {
  h.voices = list;
  for (const f of h.handlers) f();
}

const said = () => h.spoken.map((u) => `${u.voice?.lang.slice(0, 2)}:${u.text}`);

describe('speech.ts – đọc hai giọng nối tiếp', () => {
  beforeEach(() => {
    stopSpeech();
    h.spoken.length = 0;
    h.settings = { voice: true, voiceRate: 1 };
    h.grade = 1;
    setVoices([VI, EN_NET, EN_LOCAL]);
  });

  it('Lời tiếng Việt trước, rồi từ tiếng Anh bằng giọng tiếng Anh', () => {
    speak('Chọn hình đúng: «cat» 🐱');
    expect(said()).toEqual(['vi:Chọn hình đúng:']);
    expect(h.spoken[0].voice).toBe(VI);
    expect(h.spoken[0].pitch).toBeCloseTo(1.1);
    h.spoken[0].onend?.();
    expect(said()).toEqual(['vi:Chọn hình đúng:', 'en:cat']);
    expect(h.spoken[1].voice).toBe(EN_NET);
    expect(h.spoken[1].rate).toBeCloseTo(0.85);
    h.spoken[1].onend?.();
    expect(h.spoken.length).toBe(2);
    expect(h.duck.at(-1)).toBe(false);
  });

  it('Lớp 3–5 nghe tiếng Anh nhanh hơn một chút; tốc độ theo Cài đặt', () => {
    h.grade = 4;
    h.settings = { voice: true, voiceRate: 1.2 };
    speakEnglish('Good morning!');
    expect(h.spoken[0].rate).toBeCloseTo(0.9 * 1.2);
  });

  it('Câu chỉ có tiếng Việt đọc như trước', () => {
    speak('5 + 3 = ?');
    expect(said()).toEqual(['vi:5 cộng 3 bằng bao nhiêu']);
    expect(h.spoken[0].rate).toBeCloseTo(0.95);
  });

  it('Câu mới hủy câu đang đọc (phần còn lại của câu cũ không đọc tiếp)', () => {
    const c0 = h.cancels;
    speak('Nghe nhé: «cat».');
    const first = h.spoken[0];
    speak('Xin chào!');
    expect(h.cancels).toBe(c0 + 2);
    first.onend?.();
    expect(said()).toEqual(['vi:Nghe nhé:', 'vi:Xin chào!']);
  });

  it('Giọng trực tuyến lỗi (mất mạng) → đọc lại bằng giọng cục bộ một lần', () => {
    speakEnglish('apple');
    expect(h.spoken[0].voice).toBe(EN_NET);
    h.spoken[0].onerror?.({ error: 'network' });
    expect(h.spoken[1].voice).toBe(EN_LOCAL);
    expect(h.spoken[1].text).toBe('apple');
    h.spoken[1].onerror?.({ error: 'network' });
    expect(h.spoken.length).toBe(2);
  });

  it('Bị ngắt (interrupted) thì dừng, không đọc lại', () => {
    speak('Chọn «cat»');
    h.spoken[0].onerror?.({ error: 'interrupted' });
    expect(h.spoken.length).toBe(1);
  });

  it('Máy không có giọng tiếng Anh: chỉ đọc lời Việt, không ra câu hỏi nghe', () => {
    setVoices([VI]);
    expect(hasEnglishVoice()).toBe(false);
    expect(canListen()).toBe(false);
    speak('Chọn «cat»');
    h.spoken[0].onend?.();
    expect(said()).toEqual(['vi:Chọn']);
    const c0 = h.cancels;
    speakEnglish('cat');
    expect(h.spoken.length).toBe(1);
    expect(h.cancels).toBe(c0);
  });

  it('Máy không có giọng tiếng Việt: vẫn đọc phần tiếng Anh', () => {
    setVoices([EN_LOCAL]);
    expect(hasVietnameseVoice()).toBe(false);
    speak('Chọn «cat»');
    expect(said()).toEqual(['en:cat']);
  });

  it('Tắt giọng đọc: không đọc và không ra câu hỏi nghe; nút 🔊 (force) vẫn đọc', () => {
    h.settings = { voice: false, voiceRate: 1 };
    expect(canListen()).toBe(false);
    speak('Chọn «cat»');
    expect(h.spoken.length).toBe(0);
    speakEnglish('cat', { force: true });
    expect(said()).toEqual(['en:cat']);
  });

  it('Có giọng tiếng Anh và đang bật tiếng: được ra câu hỏi nghe', () => {
    expect(hasEnglishVoice()).toBe(true);
    expect(canListen()).toBe(true);
  });
});
