import { maxLevelFor, startLevel } from './curriculum';
import type { Grade, Topic } from './types';

/**
 * Trạng thái kỹ năng của một chủ đề.
 * - Trả lời đúng ngay lần đầu 3 câu liên tiếp → tăng 1 mức.
 * - 2 câu phải thử từ 3 lần trở lên → giảm 1 mức; bật "chế độ hỗ trợ" (thêm hình minh họa, ít lựa chọn).
 */
export interface SkillState {
  level: number;
  streak: number;
  struggle: number;
  support: boolean;
}

export const STREAK_UP = 3;
export const STRUGGLE_DOWN = 2;

export function initialSkill(topic: Topic, grade: Grade): SkillState {
  return { level: startLevel(topic, grade), streak: 0, struggle: 0, support: false };
}

export type SkillChange = 'up' | 'down' | null;

export function updateSkill(s: SkillState, attempts: number, topic: Topic, grade: Grade): { state: SkillState; change: SkillChange } {
  const next: SkillState = { ...s };
  let change: SkillChange = null;
  const cap = maxLevelFor(topic, grade);
  if (attempts <= 1) {
    next.streak += 1;
    next.struggle = Math.max(0, next.struggle - 1);
    if (next.support && next.streak >= 2) next.support = false;
    if (next.streak >= STREAK_UP) {
      next.streak = 0;
      if (next.level < cap) {
        next.level += 1;
        change = 'up';
      }
    }
  } else if (attempts === 2) {
    next.streak = 0;
  } else {
    next.streak = 0;
    next.struggle += 1;
    next.support = true;
    if (next.struggle >= STRUGGLE_DOWN) {
      next.struggle = 0;
      if (next.level > 1) {
        next.level -= 1;
        change = 'down';
      }
    }
  }
  if (next.level > cap) next.level = cap;
  return { state: next, change };
}
