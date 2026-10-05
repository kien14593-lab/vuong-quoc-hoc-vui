import { sfx } from '../core/audio';
import { profile, recordAnswer, skill, type AnswerResult } from '../core/state';
import { GRADE_TOPICS, TOPICS } from '../math/curriculum';
import { generate, isCorrect, pickTopic, sanitize } from '../math/engine';
import { ballsQuestion, beatTopic, scripted, usesScripted, type BeatId } from '../math/scripted';
import type { MathTopic, Question, Topic, WordTheme } from '../math/types';
import { coinIcon } from '../ui/icons';
import { rewardBurst, toast } from '../ui/toast';

/** Phản hồi đúng theo kịch bản – không gây áp lực, không "Game Over". */
export const FEEDBACK = {
  correct: '🎉 Chính xác! Tuyệt vời!',
  retry: '😊 Chưa đúng rồi. Hãy thử lại nhé!',
  hint: '💡 Gợi ý: ',
  steps: '🧩 Mình cùng làm từng bước nhé!',
} as const;

export type Stage = 'correct' | 'retry' | 'hint' | 'steps';

export interface SubmitResult {
  correct: boolean;
  stage: Stage;
  message: string;
}

/**
 * Dòng phản hồi ngay dưới câu hỏi. Ở mức gợi ý và từng bước, bóng nói trợ giúp đã hiện
 * cùng nội dung → để trống dòng này cho bé chỉ đọc một lần.
 */
export function feedbackLine(r: SubmitResult): string {
  return r.stage === 'hint' || r.stage === 'steps' ? '' : r.message;
}

/** Theo dõi số lần thử của một câu hỏi và quyết định mức hỗ trợ. */
export class AttemptTracker {
  attempts = 0;
  wrong = 0;
  solved = false;
  readonly started = performance.now();
  readonly tried = new Set<string>();

  constructor(readonly q: Question) {}

  submit(value: string): SubmitResult {
    if (this.solved) return { correct: true, stage: 'correct', message: FEEDBACK.correct };
    this.attempts++;
    if (isCorrect(this.q, value)) {
      this.solved = true;
      return { correct: true, stage: 'correct', message: FEEDBACK.correct };
    }
    this.tried.add(value);
    this.wrong++;
    if (this.wrong === 1) return { correct: false, stage: 'retry', message: FEEDBACK.retry };
    if (this.wrong === 2) return { correct: false, stage: 'hint', message: FEEDBACK.hint + this.q.hint };
    return { correct: false, stage: 'steps', message: FEEDBACK.steps };
  }

  get ms(): number {
    return performance.now() - this.started;
  }
}

/* ---------------- Sinh câu hỏi ---------------- */
export function adaptiveQuestion(topic: MathTopic, o: { theme?: WordTheme; levelDelta?: number; level?: number } = {}): Question {
  const s = skill(topic);
  const lv = o.level ?? s.level + (o.levelDelta ?? 0);
  return generate(topic, lv, { grade: profile().grade, support: s.support, theme: o.theme });
}

/** Câu hỏi cho một tình huống cốt truyện: lớp 1–2 dùng đúng câu của kịch bản, lớp 3–5 sinh theo năng lực. */
export function storyQuestion(beat: BeatId, theme?: WordTheme): Question {
  const grade = profile().grade;
  if (beat === 'balls') return sanitize(ballsQuestion({ grade }));
  if (usesScripted(beat, grade)) {
    const q = scripted(beat, { grade });
    return sanitize(scripted(beat, { grade, support: skill(q.topic).support }));
  }
  return adaptiveQuestion(beatTopic(beat, grade), { theme });
}

/** Trọng số ưu tiên chủ đề còn yếu hoặc ít luyện. */
export function topicWeights(topics: Topic[]): Partial<Record<Topic, number>> {
  const p = profile();
  const w: Partial<Record<Topic, number>> = {};
  for (const t of topics) {
    const st = p.stats[t];
    if (!st || st.q < 3) w[t] = 1.6;
    else w[t] = 0.6 + (1 - st.first / st.q) * 1.6;
  }
  return w;
}

export function mixedQuestion(topics?: MathTopic[], theme?: WordTheme): Question {
  const list = topics && topics.length ? topics : GRADE_TOPICS[profile().grade];
  return adaptiveQuestion(pickTopic(list, topicWeights(list)), { theme });
}

/* ---------------- Ghi nhận & thưởng ---------------- */
export interface FinishOpts {
  src: string;
  rewards?: boolean;
  quiet?: boolean;
  at?: { x: number; y: number };
}

export function finishQuestion(q: Question, attempts: number, ms: number, o: FinishOpts): AnswerResult {
  const res = recordAnswer(q.topic, q.level, attempts, ms, o.src, { rewards: o.rewards });
  if (!o.quiet && (res.xp || res.coins)) {
    sfx('coin');
    rewardBurst(
      [
        { icon: '✨', text: `+${res.xp} XP`, cls: 'xp' },
        { icon: coinIcon(), text: `+${res.coins} xu`, cls: 'coin' },
      ],
      o.at,
    );
  }
  if (res.change === 'up' && !o.quiet) toast(`Bạn đã lên mức thử thách mới ở ${TOPICS[q.topic].name}!`, { icon: '🚀', tone: 'good' });
  return res;
}
