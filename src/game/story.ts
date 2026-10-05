import { sfx } from '../core/audio';
import { EN_BADGE_GOAL, levelDef } from '../core/progression';
import { addCoins, addKeys, addStars, addTickets, addXp, awardBadge, flag, giveItem, hasBadge, hasProfile, isCollected, level, profile, questState, setFlag, type ZoneId } from '../core/state';
import { TOPICS } from '../math/curriculum';
import type { Topic } from '../math/types';
import type { Child } from '../ui/dom';
import { coinIcon } from '../ui/icons';
import { rewardBurst } from '../ui/toast';
import { BEAR_FREE_ZONES } from './needs';
import { siteText, st } from './subject-text';

/**
 * CỐT TRUYỆN & TIẾN TRÌNH
 *
 * Toàn bộ tiến độ lưu trong `profile().flags` (cờ) và `profile().collected` (vật đã nhặt), nên các khu vực
 * chỉ cần đọc/ghi cờ. Danh sách cờ chính (theo thứ tự chơi):
 *
 *  Làng      intro.done · (5 sao: village.star.box, village.star.1..4) · quest "stars" = done · bear.start
 *  Rừng      forest.bridge · forest.rock · forest.bearBridge · forest.stones
 *  Mê cung   maze.key1..3 (3 chìa khóa) · maze.exit (nhận vé + huy hiệu Vua Mê Cung)
 *  Vui chơi  park.coaster · park.balls · park.wheel · park.clown (mỗi trò 1 vé)
 *  Sở thú    zoo.open (đưa 5 vé) · zoo.giraffe · zoo.monkey · zoo.penguins · bear.done
 *  Lâu đài   castle.mul · castle.frac · castle.geo · castle.king
 *  Nhà       house.harvest (thu hoạch lần đầu)
 *  Chung     visited.<zone> · shop.fruit (câu đố mua trái cây của Cô Mèo)
 *
 * Câu hỏi theo môn của hồ sơ (game/subject.ts). Chế độ "Cả hai": môn của mỗi thử thách cố định (cầu, đá, cổng,
 * phòng lâu đài) được chọn một lần và lưu ở `profile().picks`, để biển báo, mục tiêu và câu hỏi luôn khớp nhau.
 */

export interface ZoneMeta {
  id: ZoneId;
  name: string;
  icon: string;
  sub: string;
  /** Vị trí trên bản đồ thế giới (0..1). */
  map: { x: number; y: number };
  color: string;
}

export const ZONE_META: Record<ZoneId, ZoneMeta> = {
  village: { id: 'village', name: 'Ngôi Làng Khởi Đầu', icon: '🏡', sub: 'Khu hướng dẫn', map: { x: 0.43, y: 0.7 }, color: '#ffd6a5' },
  house: { id: 'house', name: 'Ngôi Nhà Của Bạn', icon: '🏠', sub: 'Trang trí, trồng cây, huy hiệu', map: { x: 0.19, y: 0.84 }, color: '#ffc8dd' },
  forest: {
    id: 'forest',
    name: 'Rừng Thông Thái',
    icon: '🌳',
    get sub() {
      return st('sub.forest');
    },
    map: { x: 0.36, y: 0.42 },
    color: '#b9fbc0',
  },
  maze: {
    id: 'maze',
    name: 'Mê Cung Kỳ Bí',
    icon: '🌀',
    get sub() {
      return st('sub.maze');
    },
    map: { x: 0.56, y: 0.2 },
    color: '#cdb4db',
  },
  park: { id: 'park', name: 'Khu Vui Chơi', icon: '🎡', sub: 'Mini-game và phần thưởng', map: { x: 0.7, y: 0.66 }, color: '#a0e7ff' },
  zoo: {
    id: 'zoo',
    name: 'Sở Thú Kỳ Diệu',
    icon: '🦁',
    get sub() {
      return st('sub.zoo');
    },
    map: { x: 0.8, y: 0.36 },
    color: '#fdffb6',
  },
  castle: { id: 'castle', name: 'Lâu Đài Trí Tuệ', icon: '🏰', sub: 'Thử thách nâng cao', map: { x: 0.14, y: 0.22 }, color: '#e2ece9' },
};

export const ZONE_ORDER: ZoneId[] = ['village', 'house', 'forest', 'maze', 'park', 'zoo', 'castle'];

/** Số sao cần để vào Khu Vui Chơi. */
export const PARK_STARS = 10;
/** Số vé cần để mở cổng Sở Thú. */
export const ZOO_TICKETS = 5;
/** Cấp cần để vào Lâu Đài. */
export const CASTLE_LEVEL = 3;

export const VILLAGE_STARS = ['village.star.box', 'village.star.1', 'village.star.2', 'village.star.3', 'village.star.4'];

export function on(k: string): boolean {
  return hasProfile() && !!flag(k);
}

export function villageStars(): number {
  return VILLAGE_STARS.filter((id) => isCollected(id)).length;
}

export function mazeKeys(): number {
  return ['maze.key1', 'maze.key2', 'maze.key3'].filter((k) => on(k)).length;
}

export function starsQuestDone(): boolean {
  return questState('stars') === 'done';
}

export function visited(z: ZoneId): boolean {
  return z === 'village' || z === 'house' || on(`visited.${z}`);
}

export function markVisited(z: ZoneId): void {
  if (!on(`visited.${z}`)) setFlag(`visited.${z}`);
}

/* ---------------- Hành trình "Giúp chú Gấu đến sở thú" ---------------- */
export type BearStage = 'none' | 'bridge' | 'stones' | 'maze' | 'exit' | 'gate' | 'giraffe' | 'reward' | 'done';

export function bearStage(): BearStage {
  if (!hasProfile()) return 'none';
  if (on('bear.done')) return 'done';
  if (!on('bear.start')) return 'none';
  if (!on('forest.bearBridge')) return 'bridge';
  if (!on('forest.stones')) return 'stones';
  if (mazeKeys() < 3) return 'maze';
  if (!on('maze.exit')) return 'exit';
  if (!on('zoo.open')) return 'gate';
  if (!on('zoo.giraffe')) return 'giraffe';
  return 'reward';
}

/** Chú Gấu đi theo người chơi (đang trong hành trình). Không vào nhà, lâu đài (game/needs.ts BEAR_FREE_ZONES). */
export function bearFollows(zone: ZoneId): boolean {
  const s = bearStage();
  if (s === 'none' || s === 'done' || s === 'reward') return false;
  return !BEAR_FREE_ZONES.includes(zone);
}

/** Các bước hành trình (để hiện danh sách nhiệm vụ). */
export function bearSteps(): { text: string; done: boolean }[] {
  return [
    { text: 'Mở cây cầu bị khóa', done: on('forest.bearBridge') },
    { text: siteText('stones.step', 'forest.stones'), done: on('forest.stones') },
    { text: `Thu thập 3 chìa khóa trong Mê Cung (${mazeKeys()}/3)`, done: mazeKeys() >= 3 },
    { text: 'Ra khỏi Mê Cung và nhận vé sở thú', done: on('maze.exit') },
    { text: `Đưa ${ZOO_TICKETS} vé cho Bác Voi để mở cổng Sở Thú`, done: on('zoo.open') },
    { text: st('zoo.giraffeStep'), done: on('zoo.giraffe') },
    { text: 'Nhận 50 XP, 20 xu và huy hiệu Nhà Thám Hiểm Vương Quốc', done: on('bear.done') },
  ];
}

/* ---------------- Khóa khu vực ---------------- */
/** Lời nhắn nếu khu vực còn khóa, null nếu đã vào được. */
export function zoneLock(z: ZoneId): string | null {
  if (!hasProfile()) return null;
  const p = profile();
  switch (z) {
    case 'forest':
      if (!starsQuestDone()) return 'Hãy giúp Thỏ Bông tìm đủ 5 ngôi sao trước nhé!';
      if (!on('bear.start')) return 'Chú Gấu đang đợi ở cổng rừng – hãy nói chuyện với chú trước nhé!';
      return null;
    case 'maze':
      return on('forest.stones') ? null : 'Hãy vượt qua các thử thách trong Rừng Thông Thái trước nhé!';
    case 'park':
      return p.stars >= PARK_STARS ? null : `Cần ${PARK_STARS} ⭐ để vào Khu Vui Chơi. Bạn đang có ${p.stars} ⭐ – hãy tìm thêm sao nhé!`;
    case 'zoo':
      return visited('zoo') || on('maze.exit') || visited('park') ? null : 'Đường tới Sở Thú đi qua Mê Cung hoặc Khu Vui Chơi.';
    case 'castle':
      return level() >= CASTLE_LEVEL ? null : `Lâu Đài mở khi bạn đạt cấp ${CASTLE_LEVEL} (${levelDef(CASTLE_LEVEL).title}). ${st('lock.castleDo')}`;
    default:
      return null;
  }
}

/** Đi nhanh bằng bản đồ: đã từng đến và không bị khóa. */
export function canTravel(z: ZoneId): boolean {
  return visited(z) && !zoneLock(z);
}

/* ---------------- Mục tiêu hiện tại ---------------- */
export interface Objective {
  text: string;
  icon?: string;
  zone?: ZoneId;
}

export function storyObjective(): Objective | null {
  if (!hasProfile()) return null;
  const p = profile();
  if (!on('intro.done')) return { text: 'Nói chuyện với Thỏ Bông', icon: '🐰', zone: 'village' };
  if (!starsQuestDone()) {
    const n = villageStars();
    if (!on('village.boxes')) return { text: 'Đếm những chiếc hộp gần Thỏ Bông', icon: '📦', zone: 'village' };
    if (n < 5) return { text: `Tìm ngôi sao trong làng (${n}/5)`, icon: '⭐', zone: 'village' };
    return { text: 'Quay lại gặp Thỏ Bông', icon: '🐰', zone: 'village' };
  }
  switch (bearStage()) {
    case 'none':
      return { text: 'Nói chuyện với Chú Gấu ở cổng rừng', icon: '🐻', zone: 'village' };
    case 'bridge':
      if (!on('forest.bridge')) return { text: siteText('bridge.objStory', 'forest.bridge'), icon: '🌉', zone: 'forest' };
      if (!on('forest.rock')) return { text: 'Dọn tảng đá chặn đường', icon: '⛏️', zone: 'forest' };
      return { text: 'Mở cây cầu bị khóa cho chú Gấu', icon: '🔒', zone: 'forest' };
    case 'stones':
      return { text: siteText('stones.obj', 'forest.stones'), icon: '👣', zone: 'forest' };
    case 'maze':
      return { text: `Tìm 3 chìa khóa trong Mê Cung (${mazeKeys()}/3)`, icon: '🗝️', zone: 'maze' };
    case 'exit':
      return { text: 'Mở cửa ra của Mê Cung', icon: '🚪', zone: 'maze' };
    case 'gate':
      if (p.tickets >= ZOO_TICKETS) return { text: `Đưa ${ZOO_TICKETS} vé cho Bác Voi ở cổng Sở Thú`, icon: '🎟️', zone: 'zoo' };
      if (p.stars < PARK_STARS) return { text: `Tìm sao để vào Khu Vui Chơi (${p.stars}/${PARK_STARS} ⭐)`, icon: '⭐' };
      return { text: `Nhận vé ở Khu Vui Chơi (${p.tickets}/${ZOO_TICKETS} 🎟️)`, icon: '🎟️', zone: 'park' };
    case 'giraffe':
      return { text: 'Giúp bạn Hươu cao cổ', icon: '🦒', zone: 'zoo' };
    case 'reward':
      return { text: 'Gặp chú Gấu ở chuồng hươu', icon: '🐻', zone: 'zoo' };
    default:
      break;
  }
  if (!(on('zoo.giraffe') && on('zoo.monkey') && on('zoo.penguins'))) return { text: 'Chăm sóc các con vật ở Sở Thú', icon: '🐒', zone: 'zoo' };
  if (level() < CASTLE_LEVEL) return { text: `Lên cấp ${CASTLE_LEVEL} để mở Lâu Đài ${st('obj.levelUp')}`, icon: '🏰' };
  if (!(on('castle.mul') && on('castle.frac') && on('castle.geo'))) return { text: 'Vượt qua 3 phòng thử thách ở Lâu Đài', icon: '🛡️', zone: 'castle' };
  if (!on('castle.king')) return { text: 'Nhận thử thách của Nhà Vua', icon: '👑', zone: 'castle' };
  return { text: 'Khám phá thế giới và chơi mini-game!', icon: '🎮' };
}

/* ---------------- Phần thưởng ---------------- */
export interface Reward {
  xp?: number;
  coins?: number;
  stars?: number;
  tickets?: number;
  keys?: number;
  items?: Record<string, number>;
  badge?: string;
}

/** Trao thưởng (kèm hiệu ứng chữ bay). Huy hiệu/lên cấp tự hiện bảng chúc mừng qua HUD. */
export function reward(r: Reward, at?: { x: number; y: number }): void {
  const parts: { icon: Child; text: string; cls?: string }[] = [];
  if (r.stars) {
    addStars(r.stars);
    parts.push({ icon: '⭐', text: `+${r.stars} sao`, cls: 'star' });
  }
  if (r.tickets) {
    addTickets(r.tickets);
    parts.push({ icon: '🎟️', text: `+${r.tickets} vé`, cls: 'ticket' });
  }
  if (r.keys) {
    addKeys(r.keys);
    parts.push({ icon: '🗝️', text: `+${r.keys} chìa khóa`, cls: 'key' });
  }
  if (r.coins) {
    addCoins(r.coins);
    parts.push({ icon: coinIcon(), text: `+${r.coins} xu`, cls: 'coin' });
  }
  if (r.xp) {
    addXp(r.xp);
    parts.push({ icon: '✨', text: `+${r.xp} XP`, cls: 'xp' });
  }
  for (const [id, n] of Object.entries(r.items ?? {})) giveItem(id, n);
  if (parts.length) {
    sfx('coin');
    rewardBurst(parts, at);
  }
  if (r.badge) awardBadge(r.badge);
}

/** Huy hiệu tự động (gọi sau mỗi câu trả lời / mini-game / khi vào thế giới). */
export function checkBadges(): void {
  if (!hasProfile()) return;
  const p = profile();
  let total = 0;
  let english = 0;
  for (const [t, s] of Object.entries(p.stats)) {
    total += s?.q ?? 0;
    if (TOPICS[t as Topic]?.subject === 'english') english += s?.q ?? 0;
  }
  const first = (...ts: Topic[]): number => ts.reduce((n, t) => n + (p.stats[t]?.first ?? 0), 0);
  if (total >= 100 && !hasBadge('tram-cau')) awardBadge('tram-cau');
  if (english >= 100 && !hasBadge('tram-tu')) awardBadge('tram-tu');
  if (first('en_listen') >= EN_BADGE_GOAL && !hasBadge('doi-tai-vang')) awardBadge('doi-tai-vang');
  if (first('en_spell', 'en_phonics') >= EN_BADGE_GOAL && !hasBadge('bac-thay-danh-van')) awardBadge('bac-thay-danh-van');
  if (Object.keys(p.days).length >= 3 && !hasBadge('cham-chi')) awardBadge('cham-chi');
  if (Object.values(p.mini).filter((m) => m.plays > 0).length >= 6 && !hasBadge('nha-vo-dich')) awardBadge('nha-vo-dich');
  if (on('park.coaster') && on('park.balls') && on('park.wheel') && on('park.clown') && !hasBadge('vua-tro-choi')) awardBadge('vua-tro-choi');
  if (on('zoo.giraffe') && on('zoo.monkey') && on('zoo.penguins') && !hasBadge('ban-muong-thu')) awardBadge('ban-muong-thu');
  if (on('castle.mul') && on('castle.frac') && on('castle.geo') && !hasBadge('hiep-si')) awardBadge('hiep-si');
}
