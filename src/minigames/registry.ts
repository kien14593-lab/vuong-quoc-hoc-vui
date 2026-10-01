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
