import { canListen } from '../core/speech';
import { hasProfile, sitePick } from '../core/state';
import type { SubjectMode } from '../math/types';
import { subject } from './subject';

/**
 * Lời thoại, mục tiêu, biển báo… có nhắc tới môn học. Cột `math` giữ đúng chữ của bản chỉ có Toán
 * (có kiểm thử ghim lại); `english` cho bé chỉ học Tiếng Anh; `both` là lời chung cho bé học cả hai môn.
 * Tên riêng (khu vực, danh hiệu, huy hiệu) không nằm ở đây – mọi bé đều thấy cùng một tên.
 */
export type SubjectText = Record<SubjectMode, string>;

function rows<K extends string>(r: Record<K, SubjectText>): Record<K, SubjectText> {
  return r;
}

export const TEXT = rows({
  /* ---------- Nhà, cửa hàng ---------- */
  'house.intro': {
    math: 'Mình có thể trang trí phòng, trồng cây ở vườn nhỏ, xem huy hiệu và luyện tập toán ở bàn học.',
    english: 'Mình có thể trang trí phòng, trồng cây ở vườn nhỏ, xem huy hiệu và luyện tập tiếng Anh ở bàn học.',
    both: 'Mình có thể trang trí phòng, trồng cây ở vườn nhỏ, xem huy hiệu và luyện tập ở bàn học.',
  },
  'house.grow': {
    math: 'Giải thêm bài toán để cây lớn nhé!',
    english: 'Trả lời thêm câu hỏi tiếng Anh để cây lớn nhé!',
    both: 'Giải thêm câu đố để cây lớn nhé!',
  },
  'house.bed': {
    math: 'Nghỉ một chút rồi mình sẽ học toán tiếp.',
    english: 'Nghỉ một chút rồi mình sẽ học tiếng Anh tiếp.',
    both: 'Nghỉ một chút rồi mình sẽ học tiếp.',
  },
  'shop.more': {
    math: 'Hãy giải toán hoặc chơi mini-game để có thêm xu nhé!',
    english: 'Hãy trả lời câu hỏi tiếng Anh hoặc chơi mini-game để có thêm xu nhé!',
    both: 'Hãy giải câu đố hoặc chơi mini-game để có thêm xu nhé!',
  },

  /* ---------- Làng ---------- */
  'village.tipBridge': {
    math: 'Nghe nói trong Rừng Thông Thái có cây cầu chỉ hạ xuống khi giải đúng phép cộng đấy!',
    english: 'Nghe nói trong Rừng Thông Thái có cây cầu chỉ hạ xuống khi trả lời đúng câu tiếng Anh đấy!',
    both: 'Nghe nói trong Rừng Thông Thái có cây cầu chỉ hạ xuống khi giải đúng câu đố đấy!',
  },
  'village.tipCount': {
    math: 'Mình thích đếm hoa lắm: 1, 2, 3, 4, 5…',
    english: 'Mình thích đếm hoa bằng tiếng Anh lắm: «one, two, three, four, five»…',
    both: 'Mình thích đếm hoa lắm: 1, 2, 3… và cả «one, two, three» nữa!',
  },
  'village.tipLevel': {
    math: 'Muốn lên cấp nhanh thì hãy chơi mini-game và giải thật nhiều bài toán nhé!',
    english: 'Muốn lên cấp nhanh thì hãy chơi mini-game và trả lời thật nhiều câu hỏi tiếng Anh nhé!',
    both: 'Muốn lên cấp nhanh thì hãy chơi mini-game và giải thật nhiều câu đố nhé!',
  },
  'village.shopAsk': {
    math: 'Nhưng trước tiên, bạn giải giúp cô bài toán mua trái cây này nhé!',
    english: 'Nhưng trước tiên, bạn giúp cô chọn đúng loại quả nhé!',
    both: 'Nhưng trước tiên, bạn giúp cô chọn đúng loại quả nhé!',
  },
  'village.shopDone': {
    math: 'Giỏi quá! Bạn tính tiền rất nhanh.',
    english: 'Giỏi quá! Bạn biết tên các loại quả bằng tiếng Anh rồi.',
    both: 'Giỏi quá! Bạn biết tên các loại quả bằng tiếng Anh rồi.',
  },
  'village.bear': {
    math: 'Mình muốn đến Sở Thú thăm bạn Hươu cao cổ, nhưng đường đi có nhiều thử thách toán học quá.',
    english: 'Mình muốn đến Sở Thú thăm bạn Hươu cao cổ, nhưng đường đi có nhiều thử thách tiếng Anh quá.',
    both: 'Mình muốn đến Sở Thú thăm bạn Hươu cao cổ, nhưng đường đi có nhiều thử thách quá.',
  },

  /* ---------- Dòng giới thiệu khu vực (bản đồ, bảng tên khu) ---------- */
  'sub.forest': {
    math: 'Cộng, trừ và thử thách trực quan',
    english: 'Từ vựng, nghe và thử thách trực quan',
    both: 'Câu đố và thử thách trực quan',
  },
  'sub.maze': {
    math: 'Giải toán để chọn đúng đường',
    english: 'Trả lời tiếng Anh để chọn đúng đường',
    both: 'Giải câu đố để chọn đúng đường',
  },
  'sub.zoo': {
    math: 'Bài toán về động vật',
    english: 'Tiếng Anh về động vật',
    both: 'Câu đố về động vật',
  },
  'sub.zooZone': {
    math: 'Chăm sóc động vật bằng toán học',
    english: 'Chăm sóc động vật bằng tiếng Anh',
    both: 'Giải đố, chăm sóc động vật',
  },

  /* ---------- Lên cấp để mở Lâu Đài ---------- */
  'lock.castleDo': {
    math: 'Hãy giải toán và chơi mini-game để lên cấp nhé!',
    english: 'Hãy trả lời câu hỏi tiếng Anh và chơi mini-game để lên cấp nhé!',
    both: 'Hãy giải câu đố và chơi mini-game để lên cấp nhé!',
  },
  'obj.levelUp': {
    math: '(chơi mini-game, giải toán)',
    english: '(chơi mini-game, trả lời câu hỏi tiếng Anh)',
    both: '(chơi mini-game, giải câu đố)',
  },

  /* ---------- Rừng: cây cầu của Bác Cú (nơi "forest.bridge") ---------- */
  'bridge.obj': {
    math: 'Mở Cầu Phép Cộng',
    english: 'Mở Cầu Từ Vựng',
    both: 'Mở cây cầu của Bác Cú',
  },
  'bridge.objStory': {
    math: 'Mở Cầu Phép Cộng trong rừng',
    english: 'Mở Cầu Từ Vựng trong rừng',
    both: 'Mở cây cầu của Bác Cú trong rừng',
  },
  'bridge.quest': {
    math: 'Mở Cầu Phép Cộng của Bác Cú',
    english: 'Mở Cầu Từ Vựng của Bác Cú',
    both: 'Mở cây cầu của Bác Cú',
  },
  'bridge.sign': {
    math: '🌉 Cầu Phép Cộng',
    english: '🌉 Cầu Từ Vựng',
    both: '🌉 Cầu của Bác Cú',
  },
  'bridge.title': {
    math: 'Cầu Phép Cộng',
    english: 'Cầu Từ Vựng',
    both: 'Cầu của Bác Cú',
  },
  'bridge.label': {
    math: 'Giải để hạ cầu',
    english: 'Trả lời để hạ cầu',
    both: 'Giải đố để hạ cầu',
  },
  'bridge.owl': {
    math: 'Muốn hạ Cầu Phép Cộng, con hãy giải phép tính trên bảng nhé!',
    english: 'Muốn hạ Cầu Từ Vựng, con hãy trả lời câu hỏi tiếng Anh trên bảng nhé!',
    both: 'Muốn hạ cầu, con hãy giải câu đố trên bảng nhé!',
  },

  /* ---------- Rừng: tảng đá (nơi "forest.rock") ---------- */
  'rock.buddy': {
    math: 'Tảng đá to quá! Chắc phép trừ sẽ làm nó vỡ ra.',
    english: 'Tảng đá to quá! Chắc đánh vần đúng sẽ làm nó vỡ ra.',
    both: 'Tảng đá to quá! Chắc giải đúng câu đố sẽ làm nó vỡ ra.',
  },
  'rock.label': {
    math: 'Giải để phá đá',
    english: 'Trả lời để phá đá',
    both: 'Giải đố để phá đá',
  },

  /* ---------- Rừng: cây cầu bị khóa của Chú Gấu (nơi "forest.bearBridge") ---------- */
  'bearBridge.buddy': {
    math: 'Cây cầu này bị khóa. Mình cần đủ tấm ván để mở nó – bạn tính giúp mình nhé!',
    english: 'Cây cầu này bị khóa. Bạn trả lời câu hỏi tiếng Anh để mở giúp mình nhé!',
    both: 'Cây cầu này bị khóa. Bạn giải câu đố để mở giúp mình nhé!',
  },
  'bearBridge.ask': {
    math: 'Cầu này cần thêm ván mới đi qua được. Bạn tính giúp mình nhé!',
    english: 'Cầu này bị khóa. Bạn trả lời câu hỏi tiếng Anh để mở giúp mình nhé!',
    both: 'Cầu này bị khóa. Bạn giải câu đố để mở giúp mình nhé!',
  },

  /* ---------- Rừng: đá kê chân qua suối (nơi "forest.stones") ---------- */
  'stones.obj': {
    math: 'Chọn viên đá lớn nhất để qua suối',
    english: 'Chọn đúng viên đá để qua suối',
    both: 'Chọn đúng viên đá để qua suối',
  },
  'stones.step': {
    math: 'Chọn viên đá lớn nhất',
    english: 'Chọn đúng viên đá để qua suối',
    both: 'Chọn đúng viên đá để qua suối',
  },
  'stones.buddy': {
    math: 'Mình sẽ đứng sau bạn. Hãy chọn viên đá có số lớn nhất nhé!',
    english: 'Mình sẽ đứng sau bạn. Hãy chọn viên đá đúng với câu hỏi tiếng Anh nhé!',
    both: 'Mình sẽ đứng sau bạn. Hãy chọn viên đá đúng nhé!',
  },
  'stones.label': {
    math: 'Chọn đá lớn nhất',
    english: 'Chọn đá đúng',
    both: 'Chọn đá đúng',
  },
  'stones.sign': {
    math: 'Chọn viên đá lớn nhất',
    english: 'Chọn viên đá đúng',
    both: 'Chọn viên đá đúng',
  },

  /* ---------- Mê cung ---------- */
  'maze.exit': {
    math: 'Đủ 3 chìa khóa rồi. Cổng cuối đang chờ bạn giải một phép tính nữa!',
    english: 'Đủ 3 chìa khóa rồi. Cổng cuối đang chờ bạn trả lời một câu tiếng Anh nữa!',
    both: 'Đủ 3 chìa khóa rồi. Cổng cuối đang chờ bạn giải một câu đố nữa!',
  },
  'maze.tip': {
    math: 'Nếu gặp nhiều cửa, cháu đọc câu hỏi trước rồi nhìn số trên từng cửa.',
    english: 'Nếu gặp nhiều cửa, cháu đọc câu hỏi trước rồi nhìn chữ, hình trên từng cửa.',
    both: 'Nếu gặp nhiều cửa, cháu đọc câu hỏi trước rồi nhìn đáp án trên từng cửa.',
  },
  'maze.doors': {
    math: 'Ở mỗi ngã rẽ, bạn sẽ thấy nhiều cánh cửa có số.',
    english: 'Ở mỗi ngã rẽ, bạn sẽ thấy nhiều cánh cửa có chữ và hình.',
    both: 'Ở mỗi ngã rẽ, bạn sẽ thấy nhiều cánh cửa ghi đáp án.',
  },

  /* ---------- Khu Vui Chơi ---------- */
  'park.tickets': {
    math: 'Mỗi trò chơi toán học cho mình 1 vé.',
    english: 'Mỗi trò chơi tiếng Anh cho mình 1 vé.',
    both: 'Mỗi trò chơi cho mình 1 vé.',
  },
  'park.balls': {
    math: 'Ném bóng: số nào đúng thì mục tiêu bật tung!',
    english: 'Ném bóng: trúng đáp án tiếng Anh đúng thì mục tiêu bật tung!',
    both: 'Ném bóng: trúng đáp án đúng thì mục tiêu bật tung!',
  },
  'park.welcome': {
    math: 'Mỗi điểm vui chơi là một thử thách toán. Giải đúng thì bạn nhận 1 vé.',
    english: 'Mỗi điểm vui chơi là một thử thách tiếng Anh. Trả lời đúng thì bạn nhận 1 vé.',
    both: 'Mỗi điểm vui chơi là một thử thách nhỏ. Làm đúng thì bạn nhận 1 vé.',
  },
  'park.coaster': {
    math: 'Tàu lượn có 3 toa, mỗi toa 6 chỗ. Mình cùng tính số ghế nhé!',
    english: 'Tàu lượn sắp chạy rồi! Bạn trả lời đúng câu tiếng Anh để tàu xuất phát nhé!',
    both: 'Tàu lượn sắp chạy rồi! Bạn giải đúng câu đố để tàu xuất phát nhé!',
  },

  /* ---------- Sở thú ---------- */
  'zoo.keeper': {
    math: 'Bạn hãy ghé từng chuồng, giải toán rồi cho các bạn thú ăn. Các bạn ấy thích bạn lắm!',
    english: 'Bạn hãy ghé từng chuồng, trả lời câu hỏi tiếng Anh rồi cho các bạn thú ăn. Các bạn ấy thích bạn lắm!',
    both: 'Bạn hãy ghé từng chuồng, giải câu đố rồi cho các bạn thú ăn. Các bạn ấy thích bạn lắm!',
  },
  'zoo.gate': {
    math: 'Nhớ: giải toán xong thì tự tay cho các bạn ấy ăn trong thế giới nha!',
    english: 'Nhớ: trả lời câu hỏi tiếng Anh xong thì tự tay cho các bạn ấy ăn trong thế giới nha!',
    both: 'Nhớ: giải câu đố xong thì tự tay cho các bạn ấy ăn trong thế giới nha!',
  },
  'zoo.giraffe': {
    math: 'Mình cần chuẩn bị giỏ táo trước. Hãy giải bài toán ở chuồng hươu nhé!',
    english: 'Mình cần chuẩn bị giỏ táo trước. Hãy trả lời câu hỏi tiếng Anh ở chuồng hươu nhé!',
    both: 'Mình cần chuẩn bị giỏ táo trước. Hãy giải câu đố ở chuồng hươu nhé!',
  },
  'zoo.monkey': {
    math: 'Hãy chuẩn bị nải chuối bằng bài toán ở sân khỉ trước nhé!',
    english: 'Hãy chuẩn bị nải chuối bằng câu hỏi tiếng Anh ở sân khỉ trước nhé!',
    both: 'Hãy chuẩn bị nải chuối bằng câu đố ở sân khỉ trước nhé!',
  },
  'zoo.penguins': {
    math: 'Hãy chuẩn bị xô cá bằng bài toán ở hồ cánh cụt trước nhé!',
    english: 'Hãy chuẩn bị xô cá bằng câu hỏi tiếng Anh ở hồ cánh cụt trước nhé!',
    both: 'Hãy chuẩn bị xô cá bằng câu đố ở hồ cánh cụt trước nhé!',
  },
  'zoo.giraffeStep': {
    math: 'Giúp hươu cao cổ giải bài toán về số quả táo',
    english: 'Giúp hươu cao cổ chọn đúng món ăn',
    both: 'Giúp hươu cao cổ chuẩn bị giỏ táo',
  },

  /* ---------- Bảng nhiệm vụ ---------- */
  'quest.shop': {
    math: 'Giải bài toán mua trái cây của Cô Mèo',
    english: 'Giúp Cô Mèo mua trái cây',
    both: 'Giúp Cô Mèo mua trái cây',
  },
  'quest.balls': {
    math: 'Ném bóng trúng số',
    english: 'Ném bóng trúng đích',
    both: 'Ném bóng trúng đích',
  },

  /* ---------- Bảng giáo viên: mục tiêu tuần ---------- */
  'goal.any': {
    math: 'toán',
    english: 'tiếng Anh',
    both: '',
  },
});

export type TextKey = keyof typeof TEXT;

/** Lời theo môn đang học (hoặc theo môn `s` của câu hỏi đã chọn). */
export function st(key: TextKey, s?: SubjectMode): string {
  return TEXT[key][s ?? subject()];
}

/** Môn để chọn lời cho một thử thách cố định: "Cả hai" theo môn đã chọn cho nơi đó (chưa chọn: lời chung). */
export function siteMode(site: string): SubjectMode {
  const m = subject();
  return m === 'both' && hasProfile() ? (sitePick(site) ?? 'both') : m;
}

/** Lời của một thử thách cố định (cầu, tảng đá, đá kê chân, cổng mê cung). */
export function siteText(key: TextKey, site: string): string {
  return TEXT[key][siteMode(site)];
}

/** Mẹo của Chị Nai trong rừng ("Cả hai": lần lượt mẹo Toán rồi mẹo Tiếng Anh). */
let deerTurn = 0;
export function deerTip(): string[] {
  const m = subject();
  const s = m === 'both' ? (deerTurn++ % 2 ? 'english' : 'math') : m;
  if (s === 'math') return ['Mẹo nhỏ: phép cộng là gộp thêm, phép trừ là bớt đi.', 'Nếu bí, hãy nghe gợi ý trên bảng câu hỏi nhé!'];
  return [
    canListen() ? 'Mẹo nhỏ: bấm 🔊 trên bảng câu hỏi để nghe lại từ tiếng Anh.' : 'Mẹo nhỏ: nhìn hình thật kĩ rồi đọc to từ tiếng Anh nhé.',
    'Nếu bí, hãy nghe gợi ý trên bảng câu hỏi nhé!',
  ];
}

/** Dòng giới thiệu dưới tên game ở màn hình tiêu đề (cố định, mô tả cả game). */
export const TAGLINE = 'Phiêu lưu · Khám phá · Toán & Tiếng Anh';

/** Thứ tự và tên các lựa chọn môn học (tạo nhân vật, Cài đặt, bảng giáo viên). */
export const SUBJECT_MODES: SubjectMode[] = ['math', 'english', 'both'];
export const SUBJECT_NAMES: Record<SubjectMode, string> = { math: 'Toán', english: 'Tiếng Anh', both: 'Cả hai' };
export const SUBJECT_ICONS: Record<SubjectMode, string> = { math: '🔢', english: '🔤', both: '🔢🔤' };

/** Tên môn kèm biểu tượng, ví dụ "🔤 Tiếng Anh". */
export function subjectLabel(m: SubjectMode): string {
  return `${SUBJECT_ICONS[m]} ${SUBJECT_NAMES[m]}`;
}
