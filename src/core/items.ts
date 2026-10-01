/** Danh mục vật phẩm: trang phục, thú cưng, ván trượt, đồ trang trí, hạt giống, vật phẩm nhiệm vụ. */
export type ItemCat = 'shirt' | 'pants' | 'shoes' | 'hat' | 'backpack' | 'acc' | 'pet' | 'board' | 'decor' | 'seed' | 'quest';

export type WearSlot = 'shirt' | 'pants' | 'shoes' | 'hat' | 'backpack' | 'acc';

export type DecorSlot = 'rug' | 'lamp' | 'corner' | 'sofa' | 'shelf' | 'wall1' | 'wall2' | 'wall3' | 'table' | 'bedside' | 'corner2';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCat;
  /** Giá (xu). 0 = không bán (phần thưởng hoặc mặc định). */
  price: number;
  /** Cấp người chơi cần đạt để mua. */
  level: number;
  desc?: string;
  /** Tham số vẽ. */
  style?: string;
  color?: string;
  color2?: string;
  slot?: DecorSlot;
  /** Không xuất hiện trong cửa hàng. */
  hidden?: boolean;
}

const I = (d: ItemDef) => d;

export const ITEMS: ItemDef[] = [
  // Áo
  I({ id: 'shirt_blue', name: 'Áo phông xanh', cat: 'shirt', price: 0, level: 1, style: 'tee', color: '#6cc3f0', color2: '#4aa3d8' }),
  I({ id: 'shirt_pink', name: 'Áo phông hồng', cat: 'shirt', price: 0, level: 1, style: 'tee', color: '#ff9ec4', color2: '#f07aa8' }),
  I({ id: 'shirt_yellow', name: 'Áo phông vàng', cat: 'shirt', price: 0, level: 1, style: 'tee', color: '#ffd76a', color2: '#f2b84b' }),
  I({ id: 'shirt_green', name: 'Áo phông xanh lá', cat: 'shirt', price: 0, level: 1, style: 'tee', color: '#8ddc97', color2: '#5fbf6e' }),
  I({ id: 'shirt_stripe', name: 'Áo kẻ sọc', cat: 'shirt', price: 15, level: 1, style: 'stripe', color: '#ffffff', color2: '#ff7b7b' }),
  I({ id: 'shirt_star', name: 'Áo ngôi sao', cat: 'shirt', price: 25, level: 1, style: 'star', color: '#8f7bff', color2: '#ffe066' }),
  I({ id: 'shirt_dress', name: 'Váy hoa', cat: 'shirt', price: 30, level: 1, style: 'dress', color: '#ffb3d1', color2: '#ffffff' }),
  I({ id: 'shirt_hoodie', name: 'Áo hoodie cam', cat: 'shirt', price: 40, level: 2, style: 'hoodie', color: '#ffa45c', color2: '#e8843a' }),
  I({ id: 'shirt_math', name: 'Áo "1 + 1 = 2"', cat: 'shirt', price: 50, level: 3, style: 'math', color: '#5ec8b8', color2: '#ffffff' }),
  I({ id: 'shirt_rainbow', name: 'Áo cầu vồng', cat: 'shirt', price: 80, level: 4, style: 'rainbow', color: '#ff8fab', color2: '#7ec8e3' }),
  I({ id: 'shirt_robe', name: 'Áo choàng phù thủy', cat: 'shirt', price: 120, level: 4, style: 'robe', color: '#6a5acd', color2: '#ffd166' }),
  // Quần, váy
  I({ id: 'pants_jean', name: 'Quần jean', cat: 'pants', price: 0, level: 1, style: 'pants', color: '#5b7fc7' }),
  I({ id: 'pants_skirt', name: 'Chân váy hồng', cat: 'pants', price: 0, level: 1, style: 'skirt', color: '#ff7eb3' }),
  I({ id: 'pants_shorts', name: 'Quần soóc', cat: 'pants', price: 0, level: 1, style: 'shorts', color: '#c9a27e' }),
  I({ id: 'pants_green', name: 'Quần xanh lá', cat: 'pants', price: 15, level: 1, style: 'pants', color: '#62b06f' }),
  I({ id: 'pants_purple', name: 'Váy tím', cat: 'pants', price: 20, level: 2, style: 'skirt', color: '#a58cff' }),
  I({ id: 'pants_red', name: 'Quần soóc đỏ', cat: 'pants', price: 15, level: 1, style: 'shorts', color: '#ff6b6b' }),
  // Giày
  I({ id: 'shoes_red', name: 'Giày đỏ', cat: 'shoes', price: 0, level: 1, style: 'sneaker', color: '#ff6b6b' }),
  I({ id: 'shoes_white', name: 'Giày trắng', cat: 'shoes', price: 10, level: 1, style: 'sneaker', color: '#ffffff' }),
  I({ id: 'shoes_boots', name: 'Ủng vàng', cat: 'shoes', price: 20, level: 2, style: 'boot', color: '#ffd23f' }),
  I({ id: 'shoes_star', name: 'Giày lấp lánh', cat: 'shoes', price: 45, level: 3, style: 'sparkle', color: '#c77dff' }),
  I({ id: 'shoes_rocket', name: 'Giày tên lửa', cat: 'shoes', price: 90, level: 5, style: 'rocket', color: '#4dabf7' }),
  // Mũ
  I({ id: 'hat_cap', name: 'Mũ lưỡi trai', cat: 'hat', price: 15, level: 1, style: 'cap', color: '#ff6b6b' }),
  I({ id: 'hat_flower', name: 'Kẹp hoa', cat: 'hat', price: 12, level: 1, style: 'flower', color: '#ff8fab' }),
  I({ id: 'hat_beanie', name: 'Mũ len', cat: 'hat', price: 20, level: 1, style: 'beanie', color: '#7bd389' }),
  I({ id: 'hat_party', name: 'Mũ sinh nhật', cat: 'hat', price: 25, level: 1, style: 'party', color: '#b79cff' }),
  I({ id: 'hat_bunny', name: 'Tai thỏ', cat: 'hat', price: 35, level: 2, style: 'bunny', color: '#ffffff' }),
  I({ id: 'hat_explorer', name: 'Mũ thám hiểm', cat: 'hat', price: 40, level: 3, style: 'explorer', color: '#d9b779' }),
  I({ id: 'hat_wizard', name: 'Mũ phù thủy', cat: 'hat', price: 70, level: 4, style: 'wizard', color: '#6a5acd' }),
  I({ id: 'hat_crown', name: 'Vương miện Toán Học', cat: 'hat', price: 0, level: 1, style: 'crown', color: '#ffd166', hidden: true, desc: 'Phần thưởng của Nhà Vua.' }),
  // Balo
  I({ id: 'bag_blue', name: 'Balo xanh', cat: 'backpack', price: 20, level: 1, style: 'basic', color: '#4dabf7' }),
  I({ id: 'bag_star', name: 'Balo ngôi sao', cat: 'backpack', price: 35, level: 2, style: 'star', color: '#ffd166' }),
  I({ id: 'bag_bear', name: 'Balo gấu', cat: 'backpack', price: 45, level: 3, style: 'bear', color: '#c08552' }),
  I({ id: 'bag_rocket', name: 'Balo tên lửa', cat: 'backpack', price: 80, level: 4, style: 'rocket', color: '#e9ecef' }),
  // Phụ kiện
  I({ id: 'acc_glasses', name: 'Kính tròn', cat: 'acc', price: 15, level: 1, style: 'glasses', color: '#5b4a6e' }),
  I({ id: 'acc_bowtie', name: 'Nơ cổ', cat: 'acc', price: 12, level: 1, style: 'bowtie', color: '#ff6b6b' }),
  I({ id: 'acc_scarf', name: 'Khăn quàng', cat: 'acc', price: 20, level: 1, style: 'scarf', color: '#4dabf7' }),
  I({ id: 'acc_cape', name: 'Áo choàng siêu nhân', cat: 'acc', price: 60, level: 3, style: 'cape', color: '#ff6b6b' }),
  I({ id: 'acc_medal', name: 'Huy chương vàng', cat: 'acc', price: 0, level: 1, style: 'medal', color: '#ffd166', hidden: true, desc: 'Phần thưởng Khu Vui Chơi.' }),
  // Thú cưng
  I({ id: 'pet_dog', name: 'Cún con', cat: 'pet', price: 50, level: 1, style: 'dog', desc: 'Luôn vẫy đuôi chạy theo bạn.' }),
  I({ id: 'pet_cat', name: 'Mèo mướp', cat: 'pet', price: 60, level: 2, style: 'cat', desc: 'Thích nằm sưởi nắng.' }),
  I({ id: 'pet_rabbit', name: 'Thỏ trắng', cat: 'pet', price: 60, level: 2, style: 'rabbit', desc: 'Nhảy tưng tưng rất vui.' }),
  I({ id: 'pet_panda', name: 'Gấu trúc', cat: 'pet', price: 90, level: 3, style: 'panda', desc: 'Mê ăn lá tre.' }),
  I({ id: 'pet_fox', name: 'Cáo nhỏ', cat: 'pet', price: 90, level: 3, style: 'fox', desc: 'Thông minh và nhanh nhẹn.' }),
  I({ id: 'pet_penguin', name: 'Chim cánh cụt', cat: 'pet', price: 110, level: 4, style: 'penguin', desc: 'Đi lạch bạch đáng yêu.' }),
  I({ id: 'pet_dino', name: 'Khủng long', cat: 'pet', price: 150, level: 5, style: 'dino', desc: 'Khủng long tí hon siêu hiền.' }),
  // Ván trượt
  I({ id: 'board_skate', name: 'Ván trượt', cat: 'board', price: 60, level: 2, style: 'skate', color: '#ff8fab', desc: 'Di chuyển nhanh hơn!' }),
  // Đồ trang trí
  I({ id: 'decor_rug_round', name: 'Thảm tròn', cat: 'decor', price: 20, level: 1, slot: 'rug', style: 'rugRound', color: '#ffd6e8' }),
  I({ id: 'decor_rug_rainbow', name: 'Thảm cầu vồng', cat: 'decor', price: 40, level: 2, slot: 'rug', style: 'rugRainbow' }),
  I({ id: 'decor_lamp', name: 'Đèn ngủ', cat: 'decor', price: 15, level: 1, slot: 'lamp', style: 'lamp', color: '#ffd166' }),
  I({ id: 'decor_plant', name: 'Chậu cây', cat: 'decor', price: 15, level: 1, slot: 'corner', style: 'plant' }),
  I({ id: 'decor_sofa', name: 'Ghế sofa', cat: 'decor', price: 45, level: 2, slot: 'sofa', style: 'sofa', color: '#7ec8e3' }),
  I({ id: 'decor_bookshelf', name: 'Kệ sách', cat: 'decor', price: 35, level: 1, slot: 'shelf', style: 'bookshelf' }),
  I({ id: 'decor_aquarium', name: 'Bể cá', cat: 'decor', price: 60, level: 3, slot: 'shelf', style: 'aquarium' }),
  I({ id: 'decor_poster_star', name: 'Tranh ngôi sao', cat: 'decor', price: 15, level: 1, slot: 'wall1', style: 'posterStar' }),
  I({ id: 'decor_poster_math', name: 'Tranh bảng cửu chương', cat: 'decor', price: 20, level: 1, slot: 'wall2', style: 'posterMath' }),
  I({ id: 'decor_clock', name: 'Đồng hồ treo tường', cat: 'decor', price: 20, level: 1, slot: 'wall3', style: 'clock' }),
  I({ id: 'decor_teddy', name: 'Gấu bông', cat: 'decor', price: 30, level: 1, slot: 'bedside', style: 'teddy' }),
  I({ id: 'decor_globe', name: 'Quả địa cầu', cat: 'decor', price: 40, level: 3, slot: 'table', style: 'globe' }),
  I({ id: 'decor_rocket', name: 'Mô hình tên lửa', cat: 'decor', price: 70, level: 4, slot: 'table', style: 'rocketModel' }),
  I({ id: 'decor_piano', name: 'Đàn piano', cat: 'decor', price: 100, level: 4, slot: 'corner2', style: 'piano' }),
  I({ id: 'decor_trophy', name: 'Cúp vàng', cat: 'decor', price: 0, level: 1, slot: 'corner2', style: 'trophy', hidden: true, desc: 'Phần thưởng của Nhà Vua.' }),
  // Hạt giống
  I({ id: 'seed_sunflower', name: 'Hạt hướng dương', cat: 'seed', price: 5, level: 1, style: 'sunflower', desc: 'Lớn sau 3 thử thách.' }),
  I({ id: 'seed_tomato', name: 'Hạt cà chua', cat: 'seed', price: 8, level: 1, style: 'tomato', desc: 'Thu hoạch được 10 xu.' }),
  I({ id: 'seed_strawberry', name: 'Hạt dâu tây', cat: 'seed', price: 12, level: 2, style: 'strawberry', desc: 'Thu hoạch được 15 xu.' }),
  I({ id: 'seed_magic', name: 'Hạt cây phép thuật', cat: 'seed', price: 30, level: 4, style: 'magic', desc: 'Ra quả ngôi sao lấp lánh!' }),
  // Vật phẩm nhiệm vụ
  I({ id: 'apple', name: 'Quả táo', cat: 'quest', price: 0, level: 1, hidden: true, style: 'apple' }),
  I({ id: 'banana', name: 'Quả chuối', cat: 'quest', price: 0, level: 1, hidden: true, style: 'banana' }),
  I({ id: 'fish', name: 'Con cá', cat: 'quest', price: 0, level: 1, hidden: true, style: 'fish' }),
  I({ id: 'gift', name: 'Hộp quà', cat: 'quest', price: 0, level: 1, hidden: true, style: 'gift' }),
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function item(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

export const CAT_NAMES: Record<ItemCat, string> = {
  shirt: 'Áo',
  pants: 'Quần – váy',
  shoes: 'Giày',
  hat: 'Mũ',
  backpack: 'Balo',
  acc: 'Phụ kiện',
  pet: 'Thú cưng',
  board: 'Ván trượt',
  decor: 'Trang trí nhà',
  seed: 'Hạt giống',
  quest: 'Vật phẩm',
};

export const DECOR_SLOT_NAMES: Record<DecorSlot, string> = {
  rug: 'Thảm',
  lamp: 'Đèn',
  corner: 'Góc phòng',
  sofa: 'Ghế',
  shelf: 'Kệ',
  wall1: 'Tường trái',
  wall2: 'Tường giữa',
  wall3: 'Tường phải',
  table: 'Bàn',
  bedside: 'Cạnh giường',
  corner2: 'Góc lớn',
};

/** Thông số cây trồng. */
export const PLANTS: Record<string, { stages: number; harvest: { coins: number; xp: number }; name: string }> = {
  sunflower: { stages: 3, harvest: { coins: 6, xp: 5 }, name: 'Hướng dương' },
  tomato: { stages: 3, harvest: { coins: 10, xp: 5 }, name: 'Cà chua' },
  strawberry: { stages: 4, harvest: { coins: 15, xp: 8 }, name: 'Dâu tây' },
  magic: { stages: 5, harvest: { coins: 40, xp: 20 }, name: 'Cây phép thuật' },
};

export const SKIN_TONES = ['#ffe0c7', '#f6c9a4', '#e0a77e', '#b97c56', '#8d5a3b'];
export const HAIR_COLORS = ['#3b2b2b', '#6b4226', '#c68642', '#f2c14e', '#e86a92', '#7a5cff'];
export const HAIR_STYLES = ['Ngắn', 'Tóc dựng', 'Tóc dài', 'Hai bím', 'Tóc nấm', 'Tóc xoăn'];
export const EYE_COLORS = ['#3b2b2b', '#2f6db5', '#2e8b57', '#7b4a2a'];
