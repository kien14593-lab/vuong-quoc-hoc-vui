/**
 * Khung câu ngắn để luyện từ trong câu (điền từ, nghe câu).
 * Mọi câu mẫu trong thư mục này do nhóm tự viết – không chép câu, hội thoại hay bài tập của sách.
 */
import type { Word } from './bank';
import { ing, pluralOf, withArticle } from './words';

export interface Person {
  name: string;
  sex: 'm' | 'f';
}

export const NAMES: Person[] = [
  { name: 'Nam', sex: 'm' }, { name: 'Lan', sex: 'f' }, { name: 'Hoa', sex: 'f' }, { name: 'Phong', sex: 'm' },
  { name: 'Huy', sex: 'm' }, { name: 'Vy', sex: 'f' }, { name: 'Minh', sex: 'm' }, { name: 'Mai', sex: 'f' },
  { name: 'Tom', sex: 'm' }, { name: 'Anna', sex: 'f' }, { name: 'Jack', sex: 'm' }, { name: 'Emma', sex: 'f' },
  { name: 'Sam', sex: 'm' }, { name: 'Kate', sex: 'f' },
];

/** Tính từ tả người (dùng trong "My friend is …"). */
export const PERSON_ADJ = [
  'friendly', 'kind', 'clever', 'funny', 'shy', 'active', 'hard-working', 'brave', 'tall', 'short', 'thin', 'strong',
  'young', 'old',
];

/** Tính từ tả ngoại hình (câu "What does he look like?"). */
export const LOOK_ADJ = ['tall', 'short', 'big', 'small', 'thin', 'strong', 'young', 'old'];

/** Câu gợi ý theo nhãn chủ đề: "«cat» là một con vật". */
export const TAG_VI: Record<string, string> = {
  toy: 'là một món đồ chơi', school: 'là thứ ở trường học', transport: 'là một phương tiện đi lại',
  animal: 'là một con vật', people: 'là một người', fruit: 'là một loại quả', food: 'là một món ăn',
  veg: 'là một loại rau củ', drink: 'là một đồ uống', kitchen: 'là một đồ dùng trong bếp',
  nature: 'là một thứ trong thiên nhiên', home: 'là một thứ trong nhà', music: 'liên quan đến âm nhạc',
  clothes: 'là một món đồ mặc', family: 'là một người trong gia đình', job: 'là một nghề nghiệp',
  weather: 'nói về thời tiết', body: 'là một bộ phận cơ thể', place: 'là một địa điểm', shape: 'là một hình',
  word: 'là một từ thông dụng', action: 'là một hoạt động', number: 'là một con số', sport: 'là một môn thể thao',
  festival: 'liên quan đến ngày lễ', adj: 'là một từ chỉ đặc điểm', colour: 'là một màu sắc',
  feeling: 'là một cảm xúc', subject: 'là một môn học', greeting: 'là một lời chào', hobby: 'là một sở thích',
  room: 'là một căn phòng', country: 'nói về một đất nước', time: 'nói về thời gian',
  day: 'là một ngày trong tuần', month: 'là một tháng trong năm', game: 'là một trò chơi',
  season: 'là một mùa trong năm', health: 'liên quan đến sức khỏe', illness: 'là một cơn ốm hay chỗ đau',
};

export function hasTag(w: Word, ...tags: string[]): boolean {
  return tags.some((t) => w.tags.includes(t));
}

/** "swimming", "playing chess" – từ đầu kết thúc bằng -ing và phần gốc là một động từ thật. */
export function isGerund(s: string): boolean {
  const first = s.split(' ')[0].toLowerCase();
  if (!first.endsWith('ing')) return false;
  const stem = first.slice(0, -3);
  return stem.length >= 2 && /[aeiouy]/.test(stem);
}

/** Dạng V-ing của một hoạt động ("swim" → "swimming"; giữ nguyên nếu đã là V-ing). */
export function gerundOf(w: Word): string {
  return isGerund(w.w) ? w.w : ing(w.w);
}

/** Món thường gọi theo nhiều cái ("some nuts", không nói "a nut"). */
const SOME_PL = new Set(['nut', 'grape', 'bean', 'pea', 'chip', 'sweet', 'noodle', 'strawberry', 'cherry', 'peanut']);

/** "an apple", "some milk", "some grapes", "some nuts". */
export function aForm(w: Word): string {
  if (SOME_PL.has(w.w)) return `some ${plural(w)}`;
  return w.pw || w.nc ? `some ${w.w}` : withArticle(w.w);
}

/** Dạng số nhiều. */
export function plural(w: Word): string {
  return w.pw ? w.w : w.pl ?? pluralOf(w.w);
}

export function he(p: { sex: 'm' | 'f' }): string {
  return p.sex === 'm' ? "He's" : "She's";
}

/** Câu có một chỗ trống: câu đầy đủ = `${before} ${fill}${after}`. */
export interface Frame {
  key: string;
  before: string;
  fill: string;
  after: string;
}

export function frameText(f: Frame): string {
  return `${f.before} ${f.fill}${f.after}`;
}

export function frameGap(f: Frame): string {
  return `${f.before} ___${f.after}`;
}

const DENY = new Set([
  'brush teeth', 'went', 'visited', 'birthday', 'party', 'win', 'smile', 'colour', 'number', 'weather', 'favourite',
  'foreign', 'hobby', 'like', 'live', 'visit', 'open', 'close', 'touch', 'plus', 'minus', 'subject', 'animal', 'pet',
  'family', 'baby', 'new clothes', 'floor', 'friend', 'friends', 'best friend', 'classmate', 'sports day', 'tet',
  'christmas', "children's day", "teachers' day", 'mid-autumn festival', 'lunch', 'question', 'paper', 'lesson',
  'board', 'flat', 'on foot', 'wall',
]);
const NO_FRAME_TAGS = ['word', 'greeting', 'time', 'day', 'month', 'country'];
const MUSIC_NOUNS = new Set(['drum', 'drums', 'guitar', 'trumpet', 'violin', 'piano', 'flute', 'xylophone']);
const TRANSPORT_DENY = new Set(['plane', 'ship', 'rocket', 'helicopter', 'tractor', 'van', 'on foot', 'lorry', 'truck']);
const PASSABLE = new Set([
  'spoon', 'fork', 'knife', 'plate', 'bowl', 'cup', 'glass', 'chopsticks', 'bottle', 'jar', 'pan', 'pot', 'mug',
  'napkin', 'tray', 'teapot', 'salt', 'pepper', 'kettle', 'lid',
]);
const PLACE_DENY = new Set(['house', 'flat', 'school', 'road', 'street', 'building', 'school trip', 'home']);
const WEATHER_ADJ = new Set(['hot', 'cold', 'warm', 'cool', 'wet', 'dry']);

/** Con vật nuôi trong nhà ("I have a cat" hợp lí, "I have a lion" thì không). */
export const PETS = new Set(['cat', 'dog', 'rabbit', 'fish', 'bird', 'parrot', 'hamster', 'goldfish', 'mouse', 'turtle', 'tortoise', 'puppy', 'kitten']);

/** Phương tiện đi được "by …" ("I go to school by bus"). */
export const BY_TRANSPORT = new Set(['bus', 'car', 'taxi', 'motorbike', 'bike', 'train', 'underground', 'boat', 'coach']);

export function isWeatherAdj(w: Word): boolean {
  return hasTag(w, 'weather') && !w.w.includes(' ') && (WEATHER_ADJ.has(w.w) || /[^aeiou]y$/.test(w.w));
}

export function isPlaceWord(w: Word): boolean {
  return hasTag(w, 'place') && !PLACE_DENY.has(w.w.toLowerCase()) && !/[A-Z]/.test(w.w);
}

const NOUN_TAGS = [
  'toy', 'school', 'transport', 'animal', 'people', 'fruit', 'food', 'veg', 'drink', 'kitchen', 'nature', 'home',
  'music', 'clothes', 'family', 'job', 'body', 'place', 'room', 'shape',
];
/** Nhãn của động từ, tính từ, màu, thời tiết… – không bao giờ là danh từ đếm được. */
const NOT_NOUN_TAGS = [
  'action', 'hobby', 'adj', 'colour', 'feeling', 'greeting', 'number', 'season', 'weather', 'illness', 'time', 'day',
  'month', 'subject', 'country',
];

/** Danh từ đếm được, số ít, có hình rõ (đồ vật, con vật, người, nơi chốn…). */
export function isCountable(w: Word): boolean {
  return w.pic && !w.pw && !w.nc && /^[a-z][a-z -]*$/.test(w.w) && hasTag(w, ...NOUN_TAGS) && !hasTag(w, ...NOT_NOUN_TAGS);
}

function pick1P(w: Word, key: string, one: string, many: string, after: string): Frame {
  return w.pw ? { key: key + 'P', before: many, fill: w.w, after } : { key: key + '1', before: one, fill: w.w, after };
}

/**
 * Khung câu phù hợp cho từ `w` (hoặc null). Mọi từ cùng `key` điền vào cùng một khung đều đúng ngữ pháp,
 * nên phương án nhiễu phải có cùng `key`.
 */
export function frameFor(w: Word, she = false): Frame | null {
  const lw = w.w.toLowerCase();
  if (DENY.has(lw) || hasTag(w, ...NO_FRAME_TAGS)) return null;
  if (hasTag(w, 'hobby')) {
    if (!isGerund(w.w) && !hasTag(w, 'action')) return null;
    return { key: 'hobby', before: 'I like', fill: gerundOf(w), after: '.' };
  }
  if (hasTag(w, 'action')) {
    if (isGerund(w.w)) return { key: 'ing', before: "Look! I'm", fill: w.w, after: '.' };
    if (hasTag(w, 'health')) return { key: 'should', before: 'You should', fill: w.w, after: '.' };
    return { key: 'lets', before: "Let's", fill: w.w, after: '!' };
  }
  if (hasTag(w, 'sport') && isGerund(w.w)) return { key: 'hobby', before: 'I like', fill: w.w, after: '.' };
  if (hasTag(w, 'game')) return { key: 'play', before: "Let's play", fill: w.w, after: '!' };
  if (MUSIC_NOUNS.has(lw)) return { key: 'music', before: 'I can play the', fill: w.w, after: '.' };
  if (hasTag(w, 'animal')) return { key: 'see', before: 'I can see', fill: aForm(w), after: '.' };
  if (hasTag(w, 'food', 'fruit', 'veg', 'drink')) return { key: 'food', before: "I'd like", fill: aForm(w), after: ', please.' };
  if (hasTag(w, 'transport') && !TRANSPORT_DENY.has(lw)) {
    if (BY_TRANSPORT.has(lw)) return { key: 'by', before: 'I go to school by', fill: w.w, after: '.' };
    return { key: 'look', before: 'Look at the', fill: w.w, after: '!' };
  }
  if (hasTag(w, 'toy', 'school') && !hasTag(w, 'place', 'room', 'people', 'job') && !w.nc) {
    return pick1P(w, 'my', 'This is my', 'These are my', '.');
  }
  if (hasTag(w, 'job')) {
    const s = w.sex ? w.sex === 'f' : she;
    return { key: 'job', before: s ? "She's" : "He's", fill: withArticle(w.w), after: '.' };
  }
  if (isWeatherAdj(w)) return { key: 'weather', before: "It's", fill: w.w, after: ' today.' };
  if (hasTag(w, 'colour')) return { key: 'colour', before: 'My favourite colour is', fill: w.w, after: '.' };
  if (hasTag(w, 'body')) return { key: 'body', before: 'Touch your', fill: w.w, after: '.' };
  if (hasTag(w, 'room')) return { key: 'room', before: "I'm in the", fill: w.w, after: '.' };
  if (hasTag(w, 'clothes') && !w.nc) return pick1P(w, 'clothes', 'I like this', 'I like these', '.');
  if (hasTag(w, 'kitchen') && PASSABLE.has(lw)) return { key: 'kitchen', before: 'Pass me the', fill: w.w, after: ', please.' };
  if (hasTag(w, 'home', 'kitchen') && !w.nc) {
    return w.pw
      ? { key: 'homeP', before: 'Where are the', fill: w.w, after: '?' }
      : { key: 'home1', before: 'Where is the', fill: w.w, after: '?' };
  }
  if (isPlaceWord(w)) return { key: 'place', before: "Let's go to the", fill: w.w, after: '.' };
  if (hasTag(w, 'shape')) return { key: 'shape', before: 'Draw', fill: withArticle(w.w), after: '.' };
  if (hasTag(w, 'illness')) return { key: 'ill', before: 'I have', fill: w.nc ? w.w : withArticle(w.w), after: '.' };
  if (hasTag(w, 'feeling')) return { key: 'feeling', before: "I'm", fill: w.w, after: '.' };
  if (PERSON_ADJ.includes(lw)) return { key: 'person', before: 'My friend is', fill: w.w, after: '.' };
  if (hasTag(w, 'adj')) return { key: 'adj', before: "It's", fill: w.w, after: '.' };
  if (hasTag(w, 'season', 'subject')) return { key: 'like', before: 'I like', fill: w.w, after: '.' };
  if (hasTag(w, 'number')) return { key: 'number', before: 'Look at number', fill: w.w, after: '!' };
  if (hasTag(w, 'family')) return pick1P(w, 'fam', 'This is my', 'These are my', '.');
  if (hasTag(w, 'nature', 'people', 'festival', 'sport', 'health', 'transport', 'weather', 'home') && !w.nc) {
    return { key: 'look', before: 'Look at the', fill: w.w, after: '!' };
  }
  return null;
}
