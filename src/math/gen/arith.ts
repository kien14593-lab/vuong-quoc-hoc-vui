import type { GenOptions, Question, Visual } from '../types';
import { COUNT_ITEMS, DIVIDE, MINUS, TIMES, choiceCount, fmt, makeQ, numChoices, rand, textChoices } from '../util';

const PLACE_NAMES = ['đơn vị', 'chục', 'trăm', 'nghìn', 'chục nghìn', 'trăm nghìn'];

function digitsRev(n: number): number[] {
  return String(n).split('').reverse().map(Number);
}

export function chunk(n: number, size: number): number[] {
  const out: number[] = [];
  while (n > 0) {
    out.push(Math.min(size, n));
    n -= size;
  }
  return out;
}

/** Lời giải từng bước cho phép cộng: đếm thêm (số nhỏ) hoặc cộng theo cột. */
export function addSteps(a: number, b: number): string[] {
  const sum = a + b;
  if (sum <= 20 && Math.min(a, b) <= 10) {
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    if (small === 0) return [`Cộng với 0 thì số không đổi.`, `Vậy ${a} + ${b} = ${sum}.`];
    const seq = Array.from({ length: small }, (_, i) => big + i + 1);
    return [`Bắt đầu từ số lớn hơn: ${big}.`, `Đếm thêm ${small}: ${seq.join(', ')}.`, `Vậy ${a} + ${b} = ${sum}.`];
  }
  const da = digitsRev(a);
  const db = digitsRev(b);
  const len = Math.max(da.length, db.length);
  const steps: string[] = ['Đặt tính thẳng cột rồi cộng từ phải sang trái.'];
  let carry = 0;
  for (let i = 0; i < len; i++) {
    const x = da[i] ?? 0;
    const y = db[i] ?? 0;
    const s = x + y + carry;
    const carryTxt = carry ? `, thêm ${carry} nhớ` : '';
    const digit = s % 10;
    const nc = Math.floor(s / 10);
    if (i === len - 1) steps.push(`Hàng ${PLACE_NAMES[i]}: ${x} + ${y}${carryTxt} được ${s}, viết ${s}.`);
    else steps.push(`Hàng ${PLACE_NAMES[i]}: ${x} + ${y}${carryTxt} được ${s}, viết ${digit}${nc ? `, nhớ ${nc}` : ''}.`);
    carry = nc;
  }
  steps.push(`Vậy ${fmt(a)} + ${fmt(b)} = ${fmt(sum)}.`);
  return steps;
}

/** Lời giải từng bước cho phép trừ: đếm lùi (số nhỏ) hoặc trừ theo cột có nhớ. */
export function subSteps(a: number, b: number): string[] {
  const diff = a - b;
  if (a <= 20 && b <= 10) {
    if (b === 0) return [`Trừ đi 0 thì số không đổi.`, `Vậy ${a} ${MINUS} ${b} = ${diff}.`];
    const seq = Array.from({ length: b }, (_, i) => a - i - 1);
    return [`Bắt đầu từ ${a}.`, `Đếm lùi ${b} bước: ${seq.join(', ')}.`, `Vậy ${a} ${MINUS} ${b} = ${diff}.`];
  }
  const da = digitsRev(a);
  const db = digitsRev(b);
  const steps: string[] = ['Đặt tính thẳng cột rồi trừ từ phải sang trái.'];
  let borrow = 0;
  for (let i = 0; i < da.length; i++) {
    const x = da[i];
    const yRaw = db[i] ?? 0;
    const y = yRaw + borrow;
    const yTxt = borrow ? `${yRaw} thêm 1 là ${y}; ` : '';
    if (i >= db.length && borrow === 0) {
      if (i === da.length - 1 && x === 0) break;
      steps.push(`Hàng ${PLACE_NAMES[i]}: hạ ${x}.`);
      continue;
    }
    if (x >= y) {
      steps.push(`Hàng ${PLACE_NAMES[i]}: ${yTxt}${x} ${MINUS} ${y} = ${x - y}, viết ${x - y}.`);
      borrow = 0;
    } else {
      steps.push(`Hàng ${PLACE_NAMES[i]}: ${yTxt}${x} không trừ được ${y}, lấy ${x + 10} ${MINUS} ${y} = ${x + 10 - y}, viết ${x + 10 - y}, nhớ 1.`);
      borrow = 1;
    }
  }
  steps.push(`Vậy ${fmt(a)} ${MINUS} ${fmt(b)} = ${fmt(diff)}.`);
  return steps;
}

export function mulSteps(a: number, b: number): string[] {
  const p = a * b;
  if (a <= 10 && b <= 10) {
    if (b === 1) return [`Số nào nhân với 1 cũng bằng chính số đó.`, `Vậy ${a} ${TIMES} 1 = ${a}.`];
    if (b === 0 || a === 0) return [`Số nào nhân với 0 cũng bằng 0.`, `Vậy ${a} ${TIMES} ${b} = 0.`];
    return [
      `${a} ${TIMES} ${b} nghĩa là ${a} được lấy ${b} lần.`,
      `${Array(b).fill(a).join(' + ')} = ${p}.`,
      `Vậy ${a} ${TIMES} ${b} = ${p}.`,
    ];
  }
  if (b < 10) {
    const da = digitsRev(a);
    const steps: string[] = ['Đặt tính rồi nhân từ phải sang trái.'];
    let carry = 0;
    for (let i = 0; i < da.length; i++) {
      const s = da[i] * b + carry;
      const carryTxt = carry ? `, thêm ${carry} được ${s}` : '';
      const nc = Math.floor(s / 10);
      if (i === da.length - 1) steps.push(`${b} ${TIMES} ${da[i]} = ${da[i] * b}${carryTxt}, viết ${s}.`);
      else steps.push(`${b} ${TIMES} ${da[i]} = ${da[i] * b}${carryTxt}, viết ${s % 10}${nc ? `, nhớ ${nc}` : ''}.`);
      carry = nc;
    }
    steps.push(`Vậy ${fmt(a)} ${TIMES} ${b} = ${fmt(p)}.`);
    return steps;
  }
  const tens = Math.floor(b / 10) * 10;
  const ones = b % 10;
  return [
    `Tách ${b} = ${tens} + ${ones}.`,
    `${fmt(a)} ${TIMES} ${tens} = ${fmt(a * tens)}; ${fmt(a)} ${TIMES} ${ones} = ${fmt(a * ones)}.`,
    `${fmt(a * tens)} + ${fmt(a * ones)} = ${fmt(p)}.`,
    `Vậy ${fmt(a)} ${TIMES} ${b} = ${fmt(p)}.`,
  ];
}

export function divSteps(a: number, b: number): string[] {
  const q = Math.floor(a / b);
  const r = a % b;
  if (q <= 10 && b <= 10) {
    if (r === 0) return [`Nhẩm: ${b} nhân mấy thì bằng ${a}?`, `${b} ${TIMES} ${q} = ${a}.`, `Vậy ${a} ${DIVIDE} ${b} = ${q}.`];
    return [
      `Tìm số lớn nhất nhân với ${b} mà không vượt quá ${a}.`,
      `${b} ${TIMES} ${q} = ${b * q}, còn thừa ${a} ${MINUS} ${b * q} = ${r}.`,
      `Vậy ${a} ${DIVIDE} ${b} = ${q} (dư ${r}).`,
    ];
  }
  const ds = String(a).split('').map(Number);
  const steps: string[] = ['Chia lần lượt từ trái sang phải.'];
  let rem = 0;
  let started = false;
  for (let i = 0; i < ds.length; i++) {
    const cur = rem * 10 + ds[i];
    const qq = Math.floor(cur / b);
    if (!started && qq === 0 && i < ds.length - 1) {
      rem = cur;
      continue;
    }
    started = true;
    const rr = cur - qq * b;
    steps.push(`${cur} ${DIVIDE} ${b} được ${qq}, viết ${qq}; ${qq} ${TIMES} ${b} = ${qq * b}; ${cur} ${MINUS} ${qq * b} = ${rr}.`);
    rem = rr;
  }
  steps.push(`Vậy ${fmt(a)} ${DIVIDE} ${b} = ${fmt(q)}${r ? ` (dư ${r})` : ''}.`);
  return steps;
}

/* ------------------------------------------------------------------ */
/* ĐẾM                                                                  */
/* ------------------------------------------------------------------ */
export function genCount(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  if (level <= 3) {
    const [lo, hi] = level === 1 ? [1, 5] : level === 2 ? [5, 10] : [11, 20];
    const k = R.int(lo, hi);
    const item = R.pick(COUNT_ITEMS);
    const grouped = k > 10 || o.support;
    const groups = grouped ? chunk(k, 5) : [k];
    const c = numChoices(k, [k - 1, k + 1, k + 2, k - 2, k + 5], n, { min: 1 });
    return makeQ({
      topic: 'count',
      level,
      prompt: `Có bao nhiêu ${item.name}?`,
      visual: { kind: 'objects', emoji: item.emoji, groups },
      ...c,
      hint: grouped ? 'Hãy đếm từng nhóm 5, rồi đếm thêm phần còn lại.' : `Hãy chỉ tay vào từng ${item.name} và đếm 1, 2, 3…`,
      steps: grouped
        ? [
            `Có ${groups.length} nhóm: ${groups.join(', ')}.`,
            groups.length > 1 ? `Đếm theo 5: ${groups.slice(0, -1).map((_, i) => (i + 1) * 5).join(', ')}, rồi đếm thêm ${groups[groups.length - 1]}.` : `Đếm từng cái: 1, 2, 3…`,
            `Có tất cả ${k} ${item.name}.`,
          ]
        : [`Chỉ tay vào từng ${item.name}.`, `Đếm: ${Array.from({ length: k }, (_, i) => i + 1).join(', ')}.`, `Có tất cả ${k} ${item.name}.`],
    });
  }
  if (level === 4) {
    const t = R.int(1, 9);
    const u = R.int(0, 9);
    const v = t * 10 + u;
    const c = numChoices(v, [u * 10 + t, t + u, v + 10, v - 10, v + 1], n, { min: 1 });
    return makeQ({
      topic: 'count',
      level,
      prompt: `${t} chục và ${u} đơn vị là số nào?`,
      visual: { kind: 'place', hundreds: 0, tens: t, ones: u },
      ...c,
      hint: 'Mỗi thanh dài là 1 chục (10), mỗi ô nhỏ là 1 đơn vị.',
      steps: [`${t} chục là ${t * 10}.`, `${u} đơn vị là ${u}.`, `${t * 10} + ${u} = ${v}.`],
    });
  }
  const h = R.int(1, 9);
  const t = R.int(0, 9);
  const u = R.int(0, 9);
  const v = h * 100 + t * 10 + u;
  const c = numChoices(v, [h * 100 + u * 10 + t, h + t * 10 + u * 100, v + 100, v - 10, v + 10], n, { min: 1 });
  return makeQ({
    topic: 'count',
    level,
    prompt: `${h} trăm, ${t} chục và ${u} đơn vị là số nào?`,
    visual: { kind: 'place', hundreds: h, tens: t, ones: u },
    ...c,
    hint: 'Viết chữ số hàng trăm, rồi hàng chục, rồi hàng đơn vị.',
    steps: [`${h} trăm là ${h * 100}.`, `${t} chục là ${t * 10}, ${u} đơn vị là ${u}.`, `${h * 100} + ${t * 10} + ${u} = ${v}.`],
  });
}

/* ------------------------------------------------------------------ */
/* SO SÁNH                                                              */
/* ------------------------------------------------------------------ */
function distinctInts(k: number, lo: number, hi: number): number[] {
  const R = rand();
  const set = new Set<number>();
  let guard = 0;
  while (set.size < k && guard++ < 1000) set.add(R.int(lo, hi));
  return [...set];
}

export function genCompare(level: number, o: GenOptions): Question {
  const R = rand();
  if (level === 1) {
    const [a, b] = distinctInts(2, 1, 10);
    const big = Math.max(a, b);
    return makeQ({
      topic: 'compare',
      level,
      prompt: 'Số nào lớn hơn?',
      visual: { kind: 'compare', values: [String(a), String(b)], style: 'balls' },
      choices: [a, b].map((v) => ({ label: String(v), value: String(v) })),
      answer: String(big),
      hint: 'Số nào đứng sau khi đếm 1, 2, 3… thì lớn hơn.',
      steps: [`Đếm: 1, 2, 3… ${Math.min(a, b)} đến trước, ${big} đến sau.`, `Số đến sau thì lớn hơn.`, `Vậy ${big} lớn hơn ${Math.min(a, b)}.`],
    });
  }
  if (level === 2) {
    const count = o.support ? 3 : o.grade <= 1 ? 3 : 4;
    const vals = distinctInts(count, 1, 20);
    const wantMax = R.chance(0.65);
    const target = wantMax ? Math.max(...vals) : Math.min(...vals);
    const sorted = [...vals].sort((x, y) => x - y);
    return makeQ({
      topic: 'compare',
      level,
      prompt: wantMax ? 'Chọn số lớn nhất.' : 'Chọn số bé nhất.',
      visual: { kind: 'compare', values: vals.map(String), style: 'stones' },
      choices: vals.map((v) => ({ label: String(v), value: String(v) })),
      answer: String(target),
      hint: 'So sánh hàng chục trước, rồi đến hàng đơn vị.',
      steps: [`Xếp các số từ bé đến lớn: ${sorted.join(', ')}.`, wantMax ? `Số cuối cùng là lớn nhất.` : `Số đầu tiên là bé nhất.`, `Đáp án: ${target}.`],
    });
  }
  if (level === 3) {
    let a = R.int(10, 99);
    let b = R.int(10, 99);
    if (R.chance(0.15)) b = a;
    else if (R.chance(0.4)) b = Number(String(a).split('').reverse().join('')) || b;
    if (a === b && R.chance(0.5)) a = Math.min(99, a + 1);
    const sign = a > b ? '>' : a < b ? '<' : '=';
    return makeQ({
      topic: 'compare',
      level,
      prompt: `${a} ☐ ${b}`,
      speech: `Điền dấu thích hợp: ${a} và ${b}.`,
      context: 'Chọn dấu thích hợp:',
      choices: ['>', '<', '='].map((s) => ({ label: s, value: s })),
      answer: sign,
      hint: 'So sánh chữ số hàng chục trước. Nếu bằng nhau thì so sánh hàng đơn vị.',
      steps: [
        `Hàng chục: ${Math.floor(a / 10)} và ${Math.floor(b / 10)}.`,
        Math.floor(a / 10) === Math.floor(b / 10) ? `Hàng chục bằng nhau, so sánh hàng đơn vị: ${a % 10} và ${b % 10}.` : `Số có hàng chục lớn hơn thì lớn hơn.`,
        `Vậy ${a} ${sign} ${b}.`,
      ],
    });
  }
  if (level === 4) {
    const t = R.int(12, 60);
    const n = choiceCount(o.grade, o.support);
    const bigger = R.int(t + 1, t + 9);
    const smaller = distinctInts(n - 1, Math.max(1, t - 12), t);
    const vals = R.shuffle([bigger, ...smaller]);
    return makeQ({
      topic: 'compare',
      level,
      prompt: `Số nào lớn hơn ${t}?`,
      visual: { kind: 'compare', values: vals.map(String), style: 'balls' },
      choices: vals.map((v) => ({ label: String(v), value: String(v) })),
      answer: String(bigger),
      hint: `Tìm số đứng sau ${t} khi đếm.`,
      steps: [`Lần lượt so sánh từng số với ${t}.`, `${smaller.join(', ')} đều không lớn hơn ${t}.`, `${bigger} > ${t}. Đáp án: ${bigger}.`],
    });
  }
  const hi = level === 5 ? 999 : 99999;
  const lo = level === 5 ? 100 : 10000;
  const base = R.int(lo, hi);
  const n = choiceCount(o.grade, o.support);
  const ds = String(base).split('');
  const set = new Set<number>([base]);
  let guard = 0;
  while (set.size < n && guard++ < 200) {
    const arr = [...ds];
    const i = R.int(0, arr.length - 1);
    const j = R.int(0, arr.length - 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const v = Number(arr.join(''));
    if (arr[0] !== '0' && v >= lo && v <= hi && !set.has(v)) set.add(v);
    else set.add(Math.min(hi, Math.max(lo, base + R.int(-90, 90))));
  }
  const vals = R.shuffle([...set]);
  const wantMax = R.chance(0.6);
  const target = wantMax ? Math.max(...vals) : Math.min(...vals);
  return makeQ({
    topic: 'compare',
    level,
    prompt: wantMax ? 'Số nào lớn nhất?' : 'Số nào bé nhất?',
    choices: vals.map((v) => ({ label: fmt(v), value: fmt(v) })),
    answer: fmt(target),
    hint: 'Các số có cùng số chữ số: so sánh từng hàng từ trái sang phải.',
    steps: [`So sánh chữ số đầu tiên bên trái của mỗi số.`, `Nếu bằng nhau, so sánh tiếp chữ số kế tiếp.`, `Đáp án: ${fmt(target)}.`],
  });
}

/* ------------------------------------------------------------------ */
/* CỘNG – TRỪ                                                           */
/* ------------------------------------------------------------------ */
function addOperands(level: number): [number, number] {
  const R = rand();
  switch (level) {
    case 1: {
      const a = R.int(1, 4);
      return [a, R.int(1, 5 - a)];
    }
    case 2: {
      const a = R.int(2, 8);
      return [a, R.int(1, 10 - a)];
    }
    case 3: {
      const a = R.int(4, 9);
      return [a, R.int(11 - a, 9)];
    }
    case 4: {
      const a = R.int(10, 19);
      const b = R.int(2, 9);
      return R.chance(0.5) ? [a, b] : [R.int(1, 3) * 10 + R.int(0, 5), R.int(1, 4) + 3];
    }
    case 5: {
      const a1 = R.int(1, 6);
      const b1 = R.int(1, 8 - a1);
      const a0 = R.int(0, 8);
      const b0 = R.int(0, 9 - a0);
      return [a1 * 10 + a0, b1 * 10 + b0];
    }
    case 6: {
      const a0 = R.int(2, 9);
      const b0 = R.int(10 - a0, 9);
      const a1 = R.int(1, 6);
      const b1 = R.int(1, 8 - a1);
      return [a1 * 10 + a0, b1 * 10 + b0];
    }
    case 7: {
      const a = R.int(100, 699);
      return [a, R.int(100, 999 - a)];
    }
    default: {
      const a = R.int(1000, 59999);
      return [a, R.int(1000, 99999 - a)];
    }
  }
}

function subOperands(level: number): [number, number] {
  const R = rand();
  switch (level) {
    case 1: {
      const a = R.int(2, 5);
      return [a, R.int(1, a - 1)];
    }
    case 2: {
      const a = R.int(5, 10);
      return [a, R.int(1, a - 1)];
    }
    case 3: {
      const a = R.int(11, 18);
      return [a, R.int(a - 9, 9)];
    }
    case 4: {
      const a = R.int(20, 50);
      return [a, R.int(2, 9)];
    }
    case 5: {
      const a1 = R.int(3, 9);
      const b1 = R.int(1, a1 - 1);
      const a0 = R.int(1, 9);
      const b0 = R.int(0, a0);
      return [a1 * 10 + a0, b1 * 10 + b0];
    }
    case 6: {
      const a1 = R.int(3, 9);
      const b1 = R.int(1, a1 - 1);
      const a0 = R.int(0, 8);
      const b0 = R.int(a0 + 1, 9);
      return [a1 * 10 + a0, b1 * 10 + b0];
    }
    case 7: {
      const a = R.int(300, 999);
      return [a, R.int(100, a - 50)];
    }
    default: {
      const a = R.int(10000, 99999);
      return [a, R.int(1000, a - 500)];
    }
  }
}

function visualForArith(a: number, b: number, op: '+' | '-', o: GenOptions, level: number): Visual | undefined {
  const R = rand();
  const total = op === '+' ? a + b : a;
  if (total <= 20 && (level <= 3 || o.support)) {
    const item = R.pick(COUNT_ITEMS);
    return op === '+' ? { kind: 'objects', emoji: item.emoji, groups: [a, b], op: '+' } : { kind: 'objects', emoji: item.emoji, groups: [a], op: '-', crossOut: b };
  }
  if (total <= 100 && (o.support || o.grade <= 2)) return { kind: 'blocks', numbers: [a, b], op };
  return undefined;
}

export function genAdd(level: number, o: GenOptions): Question {
  const [a, b] = addOperands(level);
  const s = a + b;
  const n = choiceCount(o.grade, o.support);
  const c = numChoices(s, [s + 1, s - 1, s + 10, s - 10, s + 2, a - b > 0 ? a - b : s + 3], n, { min: 0 });
  return makeQ({
    topic: 'add',
    level,
    prompt: `${fmt(a)} + ${fmt(b)} = ?`,
    visual: visualForArith(a, b, '+', o, level),
    ...c,
    hint: s <= 20 ? 'Hãy đếm từng nhóm rồi gộp lại.' : 'Cộng hàng đơn vị trước, nhớ sang hàng chục nếu cần.',
    steps: addSteps(a, b),
  });
}

export function genSub(level: number, o: GenOptions): Question {
  const [a, b] = subOperands(level);
  const d = a - b;
  const n = choiceCount(o.grade, o.support);
  const c = numChoices(d, [d + 1, d - 1, d + 10, d - 10, a + b, d + 2], n, { min: 0 });
  return makeQ({
    topic: 'sub',
    level,
    prompt: `${fmt(a)} ${MINUS} ${fmt(b)} = ?`,
    visual: visualForArith(a, b, '-', o, level),
    ...c,
    hint: a <= 20 ? `Bắt đầu từ ${a} rồi đếm lùi ${b} bước.` : 'Trừ hàng đơn vị trước; không trừ được thì mượn 1 chục.',
    steps: subSteps(a, b),
  });
}

/* ------------------------------------------------------------------ */
/* NHÂN – CHIA                                                          */
/* ------------------------------------------------------------------ */
function mulOperands(level: number): [number, number] {
  const R = rand();
  switch (level) {
    case 1:
      return [R.pick([2, 3, 5]), R.int(2, 4)];
    case 2:
      return [R.pick([2, 5]), R.int(1, 10)];
    case 3:
      return [R.int(2, 5), R.int(2, 10)];
    case 4:
      return [R.int(6, 9), R.int(2, 10)];
    case 5:
      return [R.int(2, 10), R.int(2, 10)];
    case 6:
      return [R.int(12, 99), R.int(2, 9)];
    default:
      return R.chance(0.5) ? [R.int(102, 999), R.int(2, 9)] : [R.int(12, 99), R.int(11, 39)];
  }
}

export function genMul(level: number, o: GenOptions): Question {
  const R = rand();
  const [a, b] = mulOperands(level);
  const p = a * b;
  const n = choiceCount(o.grade, o.support);
  const c = numChoices(p, [a * (b + 1), a * (b - 1), (a + 1) * b, a + b, p + 10, p - 10], n, { min: 0 });
  const item = R.pick(COUNT_ITEMS);
  const visual = a <= 6 && b <= 6 && (level <= 2 || o.support) ? ({ kind: 'groups', emoji: item.emoji, groups: b, each: a } as const) : undefined;
  return makeQ({
    topic: 'mul',
    level,
    prompt: `${fmt(a)} ${TIMES} ${b} = ?`,
    context: level === 1 ? `Có ${b} nhóm, mỗi nhóm ${a} ${item.name}.` : undefined,
    visual,
    ...c,
    hint: a <= 10 && b <= 10 ? `Hãy đếm từng nhóm: ${a} được lấy ${b} lần.` : 'Nhân từ hàng đơn vị, nhớ sang hàng tiếp theo.',
    steps: mulSteps(a, b),
  });
}

export function genDiv(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  let b: number;
  let q: number;
  switch (level) {
    case 1:
      b = R.pick([2, 3]);
      q = R.int(2, 4);
      break;
    case 2:
      b = R.pick([2, 5]);
      q = R.int(1, 10);
      break;
    case 3:
      b = R.int(2, 5);
      q = R.int(2, 10);
      break;
    case 4:
      b = R.int(6, 9);
      q = R.int(2, 10);
      break;
    case 5: {
      b = R.int(3, 9);
      q = R.int(2, 9);
      const r = R.int(1, b - 1);
      const a = b * q + r;
      const ans = `${q} dư ${r}`;
      const opts = [`${q} dư ${r === 1 ? 2 : r - 1}`, `${q + 1} dư ${r}`, `${q - 1} dư ${r}`, `${q}`, `${q + 1}`];
      const c = textChoices(ans, opts, n);
      return makeQ({
        topic: 'div',
        level,
        prompt: `${a} ${DIVIDE} ${b} = ?`,
        speech: `${a} chia ${b} bằng mấy, dư mấy?`,
        ...c,
        hint: `Tìm số lớn nhất nhân với ${b} mà không vượt quá ${a}. Số dư luôn bé hơn ${b}.`,
        steps: divSteps(a, b),
      });
    }
    case 6:
      b = R.int(2, 9);
      q = R.int(12, 99);
      break;
    default:
      b = R.int(11, 29);
      q = R.int(12, 45);
  }
  const a = b * q;
  const c = numChoices(q, [q + 1, q - 1, q + 2, b, q + 10], n, { min: 1 });
  const item = R.pick(COUNT_ITEMS);
  const visual = a <= 20 && (level <= 1 || o.support) ? ({ kind: 'share', emoji: item.emoji, total: a, parts: b } as const) : undefined;
  return makeQ({
    topic: 'div',
    level,
    prompt: `${fmt(a)} ${DIVIDE} ${b} = ?`,
    context: level === 1 ? `Chia đều ${a} ${item.name} cho ${b} bạn. Mỗi bạn được mấy ${item.name}?` : undefined,
    visual,
    ...c,
    hint: q <= 10 && b <= 10 ? `Nhẩm bảng nhân ${b}: ${b} nhân mấy bằng ${a}?` : 'Chia lần lượt từ trái sang phải.',
    steps: divSteps(a, b),
  });
}

/* ------------------------------------------------------------------ */
/* DÃY SỐ                                                               */
/* ------------------------------------------------------------------ */
export function genSequence(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  let start: number;
  let rule: (i: number) => number;
  let ruleTxt: string;
  let step = 1;
  switch (level) {
    case 1:
      start = R.int(1, 5);
      rule = (i) => start + i;
      ruleTxt = 'Mỗi số hơn số trước 1 đơn vị.';
      break;
    case 2:
      step = R.pick([2, 5, 10]);
      start = step === 10 ? R.int(1, 5) * 10 : step === 5 ? R.int(0, 6) * 5 : R.int(0, 10);
      rule = (i) => start + i * step;
      ruleTxt = `Mỗi số hơn số trước ${step} đơn vị.`;
      break;
    case 3:
      if (R.chance(0.5)) {
        step = R.pick([2, 3, 5, 10]);
        start = R.int(step * 5, step * 5 + 30);
        rule = (i) => start - i * step;
        ruleTxt = `Mỗi số kém số trước ${step} đơn vị.`;
      } else {
        step = R.pick([3, 4]);
        start = R.int(1, 10);
        rule = (i) => start + i * step;
        ruleTxt = `Mỗi số hơn số trước ${step} đơn vị.`;
      }
      break;
    case 4:
      if (R.chance(0.5)) {
        start = R.int(1, 5);
        rule = (i) => start * 2 ** i;
        ruleTxt = 'Mỗi số gấp đôi số trước.';
        step = start;
      } else {
        step = R.int(6, 12);
        start = R.int(1, 20);
        rule = (i) => start + i * step;
        ruleTxt = `Mỗi số hơn số trước ${step} đơn vị.`;
      }
      break;
    default:
      if (R.chance(0.5)) {
        step = R.pick([25, 50, 100, 250]);
        start = R.int(1, 8) * step;
        rule = (i) => start + i * step;
        ruleTxt = `Mỗi số hơn số trước ${step} đơn vị.`;
      } else {
        start = R.int(1, 4);
        rule = (i) => start * 3 ** i;
        ruleTxt = 'Mỗi số gấp 3 lần số trước.';
        step = start * 2;
      }
  }
  const len = 5;
  const items = Array.from({ length: len }, (_, i) => rule(i));
  const missing = R.int(1, len - 1);
  const ans = items[missing];
  const shown = items.map((v, i) => (i === missing ? null : fmt(v)));
  const c = numChoices(ans, [ans + 1, ans - 1, ans + step, ans - step, ans + 2], n, { min: 0 });
  const pair = missing >= 2 ? items.slice(0, 2) : items.slice(2, 4);
  return makeQ({
    topic: 'sequence',
    level,
    prompt: 'Số nào còn thiếu?',
    speech: `Dãy số: ${shown.map((s) => s ?? 'mấy').join(', ')}. Số nào còn thiếu?`,
    visual: { kind: 'sequence', items: shown },
    ...c,
    hint: 'Xem hai số cạnh nhau hơn kém nhau bao nhiêu.',
    steps: [`Quan sát hai số cạnh nhau: ${pair.map(fmt).join(' → ')}.`, ruleTxt, `Số còn thiếu là ${fmt(ans)}.`],
  });
}
