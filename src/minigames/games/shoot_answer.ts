import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, capsule, cone, cyl, rbox, torus } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { fitPlate, textPlate } from '../../engine/text';
import { fmt, MINUS, numChoices } from '../../math/util';
import type { Question } from '../../math/types';
import { MiniGame, type MiniHost, type MiniInfo } from '../base';
import { defineMini } from '../registry';

type Target = THREE.Group & { userData: { value: string; ok?: boolean; hit?: boolean } };
const ss = { flat: false } as const;

function answerPlate(value: string, color: string, fit = false): THREE.Mesh {
  const o = { bg: '#fff8ee', border: color, color: '#4b3d68', size: 132, pad: 54, radius: 96, weight: 900, doubleSided: true };
  return fit ? fitPlate(value, 1.3, 0.72, o) : textPlate(value, 0.72, o);
}

class ShootAnswerGame extends MiniGame {
  private targets: Target[] = [];
  private ball = new THREE.Group();
  private thrower!: THREE.Group;
  private busy = false;

  constructor(info: MiniInfo, host: MiniHost) {
    super(info, host);
  }

  protected build(): void {
    this.sky('#a9e0ff', '#fff1d6', 45, 120);
    this.ground('#b8df79', 80, 80);
    this.view([0, 3.45, 8.2], [0, 0.55, -2.6], 43);
    this.thrower = this.model('player', undefined, [0, 0, 1.65], Math.PI, 0.62);
    const st = this.anim(this.thrower);
    if (st) st.move = 0.15;
    this.scene.add(rbox(9.7, 0.25, 0.55, 0.08, PAL.wood, { p: [0, 0.25, -2.6], base: true }));
    this.scene.add(rbox(10.2, 0.22, 0.32, 0.08, tint(PAL.wood, -0.12), { p: [0, 1.45, -2.72], base: true }));
    for (let i = 0; i < 11; i++) this.scene.add(cyl(0.055, 0.075, 1.35, PAL.woodDark, { p: [-4.8 + i * 0.96, 0.8, -2.75], seg: 8 }));
    for (let i = 0; i < 13; i++) {
      const x = -4.7 + i * 0.78;
      const bun = cone(0.18, 0.25, i % 3 === 0 ? '#ff6b6b' : i % 3 === 1 ? '#ffd166' : '#4ecdc4', { p: [x, 1.8, -2.6], r: [180, 0, 0], seg: 3 });
      this.scene.add(bun);
    }
    this.ball.add(ball(0.13, '#74c0fc', { seg: 14 }), torus(0.13, 0.01, '#ffffff', { r: [90, 0, 0], ts: 18, seg: 4 }));
    this.ball.visible = false;
    this.scene.add(this.ball);
    this.onPointer('tap', (e) => void this.tapTarget(e));
  }

  protected tick(dt: number, t: number): void {
    for (let i = 0; i < this.targets.length; i++) {
      const g = this.targets[i];
      if (!g.parent || g.userData.hit) continue;
      g.position.x += Math.sin(t * 0.7 + i * 1.7) * dt * 0.45;
      g.rotation.z = Math.sin(t * 1.4 + i) * 0.05;
    }
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearTargets();
      const q = this.isEn ? this.enQ({ short: true }) : this.makeAddSubQuestion();
      this.spawnTargets(q);
      const round = this.ask(q, { buttons: false, visual: true });
      await round.done;
      await this.successPop();
      if (!(await this.nextRound())) break;
    }
  }

  private makeAddSubQuestion(): Question {
    const grade = this.grade;
    const topic = this.round % 2 === 0 ? 'add' : 'sub';
    let a = 0;
    let b = 0;
    if (grade === 1) {
      a = 2 + ((this.round * 3) % 8);
      b = 1 + ((this.round * 2) % 6);
    } else if (grade === 2) {
      a = 18 + this.round * 3;
      b = 7 + ((this.round * 5) % 20);
    } else if (grade === 3) {
      a = 120 + this.round * 17;
      b = 35 + ((this.round * 13) % 70);
    } else if (grade === 4) {
      a = 1000 + this.round * 137;
      b = 210 + ((this.round * 71) % 500);
    } else {
      a = 2.4 + this.round * 0.3;
      b = 0.7 + (this.round % 4) * 0.2;
    }
    if (topic === 'sub' && b > a) [a, b] = [b, a];
    const ans = topic === 'add' ? a + b : a - b;
    const choices = numChoices(ans, [ans + 1, ans - 1, ans + b, Math.max(0, ans - b), ans + 2], this.grade <= 1 ? 3 : 4, { integer: grade < 5, min: 0 });
    const op = topic === 'add' ? '+' : MINUS;
    return this.makeQuestion({
      topic,
      prompt: `${fmt(a)} ${op} ${fmt(b)} = ?`,
      answer: choices.answer,
      choices: choices.choices.map((c) => c.value),
      hint: topic === 'add' ? 'Cộng thêm từng phần để tìm tổng.' : 'Bớt đi từng phần để tìm hiệu.',
      steps: [`Bắt đầu từ ${fmt(a)}.`, topic === 'add' ? `Cộng ${fmt(b)}.` : `Trừ ${fmt(b)}.`, `Đáp án là ${choices.answer}.`],
      context: 'Rạp bắn bóng',
    });
  }

  private spawnTargets(q: Question): void {
    const xs = q.choices.length === 3 ? [-3.25, 0, 3.25] : [-4.35, -1.45, 1.45, 4.35];
    q.choices.forEach((c, i) => {
      const g = new THREE.Group() as Target;
      const col = ['#ff8fab', '#74c0fc', '#ffd166', '#b197fc'][i % 4];
      const balloon = ball(0.66, col, { p: [0, 0.3, 0], s: [0.95, 1.12, 0.95], seg: 18 });
      const badge = answerPlate(c.label, col, this.isEn);
      badge.position.set(0, 0.36, 0.98);
      g.add(balloon, cone(0.13, 0.22, col, { p: [0, -0.58, 0], r: [180, 0, 0], seg: 8 }), badge, capsule(0.014, 0.7, '#ffffff', { p: [0, -1.03, 0], seg: 5 }), ball(0.92, '#ffffff', { p: [0, 0.26, 0], opacity: 0.001, cast: false }));
      g.position.set(xs[i], 1.25, -2.6);
      g.userData.value = c.value;
      g.userData.ok = q.accept?.includes(c.value) ?? c.value === q.answer;
      this.scene.add(g);
      this.targets.push(g);
    });
  }

  private async tapTarget(e: PointerEvent): Promise<void> {
    if (this.busy || !this.current) return;
    const target = this.pick(e.clientX, e.clientY, this.targets);
    if (!target || target.userData.hit) return;
    this.busy = true;
    await this.throwBall(target.position.clone());
    const r = this.current.submit(target.userData.value);
    if (r.correct) await this.popTarget(target, true);
    else await this.wobbleTarget(target);
    this.ball.visible = false;
    this.busy = false;
  }

  private async throwBall(to: THREE.Vector3): Promise<void> {
    const from = new THREE.Vector3(0.35, 1.05, 1.45);
    this.ball.visible = true;
    sfx('whoosh');
    this.tween(0.42, (k) => {
      this.ball.position.lerpVectors(from, to, k);
      this.ball.position.y += Math.sin(k * Math.PI) * 1.4;
      this.ball.rotation.x += 0.25;
    }, { ease: 'outCubic' });
    await this.wait(0.42);
  }

  private async popTarget(t: Target, good: boolean): Promise<void> {
    t.userData.hit = true;
    sfx('pop');
    this.fx.burst(good ? 'confetti' : 'dust', t.position.toArray() as [number, number, number], { count: good ? 36 : 15, spread: 1.1 });
    this.tween(0.25, (k) => t.scale.setScalar(1 + k * 0.45));
    await this.wait(0.18);
    this.remove(t);
    this.targets = this.targets.filter((x) => x !== t);
  }

  private async wobbleTarget(t: Target): Promise<void> {
    sfx('wrong');
    this.fx.burst('dust', t.position.toArray() as [number, number, number], { count: 10, spread: 0.5 });
    const x0 = t.position.x;
    this.tween(0.55, (k) => {
      t.position.x = x0 + Math.sin(k * Math.PI * 8) * 0.22 * (1 - k);
      t.scale.setScalar(1 + Math.sin(k * Math.PI * 6) * 0.08);
    });
    await this.wait(0.55);
    t.position.x = x0;
    t.scale.setScalar(1);
  }

  private async successPop(): Promise<void> {
    const good = this.targets.find((t) => t.userData.ok);
    if (good?.parent) await this.popTarget(good, true);
    const st = this.anim(this.thrower);
    if (st) st.happy = 1;
    await this.wait(0.45);
    if (st) st.happy = 0;
  }

  private clearTargets(): void {
    for (const t of this.targets) if (t.parent) this.remove(t);
    this.targets = [];
  }
}

defineMini(
  {
    id: 'shoot_answer',
    name: '🎯 Bắn đáp án – cộng/trừ',
    icon: '🎯',
    skill: 'Cộng / trừ',
    topics: ['add', 'sub'],
    desc: 'Chạm bóng bay mang đáp án đúng. Bé sẽ ném bóng để làm nổ thật vui!',
    rounds: 4,
    color: '#ff6b6b',
    unlock: 1,
    en: {
      name: 'Bắn từ',
      skill: 'Nghe từ',
      desc: 'Nghe (hoặc đọc) từ tiếng Anh rồi chạm bóng bay có từ đúng. Bé sẽ ném bóng để làm nổ thật vui!',
    },
    both: 'Bắn bóng',
    enTopics: ['en_listen'],
  },
  (info, host) => new ShootAnswerGame(info, host),
);
