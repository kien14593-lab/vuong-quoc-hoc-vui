export type Grade = 1 | 2 | 3 | 4 | 5;

export type Topic =
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
  | { kind: 'grid100'; tenths: number; hundredths: number };

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
