import type { MiniGame, MiniHost, MiniInfo } from './base';

/** Sổ đăng ký trò chơi nhỏ. Mỗi tệp trong ./games tự gọi `defineMini`. */
export interface MiniDef {
  info: MiniInfo;
  create(host: MiniHost): MiniGame;
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

/**
 * Tên trò chơi không kèm emoji ở đầu. Một số tên có sẵn emoji (ví dụ "🧩 Ghép số…"), một số không;
 * nơi nào hiện tên cạnh biểu tượng `icon` thì dùng hàm này để chỉ có đúng một biểu tượng.
 */
export function miniName(info: Pick<MiniInfo, 'name'>): string {
  return info.name.replace(/^[^\p{L}\p{N}]+/u, '');
}

/** "biểu tượng + tên" (đúng một biểu tượng), ví dụ "🧩 Ghép số – nhận biết số". */
export function miniTitle(info: Pick<MiniInfo, 'icon' | 'name'>): string {
  return `${info.icon} ${miniName(info)}`;
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
