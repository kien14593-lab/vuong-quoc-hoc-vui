/** Kích thước logic của game (Full HD). Canvas và lớp giao diện HTML đều co giãn theo tỉ lệ này. */
export const GAME_W = 1920;
export const GAME_H = 1080;

/** Kích thước một ô bản đồ (px). */
export const TILE = 64;

export const FONT_FAMILY = '"Baloo 2", "Segoe UI", system-ui, sans-serif';

/** Bảng màu pastel dùng chung cho đồ họa và giao diện. */
export const COLORS = {
  ink: '#4a3f6b',
  outline: '#5b4a6e',
  cream: '#fff8ee',
  pink: '#ff8fab',
  pinkLight: '#ffd6e8',
  blue: '#7ec8e3',
  blueLight: '#d6f0ff',
  green: '#7bd389',
  greenLight: '#d9f7dc',
  yellow: '#ffd166',
  yellowLight: '#fff1c1',
  purple: '#b79cff',
  purpleLight: '#ece4ff',
  orange: '#ffa96b',
  red: '#ff6b6b',
  white: '#ffffff',
} as const;

export const SAVE_PREFIX = 'vqth';

/** Phiên bản dữ liệu lưu – tăng khi đổi cấu trúc hồ sơ. */
export const SAVE_VERSION = 1;
