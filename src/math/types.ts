export type Grade = 1 | 2 | 3 | 4 | 5;

/** Môn học của một câu hỏi. */
export type Subject = 'math' | 'english';

/** Chủ đề Tiếng Anh (bộ câu hỏi ở src/english/). */
export type EnTopic = 'en_vocab' | 'en_listen' | 'en_phonics' | 'en_spell' | 'en_sentence' | 'en_numbers' | 'en_time';

export type Topic = MathTopic | EnTopic;

export type MathTopic =
  | 'count'
  | 'compare'
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'sequence'
  | 'time'
  | 'length'
  | 'money'
  | 'geometry'
  | 'perimeter'
  | 'area'
  | 'fraction'
  | 'decimal'
  | 'ratio'
  | 'word';

export interface Choice {
  /** Nội dung hiển thị trên nút. */
  label: string;
  /** Giá trị để so khớp đáp án. */
  value: string;
}

/** Mô tả hình minh họa trực quan cho câu hỏi (được vẽ bằng SVG/emoji trong giao diện). */
export type Visual =
  | { kind: 'objects'; emoji: string; groups: number[]; op?: '+' | '-'; crossOut?: number }
  | { kind: 'groups'; emoji: string; groups: number; each: number }
  | { kind: 'share'; emoji: string; total: number; parts: number }
  | { kind: 'compare'; values: string[]; style: 'stones' | 'balls' | 'cards' }
  | { kind: 'pair'; left: string; right: string }
  | { kind: 'blocks'; numbers: number[]; op: '+' | '-' }
  | { kind: 'place'; hundreds: number; tens: number; ones: number }
  | { kind: 'clock'; h: number; m: number }
  | { kind: 'fraction'; n: number; d: number; shape: 'pie' | 'bar' }
  | { kind: 'fractionPair'; a: [number, number]; b: [number, number] }
  | { kind: 'shape'; shape: ShapeName }
  | { kind: 'shapes'; shapes: ShapeName[] }
  | { kind: 'angle'; degrees: number }
  | { kind: 'solid'; solid: 'cube' | 'box' | 'cylinder' | 'sphere' }
  | { kind: 'rect'; w: number; h: number; unit: string; grid?: boolean; square?: boolean }
  | { kind: 'triangle'; a: number; b: number; c: number; unit: string; height?: number }
  | { kind: 'circle'; r: number; unit: string; showDiameter?: boolean }
  | { kind: 'sequence'; items: (string | null)[] }
  | { kind: 'money'; items: { emoji: string; name: string; price: number; qty?: number }[]; budget?: number }
  | { kind: 'ruler'; length: number; object: 'pencil' | 'crayon' | 'ribbon' }
  | { kind: 'lengths'; items: { name: string; length: number; color: string }[] }
  | { kind: 'ratio'; a: { emoji: string; count: number }; b: { emoji: string; count: number } }
  | { kind: 'grid100'; tenths: number; hundredths: number }
  /** Hình lớn (emoji) kèm chú thích tiếng Việt; `hex` = ô màu (câu hỏi màu sắc). */
  | { kind: 'picture'; emoji?: string; caption?: string; hex?: string }
  /** Thẻ "Nghe" lớn: bấm để nghe lại phần tiếng Anh (`Question.en`). */
  | { kind: 'listen' }
  /** Các ô chữ cái; `null` = ô trống cần điền. */
  | { kind: 'letters'; tiles: (string | null)[]; emoji?: string; caption?: string };

export type ShapeName =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'rectangle'
  | 'pentagon'
  | 'hexagon'
  | 'oval'
  | 'star'
  | 'diamond';

export interface Question {
  id: string;
  topic: Topic;
  level: number;
  /** Câu hỏi chính, ngắn gọn – ví dụ "4 + 3 = ?". */
  prompt: string;
  /** Lời dẫn tình huống (tùy chọn). */
  context?: string;
  /** Câu đọc to bằng giọng nói. */
  speech: string;
  visual?: Visual;
  choices: Choice[];
  /** Giá trị của lựa chọn đúng. */
  answer: string;
  /** Nếu có: mọi giá trị trong danh sách đều được chấp nhận là đúng (ví dụ "ném vào số lớn hơn 17"). */
  accept?: string[];
  /** Gợi ý dùng khi trả lời sai lần 2. */
  hint: string;
  /** Lời giải từng bước dùng khi trả lời sai lần 3. */
  steps: string[];
  /**
   * Câu hỏi Tiếng Anh: phần tiếng Anh (từ hoặc câu đầy đủ, đã điền đáp án) – đọc bằng giọng tiếng Anh
   * khi bấm thẻ Nghe và sau khi trả lời đúng. Trong `prompt`/`speech`/`hint`, phần tiếng Anh được đặt trong «…».
   */
  en?: string;
  /** Câu hỏi nghe: phần tiếng Anh không hiện trên màn hình, chỉ được đọc to. */
  listen?: boolean;
}

export interface GenOptions {
  grade: Grade;
  /** Người chơi đang gặp khó khăn → tăng hỗ trợ: thêm hình minh họa, ít lựa chọn hơn. */
  support?: boolean;
  /** Chủ đề trang trí (đồ vật/con vật) cho bài toán có lời văn. */
  theme?: WordTheme;
}

export interface WordTheme {
  /** Ai/cái gì – ví dụ "Khỉ" */
  who: string;
  /** Đồ vật – ví dụ "quả chuối" */
  item: string;
  /** Đơn vị đếm ngắn – ví dụ "quả" */
  unit: string;
  emoji: string;
}
