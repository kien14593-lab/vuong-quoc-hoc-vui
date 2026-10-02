import type { Speaker } from '../ui/dialog';

/**
 * DÀN NHÂN VẬT – tên, mô hình 3D và màu bảng tên của các NPC chính.
 * Dùng `CAST.tho` khi gọi `say(CAST.tho, ...)` hoặc `zone.npc(CAST.tho.art, x, z, {...castNpc('tho')})`.
 */
export interface CastMember extends Speaker {
  art: string;
  color: string;
  /** Vai trò (ghi chú cho giáo viên / người phát triển). */
  role: string;
}

export const CAST = {
  tho: { name: 'Thỏ Bông', art: 'npc_rabbit', color: '#ff9ec4', role: 'Hướng dẫn viên ở Ngôi Làng Khởi Đầu' },
  meo: { name: 'Cô Mèo', art: 'npc_cat', color: '#ffb36b', role: 'Chủ cửa hàng trong làng' },
  cu: { name: 'Bác Cú', art: 'npc_owl', color: '#b08cff', role: 'Người canh Cầu Phép Cộng trong rừng' },
  gau: { name: 'Chú Gấu', art: 'npc_bear', color: '#c98b5a', role: 'Bạn đồng hành muốn đến Sở Thú' },
  robot: { name: 'Robot Bíp', art: 'npc_robot', color: '#6cc6ff', role: 'Người gác Mê Cung Kỳ Bí' },
  he: { name: 'Chú Hề Bibo', art: 'npc_clown', color: '#ff7b7b', role: 'Chủ Khu Vui Chơi' },
  voi: { name: 'Bác Voi', art: 'npc_elephant', color: '#8fb8de', role: 'Nhân viên bán vé Sở Thú' },
  vua: { name: 'Nhà Vua', art: 'npc_king', color: '#ffcf4a', role: 'Chủ Lâu Đài Trí Tuệ' },
  hiepsi: { name: 'Hiệp Sĩ Thỏ', art: 'npc_knight', color: '#9fb3c8', role: 'Người giữ các phòng thử thách' },
  soc: { name: 'Cô Sóc', art: 'npc_squirrel', color: '#e59a5c', role: 'Cư dân trong Rừng Thông Thái' },
  nai: { name: 'Bạn Nai', art: 'npc_deer', color: '#d6a77a', role: 'Bạn nhỏ trong rừng' },
  rua: { name: 'Ông Rùa', art: 'npc_turtle', color: '#7cc79a', role: 'Ông cụ thông thái bên hồ' },
} satisfies Record<string, CastMember>;

export type CastId = keyof typeof CAST;

/** Dân làng (6 biến thể ngoại hình). */
export const VILLAGERS: { name: string; v: number; color: string }[] = [
  { name: 'Bé Na', v: 0, color: '#ffa8c5' },
  { name: 'Anh Tí', v: 1, color: '#8fd3ff' },
  { name: 'Chị Mai', v: 2, color: '#ffd166' },
  { name: 'Bé Bin', v: 3, color: '#9be09b' },
  { name: 'Bà Ba', v: 4, color: '#c7b3ff' },
  { name: 'Chú Tư', v: 5, color: '#ffb38a' },
];

export function villager(i: number): Speaker {
  const v = VILLAGERS[i % VILLAGERS.length];
  return { name: v.name, art: 'npc_villager', artOpts: { v: v.v }, color: v.color };
}

/** Người chơi (chân dung lấy từ hồ sơ – dùng tên "Bạn"). */
export const ME: Speaker = { name: 'Bạn', color: '#7a63ff' };
