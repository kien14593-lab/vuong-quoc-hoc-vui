/**
 * Lõi bộ sinh câu hỏi Tiếng Anh: phạm vi từ theo lớp và "Đang học đến Unit N", chọn từ đích,
 * chọn phương án nhiễu không gây nhầm, dựng và kiểm tra câu hỏi.
 */
import type { Rng } from '../core/rng';
import type { Choice, EnTopic, Grade, Question } from '../math/types';
import { qid, rand } from '../math/util';
import { type Word, BANK, conflicts, gradeWords } from './bank';
import { BLOCKED } from './common';
import { TAG_VI } from './frames';
import { clampUnit } from './units';
import { spellOut } from './words';

export interface EnOptions {
  grade: Grade;
  /** "Đang học đến Unit N" (null/undefined = mọi Unit). */
  units?: number | null;
  /** Học sinh đang gặp khó → ít lựa chọn hơn. */
  support?: boolean;
  /** Đang bật tiếng và có giọng tiếng Anh → được hỏi câu nghe. */
  listen?: boolean;
  /** Nhãn ngắn (≤ 8 chữ cái, không tính emoji) cho bảng 3D, bóng, cửa… */
  short?: boolean;
  /** Ưu tiên từ có một trong các nhãn chủ đề này (ví dụ ['fruit'] ở quầy trái cây). */
  tags?: string[];
  /** Chỉ dùng từ có nhãn trong `tags` (trò chơi cần đúng loại đồ vật). */
  strict?: boolean;
  /** Số lựa chọn mong muốn (Lớp 1–2: tối đa 3). */
  count?: number;
}

export interface Ctx {
  o: EnOptions;
  g: Grade;
  /** Unit N đã chuẩn hóa (null = cả năm). */
  n: number | null;
  /** Số lựa chọn. */
  k: number;
  R: Rng;
  topic: EnTopic;
  /** Từ của lớp, Unit 1..N. */
  pool: Word[];
  /** Từ của các lớp dưới (ôn tập). */
  prev: Word[];
  /** Mọi từ còn lại – chỉ dùng khi thiếu (chữ cái hiếm, phương án nhiễu). */
  rest: Word[];
  /** Từ đích của câu hỏi đang dựng. */
  target?: Word;
}

const tierCache = new Map<string, { pool: Word[]; prev: Word[]; rest: Word[] }>();

function tiersFor(g: Grade, n: number | null): { pool: Word[]; prev: Word[]; rest: Word[] } {
  const key = `${g}:${n ?? 'all'}`;
  const hit = tierCache.get(key);
  if (hit) return hit;
  const pool = gradeWords(g, n);
  const seen = new Set(pool.map((w) => w.w.toLowerCase()));
  const take = (list: Word[]) =>
    list.filter((w) => {
      const k = w.w.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const prev = take(([1, 2, 3, 4] as Grade[]).filter((x) => x < g).flatMap((x) => gradeWords(x)));
  const rest = take(BANK);
  const t = { pool, prev, rest };
  tierCache.set(key, t);
  return t;
}

export function makeCtx(o: EnOptions, topic: EnTopic): Ctx {
  const g = o.grade;
  const n = clampUnit(g, o.units ?? null);
  const small = g <= 2;
  let k = small || o.support ? 3 : 4;
  if (o.count) k = Math.max(2, Math.min(small ? 3 : 6, Math.round(o.count)));
  return { o, g, n, k, R: rand(), topic, ...tiersFor(g, n) };
}

/* ---------------- Tránh hỏi lại một từ ngay sau đó ---------------- */

const recent: string[] = [];

export function remember(w: Word | undefined): void {
  if (!w) return;
  recent.push(w.id);
  if (recent.length > 6) recent.shift();
}

export function forgetRecent(): void {
  recent.length = 0;
}

/* ---------------- Chọn từ ---------------- */

export function weighted<T>(R: Rng, items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = R.next() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

export function hasAny(w: Word, tags: readonly string[] | undefined): boolean {
  return !!tags && w.tags.some((t) => tags.includes(t));
}

function targetLists(c: Ctx, wide: boolean): Word[][] {
  const tags = c.o.tags?.length ? c.o.tags : null;
  if (!tags) return wide ? [c.pool, c.prev, c.rest] : [c.pool, c.prev];
  const t = (l: Word[]) => l.filter((w) => hasAny(w, tags));
  if (c.o.strict) return [t(c.pool), t(c.prev), t(c.rest)];
  return wide ? [t(c.pool), t(c.prev), c.pool, c.prev, c.rest] : [t(c.pool), t(c.prev), c.pool, c.prev];
}

/**
 * Chọn từ đích thỏa `ok`: ưu tiên từ của lớp (Unit 1..N), rồi lớp dưới; `wide` = được lấy cả từ khác
 * trong ngân hàng khi thiếu. Unit N và N−1 được ưu tiên gấp đôi; từ có nhãn chủ đề yêu cầu gấp ba.
 */
export function pickWord(c: Ctx, ok: (w: Word) => boolean, wide = false): Word | null {
  const cand: Word[] = [];
  const seen = new Set<Word>();
  for (const list of targetLists(c, wide)) {
    for (const w of list) {
      if (!seen.has(w) && ok(w)) {
        seen.add(w);
        cand.push(w);
      }
    }
    if (cand.length >= 3) break;
  }
  if (!cand.length) return null;
  const fresh = cand.filter((w) => !recent.includes(w.id));
  const list = fresh.length ? fresh : cand;
  const tags = c.o.tags;
  const weights = list.map(
    (w) => (c.n !== null && w.grade === c.g && w.unit >= c.n - 1 ? 2 : 1) * (hasAny(w, tags) ? 3 : 1),
  );
  const w = weighted(c.R, list, weights);
  c.target = w;
  return w;
}

const norm = (s: string) => s.trim().toLowerCase();

const bare = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Nghĩa tiếng Việt chứa luôn từ tiếng Anh (“quả kiwi”, “Việt Nam”, “người Việt Nam” – Vietnamese): không
 * dùng làm đích cho câu hỏi hiện nghĩa rồi hỏi từ (hay ngược lại), vì nhìn là đoán được ngay.
 */
export function giveaway(w: Word): boolean {
  const en = bare(w.w);
  const vi = bare(w.vi);
  if (en.length >= 3 && vi.includes(en)) return true;
  return en.length >= 8 && vi.includes(en.slice(0, -3));
}

/**
 * Phương án nhiễu cho `target`: cùng Unit, cùng chủ đề được ưu tiên; không trùng nhãn, không gây nhầm
 * (đồng nghĩa, cùng hình, từ chung – từ riêng…) với đáp án và với nhau.
 */
export function distractors(
  c: Ctx,
  target: Word,
  d: { ok?: (w: Word) => boolean; label?: (w: Word) => string; n?: number } = {},
): Word[] {
  const n = d.n ?? c.k - 1;
  const ok = d.ok ?? (() => true);
  const label = d.label ?? ((w: Word) => w.w);
  const tags = c.o.tags;
  const out: Word[] = [];
  const labels = new Set([norm(label(target))]);
  for (const list of [c.pool, c.prev, c.rest]) {
    const scored = list
      .filter((w) => w !== target && ok(w))
      .map((w) => ({
        w,
        s:
          (w.grade === target.grade && w.unit === target.unit ? 2 : 0) +
          (w.tags.some((t) => target.tags.includes(t)) ? 2 : 0) +
          (hasAny(w, tags) ? 1 : 0) +
          c.R.next() * 1.5,
      }))
      .sort((a, b) => b.s - a.s);
    for (const { w } of scored) {
      if (out.length >= n) return out;
      const l = norm(label(w));
      if (labels.has(l) || conflicts(w, target) || out.some((x) => conflicts(x, w))) continue;
      labels.add(l);
      out.push(w);
    }
    if (out.length >= n) return out;
  }
  return out;
}

/* ---------------- Lựa chọn và câu hỏi ---------------- */

/** Cách hiện một từ trên nút: chữ, hình, nghĩa tiếng Việt, hoặc hình + chữ. */
export type Show = 'w' | 'e' | 'vi' | 'ew';

export function labelOf(w: Word, show: Show): string {
  if (show === 'e') return w.e;
  if (show === 'vi') return w.vi;
  if (show === 'ew') return `${w.e} ${w.w}`;
  return w.w;
}

/** Nhãn tiếng Việt kèm hình (dùng cho câu trả lời bằng tiếng Việt và trò chơi). */
export function wordLabel(w: Word): string {
  return w.pic ? `${w.e} ${w.vi}` : w.vi;
}

export function wordChoices(c: Ctx, target: Word, others: Word[], show: Show): { choices: Choice[]; answer: string } {
  const all = [target, ...others].map((w) => ({ label: labelOf(w, show), value: w.w }));
  return { choices: c.R.shuffle(all), answer: target.w };
}

export function textChoices(c: Ctx, answer: string, wrong: string[]): { choices: Choice[]; answer: string } {
  return { choices: c.R.shuffle([answer, ...wrong].map((s) => ({ label: s, value: s }))), answer };
}

export function mk(c: Ctx, level: number, q: Omit<Question, 'id' | 'topic' | 'level'>): Question {
  return { id: qid(c.topic), topic: c.topic, level, ...q };
}

/* ---------------- Kiểm tra ---------------- */

const BAD = /NaN|undefined|Infinity|null|\[object/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Độ dài nhãn khi bỏ emoji (nhãn 3D tối đa 8). */
export function shortLen(s: string): number {
  return s.replace(EMOJI, '').replace(/\s+/g, ' ').trim().length;
}

export function balanced(s: string): boolean {
  let open = false;
  for (const ch of s) {
    if (ch === '«') {
      if (open) return false;
      open = true;
    } else if (ch === '»') {
      if (!open) return false;
      open = false;
    }
  }
  return !open;
}

/** Các câu trong một đoạn tiếng Anh. */
export function sentencesOf(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)).length;
}

/** Phần tiếng Anh «…» trong một chuỗi. */
export function englishParts(s: string): string[] {
  return [...s.matchAll(/«([^»]*)»/g)].map((m) => m[1]);
}

/** Câu hỏi hợp lệ: đáp án nằm trong lựa chọn, không trùng, đủ ngắn, không có chữ lỗi. */
export function valid(q: Question, c: Ctx): boolean {
  const vals = q.choices.map((x) => x.value);
  const labels = q.choices.map((x) => norm(x.label));
  if (q.choices.length < 2 || new Set(vals).size !== vals.length || new Set(labels).size !== labels.length) return false;
  if (!vals.includes(q.answer) || labels.some((l) => !l)) return false;
  if (c.g <= 2 && q.choices.length > 3) return false;
  if (c.o.short && q.choices.some((x) => shortLen(x.label) > 8)) return false;
  const texts = [q.prompt, q.context ?? '', q.speech, q.hint, ...q.steps, ...q.choices.map((x) => x.label), q.en ?? ''];
  if (texts.some((t) => BAD.test(t) || !balanced(t))) return false;
  const english = [q.en ?? '', ...texts.flatMap(englishParts)];
  if (english.some((t) => sentencesOf(t).some((s) => wordCount(s) > 8))) return false;
  return true;
}

/* ---------------- Gợi ý ---------------- */

/** Nghĩa tiếng Việt trong ngoặc kép + dấu chấm (không thêm chấm nếu nghĩa đã có dấu câu cuối). */
export function viq(s: string): string {
  return /[.?!…]$/.test(s.trim()) ? `“${s}”` : `“${s}”.`;
}

export function meaning(w: Word): string {
  return `«${w.w}» nghĩa là ${viq(w.vi)}`;
}

export function wordSteps(w: Word, answerLabel: string): string[] {
  return [meaning(w), `Đánh vần: «${spellOut(w.w)}».`, `Đáp án: ${answerLabel}`];
}

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Gợi ý chữ cái giúp phân biệt từ đúng với các phương án còn lại. `lead` = mạo từ đứng trước trên nút
 * (“a runny nose”): gợi ý nói về từ sau mạo từ, để không lệch với chữ bé nhìn thấy.
 */
export function letterClue(answer: string, others: string[], lead?: string): string {
  const a = answer.toLowerCase();
  const os = others.map((x) => x.toLowerCase());
  const phrase = a.includes(' ');
  const noun = lead
    ? `Trong đáp án đúng, ${phrase ? 'cụm từ' : 'từ'} sau «${lead}»`
    : phrase
      ? 'Cụm từ đúng'
      : 'Từ đúng';
  if (os.every((o) => o[0] !== a[0])) return `${noun} bắt đầu bằng chữ «${a[0]}».`;
  const words = (s: string) => s.split(' ').length;
  if (phrase && os.every((o) => words(o) !== words(a))) return `${noun} gồm ${words(a)} từ.`;
  const len = letters(a).length;
  if (!phrase) {
    if (os.every((o) => letters(o).length !== len)) return `${noun} có ${len} chữ cái.`;
    const last = a[a.length - 1];
    if (/[a-z]/.test(last) && os.every((o) => o[o.length - 1] !== last)) return `${noun} kết thúc bằng chữ «${last}».`;
  }
  for (let p = 2; p < a.length; p++) {
    const pre = a.slice(0, p);
    if (pre.endsWith(' ') || BLOCKED.has(pre.trim())) continue;
    if (os.every((o) => !o.startsWith(pre))) return `${noun} bắt đầu bằng «${pre}».`;
  }
  // Phương án sai trùng gần hết phần đầu (because – becaus – becausa): ghép đầu + cuối, vẫn giấu phần giữa.
  for (let p = 1; p < a.length - 2; p++) {
    const pre = a.slice(0, p);
    if (pre.endsWith(' ') || BLOCKED.has(pre.trim())) continue;
    for (let s = 1; s <= 2 && p + s < a.length - 1; s++) {
      const suf = a.slice(-s);
      if (suf.startsWith(' ')) continue;
      if (os.every((o) => !(o.startsWith(pre) && o.endsWith(suf)))) {
        return `${noun} bắt đầu bằng «${pre}» và kết thúc bằng «${suf}».`;
      }
    }
  }
  const drop = others.slice(0, Math.max(1, others.length - 1)).map((o) => `«${o}»`);
  return drop.length ? `Không phải ${drop.join(', cũng không phải ')}.` : `${noun} có ${len} chữ cái.`;
}

/** Có cụm `part` đứng thành từ riêng trong `s` (không khớp nửa chữ, kể cả chữ có dấu). */
export function hasPhrase(s: string, part: string): boolean {
  const esc = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu').test(s);
}

/** Các nghĩa tách theo dấu phẩy/gạch chéo: "thời gian, giờ" → ["thời gian", "giờ"]. */
export function viParts(vi: string): string[] {
  return vi.split(/\s*[,/;]\s*/).map((p) => p.trim()).filter((p) => p.length >= 2);
}

/** Gợi ý nghĩa (câu hỏi tiếng Anh → tiếng Việt). */
export function viClue(w: Word, others: Word[]): string {
  if (w.pic) return `«${w.w}» là: ${w.e}`;
  // Câu theo nhãn không được chứa chính nghĩa đúng ("«weather» nói về thời tiết").
  const leaks = (s: string) => viParts(w.vi).some((p) => hasPhrase(s, p));
  const tag = w.tags.find((t) => TAG_VI[t] && !leaks(TAG_VI[t]) && others.every((o) => !o.tags.includes(t)));
  if (tag) return `«${w.w}» ${TAG_VI[tag]}.`;
  const first = (s: string) => s.trim()[0]?.toLowerCase();
  if (others.every((o) => first(o.vi) !== first(w.vi))) return `Nghĩa đúng bắt đầu bằng chữ “${w.vi.trim()[0]}”.`;
  const syl = (s: string) => s.trim().split(/\s+/).length;
  if (others.every((o) => syl(o.vi) !== syl(w.vi))) return `Nghĩa đúng có ${syl(w.vi)} tiếng.`;
  const o = others[0];
  if (o) return `Không phải “${o.vi}” – đó là nghĩa của «${o.w}».`;
  return `Đọc lại từng nghĩa và nghĩ xem nghĩa nào hợp với «${w.w}».`;
}
