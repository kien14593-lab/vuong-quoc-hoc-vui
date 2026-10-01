import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, group, prism, rbox } from '../../engine/kit';
import { mat, PAL, tint } from '../../engine/materials';
import { numberBadge, textPlate } from '../../engine/text';
import type { Question, Topic } from '../../math/types';
import { MiniGame } from '../base';
import { defineMini } from '../registry';

type ChoiceBlock = THREE.Group & { userData: { value: string; home: THREE.Vector3; label: string } };

const SHAPES = [
  { label: 'hình vuông', value: 'vuông', color: '#ffd166' },
  { label: 'hình tròn', value: 'tròn', color: '#74c0fc' },
  { label: 'hình tam giác', value: 'tam giác', color: '#ff9ec7' },
  { label: 'hình chữ nhật', value: 'chữ nhật', color: '#7bd389' },
];

function uniqChoices(answer: string, pool: string[], n = 3): string[] {
  const out = [answer];
  for (const p of pool) if (!out.includes(p) && out.length < n) out.push(p);
  return out.sort(() => Math.random() - 0.5);
}

function vi(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

class BuilderGame extends MiniGame {
  private site = new THREE.Group();
  private targets: ChoiceBlock[] = [];
  private houseParts: THREE.Object3D[] = [];
  private worker!: THREE.Group;

  protected build(): void {
    this.sky('#9fd8f7', '#eaf6e4', 35, 95);
    this.ground('#a9d66f', 90, 70);
    this.view([0, 7.2, 10.3], [0, 1.45, 0.85], 37);
    this.scene.add(this.site);

    this.model('tree_round', { v: 2 }, [-6.5, 0, -3.5], 0.3, 1.05);
    this.model('fence', { len: 3.5, style: 'picket' }, [-5.6, 0, 2.0], 0, 1);
    this.model('flower_bed', { len: 2.6 }, [4.8, 0, 2.5], 0.1, 1);
    this.worker = this.model('npc_rabbit', undefined, [-3.7, 0, 0.8], 0.6, 1.25);
    this.anim(this.worker)!.wave = true;

    this.site.add(box(4.3, 0.08, 3.4, '#d9c2a2', { p: [0, 0.04, 0] }));
    this.site.add(group([box(0.2, 0.04, 3.4, '#f1e6cc'), box(4.3, 0.04, 0.2, '#f1e6cc')], { p: [0, 0.1, 0] }));
    for (let x = -1.8; x <= 1.8; x += 0.9) for (let z = -1.35; z <= 1.35; z += 0.9) this.site.add(box(0.82, 0.025, 0.82, '#efe3c8', { p: [x, 0.13, z], cast: false }));

    this.onPointer('tap', (e) => {
      const hit = this.pick(e.clientX, e.clientY, this.targets);
      if (!hit || !this.current) return;
      const r = this.current.submit(hit.userData.value);
      if (!r.correct) void this.wrongBlock(hit);
    });
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearChoices();
      const q = this.builderQuestion();
      this.makeBlocks(q.choices.map((c) => c.value));
      const round = this.ask(q, { visual: false, prompt: q.prompt });
      await round.done;
      const correct = this.targets.find((t) => t.userData.value === q.answer);
      if (correct) await this.snapBlock(correct, this.round);
      this.addHousePart(this.round);
      this.fx.burst('star', [0, 2.7, 0.8], { count: 28, spread: 1.7 });
      sfx(this.round === this.info.rounds - 1 ? 'levelup' : 'correct');
      if (!(await this.nextRound(0.9))) break;
    }
    this.fx.burst('confetti', [0, 3, 0], { count: 90, spread: 3 });
  }

  protected tick(_dt: number, t: number): void {
    for (let i = 0; i < this.targets.length; i++) {
      const b = this.targets[i];
      b.rotation.y = Math.sin(t * 1.5 + i) * 0.08;
      b.position.y = b.userData.home.y + Math.sin(t * 2 + i) * 0.04;
    }
  }

  private builderQuestion(): Question {
    if (this.grade <= 2) {
      const spec = SHAPES[this.round % SHAPES.length];
      const choices = uniqChoices(spec.value, SHAPES.map((s) => s.value), 3);
      return this.makeQuestion({
        topic: 'geometry',
        prompt: `Chọn ${spec.label} để xây nhà nhé!`,
        answer: spec.value,
        choices,
        hint: `${spec.label} có hình giống khối đang sáng ở công trường.`,
        steps: [`Tìm khối có dạng ${spec.label}.`, 'Chạm vào khối đó để gắn vào nhà.'],
      });
    }
    const topic: Topic = this.grade === 3 ? 'perimeter' : this.round % 2 ? 'area' : 'perimeter';
    if (topic === 'area') {
      const w = this.grade >= 5 ? 6 + (this.round % 3) : 3 + (this.round % 3);
      const d = this.grade >= 5 ? 4 + (this.round % 4) : 2 + (this.round % 3);
      const ans = w * d;
      return this.makeQuestion({
        topic,
        prompt: `Sàn nhà ${w} × ${d} ô. Diện tích là bao nhiêu?`,
        answer: vi(ans),
        choices: uniqChoices(vi(ans), [vi(ans + w), vi(ans - d), vi(w + d), vi(ans + 2)]),
        hint: 'Diện tích hình chữ nhật = dài × rộng.',
        steps: [`Lấy ${w} × ${d}.`, `Kết quả là ${vi(ans)} ô vuông.`],
      });
    }
    const w = this.grade >= 5 ? 8 + this.round : 4 + (this.round % 3);
    const d = this.grade >= 5 ? 5 + (this.round % 4) : 3 + (this.round % 2);
    const ans = 2 * (w + d);
    return this.makeQuestion({
      topic,
      prompt: `Hàng rào dài ${w} m, rộng ${d} m. Chu vi là bao nhiêu?`,
      answer: vi(ans),
      choices: uniqChoices(vi(ans), [vi(w + d), vi(w * d), vi(ans + 2), vi(ans - 2)]),
      hint: 'Chu vi hình chữ nhật = (dài + rộng) × 2.',
      steps: [`${w} + ${d} = ${w + d}.`, `${w + d} × 2 = ${ans}.`],
    });
  }

  private makeBlocks(values: string[]): void {
    this.clearChoices();
    values.forEach((v, i) => {
      const x = -2.25 + i * 2.25;
      const c = SHAPES.find((s) => s.value === v)?.color ?? ['#ffd166', '#74c0fc', '#b197fc'][i % 3];
      const shape = this.choiceMesh(v, c);
      const y = /^\d|,/.test(v) ? 0.52 : 0.95;
      const g = group([shape], { p: [x, y, 3.15] }) as ChoiceBlock;
      g.userData.value = v;
      g.userData.label = v;
      g.userData.home = g.position.clone();
      this.scene.add(g);
      this.targets.push(g);
    });
  }

  private choiceMesh(v: string, color: string): THREE.Object3D {
    if (v.includes('tròn')) {
      const back = new THREE.Mesh(new THREE.CircleGeometry(0.68, 48), mat('#ffffff'));
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.56, 48), mat(color));
      face.position.z = 0.03;
      return group([back, face], { r: [-38, 0, 0] });
    }
    if (v.includes('tam')) {
      const backShape = new THREE.Shape();
      backShape.moveTo(0, 0.78);
      backShape.lineTo(-0.78, -0.57);
      backShape.lineTo(0.78, -0.57);
      backShape.closePath();
      const faceShape = new THREE.Shape();
      faceShape.moveTo(0, 0.64);
      faceShape.lineTo(-0.64, -0.47);
      faceShape.lineTo(0.64, -0.47);
      faceShape.closePath();
      const back = new THREE.Mesh(new THREE.ShapeGeometry(backShape), mat('#ffffff'));
      const face = new THREE.Mesh(new THREE.ShapeGeometry(faceShape), mat(color));
      face.position.z = 0.03;
      return group([back, face], { r: [-38, 0, 0] });
    }
    if (v.includes('chữ nhật')) return group([
      box(1.42, 0.86, 0.05, '#ffffff', { p: [0, 0, -0.01], cast: false }),
      box(1.24, 0.68, 0.06, color, { p: [0, 0, 0.03] }),
    ], { r: [-38, 0, 0] });
    if (/^\d|,/.test(v)) {
      const badge = numberBadge(v, 1.18, { bg: '#fff8ee', color: PAL.ink, border: color });
      badge.position.set(0, 0.05, 0.1);
      return group([rbox(1.28, 0.92, 0.22, 0.12, color, { p: [0, 0, -0.04], seg: 2 }), badge]);
    }
    return group([
      box(1.12, 1.12, 0.05, '#ffffff', { p: [0, 0, -0.01], cast: false }),
      box(0.92, 0.92, 0.06, color, { p: [0, 0, 0.03] }),
    ], { r: [-38, 0, 0] });
  }

  private clearChoices(): void {
    for (const t of this.targets) this.remove(t);
    this.targets = [];
  }

  private async wrongBlock(b: ChoiceBlock): Promise<void> {
    sfx('error');
    const x0 = b.position.x;
    await this.tween(0.28, (k) => {
      b.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.14 * (1 - k);
      b.rotation.z = Math.sin(k * Math.PI * 6) * 0.12;
    });
    b.position.x = x0;
    b.rotation.z = 0;
  }

  private async snapBlock(b: ChoiceBlock, step: number): Promise<void> {
    const from = b.position.clone();
    const to = new THREE.Vector3(-1.7 + (step % 4) * 1.12, 1.0 + Math.floor(step / 4) * 0.75, 0.9);
    await this.tween(0.65, (k) => {
      const arc = Math.sin(k * Math.PI) * 1.7;
      b.position.lerpVectors(from, to, k);
      b.position.y += arc;
      b.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.25);
    }, { ease: 'outCubic' });
    b.scale.setScalar(1);
  }

  private addHousePart(step: number): void {
    const parts: THREE.Object3D[] = [
      box(3.7, 1.45, 2.7, '#fff0cf', { p: [0, 0.86, 0] }),
      group([prism(4.2, 1.0, 3.05, '#ef8c7a', { p: [0, 1.58, 0] }), box(4.35, 0.12, 0.18, '#d46f5b', { p: [0, 2.55, 0] })]),
      group([rbox(0.72, 1.1, 0.12, 0.06, '#8a5a3b', { p: [-0.75, 0.75, 1.42] }), ball(0.05, PAL.gold, { p: [-0.5, 0.78, 1.5], seg: 8 })]),
      group([rbox(0.72, 0.58, 0.1, 0.04, '#8fd3f4', { p: [0.75, 1.05, 1.43], shiny: 60 }), box(0.08, 0.6, 0.11, PAL.frame, { p: [0.75, 1.05, 1.5] })]),
      group([box(0.45, 0.95, 0.45, '#c9a58a', { p: [1.05, 2.55, -0.5] }), box(0.58, 0.12, 0.58, '#b48c70', { p: [1.05, 3.05, -0.5] })]),
      group([this.model('fence', { len: 3.2, style: 'picket' }, [-2.7, 0, 1.9], 0, 0.85), this.model('flower_bed', { len: 2 }, [2.2, 0, 1.9], 0, 0.9)]),
    ];
    const p = parts[Math.min(step, parts.length - 1)];
    if (!p.parent) this.site.add(p);
    p.scale.setScalar(0.01);
    this.houseParts.push(p);
    this.tween(0.45, (k) => p.scale.setScalar(0.01 + k * 0.99), { ease: 'outBack' });
  }
}

defineMini(
  {
    id: 'builder',
    name: '🧱 Xây nhà – hình học',
    icon: '🧱',
    skill: 'Hình học, chu vi, diện tích',
    topics: ['geometry', 'perimeter', 'area'],
    desc: 'Chọn khối đúng để ngôi nhà lớn lên từng bước. Xong nhà sẽ có pháo giấy!',
    rounds: 6,
    color: '#e8956b',
    unlock: 3,
  },
  (info, host) => new BuilderGame(info, host),
);
