import { bus } from '../core/events';
import { canListen } from '../core/speech';
import { hasProfile, profile, setSitePick, sitePick, skill, type Profile } from '../core/state';
import type { EnOptions } from '../english/gen';
import { english, loadEnglish, type EnglishModule } from '../english/load';
import { capFoundation, EN_GRADE_TOPICS, GRADE_TOPICS, TOPICS } from '../math/curriculum';
import { pickTopic } from '../math/engine';
import type { BeatId } from '../math/scripted';
import type { EnTopic, MathTopic, Question, Subject, SubjectMode, Topic, WordTheme } from '../math/types';
import { rand } from '../math/util';
import { toast } from '../ui/toast';
import { adaptiveQuestion, mixedQuestion, storyQuestion, topicWeights } from './challenge';

/**
 * Bộ chọn môn: mọi nơi ra câu hỏi trong thế giới và mini-game đều đi qua đây.
 * - 'math': gọi đúng các hàm Toán như trước (không rút thêm số ngẫu nhiên nào).
 * - 'english': chỉ dùng bộ câu hỏi Tiếng Anh.
 * - 'both': chọn môn cho từng câu, nghiêng về môn bé cần luyện hơn; không quá 3 câu liền một môn.
 * Thử thách cố định (cầu, tảng đá, cửa ra mê cung, phòng lâu đài) chọn môn một lần và lưu vào hồ sơ.
 */

/** Môn học đặt trong hồ sơ (không có hồ sơ: Toán). Dùng cho màn hình cài đặt, hồ sơ. */
export function profileSubject(): SubjectMode {
  return hasProfile() ? profile().subject : 'math';
}

/** Môn đang dùng trong thế giới: như hồ sơ, nhưng chưa tải được phần Tiếng Anh thì tạm dùng Toán. */
export function subject(): SubjectMode {
  const s = profileSubject();
  return s !== 'math' && !english() ? 'math' : s;
}

function en(): EnglishModule {
  const m = english();
  if (!m) throw new Error('Chưa tải bộ câu hỏi Tiếng Anh');
  return m;
}

/** Tải phần Tiếng Anh khi hồ sơ cần (gọi trước khi dựng khu vực). Lỗi tải: báo nhẹ và tạm chơi Toán. */
export async function ensureEnglish(): Promise<boolean> {
  if (profileSubject() === 'math' || english()) return true;
  try {
    await loadEnglish();
    return true;
  } catch (e) {
    console.warn('[subject] không tải được phần Tiếng Anh', e);
    toast('Chưa tải được phần Tiếng Anh. Tạm thời mình chơi môn Toán nhé!', { icon: '📶', tone: 'warn' });
    return false;
  }
}

/* ---------------- Cân bằng hai môn ---------------- */

/**
 * Mức "cần luyện" của một môn (0–1.15): tỉ lệ câu chưa đúng ngay lần đầu trong 20 câu gần nhất của môn đó
 * (ít hơn 5 câu: 0.5), cộng 0.15 nếu có chủ đề của môn đang ở chế độ hỗ trợ.
 */
export function need(p: Profile, s: Subject): number {
  let n = 0;
  let miss = 0;
  for (let i = p.log.length - 1; i >= 0 && n < 20; i--) {
    const e = p.log[i];
    if (TOPICS[e.topic]?.subject !== s) continue;
    n++;
    if (e.a > 1) miss++;
  }
  let v = n < 5 ? 0.5 : miss / n;
  const topics: Topic[] = s === 'math' ? GRADE_TOPICS[p.grade] : EN_GRADE_TOPICS[p.grade];
  if (topics.some((t) => p.skills[t]?.support)) v += 0.15;
  return v;
}

/** Tỉ lệ câu Tiếng Anh ở chế độ "Cả hai": 30–70%, nhiều hơn khi Tiếng Anh cần luyện hơn Toán. */
export function englishShare(p: Profile = profile()): number {
  return Math.max(0.3, Math.min(0.7, 0.5 + 0.8 * (need(p, 'english') - need(p, 'math'))));
}

/** Môn bé cần luyện hơn (bằng nhau: Tiếng Anh). */
export function weaker(p: Profile = profile()): Subject {
  return need(p, 'math') > need(p, 'english') ? 'math' : 'english';
}

const other = (s: Subject): Subject => (s === 'math' ? 'english' : 'math');

/** Chuỗi câu liền nhau cùng một môn (chế độ "Cả hai"). */
let streak: { s: Subject | null; n: number } = { s: null, n: 0 };
const MAX_STREAK = 3;

bus.on('profile', () => {
  streak = { s: null, n: 0 };
});
bus.on('subject', () => {
  streak = { s: null, n: 0 };
});

function note(s: Subject): void {
  if (subject() !== 'both') return;
  if (streak.s === s) streak.n++;
  else streak = { s, n: 1 };
}

/** Rút một môn theo tỉ lệ (không tính chuỗi). */
function drawSubject(): Subject {
  return rand().next() < englishShare() ? 'english' : 'math';
}

/** Môn cho câu hỏi tiếp theo. 'math'/'english': đúng môn đó (không rút số ngẫu nhiên). */
export function pickSubject(): Subject {
  const mode = subject();
  if (mode !== 'both') return mode;
  const s = drawSubject();
  return streak.s === s && streak.n >= MAX_STREAK ? other(s) : s;
}

/** Môn của một thử thách cố định: chọn một lần, lưu theo hồ sơ (chỉ ở chế độ "Cả hai"). */
export function siteSubject(site: string): Subject {
  const mode = subject();
  if (mode !== 'both') return mode;
  const had = sitePick(site);
  if (had) return had;
  const s = drawSubject();
  setSitePick(site, s);
  return s;
}

/* ---------------- Lâu đài ---------------- */

export type CastleSlot = 'mul' | 'frac' | 'geo';
const SLOTS: CastleSlot[] = ['mul', 'frac', 'geo'];

/**
 * Môn của ba phòng lâu đài. "Cả hai": chia 2 + 1 cố định theo hồ sơ – môn cần luyện hơn được hai phòng
 * (Phòng 1 và 3). Phòng đã chọn trước (kể cả sau khi đổi môn) được giữ nếu còn hợp lệ.
 */
export function castleRooms(): Record<CastleSlot, Subject> {
  const mode = subject();
  if (mode !== 'both') return { mul: mode, frac: mode, geo: mode };
  const w = weaker();
  const want: Record<CastleSlot, Subject> = { mul: w, frac: other(w), geo: w };
  const out = {} as Record<CastleSlot, Subject>;
  const left: Record<Subject, number> = { [w]: 2, [other(w)]: 1 } as Record<Subject, number>;
  for (const k of SLOTS) {
    const had = sitePick(`castle.${k}`);
    if (had) {
      out[k] = had;
      left[had]--;
    }
  }
  for (const k of SLOTS) {
    if (out[k]) continue;
    const s = left[want[k]] > 0 ? want[k] : other(want[k]);
    out[k] = s;
    left[s]--;
    setSitePick(`castle.${k}`, s);
  }
  return out;
}

/** Môn của 5 câu thử thách Nhà Vua. "Cả hai": 3 + 2 xen kẽ, môn cần luyện hơn được 3 câu. */
export function kingPlan(): Subject[] {
  const mode = subject();
  if (mode !== 'both') return [mode, mode, mode, mode, mode];
  const w = weaker();
  const o = other(w);
  return [w, o, w, o, w];
}

/* ---------------- Sinh câu hỏi ---------------- */

/** Tùy chọn cho bộ câu hỏi Tiếng Anh theo hồ sơ (lớp, Unit N, có giọng đọc, chế độ hỗ trợ của kĩ năng). */
export function enOpts(topic?: EnTopic, extra: Partial<EnOptions> = {}): EnOptions {
  const p = profile();
  return { grade: p.grade, units: p.enUnit, listen: canListen(), support: topic ? skill(topic).support : false, ...extra };
}

/** Câu hỏi Toán theo năng lực (như adaptiveQuestion). */
export function mathQ(topic: MathTopic, o: { theme?: WordTheme; levelDelta?: number; level?: number } = {}): Question {
  note('math');
  return adaptiveQuestion(topic, o);
}

/** Câu hỏi Tiếng Anh theo năng lực của kĩ năng (đã quy đổi theo lớp / giọng đọc). */
export function englishQ(topic: EnTopic, o: { levelDelta?: number; level?: number; en?: Partial<EnOptions> } = {}): Question {
  const E = en();
  const t = E.resolveTopic(topic, enOpts(undefined, o.en));
  const s = skill(t);
  note('english');
  return E.englishQuestion(t, o.level ?? s.level + (o.levelDelta ?? 0), enOpts(t, o.en));
}

/** Chọn kĩ năng Tiếng Anh cần luyện (ưu tiên kĩ năng yếu; có Unit N thì câu nền tảng ~20%). */
export function pickEnTopic(list?: readonly EnTopic[], extra: Partial<EnOptions> = {}): EnTopic {
  const p = profile();
  const E = en();
  const o = enOpts(undefined, extra);
  const topics = [...new Set((list && list.length ? list : EN_GRADE_TOPICS[p.grade]).map((t) => E.resolveTopic(t, o)))];
  let w = topicWeights(topics);
  if (p.enUnit) w = capFoundation(topics, w);
  return pickTopic(topics, w);
}

export interface MixedOpts {
  /** Chủ đề Toán (mặc định: theo lớp). */
  math?: MathTopic[];
  theme?: WordTheme;
  /** Kĩ năng Tiếng Anh được chọn (mặc định: theo lớp). */
  enTopics?: EnTopic[];
  en?: Partial<EnOptions>;
  /** Thử thách cố định: môn được lưu theo hồ sơ. */
  site?: string;
  /** Môn đã chọn sẵn. */
  s?: Subject;
}

/** Câu đố tổng hợp của nhân vật (Toán: đúng như mixedQuestion). */
export function mixedQ(o: MixedOpts = {}): Question {
  const s = o.s ?? (o.site ? siteSubject(o.site) : pickSubject());
  if (s === 'math') {
    note('math');
    return mixedQuestion(o.math, o.theme);
  }
  return englishQ(pickEnTopic(o.enTopics, o.en), { en: o.en });
}

/** Câu hỏi của một tình huống trong truyện, cùng cách chơi ở cả hai môn (Toán: đúng như storyQuestion). */
export function storyQ(beat: BeatId, o: { theme?: WordTheme; site?: string; s?: Subject } = {}): Question {
  const s = o.s ?? (o.site ? siteSubject(o.site) : pickSubject());
  if (s === 'math') {
    note('math');
    return storyQuestion(beat, o.theme);
  }
  const E = en();
  const topic = E.beatTopic(beat, enOpts()) ?? pickEnTopic(undefined, E.beatOptions(beat));
  note('english');
  return E.beatQuestion(beat, topic, skill(topic).level, enOpts(topic));
}

/**
 * Câu hỏi có đáp án hiện trên vật thể 3D (đá, cửa): Tiếng Anh dùng nhãn ngắn (hình hoặc từ ≤ 8 chữ cái),
 * không hỏi câu nghe. `math` = cách ra câu Toán của nơi đó (qua mathQ / storyQ / mixedQ, đã tự ghi nhận môn).
 */
export function labelQ(s: Subject, math: () => Question, o: { topic?: EnTopic; count?: number; levelDelta?: number; en?: Partial<EnOptions> } = {}): Question {
  if (s === 'math') return math();
  const extra: Partial<EnOptions> = { short: true, listen: false, ...(o.count ? { count: o.count } : {}), ...o.en };
  return englishQ(o.topic ?? pickEnTopic(undefined, extra), { levelDelta: o.levelDelta, en: extra });
}

export function isEnglishQ(q: Question): boolean {
  return TOPICS[q.topic]?.subject === 'english';
}

/** (Kiểm thử) Đặt lại chuỗi câu liền môn. */
export function resetStreak(): void {
  streak = { s: null, n: 0 };
}

/** (Kiểm thử) Ghi nhận một câu đã ra ở môn s. */
export const noteSubject = note;
