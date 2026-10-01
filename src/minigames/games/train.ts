import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, cone, cyl, group, prism, rbox, torus } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { numberBadge, textPlate } from '../../engine/text';
import type { Question } from '../../math/types';
import { MiniGame } from '../base';
import { defineMini } from '../registry';

type Crate = THREE.Group & { userData: { value: string; home: THREE.Vector3 } };

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function shuffled<T>(a: T[]): T[] {
  return [...a].sort(() => Math.random() - 0.5);
}

class TrainGame extends MiniGame {
  private train = new THREE.Group();
  private scenery = new THREE.Group();
  private crates: Crate[] = [];
  private missingCar!: THREE.Group;
  private crane!: THREE.Group;
  private stationZ = 0;

  protected build(): void {
    this.sky('#9fd8f7', '#eaf6e4', 40, 120);
    this.ground('#a9d66f', 120, 80);
    this.view([0.6, 6.4, 10.5], [0.8, 1.05, 0], 36);
    this.scene.add(this.scenery, this.train);
    for (let x = -7; x <= 7; x += 1.3) {
      this.scenery.add(box(0.95, 0.08, 0.12, '#8a5a3b', { p: [x, 0.05, 0.65] }));
      this.scenery.add(box(0.95, 0.08, 0.12, '#8a5a3b', { p: [x, 0.05, -0.65] }));
    }
    this.scenery.add(box(16, 0.07, 0.08, '#5f6268', { p: [0, 0.14, 0.62] }));
    this.scenery.add(box(16, 0.07, 0.08, '#5f6268', { p: [0, 0.14, -0.62] }));
    for (let i = 0; i < 7; i++) this.model(i % 2 ? 'tree_round' : 'tree_pine', { v: i + 1 }, [-7 + i * 2.4, 0, -4.2 - (i % 2)], 0, 0.8);
    this.buildTrain();
    this.buildCrane();
    this.onPointer('tap', (e) => {
      const hit = this.pick(e.clientX, e.clientY, this.crates);
      if (!hit || !this.current) return;
      const r = this.current.submit(hit.userData.value);
      if (!r.correct) void this.wrongCrate(hit);
    });
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearCrates();
      const puzzle = this.sequenceQuestion();
      this.decorateCars(puzzle.seq, puzzle.missing);
      this.spawnCrates(puzzle.q.choices.map((c) => c.value));
      const round = this.ask(puzzle.q, { prompt: puzzle.q.prompt });
      await round.done;
      const crate = this.crates.find((c) => c.userData.value === puzzle.q.answer);
      if (crate) await this.loadCrate(crate, puzzle.q.answer);
      await this.chug();
      if (!(await this.nextRound(0.65))) break;
    }
    this.fx.burst('confetti', [0, 2.2, 0], { count: 85, spread: 3 });
  }

  protected tick(_dt: number, t: number): void {
    for (const wheel of this.train.children.filter((c) => c.name === 'wheel')) wheel.rotation.z = -t * 4;
    this.crane.rotation.y = Math.sin(t * 1.2) * 0.08;
  }

  private buildTrain(): void {
    this.train.position.set(-0.6, 0, 0);
    const engine = group([
      rbox(1.35, 0.85, 1.0, 0.12, '#5fb3e8', { p: [-2.4, 0.65, 0], seg: 2 }),
      cyl(0.32, 0.32, 1.0, '#74c0fc', { p: [-3.1, 0.84, 0], r: [90, 0, 0], seg: 16 }),
      box(0.22, 0.55, 0.22, '#5c4a3d', { p: [-3.45, 1.22, 0] }),
      cone(0.24, 0.28, '#5c4a3d', { p: [-3.45, 1.65, 0], seg: 12 }),
      textPlate('TU TU', 0.25, { bg: '#fff8ee', color: PAL.ink, border: '#5fb3e8', pad: 8, radius: 12 }),
    ]);
    engine.children[4].position.set(-2.35, 1.16, 0.53);
    this.train.add(engine);
    const colors = ['#ffd166', '#ff9ec7', '#7bd389', '#b197fc', '#ffa94d'];
    for (let i = 0; i < 5; i++) {
      const car = group([rbox(1.25, 0.65, 0.95, 0.1, colors[i], { p: [-0.85 + i * 1.55, 0.56, 0], seg: 2 })], { name: `car${i}` });
      this.train.add(car);
    }
    for (let x = -3.25; x <= 5.65; x += 0.75) {
      for (const z of [-0.46, 0.46]) {
        const w = torus(0.18, 0.045, '#3d3550', { p: [x, 0.26, z], r: [0, 90, 0], seg: 8, ts: 14 });
        w.name = 'wheel';
        this.train.add(w);
      }
    }
  }

  private buildCrane(): void {
    this.crane = group([
      box(0.16, 2.0, 0.16, '#8a5a3b', { p: [0, 1, 0] }),
      box(2.2, 0.14, 0.14, '#d7a56d', { p: [-0.78, 2.15, 0] }),
      box(0.08, 0.78, 0.08, '#5f6268', { p: [-1.65, 1.72, 0] }),
      torus(0.18, 0.025, '#5f6268', { p: [-1.65, 1.25, 0], r: [90, 0, 0], arc: 180, ts: 10 }),
    ], { p: [5.9, 0, 3.35] });
    this.scene.add(this.crane);
  }

  private sequenceQuestion(): { q: Question; seq: string[]; missing: number } {
    const grade = this.grade;
    let start = 1 + (this.round % 4) * 2;
    let step = 1;
    let mode = 'cộng';
    if (grade === 1) step = this.round % 2 ? -1 : 1, start = step > 0 ? 4 + this.round : 12 + this.round;
    else if (grade <= 3) step = [2, 5, 10, 100][(this.round + grade) % 4], start = step === 100 ? 100 : step;
    else if (grade === 4) step = [6, 8, 25, 50][this.round % 4], start = 12 + this.round * 3;
    else if (this.round % 2 === 0) mode = 'nhân đôi', start = 2 + (this.round % 3), step = 0;
    else step = 0.5 + (this.round % 3) * 0.25, start = 1 + this.round * 0.5;

    const nums = Array.from({ length: 5 }, (_, i) => mode === 'nhân đôi' ? start * 2 ** i : start + step * i);
    const missing = 1 + (this.round % 3);
    const ans = nums[missing];
    const choices = shuffled([ans, ans + (step || ans), ans - (step || ans / 2), ans + 2 * (step || ans)].map(fmt)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    if (!choices.includes(fmt(ans))) choices[0] = fmt(ans);
    const shown = nums.map(fmt);
    return {
      seq: shown,
      missing,
      q: this.makeQuestion({
        topic: 'sequence',
        prompt: `Toa trống cần số nào? ${shown.map((n, i) => (i === missing ? '□' : n)).join(' , ')}`,
        answer: fmt(ans),
        choices: shuffled(choices),
        hint: mode === 'nhân đôi' ? 'Mỗi toa gấp đôi toa trước.' : `Mỗi toa ${step > 0 ? 'tăng' : 'giảm'} ${fmt(Math.abs(step))}.`,
        steps: mode === 'nhân đôi' ? ['Nhìn toa trước ô trống.', `Gấp đôi sẽ được ${fmt(ans)}.`] : [`Từ toa trước, ${step > 0 ? 'cộng' : 'trừ'} ${fmt(Math.abs(step))}.`, `Số cần điền là ${fmt(ans)}.`],
      }),
    };
  }

  private decorateCars(seq: string[], missing: number): void {
    for (let i = this.train.children.length - 1; i >= 0; i--) if (this.train.children[i].userData.badge) this.remove(this.train.children[i]);
    for (let i = 0; i < 5; i++) {
      const x = -0.85 + i * 1.55;
      const label = i === missing ? '?' : seq[i];
      const badge = numberBadge(label, 0.68, { bg: i === missing ? '#fff8ee' : '#ffffff', color: PAL.ink, border: i === missing ? '#ff6b6b' : '#5fb3e8' });
      badge.position.set(x, 1.05, 0.51);
      badge.userData.badge = true;
      this.train.add(badge);
      if (i === missing) this.missingCar = group([], { p: [x, 0.6, 0] });
    }
  }

  private spawnCrates(values: string[]): void {
    values.slice(0, 4).forEach((v, i) => {
      const x = -2.4 + i * 1.6;
      const badge = numberBadge(v, 0.55, { bg: '#fff8ee', color: PAL.ink, border: '#ffd166' });
      badge.position.set(0, 0.53, 0.36);
      const c = group([rbox(0.9, 0.52, 0.7, 0.06, '#c8915a', { p: [0, 0.26, 0], seg: 2 }), badge], { p: [x, 0, 3.15] }) as Crate;
      c.userData.value = v;
      c.userData.home = c.position.clone();
      this.scene.add(c);
      this.crates.push(c);
    });
  }

  private clearCrates(): void {
    for (const c of this.crates) this.remove(c);
    this.crates = [];
  }

  private async wrongCrate(c: Crate): Promise<void> {
    const x = c.position.x;
    sfx('wrong');
    await this.tween(0.25, (k) => c.position.x = x + Math.sin(k * Math.PI * 6) * 0.15 * (1 - k));
    c.position.x = x;
  }

  private async loadCrate(c: Crate, value: string): Promise<void> {
    sfx('unlock');
    const from = c.position.clone();
    const world = new THREE.Vector3();
    this.train.localToWorld(world.set(this.missingCar.position.x, 1.25, 0));
    await this.tween(0.75, (k) => {
      c.position.lerpVectors(from, world, k);
      c.position.y += Math.sin(k * Math.PI) * 2.2;
      c.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.2);
    }, { ease: 'inOutCubic' });
    const badge = numberBadge(value, 0.68, { bg: '#ffffff', color: PAL.ink, border: '#7bd389' });
    badge.position.set(this.missingCar.position.x, 1.05, 0.54);
    badge.userData.badge = true;
    this.train.add(badge);
    this.fx.burst('star', [world.x, 1.6, world.z], { count: 26, spread: 1.3 });
  }

  private async chug(): Promise<void> {
    sfx('step');
    const x0 = this.train.position.x;
    await this.tween(0.85, (k) => {
      this.train.position.x = x0 + Math.sin(k * Math.PI * 2) * 0.18;
      this.train.position.y = Math.abs(Math.sin(k * Math.PI * 6)) * 0.05;
      this.scenery.position.x = -this.round * 0.35 - k * 0.35;
    }, { ease: 'linear' });
    sfx('pop');
    this.stationZ += 1;
  }
}

defineMini(
  {
    id: 'train',
    name: '🚂 Tàu hỏa – dãy số',
    icon: '🚂',
    skill: 'Dãy số',
    topics: ['sequence'],
    desc: 'Chọn thùng số đúng để chất lên toa trống. Tàu sẽ tu tu tới ga mới!',
    rounds: 8,
    color: '#5fb3e8',
    unlock: 2,
  },
  (info, host) => new TrainGame(info, host),
);
