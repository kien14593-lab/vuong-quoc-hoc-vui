import type { GenOptions, Question, WordTheme } from '../types';
import { COUNT_ITEMS, DIVIDE, MINUS, TIMES, choiceCount, fmt, gcd, makeQ, numChoices, rand, round, simplify, textChoices } from '../util';
import { addSteps, divSteps, mulSteps, subSteps } from './arith';

/* ------------------------------------------------------------------ */
/* PHÂN SỐ                                                              */
/* ------------------------------------------------------------------ */
const f = (n: number, d: number) => `${n}/${d}`;

/** Lọc các phân số nhiễu: không trùng giá trị với đáp án. */
function fracDistractors(ans: [number, number], cands: [number, number][]): string[] {
  const v = ans[0] / ans[1];
  const out: string[] = [];
  for (const [n, d] of cands) {
    if (n <= 0 || d <= 0) continue;
    if (Math.abs(n / d - v) < 1e-9) continue;
    out.push(f(n, d));
  }
  return out;
}

export function genFraction(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  if (level <= 2) {
    const d = level === 1 ? R.int(2, 4) : R.int(3, 8);
    const k = level === 1 ? 1 : R.int(1, d - 1);
    const shape = R.chance(0.5) ? 'pie' : 'bar';
    const cands: [number, number][] = level === 1 ? [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6]] : [[d - k, d], [k, d + 1], [k + 1, d], [d, k], [k, d - 1], [1, d + 1], [k, d + 2]];
    const c = textChoices(f(k, d), fracDistractors([k, d], cands), n);
    return makeQ({
      topic: 'fraction',
      level,
      prompt: 'Phần tô màu là mấy phần mấy của hình?',
      visual: { kind: 'fraction', n: k, d, shape },
      ...c,
      hint: 'Mẫu số là số phần bằng nhau của cả hình. Tử số là số phần được tô màu.',
      steps: [`Hình được chia thành ${d} phần bằng nhau → mẫu số là ${d}.`, `Có ${k} phần được tô màu → tử số là ${k}.`, `Phân số là ${f(k, d)}.`],
    });
  }
  if (level === 3) {
    const d = R.int(2, 6);
    const k = R.int(2, 9);
    const total = d * k;
    const item = R.pick(COUNT_ITEMS);
    const c = numChoices(k, [total - k, k + 1, k - 1, d, total / 2], n, { min: 1 });
    return makeQ({
      topic: 'fraction',
      level,
      context: `Có ${total} ${item.name}.`,
      prompt: `1/${d} số ${item.name} là bao nhiêu?`,
      visual: total <= 30 ? { kind: 'share', emoji: item.emoji, total, parts: d } : undefined,
      ...c,
      hint: `Chia đều ${total} thành ${d} phần bằng nhau, lấy 1 phần.`,
      steps: [`1/${d} của ${total} nghĩa là chia ${total} thành ${d} phần bằng nhau.`, `${total} ${DIVIDE} ${d} = ${k}.`, `Vậy 1/${d} số ${item.name} là ${k}.`],
    });
  }
  if (level === 4) {
    const sameDen = R.chance(0.6);
    const k = Math.min(n, 4);
    const fr: [number, number][] = [];
    if (sameDen) {
      const d = R.int(5, 12);
      const nums = R.sample(Array.from({ length: d - 1 }, (_, i) => i + 1), k);
      nums.forEach((x) => fr.push([x, d]));
    } else {
      const num = R.int(1, 5);
      const dens = R.sample(Array.from({ length: 8 }, (_, i) => num + 1 + i), k);
      dens.forEach((x) => fr.push([num, x]));
    }
    const wantMax = R.chance(0.65);
    const best = fr.reduce((a, b) => (wantMax ? (b[0] / b[1] > a[0] / a[1] ? b : a) : b[0] / b[1] < a[0] / a[1] ? b : a));
    return makeQ({
      topic: 'fraction',
      level,
      prompt: wantMax ? 'Phân số nào lớn nhất?' : 'Phân số nào bé nhất?',
      choices: fr.map(([a, b]) => ({ label: f(a, b), value: f(a, b) })),
      answer: f(best[0], best[1]),
      hint: sameDen ? 'Cùng mẫu số: phân số nào có tử số lớn hơn thì lớn hơn.' : 'Cùng tử số: phân số nào có mẫu số bé hơn thì lớn hơn.',
      steps: [sameDen ? 'Các phân số có cùng mẫu số.' : 'Các phân số có cùng tử số.', sameDen ? 'So sánh các tử số.' : 'Mẫu số càng bé thì mỗi phần càng to.', `Đáp án: ${f(best[0], best[1])}.`],
    });
  }
  if (level === 5) {
    let pick = { d: 7, a: 2, b: 3, plus: true, res: 5 };
    for (let guard = 0; guard < 80; guard++) {
      const d = R.int(5, 12);
      const plus = R.chance(0.55);
      let a = R.int(1, d - 2);
      let b = plus ? R.int(1, d - 1 - a) : R.int(1, a);
      if (!plus && a === b) continue;
      if (!plus && a < b) [a, b] = [b, a];
      const res = plus ? a + b : a - b;
      if (res > 0 && res < d && gcd(res, d) === 1) {
        pick = { d, a, b, plus, res };
        break;
      }
    }
    const { d, a, b, plus, res } = pick;
    const op = plus ? '+' : MINUS;
    const c = textChoices(f(res, d), fracDistractors([res, d], [[res, d * 2], [plus ? a + b : a - b + 1, d], [res + 1, d], [res, d + 1], [plus ? a + b : a + b, plus ? d + d : d]]), n);
    return makeQ({
      topic: 'fraction',
      level,
      prompt: `${f(a, d)} ${op} ${f(b, d)} = ?`,
      ...c,
      hint: `Cùng mẫu số: ${plus ? 'cộng' : 'trừ'} các tử số và giữ nguyên mẫu số.`,
      steps: [`Hai phân số có cùng mẫu số ${d}.`, `${plus ? 'Cộng' : 'Trừ'} tử số: ${a} ${op} ${b} = ${res}.`, `Giữ mẫu số: ${f(res, d)}.`],
    });
  }
  const pairs: [number, number][] = [
    [2, 4],
    [2, 6],
    [3, 6],
    [2, 8],
    [4, 8],
    [3, 9],
    [5, 10],
    [2, 10],
    [4, 12],
    [3, 12],
  ];
  let pick = { a1: 1, d1: 2, a2: 1, d2: 4, rn: 3, rd: 4 };
  for (let guard = 0; guard < 80; guard++) {
    const [D1, D2] = R.pick(pairs);
    const A1 = R.int(1, D1 - 1);
    const A2 = R.int(1, D2 - 1);
    if (gcd(A1, D1) !== 1 || gcd(A2, D2) !== 1) continue;
    const num = A1 * (D2 / D1) + A2;
    if (num >= D2) continue;
    const [RN, RD] = simplify(num, D2);
    pick = { a1: A1, d1: D1, a2: A2, d2: D2, rn: RN, rd: RD };
    break;
  }
  const { a1, d1, a2, d2, rn, rd } = pick;
  const k = d2 / d1;
  const c = textChoices(f(rn, rd), fracDistractors([rn, rd], [[a1 + a2, d1 + d2], [a1 + a2, d2], [rn + 1, rd], [rn, rd + 1], [a1 * k + a2 + 1, d2]]), n);
  return makeQ({
    topic: 'fraction',
    level,
    prompt: `${f(a1, d1)} + ${f(a2, d2)} = ?`,
    ...c,
    hint: `Quy đồng mẫu số: đổi ${f(a1, d1)} thành phân số có mẫu số ${d2}.`,
    steps: [
      `${f(a1, d1)} = ${f(a1 * k, d2)} (nhân cả tử và mẫu với ${k}).`,
      `${f(a1 * k, d2)} + ${f(a2, d2)} = ${f(a1 * k + a2, d2)}.`,
      rn !== a1 * k + a2 ? `Rút gọn: ${f(a1 * k + a2, d2)} = ${f(rn, rd)}.` : `Phân số đã tối giản.`,
    ],
  });
}

/* ------------------------------------------------------------------ */
/* SỐ THẬP PHÂN                                                         */
/* ------------------------------------------------------------------ */
export function genDecimal(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  if (level === 1) {
    if (R.chance(0.5)) {
      const t = R.int(1, 9);
      const ans = t / 10;
      const c = textChoices(fmt(ans), [fmt(t / 100), fmt(t), `${t},10`, fmt(round(ans + 0.1))].filter((x) => x !== fmt(ans)), n);
      return makeQ({
        topic: 'decimal',
        level,
        prompt: `${t}/10 viết dưới dạng số thập phân là?`,
        visual: { kind: 'grid100', tenths: t, hundredths: 0 },
        ...c,
        hint: 'Phần mười: viết chữ số ngay sau dấu phẩy.',
        steps: [`${t}/10 là ${t} phần mười.`, `Phần mười đứng ngay sau dấu phẩy.`, `${t}/10 = ${fmt(ans)}.`],
      });
    }
    const h = R.int(11, 99);
    const ans = h / 100;
    const c = textChoices(fmt(ans), [fmt(h / 10), fmt(h / 1000), fmt(round(ans + 0.1)), fmt(round(ans + 0.01))].filter((x) => x !== fmt(ans)), n);
    return makeQ({
      topic: 'decimal',
      level,
      prompt: `${h}/100 viết dưới dạng số thập phân là?`,
      visual: { kind: 'grid100', tenths: Math.floor(h / 10), hundredths: h % 10 },
      ...c,
      hint: 'Phần trăm: có 2 chữ số sau dấu phẩy.',
      steps: [`${h}/100 là ${h} phần trăm.`, `Viết 2 chữ số sau dấu phẩy.`, `${h}/100 = ${fmt(ans)}.`],
    });
  }
  if (level === 2) {
    const base = R.int(1, 9);
    const k = Math.min(4, n);
    const set = new Set<number>();
    const ds = [R.int(1, 9), R.int(1, 9)];
    const cands = [base + ds[0] / 10, base + ds[1] / 100 + ds[0] / 10, base + ds[0] / 100, base + ds[1] / 10 + ds[0] / 100, base + (ds[0] + 1) / 10, base + 1 + ds[1] / 100];
    for (const v of R.shuffle(cands)) {
      if (set.size >= k) break;
      set.add(round(v));
    }
    while (set.size < k) set.add(round(base + R.int(1, 99) / 100));
    const vals = [...set];
    const wantMax = R.chance(0.6);
    const target = wantMax ? Math.max(...vals) : Math.min(...vals);
    return makeQ({
      topic: 'decimal',
      level,
      prompt: wantMax ? 'Số nào lớn nhất?' : 'Số nào bé nhất?',
      choices: vals.map((v) => ({ label: fmt(v), value: fmt(v) })),
      answer: fmt(target),
      hint: 'So sánh phần nguyên trước, rồi đến hàng phần mười, hàng phần trăm.',
      steps: ['So sánh phần nguyên (trước dấu phẩy).', 'Nếu bằng nhau, so sánh từng chữ số sau dấu phẩy từ trái sang phải.', `Đáp án: ${fmt(target)}.`],
    });
  }
  if (level === 3 || level === 4) {
    const plus = level === 3 ? R.chance(0.7) : R.chance(0.3);
    const scale = level === 3 ? 10 : R.pick([10, 100]);
    let a = R.int(11, 99) / (scale === 10 ? 10 : 100) + (scale === 100 ? R.int(1, 9) : 0);
    let b = R.int(11, 99) / (scale === 10 ? 10 : 100);
    a = round(a);
    b = round(b);
    if (!plus && b > a) [a, b] = [b, a];
    if (!plus && a === b) a = round(a + 1);
    const ans = round(plus ? a + b : a - b);
    const step = scale === 10 ? 0.1 : 0.01;
    const c = numChoices(ans, [round(ans + 1), round(ans - 1), round(ans + step * 10), round(ans - step), round(ans + step)], n, { integer: false, step });
    const op = plus ? '+' : MINUS;
    return makeQ({
      topic: 'decimal',
      level,
      prompt: `${fmt(a)} ${op} ${fmt(b)} = ?`,
      ...c,
      hint: 'Đặt tính sao cho các dấu phẩy thẳng cột với nhau.',
      steps: [`Viết các dấu phẩy thẳng cột.`, `${plus ? 'Cộng' : 'Trừ'} như số tự nhiên.`, `Đặt dấu phẩy thẳng cột: ${fmt(a)} ${op} ${fmt(b)} = ${fmt(ans)}.`],
    });
  }
  if (level === 5) {
    const mul = R.chance(0.6);
    const k = R.pick([10, 100, 1000]);
    const a = round(R.int(101, 9999) / 100);
    const ans = round(mul ? a * k : a / k, 6);
    const shift = String(k).length - 1;
    const c = numChoices(ans, [round(mul ? a / k : a * k), round(mul ? a * k * 10 : a / (k * 10)), round(mul ? a * (k / 10) : a / (k / 10))], n, { integer: false, step: ans / 10 || 0.1 });
    return makeQ({
      topic: 'decimal',
      level,
      prompt: `${fmt(a)} ${mul ? TIMES : DIVIDE} ${fmt(k)} = ?`,
      ...c,
      hint: mul ? `Nhân với ${k}: dời dấu phẩy sang phải ${shift} chữ số.` : `Chia cho ${k}: dời dấu phẩy sang trái ${shift} chữ số.`,
      steps: [`${fmt(k)} có ${shift} chữ số 0.`, `Dời dấu phẩy sang ${mul ? 'phải' : 'trái'} ${shift} chữ số.`, `${fmt(a)} ${mul ? TIMES : DIVIDE} ${fmt(k)} = ${fmt(ans)}.`],
    });
  }
  const a = round(R.int(11, 99) / 10);
  const k = R.int(2, 9);
  const ans = round(a * k);
  const c = numChoices(ans, [round(a * k * 10), round(a + k), round(ans + a), round(ans - a)], n, { integer: false, step: 0.1 });
  return makeQ({
    topic: 'decimal',
    level,
    prompt: `${fmt(a)} ${TIMES} ${k} = ?`,
    ...c,
    hint: 'Nhân như số tự nhiên rồi đặt dấu phẩy: tích có bao nhiêu chữ số phần thập phân như thừa số.',
    steps: [`Bỏ dấu phẩy: ${Math.round(a * 10)} ${TIMES} ${k} = ${Math.round(a * 10) * k}.`, `${fmt(a)} có 1 chữ số sau dấu phẩy, nên tích cũng có 1 chữ số sau dấu phẩy.`, `${fmt(a)} ${TIMES} ${k} = ${fmt(ans)}.`],
  });
}

/* ------------------------------------------------------------------ */
/* TỈ SỐ – PHẦN TRĂM                                                    */
/* ------------------------------------------------------------------ */
const RATIO_PAIRS = [
  { a: { emoji: '🍎', name: 'táo' }, b: { emoji: '🍊', name: 'cam' } },
  { a: { emoji: '🐔', name: 'gà' }, b: { emoji: '🦆', name: 'vịt' } },
  { a: { emoji: '🔵', name: 'bi xanh' }, b: { emoji: '🔴', name: 'bi đỏ' } },
  { a: { emoji: '🐱', name: 'mèo' }, b: { emoji: '🐶', name: 'chó' } },
];

export function genRatio(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  if (level === 1) {
    const p = R.pick(RATIO_PAIRS);
    let x = R.int(2, 7);
    let y = R.int(2, 7);
    if (x === y) y = x + 1;
    if (gcd(x, y) !== 1 && R.chance(0.5)) x = x + 1 === y ? x + 2 : x + 1;
    const ans = `${x} : ${y}`;
    const c = textChoices(ans, [`${y} : ${x}`, `${x} : ${x + y}`, `${x + y} : ${y}`, `${y} : ${x + y}`], n);
    return makeQ({
      topic: 'ratio',
      level,
      prompt: `Tỉ số của số ${p.a.name} và số ${p.b.name} là?`,
      visual: { kind: 'ratio', a: { emoji: p.a.emoji, count: x }, b: { emoji: p.b.emoji, count: y } },
      ...c,
      hint: `Đếm số ${p.a.name} viết trước, số ${p.b.name} viết sau.`,
      steps: [`Có ${x} ${p.a.name} và ${y} ${p.b.name}.`, `Tỉ số của ${p.a.name} và ${p.b.name} là ${x} : ${y} (hay ${x}/${y}).`],
    });
  }
  if (level === 2 || level === 3) {
    const m = R.int(1, 4);
    let k = R.int(m + 1, 7);
    if (gcd(m, k) !== 1) k = m + 1;
    const unit = R.int(2, 12);
    const small = m * unit;
    const big = k * unit;
    const askSmall = R.chance(0.5);
    const ans = askSmall ? small : big;
    const c = numChoices(ans, [askSmall ? big : small, unit, ans + unit, ans - unit], n, { min: 1 });
    if (level === 2) {
      const total = small + big;
      return makeQ({
        topic: 'ratio',
        level,
        context: `Tổng của hai số là ${total}. Số bé bằng ${m}/${k} số lớn.`,
        prompt: askSmall ? 'Tìm số bé.' : 'Tìm số lớn.',
        ...c,
        hint: 'Vẽ sơ đồ: số bé là ' + m + ' phần, số lớn là ' + k + ' phần bằng nhau.',
        steps: [`Tổng số phần bằng nhau: ${m} + ${k} = ${m + k}.`, `Giá trị một phần: ${total} ${DIVIDE} ${m + k} = ${unit}.`, askSmall ? `Số bé: ${unit} ${TIMES} ${m} = ${small}.` : `Số lớn: ${unit} ${TIMES} ${k} = ${big}.`],
      });
    }
    const diff = big - small;
    return makeQ({
      topic: 'ratio',
      level,
      context: `Hiệu của hai số là ${diff}. Số bé bằng ${m}/${k} số lớn.`,
      prompt: askSmall ? 'Tìm số bé.' : 'Tìm số lớn.',
      ...c,
      hint: 'Vẽ sơ đồ: số lớn hơn số bé ' + (k - m) + ' phần.',
      steps: [`Hiệu số phần bằng nhau: ${k} ${MINUS} ${m} = ${k - m}.`, `Giá trị một phần: ${diff} ${DIVIDE} ${k - m} = ${unit}.`, askSmall ? `Số bé: ${unit} ${TIMES} ${m} = ${small}.` : `Số lớn: ${unit} ${TIMES} ${k} = ${big}.`],
    });
  }
  if (level === 4) {
    const p = R.pick([10, 20, 25, 50, 75]);
    const base = p === 25 || p === 75 ? R.int(1, 12) * 4 : p === 50 ? R.int(1, 20) * 2 : R.int(1, 20) * 10;
    const ans = (base * p) / 100;
    const c = numChoices(ans, [base - ans, ans * 2, ans + 5, p], n, { min: 0 });
    return makeQ({
      topic: 'ratio',
      level,
      prompt: `${p}% của ${base} là bao nhiêu?`,
      ...c,
      hint: `${p}% nghĩa là ${p} phần trăm: lấy ${base} chia 100 rồi nhân ${p}.`,
      steps: [`${base} ${DIVIDE} 100 ${TIMES} ${p}.`, `= ${fmt(base / 100)} ${TIMES} ${p} = ${fmt(ans)}.`, `Vậy ${p}% của ${base} là ${fmt(ans)}.`],
    });
  }
  const scale = R.pick([100, 1000, 10000]);
  const cmOnMap = R.int(2, 9);
  const realCm = cmOnMap * scale;
  const ans = realCm / 100;
  const c = numChoices(ans, [realCm, ans * 10, ans / 10, ans + cmOnMap], n, { format: (v) => `${fmt(v)} m`, integer: false, step: ans });
  return makeQ({
    topic: 'ratio',
    level,
    context: `Bản đồ có tỉ lệ 1 : ${fmt(scale)}.`,
    prompt: `Đoạn đường dài ${cmOnMap} cm trên bản đồ thì ngoài thực tế dài bao nhiêu mét?`,
    ...c,
    hint: `1 cm trên bản đồ ứng với ${fmt(scale)} cm ngoài thực tế.`,
    steps: [`${cmOnMap} ${TIMES} ${fmt(scale)} = ${fmt(realCm)} cm.`, `Đổi ra mét: ${fmt(realCm)} cm = ${fmt(ans)} m.`],
  });
}

/* ------------------------------------------------------------------ */
/* BÀI TOÁN CÓ LỜI VĂN                                                  */
/* ------------------------------------------------------------------ */
export const WORD_THEMES: WordTheme[] = [
  { who: 'Thỏ', item: 'củ cà rốt', unit: 'củ', emoji: '🥕' },
  { who: 'Khỉ', item: 'quả chuối', unit: 'quả', emoji: '🍌' },
  { who: 'Gấu', item: 'hũ mật ong', unit: 'hũ', emoji: '🍯' },
  { who: 'Sóc', item: 'hạt dẻ', unit: 'hạt', emoji: '🌰' },
  { who: 'Mèo', item: 'con cá', unit: 'con', emoji: '🐟' },
  { who: 'Hươu', item: 'quả táo', unit: 'quả', emoji: '🍎' },
  { who: 'Chim cánh cụt', item: 'con cá', unit: 'con', emoji: '🐟' },
];

export function genWord(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  const t = o.theme ?? R.pick(WORD_THEMES);
  const u = (v: number) => `${fmt(v)} ${t.unit}`;
  if (level === 1 || level === 3) {
    const [a, b] = level === 1 ? [R.int(1, 6), R.int(1, 4)] : [R.int(12, 60), R.int(11, 35)];
    const s = a + b;
    const c = numChoices(s, [s + 1, s - 1, Math.abs(a - b), s + 10], n, { format: u, min: 0 });
    return makeQ({
      topic: 'word',
      level,
      context: `${t.who} có ${a} ${t.item}. Bạn Sóc cho ${t.who} thêm ${b} ${t.unit}.`,
      prompt: `${t.who} có tất cả bao nhiêu ${t.item}?`,
      visual: s <= 10 ? { kind: 'objects', emoji: t.emoji, groups: [a, b], op: '+' } : undefined,
      ...c,
      hint: '"Thêm", "tất cả" → làm phép cộng.',
      steps: [`Có ${a}, thêm ${b} → phép cộng.`, ...addSteps(a, b).slice(-1), `Đáp số: ${s} ${t.unit}.`],
    });
  }
  if (level === 2) {
    const a = R.int(8, 20);
    const b = R.int(2, a - 2);
    const d = a - b;
    const c = numChoices(d, [d + 1, d - 1, a + b, d + 2], n, { format: u, min: 0 });
    return makeQ({
      topic: 'word',
      level,
      context: `${t.who} có ${a} ${t.item}. ${t.who} đã ăn ${b} ${t.unit}.`,
      prompt: `${t.who} còn lại bao nhiêu ${t.item}?`,
      visual: a <= 20 ? { kind: 'objects', emoji: t.emoji, groups: [a], op: '-', crossOut: b } : undefined,
      ...c,
      hint: '"Ăn mất", "còn lại" → làm phép trừ.',
      steps: [`Có ${a}, ăn mất ${b} → phép trừ.`, ...subSteps(a, b).slice(-1), `Đáp số: ${d} ${t.unit}.`],
    });
  }
  if (level === 4) {
    const per = R.int(3, 9);
    const k = R.int(2, 9);
    if (R.chance(0.5)) {
      const ans = per * k;
      const c = numChoices(ans, [per + k, ans + per, ans - per, ans + 1], n, { format: u, min: 1 });
      return makeQ({
        topic: 'word',
        level,
        context: `Mỗi giỏ có ${per} ${t.item}.`,
        prompt: `${k} giỏ như thế có bao nhiêu ${t.item}?`,
        visual: per <= 6 && k <= 6 ? { kind: 'groups', emoji: t.emoji, groups: k, each: per } : undefined,
        ...c,
        hint: `${per} được lấy ${k} lần → phép nhân.`,
        steps: [...mulSteps(per, k).slice(-1), `Đáp số: ${ans} ${t.unit}.`],
      });
    }
    const total = per * k;
    const c = numChoices(per, [per + 1, per - 1, k, total - k], n, { format: u, min: 1 });
    return makeQ({
      topic: 'word',
      level,
      context: `Có ${total} ${t.item} chia đều vào ${k} giỏ.`,
      prompt: `Mỗi giỏ có bao nhiêu ${t.item}?`,
      visual: total <= 24 ? { kind: 'share', emoji: t.emoji, total, parts: k } : undefined,
      ...c,
      hint: '"Chia đều" → phép chia.',
      steps: [...divSteps(total, k).slice(-1), `Đáp số: ${per} ${t.unit}.`],
    });
  }
  if (level === 5) {
    const per = R.int(4, 9);
    const k = R.int(3, 8);
    const total = per * k;
    const eaten = R.int(3, total - 3);
    const ans = total - eaten;
    const c = numChoices(ans, [total, ans + per, ans - 1, eaten, per * (k - 1)], n, { format: u, min: 0 });
    return makeQ({
      topic: 'word',
      level,
      context: `${t.who} có ${k} giỏ, mỗi giỏ ${per} ${t.item}. ${t.who} đã đem tặng ${eaten} ${t.unit}.`,
      prompt: `${t.who} còn lại bao nhiêu ${t.item}?`,
      ...c,
      hint: 'Bước 1: tính tất cả. Bước 2: trừ đi số đã tặng.',
      steps: [`Tất cả: ${per} ${TIMES} ${k} = ${total} ${t.unit}.`, `Còn lại: ${total} ${MINUS} ${eaten} = ${ans} ${t.unit}.`],
    });
  }
  if (level === 6) {
    const avg = R.int(10, 40);
    const d1 = R.int(1, 8);
    const d2 = R.int(-8, 8);
    const vals = [avg - d1, avg + d1 + d2, avg - d2];
    if (vals.some((v) => v <= 0)) vals[0] = avg;
    const sum = vals.reduce((x, y) => x + y, 0);
    const realAvg = sum / 3;
    const ans = Number.isInteger(realAvg) ? realAvg : avg;
    const vs = Number.isInteger(realAvg) ? vals : [avg, avg, avg];
    const c = numChoices(ans, [ans + 1, ans - 1, vs.reduce((x, y) => x + y, 0), ans + 3], n, { format: u, min: 1 });
    return makeQ({
      topic: 'word',
      level,
      context: `Ba bạn hái được lần lượt ${vs.join(', ')} ${t.item}.`,
      prompt: 'Trung bình mỗi bạn hái được bao nhiêu?',
      ...c,
      hint: 'Trung bình cộng = tổng các số : số các số.',
      steps: [`Tổng: ${vs.join(' + ')} = ${vs.reduce((x, y) => x + y, 0)}.`, `Chia cho 3: ${vs.reduce((x, y) => x + y, 0)} ${DIVIDE} 3 = ${ans}.`, `Trung bình mỗi bạn hái ${ans} ${t.unit}.`],
    });
  }
  const v = R.pick([30, 35, 40, 45, 50, 60]);
  const h = R.int(2, 5);
  const s = v * h;
  if (R.chance(0.5)) {
    const c = numChoices(s, [v + h, s + v, s - v, s + 10], n, { format: (x) => `${fmt(x)} km`, min: 1 });
    return makeQ({
      topic: 'word',
      level,
      context: `Một chiếc xe buýt mỗi giờ đi được ${v} km.`,
      prompt: `Trong ${h} giờ, xe đi được bao nhiêu ki-lô-mét?`,
      ...c,
      hint: 'Quãng đường = vận tốc × thời gian.',
      steps: [`s = v ${TIMES} t.`, `${v} ${TIMES} ${h} = ${s}.`, `Xe đi được ${s} km.`],
    });
  }
  const c = numChoices(h, [h + 1, h - 1, h + 2, s - v], n, { format: (x) => `${fmt(x)} giờ`, min: 1 });
  return makeQ({
    topic: 'word',
    level,
    context: `Quãng đường dài ${s} km. Một chiếc xe mỗi giờ đi được ${v} km.`,
    prompt: 'Xe đi hết quãng đường trong mấy giờ?',
    ...c,
    hint: 'Thời gian = quãng đường : vận tốc.',
    steps: [`t = s ${DIVIDE} v.`, `${s} ${DIVIDE} ${v} = ${h}.`, `Xe đi hết ${h} giờ.`],
  });
}
