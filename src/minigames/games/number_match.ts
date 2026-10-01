import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, cone, cyl, extrude, group, rbox, starShape } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { numberBadge, textPlate } from '../../engine/text';
import { fmt } from '../../math/util';
import { MiniGame, type MiniRound } from '../base';
import { defineMini } from '../registry';

type Mode = 'count' | 'compare' | 'sequence';
type RoundData = {
  mode: Mode;
  answer: number;
  choices: string[];
  prompt: string;
  hint: string;
  steps: string[];
  values?: number[];
  missing?: number;
  count?: number;
};

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = <T>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

function choicesFor(answer: number, n: number, step = 1): string[] {
  const vals = new Set<number>([answer]);
  for (const d of [answer - step, answer + step, answer + 2 * step, answer - 2 * step, answer + 10, Math.max(1, answer - 10)]) {
    if (d >= 0) vals.add(d);
    if (vals.size >= n) break;
  }
  while (vals.size < n) vals.add(Math.max(0, answer + randInt(-8, 8)));
  return shuffle([...vals].slice(0, n)).map(fmt);
}

function labelMesh(text: string, h = 0.38): THREE.Mesh {
  return textPlate(text, h, { bg: '#fff8ee', color: '#2b2233', border: '#ffcf3f', size: 96, pad: 18, radius: 20 });
}

function makeCard(value: string, color = '#fff8ee'): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.25, 0.95, 0.16, 0.12, color, { p: [0, 0, 0], shiny: 35 }));
  const badge = numberBadge(value, value.length > 3 ? 0.78 : 0.84, { bg: '#ffffff', color: '#2b2233', border: '#ffcf3f' });
  badge.position.set(0, 0.02, 0.091);
  g.add(badge);
  return g;
}

function apple(): THREE.Group {
  return group([
    ball(0.18, '#ff5a5f', { seg: 12, flat: false, shiny: 35 }),
    cyl(0.014, 0.02, 0.12, '#7b4a2e', { p: [0.03, 0.2, 0], seg: 5 }),
    box(0.1, 0.025, 0.05, PAL.leaf2, { p: [0.11, 0.2, 0], r: [0, 20, -18] }),
  ]);
}

function duck(): THREE.Group {
  return group([
    ball(0.2, '#ffd166', { s: [1.25, 0.82, 0.9], seg: 12, flat: false }),
    ball(0.12, '#ffd166', { p: [0.18, 0.1, 0.02], seg: 10, flat: false }),
    cone(0.045, 0.1, '#ff9f43', { p: [0.3, 0.09, 0.02], r: [0, 0, -90], seg: 8 }),
    ball(0.025, '#2b2233', { p: [0.23, 0.14, 0.1], seg: 6 }),
  ]);
}

function starObj(): THREE.Mesh {
  return extrude('mgNumberStar', () => starShape(0.2, 0.09), 0.08, '#ffcf3f', { bevel: 0.018, emissive: '#ffcf3f', glow: 0.18, shiny: 60 });
}

function hundredFlat(): THREE.Group {
  const g = new THREE.Group();
  const size = 0.86;
  g.add(box(size, 0.12, size, '#6cb8ff', { p: [0, 0, 0], shiny: 35 }));
  for (let i = 0; i <= 10; i++) {
    const p = -size / 2 + (i * size) / 10;
    g.add(box(0.014, 0.018, size + 0.02, '#2879bd', { p: [p, 0.07, 0] }));
    g.add(box(size + 0.02, 0.018, 0.014, '#2879bd', { p: [0, 0.072, p] }));
  }
  return g;
}

function tenRod(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.28, len = 1.25;
  g.add(box(w, 0.34, len, '#ffd166', { shiny: 30 }));
  for (let i = 0; i <= 10; i++) {
    const z = -len / 2 + (i * len) / 10;
    g.add(box(w + 0.035, 0.02, 0.018, '#c08b2e', { p: [0, 0.18, z] }));
  }
  g.add(box(0.018, 0.022, len + 0.02, '#c08b2e', { p: [-w / 2, 0.182, 0] }));
  g.add(box(0.018, 0.022, len + 0.02, '#c08b2e', { p: [w / 2, 0.182, 0] }));
  return g;
}

function unitCube(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.38, 0.38, 0.38, 0.05, '#ff9ec7', { shiny: 35 }));
  g.add(box(0.41, 0.022, 0.022, '#c75d93', { p: [0, 0.205, -0.145] }));
  g.add(box(0.022, 0.022, 0.41, '#c75d93', { p: [-0.145, 0.205, 0] }));
  return g;
}

class NumberMatchGame extends MiniGame {
  private targets: THREE.Group[] = [];
  private targetValue = new Map<THREE.Group, string>();
  private roundObjs: THREE.Object3D[] = [];
  private countObjs: THREE.Object3D[] = [];
  private roundNow: MiniRound | null = null;
  private mascot: THREE.Group | null = null;

  protected build(): void {
    this.sky('#9fd8f7', '#eaf6e4', 45, 120);
    this.ground('#a9d66f', 80, 80);
    this.view([0, 5.6, 7.8], [0, 0.75, 0.45], 38);
    this.model('tree_round', { v: 1 }, [-5.6, 0, -4.2], 0, 0.8);
    this.model('tree_blossom', { v: 2 }, [5.5, 0, -4.8], 0, 0.75);
    this.model('flower', { v: 2 }, [-3.6, 0, 2.8], 0, 1.4);
    this.model('flower', { v: 4 }, [4.1, 0, 2.9], 0, 1.2);
    this.mascot = this.model('npc_villager', { v: 1 }, [-4.2, 0, 1.6], 0.45, 1.25);
    const st = this.mascot && this.anim(this.mascot);
    if (st) st.wave = true;
    this.onPointer('tap', (e) => this.tap(e));
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearRound();
      const data = this.makeData();
      this.render(data);
      const q = this.makeQuestion({
        topic: data.mode,
        prompt: data.prompt,
        answer: fmt(data.answer),
        choices: data.choices,
        hint: data.hint,
        steps: data.steps,
      });
      const round = this.ask(q, { prompt: data.prompt });
      this.roundNow = round;
      await round.done;
      this.roundNow = null;
      await this.celebrate(data);
      if (!(await this.nextRound())) break;
    }
  }

  private makeData(): RoundData {
    const modes: Mode[] = ['count', 'compare', 'sequence'];
    const mode = modes[this.round % modes.length];
    const choiceN = this.grade <= 1 ? 3 : 4;
    if (mode === 'count') {
      const count = this.grade <= 1 ? randInt(2, 6) : this.grade <= 2 ? randInt(6, 14) : this.grade <= 3 ? randInt(15, 60) : randInt(120, 950);
      return {
        mode,
        answer: count,
        choices: choicesFor(count, choiceN),
        count,
        prompt: this.grade >= 3 ? 'Các khối biểu diễn số nào?' : 'Có bao nhiêu đồ vật?',
        hint: this.grade >= 3 ? 'Đếm trăm, chục rồi đơn vị.' : 'Chạm mắt từng đồ vật và đếm 1, 2, 3…',
        steps: this.grade >= 3 ? ['Tấm lớn là hàng trăm.', 'Thanh dài là hàng chục, khối nhỏ là đơn vị.', `Số cần ghép là ${fmt(count)}.`] : ['Đếm từng món từ trái sang phải.', `Dãy đếm kết thúc ở ${count}.`, `Vậy có ${count} đồ vật.`],
      };
    }
    if (mode === 'compare') {
      const max = this.grade <= 1 ? 10 : this.grade <= 3 ? 99 : 999;
      const values = shuffle(Array.from(new Set([randInt(2, max), randInt(2, max), randInt(2, max), randInt(2, max)]))).slice(0, choiceN);
      while (values.length < choiceN) values.push(randInt(1, max));
      const wantBig = this.round % 2 === 1;
      const answer = wantBig ? Math.max(...values) : Math.min(...values);
      return {
        mode,
        answer,
        choices: shuffle(values).map(fmt),
        values,
        prompt: wantBig ? 'Chọn số lớn nhất.' : 'Chọn số bé nhất.',
        hint: 'So sánh từ chữ số bên trái trước.',
        steps: [`Các số là: ${values.map(fmt).join(', ')}.`, wantBig ? 'Số lớn nhất đứng cuối khi xếp tăng dần.' : 'Số bé nhất đứng đầu khi xếp tăng dần.', `Đáp án là ${fmt(answer)}.`],
      };
    }
    const step = this.grade <= 1 ? 1 : this.grade <= 2 ? [2, 5, 10][randInt(0, 2)] : this.grade <= 4 ? randInt(3, 12) : [25, 50, 100][randInt(0, 2)];
    const start = this.grade <= 2 ? randInt(1, 12) : randInt(2, 12) * step;
    const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
    const missing = randInt(1, 3);
    const answer = seq[missing];
    return {
      mode,
      answer,
      choices: choicesFor(answer, choiceN, step),
      values: seq,
      missing,
      prompt: 'Số nào còn thiếu trên dãy đá?',
      hint: `Mỗi viên đá hơn viên trước ${fmt(step)}.`,
      steps: [`Quan sát: ${fmt(seq[0])} → ${fmt(seq[1])}.`, `Mỗi bước tăng ${fmt(step)}.`, `Số còn thiếu là ${fmt(answer)}.`],
    };
  }

  private render(data: RoundData): void {
    const title = labelMesh(data.mode === 'count' ? 'Đếm thật vui!' : data.mode === 'compare' ? 'So sánh số!' : 'Dãy đá bí mật!', 0.35);
    title.position.set(0, 2.9, -3.0);
    this.scene.add(title);
    this.roundObjs.push(title);
    if (data.mode === 'count') this.renderCount(data.count ?? data.answer);
    if (data.mode === 'compare') this.renderCompare(data.values ?? []);
    if (data.mode === 'sequence') this.renderSequence(data.values ?? [], data.missing ?? 2);
    this.renderChoices(data.choices);
  }

  private renderCount(n: number): void {
    if (this.grade >= 3) {
      const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
      const startZ = -0.95;
      const flatCols = h <= 4 ? Math.max(1, h) : Math.ceil(h / 2);
      const flatSize = 0.86, flatSpacing = 1.02, rodW = 0.28, rodSpacing = 0.42, unitSize = 0.38, unitSpacing = 0.5, gap = 0.42;
      const unitCols = Math.min(5, Math.max(1, u));
      const flatW = h ? flatSize + (flatCols - 1) * flatSpacing : 0;
      const rodWTotal = t ? rodW + (t - 1) * rodSpacing : 0;
      const unitW = u ? unitSize + (unitCols - 1) * unitSpacing : 0;
      const totalW = flatW + rodWTotal + unitW + (h && t ? gap : 0) + ((h || t) && u ? gap : 0);
      let xCursor = -totalW / 2;
      for (let i = 0; i < h; i++) {
        const col = i % flatCols;
        const row = Math.floor(i / flatCols);
        const rowCount = Math.min(flatCols, h - row * flatCols);
        const rowOffset = (flatCols - rowCount) * flatSpacing * 0.5;
        const flat = hundredFlat();
        flat.position.set(xCursor + flatSize / 2 + rowOffset + col * flatSpacing, 0.34, startZ + row * 0.7);
        this.addCountObj(flat);
      }
      if (h) xCursor += flatW + gap;
      for (let i = 0; i < t; i++) {
        const rod = tenRod();
        rod.position.set(xCursor + rodW / 2 + i * rodSpacing, 0.38, startZ + 0.12);
        this.addCountObj(rod);
      }
      if (t) xCursor += rodWTotal + gap;
      for (let i = 0; i < u; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cube = unitCube();
        cube.position.set(xCursor + unitSize / 2 + col * unitSpacing, 0.34, startZ - 0.06 + row * 0.48);
        this.addCountObj(cube);
      }
      return;
    }
    const makers = [apple, duck, () => group([starObj()])];
    const make = makers[this.round % makers.length];
    const cols = Math.min(7, Math.ceil(Math.sqrt(n)));
    for (let i = 0; i < n; i++) {
      const x = (i % cols) * 0.88 - (cols - 1) * 0.44;
      const z = Math.floor(i / cols) * 0.78 - 0.6;
      const o = make();
      o.position.set(x, 0.38, z);
      o.scale.setScalar(1.55);
      this.scene.add(o);
      this.addCountObj(o);
    }
  }

  private addCountObj(o: THREE.Object3D): void {
    this.scene.add(o);
    this.roundObjs.push(o);
    this.countObjs.push(o);
  }

  private renderCompare(vals: number[]): void {
    vals.forEach((v, i) => {
      const x = (i - (vals.length - 1) / 2) * 1.6;
      const g = this.model('math_ball', { n: v, color: ['#6cb8ff', '#ff9ec7', '#ffd166', '#7bd389'][i % 4] }, [x, 0.55, -0.25], 0, 1.65);
      this.roundObjs.push(g);
    });
  }

  private renderSequence(vals: number[], missing: number): void {
    vals.forEach((v, i) => {
      const x = (i - 2) * 1.25;
      const stone = group([cyl(0.5, 0.55, 0.18, i === missing ? '#b197fc' : '#d6cfc2', { p: [0, 0.09, 0], seg: 16 })]);
      const n = i === missing ? labelMesh('?', 0.5) : numberBadge(fmt(v), 0.72, { bg: '#fff8ee', color: '#2b2233', border: '#7bd389' });
      n.position.set(0, 0.22, 0.02);
      n.rotation.x = -65 * Math.PI / 180;
      stone.add(n);
      stone.position.set(x, 0, -0.4);
      this.scene.add(stone);
      this.roundObjs.push(stone);
    });
  }

  private renderChoices(choices: string[]): void {
    choices.forEach((c, i) => {
      const target = makeCard(c, ['#fff8ee', '#e7f7ff', '#fff0d2', '#ffe9f2'][i % 4]);
      target.position.set((i - (choices.length - 1) / 2) * 1.55, 0.9, 2.35);
      target.rotation.x = -0.12;
      this.scene.add(target);
      this.targets.push(target);
      this.targetValue.set(target, c);
      this.roundObjs.push(target);
    });
  }

  private tap(e: PointerEvent): void {
    if (!this.roundNow || this.roundNow.solved) return;
    const hit = this.pick(e.clientX, e.clientY, this.targets);
    if (!hit) return;
    const value = this.targetValue.get(hit) ?? '';
    sfx('click');
    const res = this.roundNow.submit(value);
    if (res.correct) this.tween(0.25, (k) => hit.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18), { ease: 'outBack' });
    else this.shake(hit);
  }

  private shake(o: THREE.Object3D): void {
    const x0 = o.position.x;
    this.tween(0.36, (k) => { o.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.14 * (1 - k); }, { ease: 'linear' });
    this.fx.burst('dust', [o.position.x, 0.7, o.position.z], { count: 8, spread: 0.5 });
  }

  private async celebrate(data: RoundData): Promise<void> {
    const st = this.mascot && this.anim(this.mascot);
    if (st) st.happy = 1;
    if (data.mode === 'count' && this.countObjs.length && this.countObjs.length <= 30) {
      for (let i = 0; i < this.countObjs.length; i++) {
        const o = this.countObjs[i];
        const p = new THREE.Vector3();
        o.getWorldPosition(p);
        this.fx.burst('star', [p.x, p.y + 0.4, p.z], { count: 5, spread: 0.25 });
        const s = this.toScreen(p.clone().add(new THREE.Vector3(0, 0.7, 0)));
        if (s.visible) this.ui.floatText(String(i + 1), s.x, s.y, 'good');
        this.tween(0.18, (k) => o.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.25), { ease: 'linear' });
        await this.wait(0.08);
      }
    } else {
      this.fx.burst('confetti', [0, 1.8, 0], { count: 36, spread: 1.8 });
      await this.wait(0.65);
    }
    this.ui.flash('Giỏi quá!', 'good');
    if (st) st.happy = 0;
  }

  private clearRound(): void {
    for (const o of this.roundObjs) this.remove(o);
    this.roundObjs = [];
    this.countObjs = [];
    this.targets = [];
    this.targetValue.clear();
  }
}

defineMini(
  {
    id: 'number_match',
    name: '🧩 Ghép số – nhận biết số',
    icon: '🧩',
    skill: 'Đếm, so sánh, dãy số',
    topics: ['count', 'compare', 'sequence'],
    desc: 'Chạm thẻ số đúng với đồ vật, quả bóng hoặc dãy đá. Trả lời đúng sẽ có pháo sao và đếm vui.',
    rounds: 5,
    color: '#ff8fab',
    unlock: 1,
  },
  (info, host) => new NumberMatchGame(info, host),
);
