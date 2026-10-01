import type { Goal, Profile } from './state';

export interface GoalProgress {
  done: number;
  target: number;
  pct: number;
  completed: boolean;
}

export function goalProgress(p: Profile, goal: Goal): GoalProgress {
  const start = new Date(`${goal.week}T00:00:00`).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const done = p.log.filter((entry) => entry.t >= start && entry.t < end && (goal.topic === 'any' || entry.topic === goal.topic)).length;
  const target = Math.max(1, goal.target);
  return { done, target, pct: Math.min(1, done / target), completed: done >= target };
}

export function goalsForWeek(p: Profile, week: string): Goal[] {
  return p.goals.filter((goal) => goal.week === week);
}
