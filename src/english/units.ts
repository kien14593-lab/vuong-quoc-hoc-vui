/**
 * Danh sách Unit Tiếng Anh theo lớp – bám theo tên chủ đề của bộ "Tiếng Anh Global Success"
 * (Kết nối tri thức với cuộc sống). Chỉ dùng tên chủ đề; thầy cô sửa tên Unit ngay trong bảng này.
 * File nhỏ, luôn có trong bản chính (màn hình Cài đặt/Bảng theo dõi cần tên Unit).
 */
import type { Grade } from '../math/types';

export const UNIT_TITLES: Record<Grade, string[]> = {
  1: [
    'In the school playground',
    'In the dining room',
    'At the street market',
    'In the bedroom',
    'At the fish and chip shop',
    'In the classroom',
    'In the garden',
    'In the park',
    'In the shop',
    'At the zoo',
    'At the bus stop',
    'At the lake',
    'In the school canteen',
    'In the toy shop',
    'At the football match',
    'At home',
  ],
  2: [
    'At my birthday party',
    'In the backyard',
    'At the seaside',
    'In the countryside',
    'In the classroom',
    'On the farm',
    'In the kitchen',
    'In the village',
    'In the grocery store',
    'At the zoo',
    'In the playground',
    'At the café',
    'In the maths class',
    'At home',
    'In the clothes shop',
    'At the campsite',
  ],
  3: [
    'Hello',
    'Our names',
    'Our friends',
    'Our bodies',
    'My hobbies',
    'Our school',
    'Classroom instructions',
    'My school things',
    'Colours',
    'Break time activities',
    'My family',
    'Jobs',
    'My house',
    'My bedroom',
    'At the dining table',
    'My pets',
    'Our toys',
    'Playing and doing',
    'Outdoor activities',
    'At the zoo',
  ],
  4: [
    'My friends',
    'Time and daily routines',
    'My week',
    'My birthday party',
    'Things we can do',
    'Our school facilities',
    'Our timetables',
    'My favourite subjects',
    'Our sports day',
    'Our summer holidays',
    'My home',
    'Jobs',
    'Appearance',
    'Daily activities',
    "My family's weekends",
    'Weather',
    'In the city',
    'At the shopping centre',
    'The animal world',
    'At summer camp',
  ],
  5: [
    'All about me!',
    'Our homes',
    'My foreign friends',
    'Our free-time activities',
    'My future job',
    'Our school rooms',
    'Our favourite school activities',
    'In our classroom',
    'Our outdoor activities',
    'Our school trip',
    'Family time',
    'Our Tet holiday',
    'Our special days',
    'Staying healthy',
    'Our health',
    'Seasons and the weather',
    'Stories for children',
    'Means of transport',
    'Places of interest',
    'Our summer holiday',
  ],
};

/** Chữ cái trọng tâm của từng Unit Lớp 1 (Unit 1 → b, Unit 2 → c, …). */
export const G1_LETTERS: string[] = ['b', 'c', 'a', 'd', 'i', 'e', 'g', 'h', 'o', 'm', 'u', 'l', 'n', 't', 'f', 'w'];

/**
 * Âm trọng tâm của từng Unit Lớp 2. Chỉ dùng cho câu hỏi "âm/chữ đầu" và lời gợi ý.
 * kind: 'start' = âm đầu từ (được hỏi "bắt đầu bằng…"), 'end' = âm cuối, 'pattern' = vần (i_e, a_e),
 * 'numbers' = Unit về số đếm. Thầy cô có thể sửa bảng này.
 */
export type SoundKind = 'start' | 'end' | 'pattern' | 'numbers';
export const G2_SOUNDS: { sound: string; kind: SoundKind }[] = [
  { sound: 'p', kind: 'start' },
  { sound: 'k', kind: 'start' },
  { sound: 's', kind: 'start' },
  { sound: 'r', kind: 'start' },
  { sound: 'qu', kind: 'start' },
  { sound: 'x', kind: 'end' },
  { sound: 'j', kind: 'start' },
  { sound: 'v', kind: 'start' },
  { sound: 'y', kind: 'start' },
  { sound: 'z', kind: 'start' },
  { sound: 'i_e', kind: 'pattern' },
  { sound: 'a_e', kind: 'pattern' },
  { sound: '11–15', kind: 'numbers' },
  { sound: 'er', kind: 'end' },
  { sound: 'sh', kind: 'start' },
  { sound: 't', kind: 'start' },
];

export function unitCount(grade: Grade): number {
  return UNIT_TITLES[grade].length;
}

/** Tên Unit, ví dụ "Unit 3: At the street market". */
export function unitTitle(grade: Grade, unit: number): string {
  const t = UNIT_TITLES[grade][unit - 1];
  return t ? `Unit ${unit}: ${t}` : `Unit ${unit}`;
}

/** Giới hạn "Đang học đến Unit N" về khoảng hợp lệ; null = học tất cả. */
export function clampUnit(grade: Grade, unit: number | null | undefined): number | null {
  if (unit == null || !Number.isFinite(unit)) return null;
  const n = Math.round(unit);
  if (n >= unitCount(grade)) return null;
  return Math.max(1, n);
}

/** Chữ/âm đầu được hỏi ở Lớp 1–2 trong phạm vi Unit 1..N (Lớp 1: chữ trọng tâm; Lớp 2: âm đầu). */
export function phonicsTargets(grade: Grade, upto: number | null): string[] {
  const n = upto ?? unitCount(grade);
  if (grade === 1) return G1_LETTERS.slice(0, n);
  if (grade === 2) return G2_SOUNDS.slice(0, n).filter((s) => s.kind === 'start').map((s) => s.sound);
  return [];
}

/** Âm trọng tâm của một Unit (dùng trong lời gợi ý). */
export function unitFocus(grade: Grade, unit: number): string | null {
  if (grade === 1) return G1_LETTERS[unit - 1] ?? null;
  if (grade === 2) return G2_SOUNDS[unit - 1]?.sound ?? null;
  return null;
}
