import { playerKey, type Kid } from '../core/outfits';
import type { ZoneId } from '../core/state';
import type { MiniId } from '../minigames/registry';
import { CAST } from './cast';

/**
 * NHÂN VẬT CẦN CHO TỪNG CẢNH – để chỉ tải tệp mô hình AI (GLB) khi cần, trò chơi mở nhanh hơn:
 *  - màn hình tiêu đề: tải lúc khởi động (main.ts) – không chờ mô hình bé (thẻ hồ sơ hiện bóng bé tạm rồi tự thay);
 *  - mỗi khu vực / trò chơi nhỏ: tải trong lúc màn hình chuyển cảnh (game/app.ts), kèm bé của hồ sơ đang chơi;
 *  - thú chỉ để ngắm trong chuồng (ZONE_LATE_MODELS): không chờ – vào khu vực ngay, tải xong thì thay tại chỗ;
 *  - phần còn lại: tải dần ở nền sau khi hiện màn hình tiêu đề (trừ các bộ đồ: chỉ tải khi cần).
 * Ghi đủ mọi nhân vật/con thú xuất hiện (cả người chỉ nói trong hội thoại – để có ảnh chân dung);
 * khóa chưa có mô hình AI thì bỏ qua, không tốn gì. Quên ghi → tests/needs.test.ts báo lỗi.
 */

/** Màn hình tiêu đề (world/title.ts). */
export const TITLE_MODELS: readonly string[] = [CAST.tho.art, CAST.gau.art, CAST.meo.art, 'npc_villager', 'pet_dog'];

/** Có ở mọi khu vực: Chú Gấu đi theo người chơi (world/zone.ts). */
export const EVERY_ZONE_MODELS: readonly string[] = [CAST.gau.art];

/** Từng khu vực (world/zones/*.ts) – theo thứ tự cốt truyện. */
export const ZONE_MODELS: Record<ZoneId, readonly string[]> = {
  village: [CAST.tho.art, CAST.meo.art, 'npc_villager'],
  house: [],
  forest: [CAST.cu.art, CAST.soc.art, CAST.nai.art, CAST.rua.art],
  maze: [CAST.robot.art, CAST.soc.art, CAST.rua.art],
  park: [CAST.he.art, 'npc_villager'],
  zoo: [CAST.voi.art, CAST.nai.art, 'npc_villager'],
  castle: [CAST.vua.art, CAST.hiepsi.art, 'npc_villager'],
};

/**
 * Thú AI trong chuồng của khu vực: không chờ khi vào (mạng chậm vẫn vào nhanh). Khu vực hiện tạm thú dựng bằng code,
 * rồi tự tải lần lượt theo thứ tự này (sau nhân vật của khu vực và thú cưng) và thay tại chỗ (world/zones/zoo.ts).
 */
export const ZONE_LATE_MODELS: Partial<Record<ZoneId, readonly string[]>> = {
  zoo: ['animal_lion', 'animal_zebra', 'animal_giraffe', 'animal_monkey', 'animal_penguin'],
};

/** Trò chơi nhỏ có nhân vật/con thú (minigames/games/*.ts). */
export const MINI_MODELS: Partial<Record<MiniId, readonly string[]>> = {
  builder: [CAST.tho.art],
  market: [CAST.meo.art],
  number_match: ['npc_villager'],
  monkey: ['animal_monkey'],
  pizza: ['animal_penguin', 'animal_monkey', 'animal_hippo'],
};

/** Trò chơi nhỏ có bé (người chơi) trong cảnh – cần mô hình bé mặc bộ đồ đang chọn. */
export const MINI_WITH_PLAYER: readonly MiniId[] = ['fishing', 'maze_run', 'runner', 'shoot_answer'];

/** Bé của hồ sơ đang chơi: bé trai / bé gái và bộ đồ đang mặc. */
export interface PlayerNeed {
  kid: Kid;
  outfit: string | null;
}

/** Mô hình bé (người chơi) đang mặc bộ đồ: player_trai, player_gai__the_thao... (không có hồ sơ → không cần). */
export function playerModels(p?: PlayerNeed | null): string[] {
  return p ? [playerKey(p.kid, p.outfit)] : [];
}

/** Mô hình cần trước khi dựng khu vực (kèm thú cưng đang mang theo – mã vật phẩm cũng là khóa mô hình – và bé). */
export function zoneModels(id: ZoneId, pet?: string | null, player?: PlayerNeed | null): string[] {
  return [...new Set([...ZONE_MODELS[id], ...EVERY_ZONE_MODELS, ...(pet ? [pet] : []), ...playerModels(player)])];
}

/** Thú AI của khu vực tải sau khi đã vào (không chờ). */
export function zoneLateModels(id: ZoneId): string[] {
  return [...(ZONE_LATE_MODELS[id] ?? [])];
}

/** Mô hình cần trước khi chơi trò chơi nhỏ (kèm bé nếu trò chơi có bé). */
export function miniModels(id: string, player?: PlayerNeed | null): string[] {
  return [...(MINI_MODELS[id as MiniId] ?? []), ...(MINI_WITH_PLAYER.includes(id as MiniId) ? playerModels(player) : [])];
}

/** Mọi mô hình theo thứ tự trẻ sẽ gặp (để tải dần ở nền). */
export function modelsInStoryOrder(): string[] {
  const zones = (Object.keys(ZONE_MODELS) as ZoneId[]).flatMap((id) => [...ZONE_MODELS[id], ...zoneLateModels(id)]);
  return [...new Set([...TITLE_MODELS, ...zones, ...Object.values(MINI_MODELS).flat()])];
}
