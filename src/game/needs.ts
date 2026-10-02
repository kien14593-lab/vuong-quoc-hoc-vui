import type { ZoneId } from '../core/state';
import type { MiniId } from '../minigames/registry';
import { CAST } from './cast';

/**
 * NHÂN VẬT CẦN CHO TỪNG CẢNH – để chỉ tải tệp mô hình AI (GLB) khi cần, trò chơi mở nhanh hơn:
 *  - màn hình tiêu đề: tải lúc khởi động (main.ts);
 *  - mỗi khu vực / trò chơi nhỏ: tải trong lúc màn hình chuyển cảnh (game/app.ts);
 *  - phần còn lại: tải dần ở nền sau khi hiện màn hình tiêu đề.
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
  zoo: [CAST.voi.art, CAST.nai.art, 'npc_villager', 'animal_lion', 'animal_monkey', 'animal_zebra'],
  castle: [CAST.vua.art, CAST.hiepsi.art, 'npc_villager'],
};

/** Trò chơi nhỏ có nhân vật/con thú (minigames/games/*.ts). */
export const MINI_MODELS: Partial<Record<MiniId, readonly string[]>> = {
  builder: [CAST.tho.art],
  market: [CAST.meo.art],
  number_match: ['npc_villager'],
  monkey: ['animal_monkey'],
  pizza: ['animal_penguin', 'animal_monkey', 'animal_hippo'],
};

/** Mô hình cần trước khi dựng khu vực (kèm thú cưng đang mang theo – mã vật phẩm cũng là khóa mô hình). */
export function zoneModels(id: ZoneId, pet?: string | null): string[] {
  return [...new Set([...ZONE_MODELS[id], ...EVERY_ZONE_MODELS, ...(pet ? [pet] : [])])];
}

export function miniModels(id: string): string[] {
  return [...(MINI_MODELS[id as MiniId] ?? [])];
}

/** Mọi mô hình theo thứ tự trẻ sẽ gặp (để tải dần ở nền). */
export function modelsInStoryOrder(): string[] {
  return [...new Set([...TITLE_MODELS, ...Object.values(ZONE_MODELS).flat(), ...Object.values(MINI_MODELS).flat()])];
}
