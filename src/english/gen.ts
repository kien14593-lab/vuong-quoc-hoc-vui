/**
 * Bộ sinh câu hỏi Tiếng Anh – điểm vào duy nhất (tải lười qua load.ts).
 * Câu hỏi có cùng dạng Question với Toán nên bảng câu hỏi, gợi ý, các bước giải và phần thưởng dùng chung.
 */
import { maxLevelFor } from '../math/curriculum';
import type { EnTopic, Question } from '../math/types';
import { qid } from '../math/util';
import { type Word, conflicts } from './bank';
import { type Ctx, type EnOptions, forgetRecent, hasAny, makeCtx, remember, valid, wordLabel } from './gen-core';
import { phonics, spell } from './gen-letters';
import { numbers } from './gen-numbers';
import { listenText, sentence } from './gen-sentence';
import { time, timeAvailable } from './gen-time';
import { listenQ, vocab } from './gen-vocab';
import { clampUnit } from './units';

export type { EnOptions, Word };
export { forgetRecent, wordLabel };

/**
 * Chủ đề thực sự dùng: Lớp 1–2 chưa có mẫu câu; Lớp 3–5 luyện chữ qua chính tả; Lớp 1 luyện chữ qua âm đầu;
 * không có giọng tiếng Anh thì không hỏi câu nghe; giờ – lịch chưa học thì hỏi số đếm.
 */
export function resolveTopic(topic: EnTopic, o: EnOptions): EnTopic {
  const g = o.grade;
  if (topic === 'en_sentence' && g <= 2) return 'en_vocab';
  if (topic === 'en_phonics' && g >= 3) return 'en_spell';
  if (topic === 'en_spell' && g === 1) return 'en_phonics';
  if (topic === 'en_listen' && !o.listen) return 'en_vocab';
  if (topic === 'en_time' && !timeAvailable(g, clampUnit(g, o.units ?? null))) return 'en_numbers';
  return topic;
}

function build(c: Ctx, level: number): Question | null {
  switch (c.topic) {
    case 'en_vocab':
      return vocab(c, level);
    case 'en_listen':
      return level >= 4 ? listenText(c, level) : listenQ(c, level);
    case 'en_phonics':
      return phonics(c, level);
    case 'en_spell':
      return spell(c, level);
    case 'en_sentence':
      return sentence(c, level);
    case 'en_numbers':
      return numbers(c, level);
    case 'en_time':
      return time(c, level);
  }
}

/** Kiểm thử bật chế độ nghiêm: lỗi trong bộ sinh được ném ra thay vì bỏ qua. */
let strict = false;
export function setStrict(v: boolean): void {
  strict = v;
}

function attempt(o: EnOptions, topic: EnTopic, level: number): Question | null {
  const c = makeCtx(o, topic);
  let q: Question | null = null;
  try {
    q = build(c, level);
  } catch (e) {
    if (strict) throw e;
    return null;
  }
  if (!q || !valid(q, c)) return null;
  remember(c.target);
  return q;
}

/** Câu hỏi dự phòng cuối cùng (không bao giờ dùng tới nếu ngân hàng từ đúng). */
function fallback(): Question {
  return {
    id: qid('en_vocab'),
    topic: 'en_vocab',
    level: 1,
    prompt: 'Chọn hình đúng: «cat»',
    speech: 'Chọn hình đúng: «cat»',
    choices: [
      { label: '🐱', value: 'cat' },
      { label: '🐶', value: 'dog' },
      { label: '🐟', value: 'fish' },
    ],
    answer: 'cat',
    hint: '«cat» là con mèo.',
    steps: ['«cat» nghĩa là “con mèo”.', 'Đáp án: 🐱'],
    en: 'cat',
  };
}

/**
 * Câu hỏi Tiếng Anh cho một chủ đề ở một mức (mức được giới hạn theo lớp). Không bao giờ ném lỗi:
 * thử lại, hạ mức, rồi hỏi từ vựng mức 1.
 */
export function englishQuestion(topic: EnTopic, level: number, o: EnOptions): Question {
  const t = resolveTopic(topic, o);
  const top = Math.max(1, Math.min(Math.round(level) || 1, maxLevelFor(t, o.grade)));
  for (let L = top; L >= 1; L--) {
    for (let i = 0; i < 8; i++) {
      const q = attempt(o, t, L);
      if (q) return q;
    }
  }
  if (t !== 'en_vocab') {
    for (let i = 0; i < 8; i++) {
      const q = attempt(o, 'en_vocab', 1);
      if (q) return q;
    }
  }
  return fallback();
}

export interface SetOptions {
  /** Số từ cần. */
  n: number;
  /** Chỉ lấy từ có một trong các nhãn chủ đề này. */
  tags?: string[];
  /** Chỉ lấy từ có hình (emoji) rõ nghĩa. */
  pic?: boolean;
  ok?: (w: Word) => boolean;
}

/**
 * Chọn n từ khác hình, không gây nhầm với nhau (trò ghép cặp, cho khỉ ăn, làm bánh…).
 * Ưu tiên từ của lớp (Unit N và N−1 trước), rồi lớp dưới; nhãn ngắn thì từ ≤ 8 chữ cái.
 */
export function pickSet(o: EnOptions, s: SetOptions): Word[] {
  const c = makeCtx(o, 'en_vocab');
  const fits = (w: Word) =>
    (!s.tags || hasAny(w, s.tags)) && (!s.pic || w.pic) && (!o.short || w.w.length <= 8) && (!s.ok || s.ok(w));
  const out: Word[] = [];
  const emojis = new Set<string>();
  for (const list of [c.pool, c.prev, c.rest]) {
    const ranked = list
      .filter(fits)
      .map((w) => ({ w, r: c.R.next() + (c.n !== null && w.grade === c.g && w.unit >= c.n - 1 ? 0.5 : 0) }))
      .sort((a, b) => b.r - a.r);
    for (const { w } of ranked) {
      if (out.length >= s.n) return out;
      if (emojis.has(w.e) || out.some((x) => conflicts(x, w))) continue;
      emojis.add(w.e);
      out.push(w);
    }
  }
  return out;
}
