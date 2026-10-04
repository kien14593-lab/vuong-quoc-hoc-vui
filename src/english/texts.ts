/**
 * Đoạn văn rất ngắn (1–3 câu) để đọc hoặc nghe rồi trả lời bằng tiếng Việt. Do nhóm tự viết.
 */
import type { Rng } from '../core/rng';
import type { Grade } from '../math/types';
import type { Word } from './bank';
import { BY_TRANSPORT, PETS, type Person, aForm, gerundOf, hasTag, he, isWeatherAdj } from './frames';
import { NATIONALITY, fixPhrase, hobbyLike, plainAction } from './qa';
import { withArticle } from './words';

export interface MiniText {
  id: string;
  gate: [Grade, number];
  pick(w: Word): boolean;
  make(w: Word, p: Person, R: Rng): { text: string; ask: string };
}

const MEMBERS: { en: string; vi: string; sex: 'm' | 'f' }[] = [
  { en: 'mother', vi: 'Mẹ', sex: 'f' }, { en: 'father', vi: 'Bố', sex: 'm' },
  { en: 'grandmother', vi: 'Bà', sex: 'f' }, { en: 'grandfather', vi: 'Ông', sex: 'm' },
  { en: 'aunt', vi: 'Cô', sex: 'f' }, { en: 'uncle', vi: 'Chú', sex: 'm' },
];
const SEASON_ADJ: Record<string, string> = { summer: 'hot', winter: 'cold', spring: 'warm', autumn: 'cool' };

export const MINI_TEXTS: MiniText[] = [
  {
    id: 'hobby', gate: [3, 5], pick: hobbyLike,
    make: (w, p) => ({ text: `Hi, I'm ${p.name}. I like ${gerundOf(w)}. It's fun!`, ask: `${p.name} thích làm gì?` }),
  },
  {
    id: 'familyJob', gate: [3, 12], pick: (w) => hasTag(w, 'job') && !w.pw,
    make: (w, _p, R) => {
      const pool = MEMBERS.filter((m) => !w.sex || m.sex === w.sex);
      const m = R.pick(pool);
      const s = he(m);
      return { text: `This is my ${m.en}. ${s} ${withArticle(w.w)}. ${s} kind.`, ask: `${m.vi} của bạn ấy làm nghề gì?` };
    },
  },
  {
    id: 'food', gate: [3, 15], pick: (w) => hasTag(w, 'food', 'fruit', 'veg') && w.pic,
    make: (w) => ({ text: `I'm hungry. I'd like ${aForm(w)}, please.`, ask: 'Bạn ấy muốn ăn gì?' }),
  },
  {
    id: 'pet', gate: [3, 16], pick: (w) => PETS.has(w.w),
    make: (w) => ({ text: `I have a pet. It's ${withArticle(w.w)}. It's very cute.`, ask: 'Bạn ấy nuôi con gì?' }),
  },
  {
    id: 'country', gate: [4, 1],
    pick: (w) => w.grade === 4 && w.unit === 1 && hasTag(w, 'country') && !NATIONALITY.has(w.w),
    make: (w, p) => ({ text: `Hello! My name is ${p.name}. I'm from ${w.w}.`, ask: `Bạn ${p.name} đến từ đâu?` }),
  },
  {
    id: 'birthday', gate: [4, 4], pick: (w) => hasTag(w, 'month') && /^[A-Z][a-z]+$/.test(w.w),
    make: (w, p) => ({ text: `My name is ${p.name}. My birthday is in ${w.w}.`, ask: `Sinh nhật của ${p.name} vào tháng mấy?` }),
  },
  {
    id: 'subject', gate: [4, 8], pick: (w) => hasTag(w, 'subject') && /^[A-Z]/.test(w.w),
    make: (w) => ({ text: `My favourite subject is ${w.w}. It's fun!`, ask: 'Môn học yêu thích của bạn ấy là gì?' }),
  },
  {
    id: 'weekend', gate: [4, 15], pick: (w) => w.grade === 4 && w.unit === 15 && plainAction(w),
    make: (w) => ({ text: `At the weekend, we ${fixPhrase(w.w)}. It's great!`, ask: 'Cuối tuần gia đình bạn ấy làm gì?' }),
  },
  {
    id: 'weather', gate: [4, 16], pick: isWeatherAdj,
    make: (w) => ({ text: `Look outside! It's ${w.w} today.`, ask: 'Hôm nay thời tiết thế nào?' }),
  },
  {
    id: 'futureJob', gate: [5, 5], pick: (w) => hasTag(w, 'job') && !w.pw,
    make: (w) => ({ text: `I want to be ${withArticle(w.w)}. It's my dream job.`, ask: 'Bạn ấy muốn làm nghề gì?' }),
  },
  {
    id: 'illness', gate: [5, 15], pick: (w) => hasTag(w, 'illness'),
    make: (w) => ({ text: `I don't feel well. I have ${w.nc ? w.w : withArticle(w.w)}.`, ask: 'Bạn ấy bị làm sao?' }),
  },
  {
    id: 'season', gate: [5, 16], pick: (w) => w.w in SEASON_ADJ,
    make: (w) => ({ text: `I love ${w.w}. It's ${SEASON_ADJ[w.w]}.`, ask: 'Bạn ấy thích mùa nào?' }),
  },
  {
    id: 'transport', gate: [5, 18], pick: (w) => BY_TRANSPORT.has(w.w),
    make: (w) => ({ text: `Every day, I go to school by ${w.w}.`, ask: 'Bạn ấy đến trường bằng gì?' }),
  },
];
