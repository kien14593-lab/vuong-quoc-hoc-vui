/**
 * Dân làng: 6 nhân vật, mỗi người một khóa mô hình riêng để có thể thay từng người bằng mô hình AI
 * (mo-hinh-ai/be-na.glb, anh-ti.glb, …). Trong màn chơi vẫn gọi chung 'npc_villager' + { v } –
 * sổ đăng ký (registry.ts, defineRoute) tự chuyển sang khóa riêng.
 * v: 0 Bé Na (heo con), 1 Anh Tí (vịt), 2 Chị Mai (cún), 3 Bé Bin (chuột hamster), 4 Bà Ba (ếch), 5 Chú Tư (gà).
 */
export const VILLAGER_KEYS = ['npc_be_na', 'npc_anh_ti', 'npc_chi_mai', 'npc_be_bin', 'npc_ba_ba', 'npc_chu_tu'] as const;
export type VillagerKey = (typeof VILLAGER_KEYS)[number];

/** Khóa mô hình riêng của dân làng thứ v (0..5; số khác quay vòng, thiếu thì 0). */
export function villagerKey(v: unknown = 0): VillagerKey {
  const n = Math.floor(Number(v) || 0);
  const len = VILLAGER_KEYS.length;
  return VILLAGER_KEYS[((n % len) + len) % len];
}
