import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { box, cone, cyl, rbox, torus } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { textPlate } from '../../engine/text';
import { fmt, MINUS, TIMES, DIVIDE, numChoices } from '../../math/util';
import type { Question, Topic } from '../../math/types';
import { MiniGame, type MiniHost, type MiniInfo, type MiniRound } from '../base';
import { defineMini } from '../registry';

type Gate = THREE.Group & { userData: { value: string; ok?: boolean; lane: number } };

function answerBoard(value: string, color: string): THREE.Mesh {
  return textPlate(value, 2.05, { bg: '#fff8ee', border: color, color: '#4b3d68', size: 150, pad: 70, radius: 118, weight: 900, doubleSided: true });
}

class RunnerGame extends MiniGame {
  private lanes = [-2.8, 0, 2.8];
  private lane = 1;
  private runner!: THREE.Group;
  private gates: Gate[] = [];
  private activeRound: MiniRound | null = null;
  private gateZ = -18;
  private speed = 1.55;
  private resolving = false;
  private roadMarks: THREE.Object3D[] = [];

  constructor(info: MiniInfo, host: MiniHost) {
    super(info, host);
  }

  protected build(): void {
    this.sky('#9fd8f7', '#eaf6e4', 50, 130);
    this.ground('#8ed36a', 90, 120);
    this.view([0, 5.0, 11.2], [0, 1.05, -4.8], 46);
    this.scene.add(rbox(8.6, 0.045, 48, 0.15, '#efd9a8', { p: [0, 0.025, -8], base: true }));
    for (const x of [-4.3, 4.3]) this.scene.add(rbox(0.25, 0.06, 48, 0.1, '#d2b47a', { p: [x, 0.06, -8], base: true }));
    for (let i = 0; i < 18; i++) {
      const z = 8 - i * 2.6;
      const mark = box(0.08, 0.012, 0.9, '#ffffff', { p: [-1.4, 0.08, z], base: true });
      const mark2 = box(0.08, 0.012, 0.9, '#ffffff', { p: [1.4, 0.08, z], base: true });
      this.scene.add(mark, mark2);
      this.roadMarks.push(mark, mark2);
    }
    for (let i = 0; i < 18; i++) {
      const z = 10 - i * 3.2;
      const x = i % 2 ? -5.0 : 5.0;
      this.model(i % 3 === 0 ? 'tree_round' : i % 3 === 1 ? 'tree_pine' : 'bush', { v: i }, [x, 0, z], 0, i % 3 === 2 ? 0.9 : 1.1);
    }
    this.runner = this.model('player', undefined, [0, 0, 3.0], Math.PI, 0.78);
    const st = this.anim(this.runner);
    if (st) {
      st.move = 0.8;
      st.run = true;
    }
    this.onKey((e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.moveLane(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.moveLane(1);
      if (e.code === 'Space' || e.code === 'ArrowUp') this.jump();
    });
    this.onPointer('tap', (e) => {
      const w = window.innerWidth;
      if (e.clientY < window.innerHeight * 0.35) this.jump();
      else this.moveLane(e.clientX < w / 2 ? -1 : 1);
    });
  }

  protected tick(dt: number, t: number): void {
    for (const m of this.roadMarks) {
      m.position.z += dt * this.speed;
      if (m.position.z > 9) m.position.z -= 46.8;
    }
    for (const g of this.gates) g.position.z += dt * this.speed;
    if (this.activeRound && !this.resolving && this.gates.length && this.gates[0].position.z > 2.75) {
      const gate = this.gates.find((g) => g.userData.lane === this.lane);
      if (gate) void this.hitGate(gate);
    }
    this.runner.position.x += (this.lanes[this.lane] - this.runner.position.x) * (1 - Math.exp(-12 * dt));
    this.runner.rotation.z = (this.lanes[this.lane] - this.runner.position.x) * 0.06;
    const st = this.anim(this.runner);
    if (st) {
      st.move = 0.85;
      st.run = true;
      st.air = Math.sin(t * 4) > 0.96 && false;
    }
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearGates();
      const q = this.makeRunnerQuestion();
      this.spawnGates(q);
      const round = this.ask(q, { buttons: false, visual: true, prompt: `${q.prompt}  Chọn làn đúng!` });
      this.activeRound = round;
      await round.done;
      await this.successRun();
      this.activeRound = null;
      if (!(await this.nextRound())) break;
    }
  }

  private makeRunnerQuestion(): Question {
    const grade = this.grade;
    const topics: Topic[] = grade === 1 ? ['add', 'sub'] : grade === 2 ? ['add', 'sub'] : grade === 3 ? ['add', 'sub', 'mul'] : ['add', 'sub', 'mul', 'div'];
    const topic = topics[this.round % topics.length];
    let a = 0;
    let b = 0;
    let ans = 0;
    let op = '+';
    if (topic === 'add') {
      a = grade === 1 ? 3 + this.round : 20 + this.round * 7;
      b = grade === 1 ? 2 + (this.round % 5) : 8 + this.round * 3;
      ans = a + b;
      op = '+';
    } else if (topic === 'sub') {
      a = grade === 1 ? 9 + this.round : 45 + this.round * 8;
      b = grade === 1 ? 1 + (this.round % 6) : 9 + this.round * 2;
      ans = a - b;
      op = MINUS;
    } else if (topic === 'mul') {
      a = 2 + (this.round % (grade >= 4 ? 8 : 5));
      b = 3 + ((this.round * 2) % (grade >= 4 ? 8 : 5));
      ans = a * b;
      op = TIMES;
    } else {
      b = 2 + (this.round % 7);
      ans = 3 + ((this.round * 2) % 8);
      a = ans * b;
      op = DIVIDE;
    }
    const choices = numChoices(ans, [ans + 1, ans - 1, ans + b, Math.max(0, ans - b)], 3, { integer: true, min: 0 });
    return this.makeQuestion({
      topic,
      prompt: `${fmt(a)} ${op} ${fmt(b)} = ?`,
      answer: choices.answer,
      choices: choices.choices.map((c) => c.value),
      hint: 'Đi chậm, nhìn ba cổng rồi chọn cổng có đáp án đúng.',
      steps: [`Tính ${fmt(a)} ${op} ${fmt(b)}.`, `Kết quả là ${choices.answer}.`, 'Đổi làn để chạy qua cổng đúng.'],
      context: 'Đường rừng ba làn',
    });
  }

  private spawnGates(q: Question): void {
    this.gateZ = -14;
    q.choices.slice(0, 3).forEach((c, lane) => {
      const g = new THREE.Group() as Gate;
      const col = ['#ff8fab', '#74c0fc', '#ffd166'][lane];
      const x = this.lanes[lane];
      g.add(
        cyl(0.12, 0.14, 2.85, tint(col, -0.05), { p: [-1.08, 1.42, 0], seg: 8 }),
        cyl(0.12, 0.14, 2.85, tint(col, -0.05), { p: [1.08, 1.42, 0], seg: 8 }),
        torus(1.08, 0.12, col, { p: [0, 2.75, 0], r: [0, 90, 0], arc: 180, ts: 22, seg: 7 }),
        answerBoard(c.label, col),
      );
      const badge = g.children[g.children.length - 1];
      badge.position.set(0, 2.05, 0.14);
      g.position.set(x, 0, this.gateZ);
      g.userData.value = c.value;
      g.userData.ok = q.accept?.includes(c.value) ?? c.value === q.answer;
      g.userData.lane = lane;
      this.scene.add(g);
      this.gates.push(g);
    });
  }

  private moveLane(dir: number): void {
    const old = this.lane;
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
    if (old !== this.lane) sfx('step');
  }

  private jump(): void {
    const st = this.anim(this.runner);
    if (st) st.air = true;
    const y0 = this.runner.position.y;
    this.tween(0.45, (k) => {
      this.runner.position.y = y0 + Math.sin(k * Math.PI) * 0.55;
    });
    sfx('jump');
  }

  private async hitGate(g: Gate): Promise<void> {
    if (!this.activeRound || this.resolving) return;
    this.resolving = true;
    const r = this.activeRound.submit(g.userData.value);
    if (r.correct) {
      sfx('star');
      this.fx.burst('star', [g.position.x, 1.5, g.position.z], { count: 26, spread: 1 });
    } else {
      sfx('wrong');
      this.fx.burst('dust', [this.runner.position.x, 0.5, this.runner.position.z - 0.6], { count: 18, spread: 0.7 });
      const x0 = this.runner.position.x;
      this.tween(0.5, (k) => (this.runner.position.x = x0 + Math.sin(k * Math.PI * 7) * 0.18 * (1 - k)));
      await this.wait(0.65);
      this.gates.forEach((gate) => (gate.position.z = -13));
    }
    this.resolving = false;
  }

  private async successRun(): Promise<void> {
    const st = this.anim(this.runner);
    if (st) st.happy = 1;
    this.fx.burst('confetti', [this.runner.position.x, 1.6, this.runner.position.z - 0.8], { count: 30, spread: 1.2 });
    await this.wait(0.55);
    if (st) st.happy = 0;
    this.clearGates();
  }

  private clearGates(): void {
    for (const g of this.gates) if (g.parent) this.remove(g);
    this.gates = [];
    this.resolving = false;
  }
}

defineMini(
  {
    id: 'runner',
    name: '🏃 Chạy vượt chướng ngại – phép tính',
    icon: '🏃',
    skill: 'Phép tính',
    topics: ['add', 'sub', 'mul', 'div'],
    desc: 'Đổi làn để chạy qua cổng có đáp án đúng. Nhấn trái/phải hoặc chạm hai bên màn hình.',
    rounds: 8,
    color: '#ffa96b',
    unlock: 1,
  },
  (info, host) => new RunnerGame(info, host),
);
