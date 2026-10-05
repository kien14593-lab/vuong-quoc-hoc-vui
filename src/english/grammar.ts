/**
 * Bài điền ngữ pháp ngắn (lớp 3–5): câu mẫu do nhóm tự viết, mỗi bài dạy một quy tắc bằng tiếng Việt.
 */
import type { Rng } from '../core/rng';
import type { Grade } from '../math/types';
import { type Word, isBankWord } from './bank';
import { COMMON } from './common';
import { NAMES, PETS, hasTag, isCountable, plural } from './frames';
import { DAYS, MONTHS, article, ing, numberWord, thirdPerson, timeWords, withArticle } from './words';

export interface GapItem {
  /** Câu có chỗ trống "___". */
  gap: string;
  answer: string;
  wrong: string[];
  /** Câu đầy đủ (đọc bằng giọng tiếng Anh). */
  full: string;
  /** Quy tắc bằng tiếng Việt (phần tiếng Anh trong «»). */
  rule: string;
  emoji?: string;
  caption?: string;
  objects?: { emoji: string; groups: number[] };
}

export interface Grammar {
  id: string;
  gate: [Grade, number];
  make(R: Rng, pool: Word[]): GapItem | null;
}

/** Động từ thường gặp: [nguyên mẫu, tân ngữ, nghĩa, hình]. */
export const VERBS: [string, string, string, string][] = [
  ['read', 'a book', 'đọc sách', '📖'], ['write', 'a letter', 'viết thư', '✉️'], ['draw', 'a picture', 'vẽ tranh', '🖍️'],
  ['sing', 'a song', 'hát một bài hát', '🎤'], ['watch', 'TV', 'xem ti vi', '📺'], ['eat', 'an apple', 'ăn táo', '🍎'],
  ['drink', 'some milk', 'uống sữa', '🥛'], ['ride', 'a bike', 'đi xe đạp', '🚲'], ['fly', 'a kite', 'thả diều', '🪁'],
  ['play', 'football', 'chơi bóng đá', '⚽'], ['cook', 'dinner', 'nấu bữa tối', '🍳'], ['wash', 'the dishes', 'rửa bát', '🍽️'],
  ['listen', 'to music', 'nghe nhạc', '🎧'], ['swim', '', 'bơi', '🏊'], ['dance', '', 'nhảy múa', '💃'],
  ['run', '', 'chạy', '🏃'], ['sleep', '', 'ngủ', '😴'],
];

function mk(before: string, answer: string, after: string, wrong: string[], rule: string, extra: Partial<GapItem> = {}): GapItem {
  const join = (x: string) => [before, x, after].filter(Boolean).join(' ').replace(/ ([.,!?])/g, '$1');
  return { gap: join('___'), full: join(answer), answer, wrong, rule, ...extra };
}

const name = (R: Rng) => R.pick(NAMES);
const fillName = (s: string, R: Rng) => s.replace('{N}', name(R).name);
const realWord = (s: string) => COMMON.has(s) || isBankWord(s);
const simpleNoun = (w: Word) => isCountable(w) && /^[a-z]+$/.test(w.w);

const BE: [string, string, string][] = [
  ['I', 'am', 'eight years old.'], ['She', 'is', 'my friend.'], ['{N}', 'is', 'in the garden.'],
  ['They', 'are', 'my friends.'], ['We', 'are', 'in class 3A.'], ['You', 'are', 'very kind.'], ['He', 'is', 'my brother.'],
  ['It', 'is', 'a big cat.'], ['I', 'am', 'happy today.'], ['My parents', 'are', 'at home.'],
];
const PRONOUNS: [string, string, string, string][] = [
  ['This is my mother.', 'She', 'is kind.', '👩'], ['This is my father.', 'He', 'is tall.', '👨'],
  ['This is my grandmother.', 'She', 'is seventy years old.', '👵'], ['This is my grandfather.', 'He', 'is very kind.', '👴'],
  ['This is my sister.', 'She', 'is nine years old.', '👧'], ['This is my brother.', 'He', 'is a pupil.', '👦'],
  ['These are my parents.', 'They', 'are teachers.', '👫'], ['These are my grandparents.', 'They', 'are at home.', '👵👴'],
  ['This is my uncle.', 'He', 'is a doctor.', '👨‍⚕️'], ['This is my aunt.', 'She', 'is a nurse.', '👩‍⚕️'],
];
const HAVE: [string, string][] = [
  ['I', 'have'], ['You', 'have'], ['We', 'have'], ['They', 'have'], ['He', 'has'], ['She', 'has'], ['{N}', 'has'],
  ['My brother', 'has'], ['My sister', 'has'],
];
const ING_SUBJ = ["I'm", "She's", "He's", "We're", "They're", '{N} is'];
const ROUTINES: [string, string][] = [
  ['get', "up at six o'clock"], ['go', "to school at seven o'clock"], ['do', '{pos} homework after dinner'],
  ['watch', 'TV in the evening'], ['have', 'breakfast at half past six'], ['brush', '{pos} teeth every morning'],
  ['go', "to bed at nine o'clock"], ['play', 'football after school'], ['help', '{pos} mother at home'],
  ['walk', 'to school every day'],
];
const THIRD: [string, string][] = [['She', 'her'], ['He', 'his'], ['My brother', 'his'], ['My sister', 'her']];
const NOT_THIRD: [string, string][] = [['I', 'my'], ['They', 'their'], ['We', 'our'], ['You', 'your']];
const CAN_SUBJ = ['She', 'He', 'I', 'They', '{N}', 'My brother', 'My sister'];
const DO_SUBJ: [string, string][] = [
  ['you', 'Do'], ['they', 'Do'], ['we', 'Do'], ['she', 'Does'], ['he', 'Does'], ['{N}', 'Does'], ['your brother', 'Does'],
];
const DO_OBJ = ['like Maths?', 'like English?', 'like Science?', 'like Music?', 'like Art?', 'play football?', 'like cats?', 'have a bike?'];
const PAST: [string, string, string, string][] = [
  ['Yesterday, I', 'go', 'went', 'to the zoo.'], ['Last summer, we', 'visit', 'visited', 'our grandparents.'],
  ['Last Sunday, she', 'watch', 'watched', 'a film.'], ['Yesterday, {N}', 'play', 'played', 'football.'],
  ['Last week, they', 'swim', 'swam', 'in the sea.'], ['Yesterday, my mother', 'cook', 'cooked', 'a big dinner.'],
  ['Last weekend, we', 'have', 'had', 'a picnic.'], ['Yesterday, he', 'eat', 'ate', 'some noodles.'],
  ['Last Saturday, I', 'buy', 'bought', 'a new kite.'], ['Yesterday, they', 'see', 'saw', 'an elephant.'],
];
const SHOULD: [string, string, string][] = [
  ['drink', 'more water', '💧'], ['wash', 'your hands', '🧼'], ['go', 'to bed early', '🛏️'],
  ['eat', 'more vegetables', '🥦'], ['do', 'exercise every day', '🏃'], ['brush', 'your teeth twice a day', '😁'],
  ['see', 'a doctor', '👨‍⚕️'], ['take', 'a rest', '😴'],
];

function others(all: string[], answer: string): string[] {
  return all.filter((x) => x !== answer);
}

/** Từ có hai dạng số nhiều đều đúng (scarves/scarfs, mangoes/mangos) – không dùng để hỏi số nhiều. */
const TWO_PLURALS = new Set(['scarf', 'mango', 'buffalo', 'zero', 'hoof', 'volcano', 'mosquito']);

/** Ví dụ minh họa quy tắc – không bao giờ là chính từ đang hỏi, để gợi ý không đọc luôn đáp án. */
function examples(word: string, pairs: [string, string][], n: number, join = ', '): string {
  return pairs.filter(([a]) => a !== word).slice(0, n).map(([a, b]) => `${a} → ${b}`).join(join);
}

export const GRAMMAR: Grammar[] = [
  {
    id: 'be', gate: [3, 1],
    make(R) {
      const [s, v, rest] = R.pick(BE);
      return mk(fillName(s, R), v, rest, others(['am', 'is', 'are'], v),
        '«am» đi với «I»; «is» đi với «he», «she», «it» hoặc một người; «are» đi với «you», «we», «they» hoặc nhiều người.');
    },
  },
  {
    id: 'aan', gate: [3, 2],
    make(R, pool) {
      const ok = pool.filter((w) => simpleNoun(w) && !hasTag(w, 'people', 'family', 'job') && /^[aeiou]/.test(w.w) === (article(w.w) === 'an'));
      const vow = ok.filter((w) => /^[aeiou]/.test(w.w));
      const src = vow.length && R.chance(0.5) ? vow : ok;
      if (!src.length) return null;
      const w = R.pick(src);
      const a = article(w.w);
      const an = ['apple', 'egg', 'orange'].find((x) => x !== w.w);
      const one = ['book', 'pen', 'cat'].find((x) => x !== w.w);
      return mk("It's", a, `${w.w}.`, [a === 'a' ? 'an' : 'a'],
        `Dùng «an» trước từ bắt đầu bằng nguyên âm a, e, i, o, u (an ${an}); các từ khác dùng «a» (a ${one}).`,
        { emoji: w.e, caption: w.vi });
    },
  },
  {
    id: 'this', gate: [3, 8],
    make(R, pool) {
      const src = pool.filter((w) => simpleNoun(w) && hasTag(w, 'toy', 'school', 'fruit', 'animal'));
      if (!src.length) return null;
      const w = R.pick(src);
      const n = R.chance(0.5) ? 1 : R.int(2, 4);
      const one = n === 1;
      return mk('', one ? 'This is' : 'These are', `my ${one ? w.w : plural(w)}.`, [one ? 'These are' : 'This is'],
        'Một đồ vật dùng «This is»; nhiều đồ vật dùng «These are».', { objects: { emoji: w.e, groups: [n] } });
    },
  },
  {
    id: 'plural', gate: [3, 8],
    make(R, pool) {
      const src = pool.filter(
        (w) => simpleNoun(w) && !w.w.endsWith('s') && !TWO_PLURALS.has(w.w) && hasTag(w, 'toy', 'school', 'fruit', 'animal', 'food', 'clothes', 'home'),
      );
      for (let tries = 0; tries < 6 && src.length; tries++) {
        const w = R.pick(src);
        const pl = plural(w);
        // Từ tận cùng bằng «o» phải nhớ riêng: potato → potatoes nhưng hippo → hippos.
        const endsO = w.w.endsWith('o');
        let bad: string;
        let rule: string;
        if (pl === w.w + 's') {
          bad = w.w + 'es';
          rule = endsO
            ? `Nhiều từ tận cùng bằng «o» chỉ thêm «s» (${examples(w.w, [['hippo', 'hippos'], ['kangaroo', 'kangaroos']], 1)}); chỉ vài từ như potato → potatoes mới thêm «es».`
            : `Nhiều đồ vật thì thêm «s» vào cuối từ (${examples(w.w, [['book', 'books'], ['pen', 'pens']], 1)}).`;
        } else if (pl === w.w + 'es') {
          bad = w.w + 's';
          rule = endsO
            ? `Vài từ tận cùng bằng «o» phải thêm «es» (${examples(w.w, [['potato', 'potatoes'], ['tomato', 'tomatoes']], 1)}), nhưng hippo → hippos chỉ thêm «s».`
            : `Từ tận cùng bằng s, x, ch, sh thì thêm «es» (${examples(w.w, [['box', 'boxes'], ['bus', 'buses']], 1)}).`;
        } else if (/[^aeiou]y$/.test(w.w) && pl === w.w.slice(0, -1) + 'ies') {
          bad = w.w + 's';
          rule = `Từ tận cùng bằng phụ âm + y thì đổi y thành «ies» (${examples(w.w, [['baby', 'babies'], ['city', 'cities']], 1)}).`;
        } else if (/(f|fe)$/.test(w.w) && pl.endsWith('ves')) {
          bad = w.w + 's';
          rule = `Từ tận cùng bằng «f» hoặc «fe» thường đổi thành «ves» (${examples(w.w, [['leaf', 'leaves'], ['knife', 'knives']], 1)}).`;
        } else {
          bad = w.w + (/(x|ch|sh)$/.test(w.w) ? 'es' : 's');
          rule = `«${w.w}» có dạng số nhiều đặc biệt, không chỉ thêm «s» (giống ${examples(w.w, [['man', 'men'], ['foot', 'feet']], 2)}).`;
        }
        if (bad === pl || pl === w.w || realWord(bad)) continue;
        const n = R.int(2, 5);
        return mk(`I have ${numberWord(n)}`, pl, '.', [w.w, bad], rule, { objects: { emoji: w.e, groups: [n] } });
      }
      return null;
    },
  },
  {
    id: 'pronoun', gate: [3, 11],
    make(R) {
      const [first, p, rest, e] = R.pick(PRONOUNS);
      return mk(first, p, rest, others(['He', 'She', 'They'], p),
        '«He» thay cho một người nam; «She» thay cho một người nữ; «They» thay cho nhiều người.', { emoji: e });
    },
  },
  {
    id: 'have', gate: [3, 11],
    make(R, pool) {
      const src = pool.filter((w) => isCountable(w) && (hasTag(w, 'toy', 'school') || PETS.has(w.w)));
      if (!src.length) return null;
      const w = R.pick(src);
      const [s, v] = R.pick(HAVE);
      return mk(fillName(s, R), v, `${withArticle(w.w)}.`, [v === 'has' ? 'have' : 'has'],
        '«has» đi với «he», «she» hoặc một người; «have» đi với «I», «you», «we», «they».', { emoji: w.e, caption: w.vi });
    },
  },
  {
    id: 'ing', gate: [3, 18],
    make(R) {
      const [v, obj, , e] = R.pick(VERBS);
      const iv = ing(v);
      const how =
        iv === v.slice(0, -1) + 'ing' && v.endsWith('e')
          ? `; từ tận cùng bằng «e» thì bỏ «e» (${examples(v, [['ride', 'riding'], ['dance', 'dancing'], ['write', 'writing']], 1)})`
          : iv === v + v.slice(-1) + 'ing'
            ? `; từ ngắn tận cùng bằng một nguyên âm và một phụ âm thì gấp đôi chữ cuối (${examples(v, [['swim', 'swimming'], ['run', 'running'], ['sit', 'sitting']], 1)})`
            : ` (${examples(v, [['read', 'reading'], ['play', 'playing'], ['sing', 'singing']], 1)})`;
      return mk(fillName(R.pick(ING_SUBJ), R), iv, `${obj}.`.trim(), [v, thirdPerson(v)],
        `Đang làm gì (am / is / are + …) thì động từ thêm «-ing»${how}.`, { emoji: e });
    },
  },
  {
    id: 'third', gate: [4, 2],
    make(R) {
      const [v, rest] = R.pick(ROUTINES);
      const third = R.chance(0.7);
      let [s, pos] = R.pick(third ? THIRD : NOT_THIRD);
      if (third && R.chance(0.3)) {
        const p = name(R);
        s = p.name;
        pos = p.sex === 'm' ? 'his' : 'her';
      }
      const ans = third ? thirdPerson(v) : v;
      const wrong = third ? [v, ing(v)] : [thirdPerson(v), ing(v)];
      const ex = examples(v, [['play', 'plays'], ['watch', 'watches'], ['have', 'has'], ['go', 'goes']], 3);
      return mk(s, ans, `${rest.replace('{pos}', pos)}.`, wrong,
        `Với «he», «she» hoặc một người, động từ thêm «s» hay «es» (${ex}); với «I», «you», «we», «they» thì giữ nguyên.`);
    },
  },
  {
    id: 'prep', gate: [4, 4],
    make(R) {
      const all = ['at', 'on', 'in'];
      const day = R.pick(DAYS);
      const month = R.pick(MONTHS);
      const items: [string, string, string][] = [
        ['I get up', 'at', `${timeWords(R.int(5, 7), 0)}.`],
        ['We have lunch', 'at', `${timeWords(11, 30)}.`],
        ['I play football', 'on', `${day}.`],
        ['We have English', 'on', `${day}.`],
        ['My birthday is', 'in', `${month}.`],
        R.chance(0.5) ? ["It's hot", 'in', 'summer.'] : ["It's cold", 'in', 'winter.'],
      ];
      const [b, a, rest] = R.pick(items);
      return mk(b, a, rest, others(all, a), '«at» đi với giờ; «on» đi với thứ trong tuần; «in» đi với tháng hoặc mùa.');
    },
  },
  {
    id: 'can', gate: [4, 5],
    make(R) {
      const [v, obj, , e] = R.chance(0.2) ? (['play', 'the piano', 'chơi đàn piano', '🎹'] as const) : R.pick(VERBS);
      const ex = ['swim', 'dance', 'sing'].filter((x) => x !== v).slice(0, 2).map((x) => `can ${x}`).join(', ');
      return mk(`${fillName(R.pick(CAN_SUBJ), R)} can`, v, `${obj}.`.trim(), [thirdPerson(v), ing(v)],
        `Sau «can» dùng động từ nguyên mẫu, không thêm «s» hay «-ing» (${ex}).`, { emoji: e });
    },
  },
  {
    id: 'do', gate: [4, 8],
    make(R) {
      const [s, d] = R.pick(DO_SUBJ);
      return mk('', d, `${fillName(s, R)} ${R.pick(DO_OBJ)}`, [d === 'Do' ? 'Does' : 'Do'],
        'Câu hỏi với «he», «she» hoặc một người dùng «Does»; với «you», «we», «they» dùng «Do».');
    },
  },
  {
    id: 'past', gate: [4, 10],
    make(R) {
      const [b, v, p, rest] = R.pick(PAST);
      const rule = p.endsWith('ed')
        ? `Chuyện đã qua (yesterday, last …) dùng động từ quá khứ, thường thêm «-ed» (${examples(v, [['play', 'played'], ['watch', 'watched']], 1)}).`
        : `Chuyện đã qua (yesterday, last …) dùng động từ quá khứ. «${v}» là động từ đặc biệt, không thêm «-ed» (giống ${examples(v, [['go', 'went'], ['see', 'saw'], ['eat', 'ate']], 2)}).`;
      return mk(fillName(b, R), p, rest, [v, ing(v)], rule);
    },
  },
  {
    id: 'should', gate: [5, 14],
    make(R) {
      const [v, rest, e] = R.pick(SHOULD);
      const ex = ['drink', 'go', 'eat'].filter((x) => x !== v).slice(0, 2).map((x) => `should ${x}`).join(', ');
      return mk('You should', v, `${rest}.`, [thirdPerson(v), ing(v)],
        `Sau «should» dùng động từ nguyên mẫu, không thêm «s» hay «-ing» (${ex}).`, { emoji: e });
    },
  },
];
