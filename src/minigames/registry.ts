import type { SubjectMode } from '../math/types';
import type { MiniGame, MiniHost, MiniInfo } from './base';

/** Sổ đăng ký trò chơi nhỏ. Mỗi tệp trong ./games tự gọi `defineMini`. */
export interface MiniDef {
  info: MiniInfo;
  create(host: MiniHost): MiniGame;
}

/** Tên, kĩ năng và cách chơi của trò chơi khi học Tiếng Anh. */
export interface MiniText {
  name: string;
  /** Biểu tượng riêng (mặc định: như môn Toán). */
  icon?: string;
  skill: string;
  desc: string;
}

/** Thẻ trò chơi đang hiện (sảnh, biển, màn hướng dẫn) – theo môn. `name` không kèm emoji ở đầu. */
export interface MiniCard {
  name: string;
  icon: string;
  skill: string;
  desc: string;
}

/** Thứ tự hiển thị trong sảnh trò chơi (theo kịch bản, mục 8). */
export const MINI_ORDER = [
  'number_match',
  'shoot_answer',
  'runner',
  'maze_run',
  'fishing',
  'market',
  'clock',
  'builder',
  'pizza',
  'train',
  'monkey',
  'wheel',
] as const;
export type MiniId = (typeof MINI_ORDER)[number];

const defs = new Map<string, MiniDef>();

export function defineMini(info: MiniInfo, make: (info: MiniInfo, host: MiniHost) => MiniGame): void {
  defs.set(info.id, { info, create: (host) => make(info, host) });
}

export function miniDef(id: string): MiniDef | undefined {
  return defs.get(id);
}

let modeOf: () => SubjectMode = () => 'math';

/** Nối với bộ chọn môn (minigames/index.ts): tên trò chơi hiện theo môn của hồ sơ đang chơi. */
export function setMiniMode(fn: () => SubjectMode): void {
  modeOf = fn;
}

type CardSource = Pick<MiniInfo, 'name' | 'icon'> & Partial<Pick<MiniInfo, 'skill' | 'desc' | 'en' | 'both'>>;

const noLead = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '');

/**
 * Thẻ trò chơi theo môn. 'math': đúng như trước. 'english': tên, kĩ năng, cách chơi Tiếng Anh.
 * 'both' (sảnh, biển): tên chung và kĩ năng cả hai môn – mỗi lượt chơi tự chọn một môn và hiện thẻ của môn đó.
 * Một số tên Toán có sẵn emoji ở đầu ("🧩 Ghép số…"): `name` luôn bỏ emoji đó để chỉ có đúng một biểu tượng.
 */
export function miniCard(info: CardSource, mode: SubjectMode = modeOf()): MiniCard {
  const en = info.en;
  if (en && mode === 'english') return { name: noLead(en.name), icon: en.icon ?? info.icon, skill: en.skill, desc: en.desc };
  const skill = info.skill ?? '';
  if (en && mode === 'both') {
    return { name: noLead(info.both ?? info.name), icon: info.icon, skill: `🔢 ${skill} · 🔤 ${en.skill}`, desc: info.desc ?? '' };
  }
  return { name: noLead(info.name), icon: info.icon, skill, desc: info.desc ?? '' };
}

/** Tên trò chơi (theo môn) không kèm emoji ở đầu – nơi hiện tên cạnh biểu tượng dùng hàm này. */
export function miniName(info: CardSource, mode?: SubjectMode): string {
  return miniCard(info, mode).name;
}

/** "biểu tượng + tên" (đúng một biểu tượng), ví dụ "🧩 Ghép số – nhận biết số". */
export function miniTitle(info: CardSource, mode?: SubjectMode): string {
  const c = miniCard(info, mode);
  return `${c.icon} ${c.name}`;
}

/** Tên ngắn (bỏ phần sau dấu "–"), ví dụ "Câu cá số" – dòng mở khóa khi lên cấp. */
export function miniShort(info: CardSource, mode?: SubjectMode): string {
  return miniName(info, mode).split(' – ')[0];
}

/** Những gì mở khóa ở một cấp, kèm dòng "Mini-game: …" đọc tên theo môn (Toán: đúng như trước). */
export function unlockLines(def: { unlocks: string[]; minis?: readonly string[] }, mode?: SubjectMode): string[] {
  if (!def.minis?.length) return def.unlocks;
  const names = def.minis.map((id) => {
    const d = defs.get(id);
    return d ? miniShort(d.info, mode) : id;
  });
  return [...def.unlocks, `Mini-game: ${names.join(', ')}`];
}

/** Danh sách trò chơi theo thứ tự sảnh. */
export function miniList(): MiniDef[] {
  const out: MiniDef[] = [];
  for (const id of MINI_ORDER) {
    const d = defs.get(id);
    if (d) out.push(d);
  }
  for (const [id, d] of defs) if (!(MINI_ORDER as readonly string[]).includes(id)) out.push(d);
  return out;
}
