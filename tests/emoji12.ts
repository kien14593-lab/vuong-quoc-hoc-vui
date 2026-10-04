/**
 * Quy tắc "emoji hiện được trên Windows 10": chỉ dùng emoji tới phiên bản Emoji 12.0 (font Segoe UI Emoji của
 * Windows 10 dừng ở 12.0). Emoji mới hơn (🪙 🪨 🪵 …), cờ quốc gia và các chuỗi ghép ZWJ ra đời từ 12.1 trở đi hiện
 * thành ô vuông trống trên máy trường. Dùng chung cho kiểm tra mã nguồn và kiểm tra ngân hàng từ Tiếng Anh.
 */

/** Các khoảng mã của Emoji 13.0 trở đi (kể cả các ô còn trống trong những khối đó). */
const NEW_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1f6d6, 0x1f6d8], // 🛖 🛗 …
  [0x1f6dc, 0x1f6df], // 🛜 🛝 🛞 🛟
  [0x1f6fb, 0x1f6fc], // 🛻 🛼
  [0x1f7f0, 0x1f7f0], // 🟰
  [0x1f90c, 0x1f90c], // 🤌
  [0x1f972, 0x1f972], // 🥲
  [0x1f977, 0x1f979], // 🥷 🥸 🥹
  [0x1f9a3, 0x1f9a4], // 🦣 🦤
  [0x1f9ab, 0x1f9ad], // 🦫 🦬 🦭
  [0x1f9cb, 0x1f9cc], // 🧋 🧌
  [0x1fa74, 0x1fa77], // 🩴 🩵 🩶 🩷
  [0x1fa7b, 0x1fa7f], // 🩻 🩼
  [0x1fa83, 0x1fa8f], // 🪃 🪄 🪅 🪆 🪇 🪈 …
  [0x1fa96, 0x1faff], // 🪖 … 🪙 🪨 🪵 … 🫐 … 🫶 …
  [0x26a7, 0x26a7], // ⚧
];

/** Cờ (cặp chữ cái vùng) – Windows không vẽ cờ, chỉ hiện hai chữ cái. */
const REGIONAL: readonly [number, number] = [0x1f1e6, 0x1f1ff];
/** Ký tự thẻ (cờ vùng như 🏴 England). */
const TAGS: readonly [number, number] = [0xe0020, 0xe007f];
const ZWJ = 0x200d;
const VS16 = 0xfe0f;
const isTone = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff;

/** Phần đứng sau ZWJ chỉ có từ Emoji 13.0 trở đi: 🐈‍⬛ 🐻‍❄️ 🧑‍🍼 🧑‍🎄 ❤️‍🔥 ❤️‍🩹 😮‍💨 😵‍💫 😶‍🌫️ 🍋‍🟩 🍄‍🟫 ⛓️‍💥 🙂‍↔️ 🚶‍➡️ … */
const NEW_ZWJ_TAIL = new Set([0x1f37c, 0x1f384, 0x2b1b, 0x2744, 0x1f525, 0x1fa79, 0x1f4a8, 0x1f4ab, 0x1f32b, 0x1f7e9, 0x1f7eb, 0x1f4a5, 0x2194, 0x2195, 0x27a1]);

export interface EmojiIssue {
  /** Vị trí (theo mã) trong chuỗi. */
  at: number;
  /** Ký tự / chuỗi gây lỗi. */
  text: string;
  reason: string;
}

const inRange = (cp: number, [a, b]: readonly [number, number]) => cp >= a && cp <= b;

/** Mã có phải emoji mới hơn Emoji 12.0 không (chỉ xét từng mã đơn). */
export function isNewEmoji(cp: number): boolean {
  return NEW_RANGES.some((r) => inRange(cp, r));
}

/** Liệt kê các emoji / chuỗi emoji trong `text` sẽ không hiện được trên Windows 10. */
export function emojiIssues(text: string): EmojiIssue[] {
  const cps = Array.from(text, (c) => c.codePointAt(0)!);
  const out: EmojiIssue[] = [];
  const add = (at: number, len: number, reason: string) => out.push({ at, text: String.fromCodePoint(...cps.slice(at, at + len)), reason });

  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    if (isNewEmoji(cp)) add(i, 1, 'emoji mới hơn Emoji 12.0');
    else if (inRange(cp, REGIONAL)) add(i, 1, 'cờ (Windows chỉ hiện hai chữ cái)');
    else if (inRange(cp, TAGS)) add(i, 1, 'ký tự thẻ (cờ vùng)');
    else if ((cp === 0x1f48f || cp === 0x1f491) && isTone(cps[i + 1] ?? 0)) add(i, 2, 'cặp đôi có màu da (Emoji 13.1)');
    if (cp !== ZWJ) continue;

    let p = i - 1;
    while (p >= 0 && (cps[p] === VS16 || isTone(cps[p]))) p--;
    const prev = cps[p] ?? 0;
    const next = cps[i + 1] ?? 0;
    if (prev === 0x1f9d1 && next !== 0x1f91d) add(p, i + 2 - p, 'người trung tính ghép ZWJ (Emoji 12.1+)');
    else if (prev === 0x1f9d4) add(p, i + 2 - p, 'người có râu ghép ZWJ (Emoji 13.1)');
    else if (NEW_ZWJ_TAIL.has(next)) add(p, i + 2 - p, 'chuỗi ghép ZWJ mới (Emoji 13.0+)');
  }

  // Chuỗi ghép ZWJ có màu da với ❤ / 💋 / 🤝 (cặp đôi, nắm tay khác màu da) – Emoji 12.1 / 13.1.
  let start = 0;
  for (let i = 0; i <= cps.length; i++) {
    const joined = i < cps.length && (cps[i] === ZWJ || cps[i] === VS16 || isTone(cps[i]) || cps[i - 1] === ZWJ);
    if (joined) continue;
    const seq = cps.slice(start, i);
    if (seq.includes(ZWJ) && seq.some(isTone) && seq.some((c) => c === 0x2764 || c === 0x1f48b || c === 0x1f91d)) add(start, i - start, 'chuỗi ghép có màu da (Emoji 12.1+)');
    start = i;
  }
  return out;
}
