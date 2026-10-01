import type { GenOptions, Question, ShapeName } from '../types';
import { DIVIDE, TIMES, choiceCount, fmt, makeQ, numChoices, rand, round, textChoices } from '../util';

export const SHAPE_NAMES: Record<ShapeName, string> = {
  circle: 'Hình tròn',
  square: 'Hình vuông',
  triangle: 'Hình tam giác',
  rectangle: 'Hình chữ nhật',
  pentagon: 'Hình ngũ giác',
  hexagon: 'Hình lục giác',
  oval: 'Hình bầu dục',
  star: 'Hình ngôi sao',
  diamond: 'Hình thoi',
};

const SIDES: Partial<Record<ShapeName, number>> = { triangle: 3, square: 4, rectangle: 4, diamond: 4, pentagon: 5, hexagon: 6 };

const SOLIDS = {
  cube: 'Khối lập phương',
  box: 'Khối hộp chữ nhật',
  cylinder: 'Khối trụ',
  sphere: 'Khối cầu',
} as const;

const PROPERTY_BANK: { q: string; a: string; alts: string[]; hint: string; why: string }[] = [
  { q: 'Hình nào có 4 cạnh bằng nhau và 4 góc vuông?', a: 'Hình vuông', alts: ['Hình chữ nhật', 'Hình thoi', 'Hình tam giác'], hint: 'Hình này vừa có 4 góc vuông, vừa có 4 cạnh dài bằng nhau.', why: 'Hình vuông có 4 cạnh bằng nhau và 4 góc vuông.' },
  { q: 'Hình chữ nhật có mấy góc vuông?', a: '4', alts: ['2', '3', '1'], hint: 'Đếm các góc ở 4 đỉnh của hình chữ nhật.', why: 'Cả 4 góc của hình chữ nhật đều là góc vuông.' },
  { q: 'Hình thoi có mấy cạnh bằng nhau?', a: '4', alts: ['2', '3', '6'], hint: 'Hình thoi giống hình vuông bị nghiêng.', why: 'Hình thoi có 4 cạnh bằng nhau.' },
  { q: 'Góc vuông bằng bao nhiêu độ?', a: '90°', alts: ['180°', '45°', '60°'], hint: 'Góc vuông giống góc của trang vở.', why: 'Góc vuông bằng 90°.' },
  { q: 'Góc bẹt bằng bao nhiêu độ?', a: '180°', alts: ['90°', '360°', '120°'], hint: 'Góc bẹt có hai cạnh nằm trên một đường thẳng.', why: 'Góc bẹt bằng 2 góc vuông: 90° + 90° = 180°.' },
  { q: 'Hình lập phương có mấy mặt?', a: '6', alts: ['4', '8', '12'], hint: 'Hãy nghĩ tới con xúc xắc: mỗi mặt có một số chấm từ 1 đến 6.', why: 'Hình lập phương có 6 mặt là các hình vuông bằng nhau.' },
  { q: 'Hình lập phương có mấy đỉnh?', a: '8', alts: ['6', '4', '12'], hint: 'Đếm 4 đỉnh mặt trên và 4 đỉnh mặt dưới.', why: 'Mặt trên 4 đỉnh + mặt dưới 4 đỉnh = 8 đỉnh.' },
  { q: 'Đường kính dài gấp mấy lần bán kính?', a: '2', alts: ['3', '4', '1'], hint: 'Đường kính đi qua tâm, gồm hai bán kính.', why: 'Đường kính = bán kính × 2.' },
  { q: 'Hình bình hành có mấy cặp cạnh đối diện song song?', a: '2', alts: ['1', '3', '4'], hint: 'Xét cặp cạnh trên – dưới và cặp cạnh trái – phải.', why: 'Hình bình hành có 2 cặp cạnh đối diện song song và bằng nhau.' },
  { q: 'Hình tam giác có mấy đỉnh?', a: '3', alts: ['4', '2', '5'], hint: 'Đỉnh là chỗ hai cạnh gặp nhau.', why: 'Hình tam giác có 3 cạnh và 3 đỉnh.' },
];

export function genGeometry(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  if (level === 1) {
    const basics: ShapeName[] = ['circle', 'square', 'triangle', 'rectangle'];
    const s = R.pick(basics);
    const extra: ShapeName[] = o.grade >= 2 ? ['oval', 'diamond', 'star'] : ['star'];
    const c = textChoices(SHAPE_NAMES[s], [...basics, ...extra].map((x) => SHAPE_NAMES[x]), n);
    return makeQ({
      topic: 'geometry',
      level,
      prompt: 'Đây là hình gì?',
      visual: { kind: 'shape', shape: s },
      ...c,
      hint: s === 'circle' ? 'Hình này tròn đều, không có góc.' : `Đếm số cạnh: hình này có ${SIDES[s]} cạnh.`,
      steps: s === 'circle' ? ['Hình không có cạnh thẳng, không có góc.', 'Hình tròn đều như cái đĩa.', 'Đó là hình tròn.'] : [`Hình có ${SIDES[s]} cạnh.`, s === 'square' ? '4 cạnh dài bằng nhau.' : s === 'rectangle' ? '2 cạnh dài, 2 cạnh ngắn.' : '3 cạnh, 3 góc.', `Đó là ${SHAPE_NAMES[s].toLowerCase()}.`],
    });
  }
  if (level === 2) {
    const s = R.pick<ShapeName>(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon']);
    const k = SIDES[s]!;
    const askSides = R.chance(0.5);
    const c = numChoices(k, [k + 1, k - 1, k + 2], n, { min: 3 });
    return makeQ({
      topic: 'geometry',
      level,
      prompt: askSides ? 'Hình này có mấy cạnh?' : 'Hình này có mấy đỉnh (góc)?',
      visual: { kind: 'shape', shape: s },
      ...c,
      hint: askSides ? 'Chạm vào từng cạnh thẳng và đếm.' : 'Đỉnh là chỗ hai cạnh gặp nhau. Đếm từng đỉnh.',
      steps: [`Bắt đầu từ một ${askSides ? 'cạnh' : 'đỉnh'} và đi vòng quanh hình.`, `Đếm: ${Array.from({ length: k }, (_, i) => i + 1).join(', ')}.`, `Hình có ${k} ${askSides ? 'cạnh' : 'đỉnh'}.`],
    });
  }
  if (level === 3) {
    if (R.chance(0.5)) {
      const solid = R.pick(Object.keys(SOLIDS) as (keyof typeof SOLIDS)[]);
      const c = textChoices(SOLIDS[solid], Object.values(SOLIDS), n);
      const hints = { cube: 'Mọi mặt đều là hình vuông, giống con xúc xắc.', box: 'Giống hộp sữa, cái tủ: các mặt là hình chữ nhật.', cylinder: 'Giống lon nước: hai đáy là hình tròn.', sphere: 'Tròn đều mọi phía, giống quả bóng.' };
      return makeQ({ topic: 'geometry', level, prompt: 'Đây là khối gì?', visual: { kind: 'solid', solid }, ...c, hint: hints[solid], steps: [hints[solid], `Đó là ${SOLIDS[solid].toLowerCase()}.`] });
    }
    const target = R.pick<ShapeName>(['triangle', 'square', 'circle']);
    const others: ShapeName[] = (['triangle', 'square', 'circle', 'rectangle', 'star'] as ShapeName[]).filter((x) => x !== target);
    const k = R.int(2, 6);
    const total = R.int(Math.max(7, k + 2), 10);
    const shapes = R.shuffle([...Array(k).fill(target), ...Array.from({ length: total - k }, () => R.pick(others))]);
    const c = numChoices(k, [k + 1, k - 1, total - k, k + 2], n, { min: 0 });
    return makeQ({
      topic: 'geometry',
      level,
      prompt: `Có bao nhiêu ${SHAPE_NAMES[target].toLowerCase()}?`,
      visual: { kind: 'shapes', shapes },
      ...c,
      hint: 'Chỉ đếm những hình giống nhau, bỏ qua các hình khác.',
      steps: [`Tìm từng ${SHAPE_NAMES[target].toLowerCase()} từ trái sang phải.`, `Đếm: ${Array.from({ length: k }, (_, i) => i + 1).join(', ')}.`, `Có ${k} ${SHAPE_NAMES[target].toLowerCase()}.`],
    });
  }
  if (level === 4) {
    const kind = R.pick(['vuông', 'nhọn', 'tù', 'bẹt'] as const);
    const deg = kind === 'vuông' ? 90 : kind === 'nhọn' ? R.int(25, 70) : kind === 'tù' ? R.int(110, 160) : 180;
    const c = textChoices(`Góc ${kind}`, ['Góc vuông', 'Góc nhọn', 'Góc tù', 'Góc bẹt'], Math.min(4, n));
    return makeQ({
      topic: 'geometry',
      level,
      prompt: 'Đây là góc gì?',
      visual: { kind: 'angle', degrees: deg },
      ...c,
      hint: 'So sánh với góc vuông (góc của trang vở): nhỏ hơn là góc nhọn, lớn hơn là góc tù.',
      steps: ['Đặt góc vuông của ê-ke vào góc.', kind === 'vuông' ? 'Hai cạnh trùng khít ê-ke.' : kind === 'nhọn' ? 'Góc nhỏ hơn góc vuông.' : kind === 'tù' ? 'Góc lớn hơn góc vuông nhưng chưa thẳng hàng.' : 'Hai cạnh nằm trên một đường thẳng.', `Đó là góc ${kind}.`],
    });
  }
  const p = R.pick(PROPERTY_BANK);
  const c = textChoices(p.a, p.alts, n);
  return makeQ({ topic: 'geometry', level, prompt: p.q, ...c, hint: p.hint, steps: [p.why, `Đáp án: ${p.a}.`] });
}

/* ------------------------------------------------------------------ */
/* CHU VI                                                               */
/* ------------------------------------------------------------------ */
export function genPerimeter(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  const cm = (v: number) => `${fmt(v)} cm`;
  if (level === 1) {
    const a = R.int(3, 9);
    let b = R.int(2, 8);
    if (b >= a) b = a - 1;
    const ans = (a + b) * 2;
    const c = numChoices(ans, [a * b, a + b, ans + 2, ans - 2], n, { format: cm, min: 1 });
    return makeQ({
      topic: 'perimeter',
      level,
      prompt: 'Chu vi hình chữ nhật là bao nhiêu?',
      visual: { kind: 'rect', w: a, h: b, unit: 'cm' },
      ...c,
      hint: 'Chu vi là tổng độ dài 4 cạnh: (dài + rộng) × 2.',
      steps: [`Chiều dài ${a} cm, chiều rộng ${b} cm.`, `(${a} + ${b}) ${TIMES} 2 = ${a + b} ${TIMES} 2 = ${ans}.`, `Chu vi là ${ans} cm.`],
    });
  }
  if (level === 2) {
    const a = R.int(2, 12);
    const ans = a * 4;
    const c = numChoices(ans, [a * a, a * 2, ans + 4, ans - 4, a + 4], n, { format: cm, min: 1 });
    return makeQ({
      topic: 'perimeter',
      level,
      prompt: 'Chu vi hình vuông là bao nhiêu?',
      visual: { kind: 'rect', w: a, h: a, unit: 'cm', square: true },
      ...c,
      hint: 'Hình vuông có 4 cạnh bằng nhau: cạnh × 4.',
      steps: [`Cạnh hình vuông dài ${a} cm.`, `${a} ${TIMES} 4 = ${ans}.`, `Chu vi là ${ans} cm.`],
    });
  }
  if (level === 3) {
    const a = R.int(3, 15);
    const b = R.int(3, 15);
    const lo = Math.abs(a - b) + 1;
    const cc = R.int(lo, Math.min(a + b - 1, 15));
    const ans = a + b + cc;
    const c = numChoices(ans, [ans + 1, ans - 1, a * b, ans + 10], n, { format: cm, min: 1 });
    return makeQ({
      topic: 'perimeter',
      level,
      prompt: 'Chu vi hình tam giác là bao nhiêu?',
      visual: { kind: 'triangle', a, b, c: cc, unit: 'cm' },
      ...c,
      hint: 'Cộng độ dài ba cạnh.',
      steps: [`Ba cạnh dài ${a} cm, ${b} cm, ${cc} cm.`, `${a} + ${b} + ${cc} = ${ans}.`, `Chu vi là ${ans} cm.`],
    });
  }
  if (level === 4) {
    if (R.chance(0.5)) {
      const a = R.int(3, 15);
      const P = a * 4;
      const c = numChoices(a, [a + 1, a - 1, P / 2, a * 2], n, { format: cm, min: 1 });
      return makeQ({
        topic: 'perimeter',
        level,
        context: `Một hình vuông có chu vi ${P} cm.`,
        prompt: 'Cạnh hình vuông dài bao nhiêu?',
        visual: { kind: 'rect', w: a, h: a, unit: '?', square: true },
        ...c,
        hint: 'Chu vi hình vuông = cạnh × 4, nên cạnh = chu vi : 4.',
        steps: [`Cạnh = chu vi ${DIVIDE} 4.`, `${P} ${DIVIDE} 4 = ${a}.`, `Cạnh dài ${a} cm.`],
      });
    }
    const a = R.int(6, 20);
    const b = R.int(2, a - 1);
    const P = (a + b) * 2;
    const c = numChoices(b, [b + 1, b - 1, P / 2, P - a], n, { format: cm, min: 1 });
    return makeQ({
      topic: 'perimeter',
      level,
      context: `Hình chữ nhật có chu vi ${P} cm, chiều dài ${a} cm.`,
      prompt: 'Chiều rộng là bao nhiêu?',
      ...c,
      hint: 'Nửa chu vi = dài + rộng.',
      steps: [`Nửa chu vi: ${P} ${DIVIDE} 2 = ${P / 2} cm.`, `Chiều rộng: ${P / 2} − ${a} = ${b} cm.`],
    });
  }
  if (R.chance(0.5)) {
    const d = R.int(2, 10);
    const ans = round(d * 3.14);
    const c = numChoices(ans, [round(d * 3.14 * 2), round(d * d * 3.14), round((d / 2) * 3.14), round(ans + 1)], n, { format: cm, integer: false, step: 1 });
    return makeQ({
      topic: 'perimeter',
      level,
      prompt: `Hình tròn có đường kính ${d} cm. Chu vi bằng bao nhiêu?`,
      visual: { kind: 'circle', r: d / 2, unit: 'cm', showDiameter: true },
      ...c,
      hint: 'Chu vi hình tròn = đường kính × 3,14.',
      steps: [`C = d ${TIMES} 3,14.`, `${d} ${TIMES} 3,14 = ${fmt(ans)}.`, `Chu vi là ${fmt(ans)} cm.`],
    });
  }
  const a = R.int(12, 60);
  const b = R.int(8, a - 1);
  const ans = (a + b) * 2;
  const c = numChoices(ans, [a * b, a + b, ans + 10, ans - 10], n, { format: (v) => `${fmt(v)} m`, min: 1 });
  return makeQ({
    topic: 'perimeter',
    level,
    context: `Một mảnh vườn hình chữ nhật dài ${a} m, rộng ${b} m.`,
    prompt: 'Chu vi mảnh vườn là bao nhiêu?',
    visual: { kind: 'rect', w: a, h: b, unit: 'm' },
    ...c,
    hint: 'Chu vi hình chữ nhật = (dài + rộng) × 2.',
    steps: [`(${a} + ${b}) ${TIMES} 2 = ${a + b} ${TIMES} 2 = ${ans}.`, `Chu vi là ${ans} m.`],
  });
}

/* ------------------------------------------------------------------ */
/* DIỆN TÍCH                                                            */
/* ------------------------------------------------------------------ */
export function genArea(level: number, o: GenOptions): Question {
  const R = rand();
  const n = choiceCount(o.grade, o.support);
  const cm2 = (v: number) => `${fmt(v)} cm²`;
  if (level === 1) {
    const w = R.int(2, 6);
    const h = R.int(2, 5);
    const ans = w * h;
    const c = numChoices(ans, [w + h, (w + h) * 2, ans + 1, ans - 1, ans + w], n, { format: (v) => `${v} ô`, min: 1 });
    return makeQ({
      topic: 'area',
      level,
      prompt: 'Hình chữ nhật gồm bao nhiêu ô vuông?',
      visual: { kind: 'rect', w, h, unit: 'ô', grid: true },
      ...c,
      hint: `Có ${h} hàng, mỗi hàng ${w} ô. Hãy đếm từng hàng.`,
      steps: [`Mỗi hàng có ${w} ô.`, `Có ${h} hàng: ${w} ${TIMES} ${h} = ${ans}.`, `Hình gồm ${ans} ô vuông.`],
    });
  }
  if (level === 2) {
    const a = R.int(3, 12);
    const b = R.int(2, Math.min(9, a));
    const ans = a * b;
    const c = numChoices(ans, [(a + b) * 2, a + b, ans + a, ans - b], n, { format: cm2, min: 1 });
    return makeQ({
      topic: 'area',
      level,
      prompt: 'Diện tích hình chữ nhật là bao nhiêu?',
      visual: { kind: 'rect', w: a, h: b, unit: 'cm' },
      ...c,
      hint: 'Diện tích hình chữ nhật = dài × rộng.',
      steps: [`Chiều dài ${a} cm, chiều rộng ${b} cm.`, `${a} ${TIMES} ${b} = ${ans}.`, `Diện tích là ${ans} cm².`],
    });
  }
  if (level === 3) {
    const a = R.int(2, 12);
    const ans = a * a;
    const c = numChoices(ans, [a * 4, a * 2, ans + a, ans - a], n, { format: cm2, min: 1 });
    return makeQ({
      topic: 'area',
      level,
      prompt: 'Diện tích hình vuông là bao nhiêu?',
      visual: { kind: 'rect', w: a, h: a, unit: 'cm', square: true },
      ...c,
      hint: 'Diện tích hình vuông = cạnh × cạnh.',
      steps: [`Cạnh dài ${a} cm.`, `${a} ${TIMES} ${a} = ${ans}.`, `Diện tích là ${ans} cm².`],
    });
  }
  if (level === 4) {
    if (R.chance(0.5)) {
      let a = R.int(4, 16);
      const h = R.int(3, 12);
      if ((a * h) % 2) a += 1;
      const ans = (a * h) / 2;
      const c = numChoices(ans, [a * h, a + h, ans + h, (a + h) * 2], n, { format: cm2, min: 1 });
      return makeQ({
        topic: 'area',
        level,
        prompt: `Tam giác có đáy ${a} cm, chiều cao ${h} cm. Diện tích là bao nhiêu?`,
        visual: { kind: 'triangle', a, b: 0, c: 0, unit: 'cm', height: h },
        ...c,
        hint: 'Diện tích tam giác = đáy × chiều cao : 2.',
        steps: [`${a} ${TIMES} ${h} = ${a * h}.`, `${a * h} ${DIVIDE} 2 = ${ans}.`, `Diện tích là ${ans} cm².`],
      });
    }
    const a = R.int(4, 15);
    const b = R.int(2, 9);
    const S = a * b;
    const c = numChoices(b, [b + 1, b - 1, S - a, a], n, { format: (v) => `${v} cm`, min: 1 });
    return makeQ({
      topic: 'area',
      level,
      context: `Hình chữ nhật có diện tích ${S} cm², chiều dài ${a} cm.`,
      prompt: 'Chiều rộng là bao nhiêu?',
      ...c,
      hint: 'Chiều rộng = diện tích : chiều dài.',
      steps: [`Chiều rộng = ${S} ${DIVIDE} ${a}.`, `${S} ${DIVIDE} ${a} = ${b}.`, `Chiều rộng là ${b} cm.`],
    });
  }
  const r = R.int(1, 10);
  const ans = round(r * r * 3.14);
  const c = numChoices(ans, [round(r * 2 * 3.14), round(r * 3.14), round(ans + 3.14), round(r * r * 4)], n, { format: cm2, integer: false, step: 1 });
  return makeQ({
    topic: 'area',
    level,
    prompt: `Hình tròn có bán kính ${r} cm. Diện tích là bao nhiêu?`,
    visual: { kind: 'circle', r, unit: 'cm' },
    ...c,
    hint: 'Diện tích hình tròn = bán kính × bán kính × 3,14.',
    steps: [`S = r ${TIMES} r ${TIMES} 3,14.`, `${r} ${TIMES} ${r} = ${r * r}; ${r * r} ${TIMES} 3,14 = ${fmt(ans)}.`, `Diện tích là ${fmt(ans)} cm².`],
  });
}
