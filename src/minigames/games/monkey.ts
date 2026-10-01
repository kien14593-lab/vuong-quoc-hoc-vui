import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, cyl, group, rbox, torus, tube } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { numberBadge, textPlate } from '../../engine/text';
import type { Question } from '../../math/types';
import { parseVi } from '../../math/util';
import { MiniGame, type MiniRound } from '../base';
import { defineMini } from '../registry';

const BANANA = '#ffd166';
const INK = '#2b2233';

function answerBasket(label: string): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.48, 0.38, 0.28, '#c8915a', { p: [0, 0.14, 0], seg: 16 }));
  g.add(torus(0.44, 0.035, '#8a5a3b', { p: [0, 0.31, 0], ts: 22 }));
  for (let i = 0; i < 3; i++) {
    const b = tube([[-0.22, 0.42, 0], [-0.04, 0.54 + i * 0.015, 0], [0.22, 0.42, 0]], 0.035, BANANA, { radial: 7, seg: 12 });
    b.position.set((i - 1) * 0.08, 0, (i - 1) * 0.06);
    b.rotation.y = (i - 1) * 0.35;
    g.add(b);
  }
  const badge = textPlate(label, label.length > 5 ? 0.36 : 0.46, { bg: '#fff8ee', color: INK, border: BANANA, size: 92, pad: 14 });
  badge.position.set(0, 0.82, 0.18);
  g.add(badge);
  return g;
}

function promptSign(): THREE.Group {
  return group([
    rbox(3.8, 0.72, 0.12, 0.08, '#fff8ee', { shiny: 25 }),
    box(3.95, 0.08, 0.16, BANANA, { p: [0, -0.42, 0.01] }),
  ]);
}

function operands(q: Question): [number, number] {
  if (q.visual?.kind === 'objects' && q.visual.groups.length) {
    const a = q.visual.groups[0] ?? 0;
    const b = q.topic === 'sub' ? q.visual.crossOut ?? 0 : q.visual.groups[1] ?? 0;
    return [a, b];
  }
  const nums = (q.prompt.match(/[0-9][0-9\s\u00a0\u202f.,]*/g) ?? []).map((s) => parseVi(s.trim()));
  const a = nums[0] ?? 3;
  const b = nums[1] ?? (q.topic === 'sub' ? a - parseVi(q.answer) : parseVi(q.answer) - a);
  return [a, b];
}

class MonkeyGame extends MiniGame {
  private monkey: THREE.Group | null = null;
  private targets: THREE.Group[] = [];
  private targetValue = new Map<THREE.Group, string>();
  private roundObjs: THREE.Object3D[] = [];
  private roundNow: MiniRound | null = null;

  protected build(): void {
    this.sky('#9fd8f7', '#fff5d6', 45, 120);
    this.ground('#9bd56b', 70, 70);
    this.view([0, 4.8, 7.7], [0, 0.95, 0.15], 38);
    this.model('tree_round', { v: 3 }, [-2.8, 0, -2.2], 0.2, 0.95);
    this.model('tree_palm', { v: 1 }, [3.8, 0, -3.2], -0.3, 0.8);
    this.model('bush', { v: 2, flowers: true }, [-4.4, 0, 1.8], 0, 1.3);
    this.scene.add(group([
      cyl(0.16, 0.22, 2.0, '#8a5a3b', { p: [0, 1.0, -2.25], seg: 8 }),
      tube([[-2.0, 1.55, -2.35], [-0.6, 1.75, -2.3], [1.8, 1.55, -2.35]], 0.11, '#8a5a3b', { radial: 8, seg: 18 }),
    ]));
    this.monkey = this.model('animal_monkey', undefined, [0, 0, -1.15], 0, 1.55);
    const st = this.monkey && this.anim(this.monkey);
    if (st) st.wave = true;
    this.onPointer('tap', (e) => this.tap(e));
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearRound();
      const q = this.question(['add', 'sub'], { who: 'Khỉ', item: 'quả chuối', unit: 'quả', emoji: '🍌' });
      this.renderRound(q);
      const st = this.monkey && this.anim(this.monkey);
      if (st) st.talk = true;
      const round = this.ask(q, { prompt: q.context ? `${q.context} ${q.prompt}` : q.prompt });
      this.roundNow = round;
      await round.done;
      this.roundNow = null;
      if (st) st.talk = false;
      await this.feed(q.answer);
      if (!(await this.nextRound())) break;
    }
  }

  private renderRound(q: Question): void {
    this.renderBananaStory(q);
    q.choices.forEach((c, i) => {
      const x = (i - (q.choices.length - 1) / 2) * 1.55;
      const b = answerBasket(c.label);
      b.position.set(x, 0, 2.35);
      this.scene.add(b);
      this.targets.push(b);
      this.targetValue.set(b, c.value);
      this.roundObjs.push(b);
    });
  }

  private renderBananaStory(q: Question): void {
    const [a, b] = operands(q);
    const op = q.topic === 'sub' ? 'sub' : 'add';
    const totalShown = Math.min(op === 'sub' ? a : a + b, 18);
    for (let i = 0; i < totalShown; i++) {
      const x = (i % 9) * 0.38 - 1.55;
      const z = Math.floor(i / 9) * 0.46 - 0.35;
      const banana = this.model('pickup_banana', undefined, [x, 0.35, z], -0.35, 0.75);
      if (op === 'sub' && i >= a - b) banana.scale.setScalar(0.55);
      this.roundObjs.push(banana);
    }
    const label = textPlate(op === 'sub' ? `Ăn bớt ${b} quả` : `Thêm ${b} quả`, 0.36, { bg: '#fff4df', color: INK, border: '#ff9f43', size: 72, pad: 12 });
    label.position.set(0, 1.12, -0.05);
    this.scene.add(label);
    this.roundObjs.push(label);
  }

  private tap(e: PointerEvent): void {
    if (!this.roundNow || this.roundNow.solved) return;
    const hit = this.pick(e.clientX, e.clientY, this.targets);
    if (!hit) return;
    sfx('click');
    const res = this.roundNow.submit(this.targetValue.get(hit) ?? '');
    if (res.correct) {
      this.tween(0.25, (k) => hit.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18), { ease: 'linear' });
    } else {
      this.wrong(hit);
    }
  }

  private wrong(hit: THREE.Object3D): void {
    const mx = this.monkey?.position.x ?? 0;
    const st = this.monkey && this.anim(this.monkey);
    if (st) st.talk = false;
    const x0 = hit.position.x;
    this.tween(0.42, (k) => {
      hit.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.12 * (1 - k);
      if (this.monkey) this.monkey.position.x = mx + Math.sin(k * Math.PI * 5) * 0.08 * (1 - k);
    }, { ease: 'linear' });
    this.fx.burst('dust', [hit.position.x, 0.6, hit.position.z], { count: 10, spread: 0.45 });
  }

  private async feed(answer: string): Promise<void> {
    const target = this.targets.find((t) => this.targetValue.get(t) === answer) ?? this.targets[0];
    const st = this.monkey && this.anim(this.monkey);
    const start = target ? target.position.clone().add(new THREE.Vector3(0, 0.7, 0)) : new THREE.Vector3(0, 0.4, 2);
    const end = new THREE.Vector3(0, 2.55, -2.0);
    for (let i = 0; i < 5; i++) {
      const b = this.model('pickup_banana', undefined, [start.x, start.y, start.z], 0, 0.55);
      this.roundObjs.push(b);
      const delay = i * 0.09;
      this.tween(0.75 + delay, (k) => {
        const kk = Math.max(0, Math.min(1, (k * (0.75 + delay) - delay) / 0.75));
        b.position.lerpVectors(start, end, kk);
        b.position.y += Math.sin(kk * Math.PI) * 1.0;
        b.rotation.y += 0.18;
      }, { ease: 'inOutCubic' });
    }
    if (st) st.happy = 1;
    this.fx.burst('heart', [0, 2.7, -2], { count: 18, spread: 0.9 });
    this.ui.flash('Khỉ vui quá!', 'good');
    await this.wait(1.0);
    if (st) st.happy = 0;
  }

  private clearRound(): void {
    for (const o of this.roundObjs) this.remove(o);
    this.roundObjs = [];
    this.targets = [];
    this.targetValue.clear();
  }
}

defineMini(
  {
    id: 'monkey',
    name: '🐒 Cho khỉ ăn – cộng/trừ',
    icon: '🐒',
    skill: 'Cộng / trừ',
    topics: ['add', 'sub'],
    desc: 'Đọc bài toán chuối, chạm giỏ có kết quả đúng để chuối bay tới chú khỉ.',
    rounds: 8,
    color: '#f2b134',
    unlock: 1,
  },
  (info, host) => new MonkeyGame(info, host),
);
