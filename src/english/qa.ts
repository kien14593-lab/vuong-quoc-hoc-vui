/**
 * Mẫu hỏi – đáp ngắn (lớp 3–5) theo chủ đề Unit, do nhóm tự viết.
 * Mỗi mẫu: câu hỏi + câu trả lời ghép từ một từ trong ngân hàng; phương án nhiễu dùng cùng mẫu với từ khác.
 */
import type { Grade } from '../math/types';
import type { Word } from './bank';
import { withArticle } from './words';
import {
  BY_TRANSPORT, LOOK_ADJ, type Person, aForm, gerundOf, hasTag, he, isCountable, isGerund, isPlaceWord, isWeatherAdj,
} from './frames';

/** Mẫu mở khi học sinh lớp `g` đã học tới Unit `n` (null = cả năm). */
export function gateOpen(gate: [Grade, number], g: Grade, n: number | null): boolean {
  return g > gate[0] || (g === gate[0] && (n === null || n >= gate[1]));
}

export interface QaPattern {
  id: string;
  gate: [Grade, number];
  q(p: Person, w: Word): string;
  vi(p: Person, w: Word): string;
  pick(w: Word): boolean;
  say(w: Word, p: Person): string;
  /** Mẫu chỉ hợp với người cùng giới với từ (nghề có giới tính). */
  sexed?: boolean;
}

const NATIONALITY = new Set([
  'Vietnamese', 'Japanese', 'Chinese', 'Korean', 'Thai', 'Australian', 'American', 'English', 'British', 'Malaysian',
  'Singaporean', 'Indonesian', 'French', 'Cambodian', 'Laotian', 'Indian', 'Canadian', 'Filipino', 'Scottish',
]);
const PHRASE_FIX: Record<string, string> = { 'visit grandparents': 'visit my grandparents', 'do homework': 'do my homework' };
const fix = (s: string) => PHRASE_FIX[s] ?? s;
const from = (w: Word, g: Grade, u: number) => w.grade === g && w.unit === u;
const plainAction = (w: Word) => hasTag(w, 'action') && !isGerund(w.w) && !/^(be|let's|please)\b/i.test(w.w);
const hobbyLike = (w: Word) =>
  (hasTag(w, 'hobby') && (isGerund(w.w) || hasTag(w, 'action'))) || (hasTag(w, 'sport') && isGerund(w.w));

export { fix as fixPhrase, hobbyLike, plainAction, NATIONALITY };

export const QA_PATTERNS: QaPattern[] = [
  {
    id: 'this', gate: [3, 3], q: () => "What's this?", vi: () => 'Đây là cái gì?',
    pick: (w) => isCountable(w) && hasTag(w, 'toy', 'school', 'kitchen', 'home') && !hasTag(w, 'place', 'room', 'people', 'job'),
    say: (w) => `It's ${withArticle(w.w)}.`,
  },
  {
    id: 'colour', gate: [3, 9], q: () => 'What colour is it?', vi: () => 'Nó màu gì?',
    pick: (w) => hasTag(w, 'colour') && !!w.hex, say: (w) => `It's ${w.w}.`,
  },
  {
    id: 'likeDoing', gate: [3, 5], q: () => 'What do you like doing?', vi: () => 'Bạn thích làm gì?',
    pick: hobbyLike, say: (w) => `I like ${gerundOf(w)}.`,
  },
  {
    id: 'job', gate: [3, 12], sexed: true,
    q: (p) => (p.sex === 'm' ? "What's his job?" : "What's her job?"),
    vi: (p) => (p.sex === 'm' ? 'Chú ấy làm nghề gì?' : 'Cô ấy làm nghề gì?'),
    pick: (w) => hasTag(w, 'job') && !w.pw, say: (w, p) => `${he(p)} ${withArticle(w.w)}.`,
  },
  {
    id: 'whereRoom', gate: [3, 13], q: (p) => `Where is ${p.name}?`, vi: (p) => `${p.name} đang ở đâu?`,
    pick: (w) => hasTag(w, 'room') && !w.pw, say: (w, p) => `${he(p)} in the ${w.w}.`,
  },
  {
    id: 'eat', gate: [3, 15],
    q: (_p, w) => (hasTag(w, 'drink') ? 'What would you like to drink?' : 'What would you like to eat?'),
    vi: (_p, w) => (hasTag(w, 'drink') ? 'Bạn muốn uống gì?' : 'Bạn muốn ăn gì?'),
    pick: (w) => hasTag(w, 'food', 'fruit', 'veg', 'drink') && w.pic, say: (w) => `I'd like ${aForm(w)}, please.`,
  },
  {
    id: 'doing', gate: [3, 18], q: () => 'What are you doing?', vi: () => 'Bạn đang làm gì?',
    pick: (w) => hasTag(w, 'action', 'hobby', 'sport') && isGerund(w.w), say: (w) => `I'm ${w.w}.`,
  },
  {
    id: 'from', gate: [4, 1], q: () => 'Where are you from?', vi: () => 'Bạn đến từ đâu?',
    pick: (w) => from(w, 4, 1) && hasTag(w, 'country') && !NATIONALITY.has(w.w), say: (w) => `I'm from ${w.w}.`,
  },
  {
    id: 'day', gate: [4, 3], q: () => 'What day is it today?', vi: () => 'Hôm nay là thứ mấy?',
    pick: (w) => hasTag(w, 'day') && /^[A-Z][a-z]+day$/.test(w.w), say: (w) => `It's ${w.w}.`,
  },
  {
    id: 'birthday', gate: [4, 4], q: () => 'When is your birthday?', vi: () => 'Sinh nhật bạn vào tháng mấy?',
    pick: (w) => hasTag(w, 'month') && /^[A-Z][a-z]+$/.test(w.w), say: (w) => `It's in ${w.w}.`,
  },
  {
    id: 'can', gate: [4, 5], q: () => 'What can you do?', vi: () => 'Bạn có thể làm gì?',
    pick: (w) => from(w, 4, 5) && plainAction(w), say: (w) => `I can ${w.w}.`,
  },
  {
    id: 'subject', gate: [4, 8], q: () => "What's your favourite subject?", vi: () => 'Môn học yêu thích của bạn là gì?',
    pick: (w) => hasTag(w, 'subject') && /^[A-Z]/.test(w.w), say: (w) => `It's ${w.w}.`,
  },
  {
    id: 'went', gate: [4, 10], q: () => 'Where did you go?', vi: () => 'Bạn đã đi đâu?',
    pick: (w) => isPlaceWord(w) && !w.pw, say: (w) => `I went to the ${w.w}.`,
  },
  {
    id: 'look', gate: [4, 13],
    q: (p) => (p.sex === 'm' ? 'What does he look like?' : 'What does she look like?'),
    vi: (p) => (p.sex === 'm' ? 'Bạn ấy (nam) trông thế nào?' : 'Bạn ấy (nữ) trông thế nào?'),
    pick: (w) => LOOK_ADJ.includes(w.w), say: (w, p) => `${he(p)} ${w.w}.`,
  },
  {
    id: 'weekend', gate: [4, 15], q: () => 'What do you do at the weekend?', vi: () => 'Cuối tuần bạn làm gì?',
    pick: (w) => from(w, 4, 15) && plainAction(w), say: (w) => `I ${fix(w.w)}.`,
  },
  {
    id: 'weather', gate: [4, 16], q: () => "What's the weather like?", vi: () => 'Thời tiết thế nào?',
    pick: isWeatherAdj, say: (w) => `It's ${w.w}.`,
  },
  {
    id: 'nationality', gate: [5, 3], q: () => 'What nationality are you?', vi: () => 'Bạn mang quốc tịch gì?',
    pick: (w) => NATIONALITY.has(w.w), say: (w) => `I'm ${w.w}.`,
  },
  {
    id: 'beJob', gate: [5, 5], q: () => 'What would you like to be?', vi: () => 'Bạn muốn làm nghề gì?',
    pick: (w) => hasTag(w, 'job') && !w.pw, say: (w) => `I'd like to be ${withArticle(w.w)}.`,
  },
  {
    id: 'should', gate: [5, 14], q: () => 'What should I do?', vi: () => 'Mình nên làm gì?',
    pick: (w) => plainAction(w) && hasTag(w, 'health'), say: (w) => `You should ${w.w}.`,
  },
  {
    id: 'matter', gate: [5, 15], q: () => "What's the matter?", vi: () => 'Bạn bị làm sao vậy?',
    pick: (w) => hasTag(w, 'illness'), say: (w) => `I have ${w.nc ? w.w : withArticle(w.w)}.`,
  },
  {
    id: 'season', gate: [5, 16], q: () => 'What season is it?', vi: () => 'Bây giờ là mùa gì?',
    pick: (w) => hasTag(w, 'season') && /^[a-z]+$/.test(w.w), say: (w) => `It's ${w.w}.`,
  },
  {
    id: 'goBy', gate: [5, 18], q: () => 'How do you go to school?', vi: () => 'Bạn đến trường bằng gì?',
    pick: (w) => BY_TRANSPORT.has(w.w), say: (w) => `I go by ${w.w}.`,
  },
];
