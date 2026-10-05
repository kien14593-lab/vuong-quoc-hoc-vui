import { playerKey, type Kid } from '../core/outfits';
import type { ZoneId } from '../core/state';
import type { MiniId } from '../minigames/registry';
import { VILLAGER_KEYS } from '../models/villagers';
import { CAST } from './cast';

/**
 * NHÂN VẬT CẦN CHO TỪNG CẢNH – để chỉ tải tệp mô hình AI (GLB) khi cần, trò chơi mở nhanh hơn:
 *  - màn hình tiêu đề: tải lúc khởi động (main.ts) – không chờ mô hình bé (thẻ hồ sơ hiện bóng bé tạm rồi tự thay);
 *  - mỗi khu vực / trò chơi nhỏ: tải trong lúc màn hình chuyển cảnh (game/app.ts), kèm bé của hồ sơ đang chơi;
 *  - tải sau (ZONE_LATE_MODELS, TITLE_LATE_MODELS – thú chỉ để ngắm trong chuồng, dân làng): KHÔNG chờ – vào cảnh ngay
 *    với mô hình dựng bằng code, tải xong thì thay tại chỗ (world/late.ts) – mạng chậm không phải chờ vì nhân vật phụ;
 *  - phần còn lại: tải dần ở nền sau khi hiện màn hình tiêu đề (trừ các bộ đồ: chỉ tải khi cần).
 * Ghi đủ mọi nhân vật/con thú xuất hiện (cả người chỉ nói trong hội thoại – để có ảnh chân dung);
 * khóa chưa có mô hình AI thì bỏ qua, không tốn gì. Quên ghi → tests/needs.test.ts báo lỗi.
 * Dân làng: trong màn chơi gọi chung 'npc_villager' + { v } – ở đây ghi khóa riêng của từng người (models/villagers.ts):
 * v0 npc_be_na, v1 npc_anh_ti, v2 npc_chi_mai, v3 npc_be_bin, v4 npc_ba_ba, v5 npc_chu_tu.
 */

/** Màn hình tiêu đề (world/title.ts). */
export const TITLE_MODELS: readonly string[] = [CAST.tho.art, CAST.gau.art, CAST.meo.art, 'pet_dog'];

/** Màn hình tiêu đề, tải sau (không chờ): dân làng đi dạo. */
export const TITLE_LATE_MODELS: readonly string[] = ['npc_be_na', 'npc_chi_mai'];

/** Có ở mọi khu vực: Chú Gấu đi theo người chơi (world/zone.ts). */
export const EVERY_ZONE_MODELS: readonly string[] = [CAST.gau.art];

/** Từng khu vực (world/zones/*.ts) – theo thứ tự cốt truyện. */
export const ZONE_MODELS: Record<ZoneId, readonly string[]> = {
  village: [CAST.tho.art, CAST.meo.art],
  house: [],
  forest: [CAST.cu.art, CAST.soc.art, CAST.nai.art, CAST.rua.art],
  maze: [CAST.robot.art, CAST.soc.art, CAST.rua.art],
  park: [CAST.he.art],
  zoo: [CAST.voi.art, CAST.nai.art],
  castle: [CAST.vua.art, CAST.hiepsi.art],
};

/**
 * Tải sau khi đã vào khu vực (không chờ – mạng chậm vẫn vào nhanh): thú AI trong chuồng và dân làng (nhân vật phụ) –
 * chỉ những người khu vực đó có. Khu vực hiện tạm mô hình dựng bằng code, rồi tự tải lần lượt theo thứ tự này (sau
 * nhân vật của khu vực, thú cưng và bé) và thay ngay tại chỗ (world/late.ts, world/zone.ts lateLoaded).
 */
export const ZONE_LATE_MODELS: Partial<Record<ZoneId, readonly string[]>> = {
  village: ['npc_be_na', 'npc_anh_ti', 'npc_chi_mai', 'npc_ba_ba'],
  park: ['npc_be_na', 'npc_chi_mai', 'npc_be_bin', 'npc_chu_tu'],
  // Chú Tư đứng ở khu trung tâm, sau cổng (chỉ tới được khi Bác Voi đã mở cổng): tải sau các bạn thú.
  zoo: ['animal_lion', 'animal_zebra', 'animal_giraffe', 'animal_monkey', 'animal_penguin', 'npc_chu_tu'],
  castle: ['npc_anh_ti', 'npc_be_bin', 'npc_ba_ba'],
};

/** Trò chơi nhỏ có nhân vật/con thú (minigames/games/*.ts). Ở đây dân làng cũng chờ (cảnh không thay mô hình tại chỗ). */
export const MINI_MODELS: Partial<Record<MiniId, readonly string[]>> = {
  builder: [CAST.tho.art],
  market: [CAST.meo.art],
  number_match: ['npc_anh_ti'],
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

/** Mô hình của khu vực tải sau khi đã vào (không chờ). */
export function zoneLateModels(id: ZoneId): string[] {
  return [...(ZONE_LATE_MODELS[id] ?? [])];
}

/** Mô hình cần trước khi chơi trò chơi nhỏ (kèm bé nếu trò chơi có bé). */
export function miniModels(id: string, player?: PlayerNeed | null): string[] {
  return [...(MINI_MODELS[id as MiniId] ?? []), ...(MINI_WITH_PLAYER.includes(id as MiniId) ? playerModels(player) : [])];
}

/**
 * Mọi mô hình theo thứ tự trẻ sẽ gặp (để tải dần ở nền): màn tiêu đề, rồi từng khu vực (mô hình phải chờ trước, mô hình
 * tải sau liền sau), rồi trò chơi nhỏ. Dân làng xếp cuối cùng (người ở làng trước): vào cảnh nào thì cảnh đó tự tải
 * dân làng của mình (world/late.ts), nên nạp trước ở nền không được làm chậm nhân vật của các khu vực sau.
 */
export function modelsInStoryOrder(): string[] {
  const V = new Set<string>(VILLAGER_KEYS);
  const zones = (Object.keys(ZONE_MODELS) as ZoneId[]).flatMap((id) => [...ZONE_MODELS[id], ...zoneLateModels(id)]);
  const all = [...TITLE_MODELS, ...TITLE_LATE_MODELS, ...zones, ...Object.values(MINI_MODELS).flat()];
  return [...new Set([...all.filter((k) => !V.has(k)), ...[...zoneLateModels('village'), ...all].filter((k) => V.has(k))])];
}
