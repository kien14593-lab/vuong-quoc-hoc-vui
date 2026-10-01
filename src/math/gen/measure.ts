import type { GenOptions, Question } from '../types';
import { MINUS, TIMES, choiceCount, fmt, makeQ, numChoices, rand, textChoices } from '../util';
import { addSteps, subSteps } from './arith';

/* ------------------------------------------------------------------ */
/* THỜI GIAN                                                            */
/* ------------------------------------------------------------------ */
export function fmtTime(h: number, m: number): string {
  const hh = ((h - 1 + 24) % 12) + 1;
  return m === 0 ? `${hh} giờ` : `${hh} giờ ${m} phút`;
}

function timeChoices(h: number, m: number, alts: [number, number][], n: number) {
  const ans = fmtTime(h, m);
  return textChoices(
    ans,
    alts.map(([a, b]) => fmtTime(a, ((b % 60) + 60) % 60)),
    n,
  );
}

export function genTime(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  if (level <= 3) {
    const h = R.int(1, 12);
    const m = level === 1 ? 0 : level === 2 ? 30 : R.pick([15, 45, 5, 10, 20, 25, 35, 40, 50, 55]);
    const alts: [number, number][] =
      level === 1
        ? [[h + 1, 0], [h - 1, 0], [h + 6, 0], [h + 3, 0]]
        : level === 2
          ? [[h + 1, 30], [h, 0], [h - 1, 30], [h + 1, 0]]
          : [[h + 1, m], [h, m + 5], [h, m - 5], [m / 5, h * 5], [h - 1, m]];
    const c = timeChoices(h, m, alts, n);
    return makeQ({
      topic: 'time',
      level,
      prompt: 'Đồng hồ chỉ mấy giờ?',
      visual: { kind: 'clock', h, m },
      ...c,
      hint:
        level === 1
          ? 'Kim dài chỉ số 12. Kim ngắn chỉ số giờ.'
          : level === 2
            ? 'Kim dài chỉ số 6 là 30 phút. Kim ngắn nằm giữa hai số: đọc số nhỏ hơn.'
            : 'Kim dài chỉ số nào thì nhân số đó với 5 để ra số phút.',
      steps:
        level === 1
          ? ['Kim dài (kim phút) chỉ số 12 nên là giờ đúng.', `Kim ngắn (kim giờ) chỉ số ${h}.`, `Vậy đồng hồ chỉ ${fmtTime(h, 0)}.`]
          : [
              `Kim dài chỉ số ${m / 5}: ${m / 5} ${TIMES} 5 = ${m} phút.`,
              `Kim ngắn đã qua số ${h} nhưng chưa tới số ${(h % 12) + 1}.`,
              `Vậy đồng hồ chỉ ${fmtTime(h, m)}.`,
            ],
    });
  }
  if (level === 4) {
    const h = R.int(6, 10);
    const m = R.int(0, 6) * 5;
    if (R.chance(0.6)) {
      const dur = R.pick([15, 20, 25, 30, 40, 45, 50]);
      const total = h * 60 + m + dur;
      const eh = Math.floor(total / 60);
      const em = total % 60;
      const c = timeChoices(eh, em, [[eh, em + 5], [eh, em - 5], [eh + 1, em], [eh - 1, em], [h, m + dur]], n);
      return makeQ({
        topic: 'time',
        level,
        context: `Bạn Gấu bắt đầu đọc sách lúc ${fmtTime(h, m)} và đọc trong ${dur} phút.`,
        prompt: 'Bạn Gấu đọc xong lúc mấy giờ?',
        visual: { kind: 'clock', h, m },
        ...c,
        hint: 'Cộng số phút. Đủ 60 phút thì thêm 1 giờ.',
        steps: [
          `${m} phút + ${dur} phút = ${m + dur} phút.`,
          m + dur >= 60 ? `${m + dur} phút = 1 giờ ${m + dur - 60} phút, thêm vào số giờ.` : `Chưa đủ 60 phút nên giữ nguyên số giờ.`,
          `Bạn Gấu đọc xong lúc ${fmtTime(eh, em)}.`,
        ],
      });
    }
    const durH = R.int(1, 3);
    const durM = R.pick([0, 15, 30, 45]);
    const total = h * 60 + m + durH * 60 + durM;
    const eh = Math.floor(total / 60);
    const em = total % 60;
    const ans = durM ? `${durH} giờ ${durM} phút` : `${durH} giờ`;
    const alts = [`${durH + 1} giờ${durM ? ` ${durM} phút` : ''}`, `${durH} giờ ${durM ? (durM + 15 > 45 ? 15 : durM + 15) : 30} phút`, `${Math.max(1, durH - 1)} giờ ${durM ? durM : 15} phút`, `${durH + 2} giờ`];
    const c = textChoices(ans, alts, n);
    return makeQ({
      topic: 'time',
      level,
      context: `Chuyến tàu khởi hành lúc ${fmtTime(h, m)} và đến nơi lúc ${fmtTime(eh, em)}.`,
      prompt: 'Tàu đã đi trong bao lâu?',
      ...c,
      hint: 'Đếm số giờ trước, rồi đếm thêm số phút.',
      steps: [`Từ ${fmtTime(h, m)} đến ${fmtTime(h + durH, m)} là ${durH} giờ.`, durM ? `Thêm ${durM} phút nữa thì đến ${fmtTime(eh, em)}.` : 'Không cần thêm phút nào.', `Tàu đã đi trong ${ans}.`],
    });
  }
  const kind = R.int(0, 3);
  if (kind === 0) {
    const h = R.int(1, 4);
    const m = R.pick([10, 15, 20, 30, 45]);
    const ans = h * 60 + m;
    const c = numChoices(ans, [h * 100 + m, h * 60, ans + 10, h + m, ans - 15], n, { format: (v) => `${fmt(v)} phút` });
    return makeQ({ topic: 'time', level, prompt: `${h} giờ ${m} phút = ? phút`, ...c, hint: '1 giờ = 60 phút.', steps: [`${h} giờ = ${h} ${TIMES} 60 = ${h * 60} phút.`, `${h * 60} + ${m} = ${ans}.`, `Vậy ${h} giờ ${m} phút = ${ans} phút.`] });
  }
  if (kind === 1) {
    const d = R.int(2, 7);
    const ans = d * 24;
    const c = numChoices(ans, [d * 12, d * 60, ans + 24, ans - 24, d * 10], n, { format: (v) => `${fmt(v)} giờ` });
    return makeQ({ topic: 'time', level, prompt: `${d} ngày = ? giờ`, ...c, hint: '1 ngày có 24 giờ.', steps: [`1 ngày = 24 giờ.`, `${d} ngày = ${d} ${TIMES} 24 = ${ans} giờ.`] });
  }
  if (kind === 2) {
    const mi = R.int(2, 9);
    const ans = mi;
    const s = mi * 60;
    const c = numChoices(ans, [mi + 1, mi - 1, mi * 10, s / 100, mi + 2], n, { format: (v) => `${fmt(v)} phút`, min: 1 });
    return makeQ({ topic: 'time', level, prompt: `${s} giây = ? phút`, ...c, hint: '1 phút = 60 giây.', steps: [`1 phút = 60 giây.`, `${s} : 60 = ${mi}.`, `Vậy ${s} giây = ${mi} phút.`] });
  }
  const w = R.int(2, 6);
  const ans = w * 7;
  const c = numChoices(ans, [w * 5, w * 10, ans + 7, ans - 7, w + 7], n, { format: (v) => `${fmt(v)} ngày` });
  return makeQ({ topic: 'time', level, prompt: `${w} tuần = ? ngày`, ...c, hint: '1 tuần có 7 ngày.', steps: [`1 tuần = 7 ngày.`, `${w} tuần = ${w} ${TIMES} 7 = ${ans} ngày.`] });
}

/* ------------------------------------------------------------------ */
/* ĐỘ DÀI                                                               */
/* ------------------------------------------------------------------ */
const RIBBONS = [
  { name: 'Dải đỏ', color: '#ff6b6b' },
  { name: 'Dải xanh', color: '#4dabf7' },
  { name: 'Dải vàng', color: '#ffd43b' },
  { name: 'Dải tím', color: '#b197fc' },
];

export function genLength(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  const cm = (v: number) => `${fmt(v)} cm`;
  if (level === 1) {
    const k = o.support ? 3 : 3 + (o.grade > 1 ? 1 : 0);
    const set = new Set<number>();
    while (set.size < k) set.add(R.int(3, 12));
    const lens = [...set];
    const ribbons = R.sample(RIBBONS, k).map((r, i) => ({ ...r, length: lens[i] }));
    const wantLong = R.chance(0.6);
    const target = ribbons.reduce((best, r) => (wantLong ? (r.length > best.length ? r : best) : r.length < best.length ? r : best));
    return makeQ({
      topic: 'length',
      level,
      prompt: wantLong ? 'Dải ruy băng nào dài nhất?' : 'Dải ruy băng nào ngắn nhất?',
      visual: { kind: 'lengths', items: ribbons.map((r) => ({ name: r.name, length: r.length, color: r.color })) },
      choices: ribbons.map((r) => ({ label: r.name, value: r.name })),
      answer: target.name,
      hint: 'Các dải bắt đầu ở cùng một vạch. Xem dải nào kết thúc xa nhất (hoặc gần nhất).',
      steps: ['Đặt các dải thẳng hàng ở đầu bên trái.', 'So sánh đầu bên phải của từng dải.', `${target.name} ${wantLong ? 'dài nhất' : 'ngắn nhất'}.`],
    });
  }
  if (level === 2) {
    const len = R.int(3, 15);
    const obj = R.pick(['pencil', 'crayon', 'ribbon'] as const);
    const name = obj === 'pencil' ? 'Bút chì' : obj === 'crayon' ? 'Bút sáp' : 'Ruy băng';
    const c = numChoices(len, [len + 1, len - 1, len + 2, len + 10], n, { format: cm, min: 1 });
    return makeQ({
      topic: 'length',
      level,
      prompt: `${name} dài bao nhiêu xăng-ti-mét?`,
      visual: { kind: 'ruler', length: len, object: obj },
      ...c,
      hint: 'Đầu vật đặt ở vạch 0. Đọc số ở vạch cuối của vật.',
      steps: ['Một đầu của vật đặt đúng vạch 0.', `Đầu kia ở vạch số ${len}.`, `Vậy vật dài ${len} cm.`],
    });
  }
  if (level === 3) {
    const plus = R.chance(0.55);
    const a = plus ? R.int(12, 60) : R.int(40, 99);
    const b = plus ? R.int(11, 39) : R.int(11, a - 10);
    const ans = plus ? a + b : a - b;
    const c = numChoices(ans, [ans + 10, ans - 10, ans + 1, ans - 1, plus ? a - b : a + b], n, { format: cm, min: 1 });
    return makeQ({
      topic: 'length',
      level,
      context: plus ? `Sợi dây xanh dài ${a} cm, sợi dây đỏ dài ${b} cm.` : `Sợi dây dài ${a} cm. Cắt đi ${b} cm.`,
      prompt: plus ? `Hai sợi dây dài tất cả bao nhiêu?` : 'Sợi dây còn lại dài bao nhiêu?',
      ...c,
      hint: plus ? 'Cộng hai độ dài, nhớ ghi đơn vị cm.' : 'Lấy độ dài ban đầu trừ đi phần cắt.',
      steps: plus ? addSteps(a, b).concat(`Đáp số: ${ans} cm.`) : subSteps(a, b).concat(`Đáp số: ${ans} cm.`),
    });
  }
  if (level === 4) {
    const k = R.int(1, 9);
    const forms: { p: string; ans: number; unit: string; why: string; alts: number[] }[] = [
      { p: `${k} m = ? cm`, ans: k * 100, unit: 'cm', why: '1 m = 100 cm.', alts: [k * 10, k * 1000, k + 100] },
      { p: `${k} dm = ? cm`, ans: k * 10, unit: 'cm', why: '1 dm = 10 cm.', alts: [k * 100, k + 10, k] },
      { p: `${k} m = ? dm`, ans: k * 10, unit: 'dm', why: '1 m = 10 dm.', alts: [k * 100, k + 10, k] },
      { p: `${k} km = ? m`, ans: k * 1000, unit: 'm', why: '1 km = 1000 m.', alts: [k * 100, k * 10, k * 10000] },
    ];
    const f = R.pick(forms);
    const c = numChoices(f.ans, f.alts, n, { format: (v) => `${fmt(v)} ${f.unit}`, min: 1 });
    return makeQ({ topic: 'length', level, prompt: f.p, ...c, hint: f.why, steps: [f.why, `${f.p.replace('?', String(f.ans))}.`] });
  }
  const kind = R.int(0, 2);
  if (kind === 0) {
    const a = R.int(1, 9);
    const b = R.int(5, 95);
    const ans = a * 100 + b;
    const c = numChoices(ans, [a * 10 + b, a + b, a * 1000 + b, ans + 10], n, { format: cm });
    return makeQ({ topic: 'length', level, prompt: `${a} m ${b} cm = ? cm`, ...c, hint: '1 m = 100 cm.', steps: [`${a} m = ${a * 100} cm.`, `${a * 100} + ${b} = ${ans}.`, `Vậy ${a} m ${b} cm = ${ans} cm.`] });
  }
  if (kind === 1) {
    const a = R.int(1, 9);
    const b = R.int(1, 9) * 100 + R.pick([0, 50]);
    const ans = a * 1000 + b;
    const c = numChoices(ans, [a * 100 + b, a + b, a * 10000 + b, ans + 100], n, { format: (v) => `${fmt(v)} m` });
    return makeQ({ topic: 'length', level, prompt: `${a} km ${b} m = ? m`, ...c, hint: '1 km = 1000 m.', steps: [`${a} km = ${fmt(a * 1000)} m.`, `${fmt(a * 1000)} + ${b} = ${fmt(ans)}.`, `Vậy ${a} km ${b} m = ${fmt(ans)} m.`] });
  }
  const a = R.int(1, 9);
  const d = R.int(1, 9);
  const ans = a * 100 + d * 10;
  const c = numChoices(ans, [a * 10 + d, a * 100 + d, ans + 100, a * 1000 + d * 100], n, { format: cm });
  return makeQ({ topic: 'length', level, prompt: `${a},${d} m = ? cm`, ...c, hint: '1 m = 100 cm. Nhân với 100 thì dời dấu phẩy sang phải 2 chữ số.', steps: [`1 m = 100 cm.`, `${a},${d} ${TIMES} 100 = ${ans}.`, `Vậy ${a},${d} m = ${ans} cm.`] });
}

/* ------------------------------------------------------------------ */
/* TIỀN (XU)                                                            */
/* ------------------------------------------------------------------ */
export const SHOP_GOODS = [
  { emoji: '🍎', name: 'táo' },
  { emoji: '🍌', name: 'chuối' },
  { emoji: '🍬', name: 'kẹo' },
  { emoji: '🍰', name: 'bánh' },
  { emoji: '🥛', name: 'sữa' },
  { emoji: '✏️', name: 'bút chì' },
  { emoji: '📒', name: 'quyển vở' },
  { emoji: '🎈', name: 'bóng bay' },
  { emoji: '🍦', name: 'kem' },
  { emoji: '🧃', name: 'nước cam' },
] as const;

export function genMoney(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  const xu = (v: number) => `${fmt(v)} xu`;
  if (level === 1) {
    const [g1, g2] = R.sample(SHOP_GOODS, 2);
    const p1 = R.int(1, 5);
    const p2 = R.int(1, 5);
    const ans = p1 + p2;
    const c = numChoices(ans, [ans + 1, ans - 1, Math.abs(p1 - p2), ans + 2], n, { format: xu, min: 1 });
    return makeQ({
      topic: 'money',
      level,
      context: `Một ${g1.name} giá ${p1} xu, một ${g2.name} giá ${p2} xu.`,
      prompt: 'Mua cả hai hết bao nhiêu xu?',
      visual: { kind: 'money', items: [{ emoji: g1.emoji, name: g1.name, price: p1 }, { emoji: g2.emoji, name: g2.name, price: p2 }] },
      ...c,
      hint: 'Cộng giá của hai món.',
      steps: addSteps(p1, p2).concat(`Mua cả hai hết ${ans} xu.`),
    });
  }
  if (level === 2) {
    const budget = R.int(10, 20);
    const [g1, g2] = R.sample(SHOP_GOODS, 2);
    const p1 = R.int(2, Math.floor(budget / 2));
    const p2 = R.int(1, budget - p1 - 1);
    const ans = budget - p1 - p2;
    const c = numChoices(ans, [ans + 1, ans - 1, p1 + p2, budget - p1, ans + 2], n, { format: xu, min: 0 });
    return makeQ({
      topic: 'money',
      level,
      context: `Em có ${budget} xu. Một ${g1.name} giá ${p1} xu, một ${g2.name} giá ${p2} xu.`,
      prompt: 'Mua mỗi loại một món thì còn lại bao nhiêu xu?',
      visual: { kind: 'money', items: [{ emoji: g1.emoji, name: g1.name, price: p1 }, { emoji: g2.emoji, name: g2.name, price: p2 }], budget },
      ...c,
      hint: 'Tính tổng tiền hai món, rồi lấy số xu đang có trừ đi.',
      steps: [`Hai món hết: ${p1} + ${p2} = ${p1 + p2} xu.`, `Còn lại: ${budget} ${MINUS} ${p1 + p2} = ${ans} xu.`],
    });
  }
  if (level === 3) {
    const g = R.pick(SHOP_GOODS);
    const p = R.int(2, 10);
    const k = R.int(2, 5);
    const ans = p * k;
    const c = numChoices(ans, [p + k, ans + p, ans - p, ans + 1], n, { format: xu, min: 1 });
    return makeQ({
      topic: 'money',
      level,
      context: `Mỗi ${g.name} giá ${p} xu.`,
      prompt: `Mua ${k} ${g.name} hết bao nhiêu xu?`,
      visual: { kind: 'money', items: [{ emoji: g.emoji, name: g.name, price: p, qty: k }] },
      ...c,
      hint: `${p} xu được lấy ${k} lần.`,
      steps: [`${k} ${g.name}, mỗi ${g.name} ${p} xu.`, `${p} ${TIMES} ${k} = ${ans}.`, `Hết ${ans} xu.`],
    });
  }
  if (level === 4) {
    const budget = R.pick([50, 60, 80, 100]);
    const items = R.sample(SHOP_GOODS, 3);
    const prices = items.map(() => R.int(5, Math.floor(budget / 4)));
    const total = prices.reduce((a, b) => a + b, 0);
    const ans = budget - total;
    const c = numChoices(ans, [ans + 10, ans - 10, total, ans + 5, ans - 1], n, { format: xu, min: 0 });
    return makeQ({
      topic: 'money',
      level,
      context: `Em mang ${budget} xu đi chợ và mua: ${items.map((g, i) => `${g.name} ${prices[i]} xu`).join(', ')}.`,
      prompt: 'Em còn lại bao nhiêu xu?',
      visual: { kind: 'money', items: items.map((g, i) => ({ emoji: g.emoji, name: g.name, price: prices[i] })), budget },
      ...c,
      hint: 'Cộng tất cả giá tiền rồi lấy số xu mang theo trừ đi.',
      steps: [`Tổng tiền: ${prices.join(' + ')} = ${total} xu.`, `Còn lại: ${budget} ${MINUS} ${total} = ${ans} xu.`],
    });
  }
  const [g1, g2] = R.sample(SHOP_GOODS, 2);
  const k = R.int(2, 6);
  const p1 = R.int(8, 25);
  const p2 = R.int(10, 40);
  const total = k * p1 + p2;
  const budget = Math.ceil((total + 5) / 50) * 50;
  const ans = budget - total;
  const c = numChoices(ans, [ans + p1, ans - 10, total, budget - p1 - p2, ans + 5], n, { format: xu, min: 0 });
  return makeQ({
    topic: 'money',
    level,
    context: `Mua ${k} ${g1.name}, mỗi ${g1.name} ${p1} xu, và 1 ${g2.name} giá ${p2} xu. Em đưa cô bán hàng ${budget} xu.`,
    prompt: 'Cô bán hàng trả lại em bao nhiêu xu?',
    visual: { kind: 'money', items: [{ emoji: g1.emoji, name: g1.name, price: p1, qty: k }, { emoji: g2.emoji, name: g2.name, price: p2 }], budget },
    ...c,
    hint: 'Tính tiền từng loại, cộng lại, rồi lấy số tiền đưa trừ đi.',
    steps: [`${k} ${g1.name}: ${p1} ${TIMES} ${k} = ${k * p1} xu.`, `Tổng: ${k * p1} + ${p2} = ${total} xu.`, `Trả lại: ${budget} ${MINUS} ${total} = ${ans} xu.`],
  });
}
