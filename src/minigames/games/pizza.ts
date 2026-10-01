import * as THREE from 'three';
import '../../styles/games/pizza.css';
import { sfx } from '../../core/audio';
import { ball, box, cone, cyl, rbox } from '../../engine/kit';
import { mat, PAL } from '../../engine/materials';
import { textPlate } from '../../engine/text';
import type { MiniHost, MiniInfo, MiniRound } from '../base';
import { MiniGame } from '../base';
import { defineMini } from '../registry';

const TOPPING = ['#ff6b6b', '#7bd389', '#ffd166', '#b197fc'];

function frac(n: number, d: number): string {
  return `${n}/${d}`;
}

function sliceMesh(i: number, d: number, selected: boolean): THREE.Mesh {
  const gap = 0.035;
  const a0 = (i / d) * Math.PI * 2 + gap;
  const a1 = ((i + 1) / d) * Math.PI * 2 - gap;
  const r = 2.08;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(Math.sin(a0) * r, Math.cos(a0) * r);
  shape.absarc(0, 0, r, Math.PI / 2 - a0, Math.PI / 2 - a1, true);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat(selected ? '#ff9ec7' : '#ffd166', { shiny: selected ? 35 : undefined }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const mid = (a0 + a1) / 2;
  mesh.position.set(Math.sin(mid) * (selected ? 0.18 : 0.02), 1.04 + (selected ? 0.05 : 0), Math.cos(mid) * (selected ? 0.18 : 0.02));
  mesh.userData.index = i;
  return mesh;
}

function cutLine(angle: number): THREE.Mesh {
  const g = new THREE.BoxGeometry(0.075, 0.05, 2.14);
  g.translate(0, 0, 1.04);
  g.rotateY(angle);
  const m = new THREE.Mesh(g, mat('#9b4a2f', { shiny: 10 }));
  m.position.y = 1.19;
  m.castShadow = false;
  return m;
}

function uniqueChoiceValues(values: string[], answer: string): string[] {
  const out: string[] = [];
  const add = (v: string) => {
    if (!out.includes(v)) out.push(v);
  };
  add(answer);
  for (const v of values) add(v);
  let n = 1;
  while (out.length < 4) add(String(n++));
  return out.slice(0, 4);
}

class PizzaGame extends MiniGame {
  private pizzaRoot = new THREE.Group();
  private targets: THREE.Object3D[] = [];
  private choiceTargets: THREE.Object3D[] = [];
  private selected = new Set<number>();
  private activeRound: MiniRound | null = null;
  private pieces = 4;
  private submitButton: THREE.Object3D | null = null;

  constructor(info: MiniInfo, host: MiniHost) {
    super(info, host);
  }

  protected build(): void {
    this.sky('#ffd6e8', '#fff6d7', 45, 110);
    this.ground('#bfe283', 70, 70);
    this.view([0, 5.8, 7.7], [0, 1.25, 0], 42);
    this.scene.add(rbox(5.6, 0.42, 4.2, 0.18, '#c8915a', { p: [0, 0.45, 0] }));
    this.scene.add(rbox(5.9, 0.22, 4.5, 0.12, '#e2b07a', { p: [0, 0.82, 0] }));
    this.scene.add(box(1.0, 1.0, 0.22, PAL.woodDark, { p: [-2.1, 0.02, -1.5], base: true }));
    this.scene.add(box(1.0, 1.0, 0.22, PAL.woodDark, { p: [2.1, 0.02, -1.5], base: true }));
    this.scene.add(box(1.0, 1.0, 0.22, PAL.woodDark, { p: [-2.1, 0.02, 1.5], base: true }));
    this.scene.add(box(1.0, 1.0, 0.22, PAL.woodDark, { p: [2.1, 0.02, 1.5], base: true }));
    this.scene.add(cyl(2.05, 2.1, 0.18, '#fff8ee', { p: [0, 0.92, 0], seg: 36 }));
    this.pizzaRoot.position.set(0, 0, 0);
    this.scene.add(this.pizzaRoot);
    this.model('animal_penguin', undefined, [-4.2, 0, 1.3], 0.8, 1.1);
    this.model('animal_monkey', undefined, [4.0, 0, 1.1], -0.8, 1.0);
    this.model('animal_hippo', undefined, [0, 0, -3.6], 0, 1.0);

    this.onPointer('tap', (e) => {
      if (!this.activeRound) return;
      const choice = this.pick(e.clientX, e.clientY, this.choiceTargets);
      if (choice) {
        const ok = this.activeRound.submit(String(choice.userData.value)).correct;
        if (ok) this.fx.burst('heart', choice.getWorldPosition(new THREE.Vector3()), { count: 16, spread: 1 });
        else this.shake(choice);
        return;
      }
      const hit = this.pick(e.clientX, e.clientY, this.targets);
      if (hit) {
        const idx = Number(hit.userData.index);
        if (this.selected.has(idx)) this.selected.delete(idx);
        else this.selected.add(idx);
        sfx('click');
        this.renderPizza(this.pieces);
        return;
      }
      if (this.submitButton && this.pick(e.clientX, e.clientY, [this.submitButton])) {
        const value = frac(this.selected.size, this.pieces);
        const ok = this.activeRound.submit(value).correct;
        if (!ok) this.shake(this.submitButton);
      }
    });
  }

  private renderPizza(d: number): void {
    for (const c of [...this.pizzaRoot.children]) this.remove(c);
    this.targets = [];
    this.pieces = d;
    for (let i = 0; i < d; i++) {
      const s = sliceMesh(i, d, this.selected.has(i));
      this.pizzaRoot.add(s);
      this.targets.push(s);
      const a = ((i + 0.5) / d) * Math.PI * 2;
      if (i % 2 === 0) this.pizzaRoot.add(ball(0.08, TOPPING[i % TOPPING.length], { p: [Math.sin(a) * 1.0, 1.22, Math.cos(a) * 1.0], seg: 8, cast: false }));
    }
    for (let i = 0; i < d; i++) this.pizzaRoot.add(cutLine((i / d) * Math.PI * 2));
  }

  private makeSubmit(): void {
    if (this.submitButton) this.remove(this.submitButton);
    const g = new THREE.Group();
    g.position.set(0, 0.75, 3.0);
    g.add(rbox(2.0, 0.75, 0.22, 0.15, '#7bd389', { shiny: 45 }));
    const t = textPlate('TÔ XONG!', 0.34, { color: '#195b4a', bg: '#ffffff', border: '#7bd389', radius: 24, pad: 8 });
    t.position.set(0, 0, 0.15);
    g.add(t);
    this.scene.add(g);
    this.submitButton = g;
  }

  private clearSubmit(): void {
    if (this.submitButton) this.remove(this.submitButton);
    this.submitButton = null;
  }

  private clearChoices(): void {
    for (const c of this.choiceTargets) this.remove(c);
    this.choiceTargets = [];
  }

  private makeChoicePlates(round: MiniRound): void {
    this.clearChoices();
    round.q.choices.forEach((c, i) => {
      const x = (i - (round.q.choices.length - 1) / 2) * 1.45;
      const g = new THREE.Group();
      g.position.set(x, 0.48, 2.75);
      g.userData.value = c.value;
      g.add(cyl(0.46, 0.52, 0.18, ['#ff9ec7', '#6cb8ff', '#ffd166', '#4ecdc4'][i % 4], { seg: 18, shiny: 30 }));
      const t = textPlate(c.label, 0.54, { color: '#2b2233', bg: '#ffffff', border: '#ffd166', radius: 28, pad: 12 });
      t.position.set(0, 0.19, 0.0);
      t.rotation.x = -Math.PI / 2;
      g.add(t);
      this.scene.add(g);
      this.choiceTargets.push(g);
    });
  }

  private fractionQuestion(): MiniRound['q'] {
    const d = this.grade <= 3 ? [2, 3, 4, 6][Math.floor(Math.random() * 4)] : [4, 5, 6, 8][Math.floor(Math.random() * 4)];
    const n = 1 + Math.floor(Math.random() * (d - 1));
    return this.makeQuestion({
      topic: 'fraction',
      prompt: `Tô màu ${n}/${d} cái bánh`,
      answer: frac(n, d),
      choices: uniqueChoiceValues([frac(Math.max(1, n - 1), d), frac(Math.min(d - 1, n + 1), d), frac(n, d + 1), frac(Math.min(d, n + 1), d + 1)], frac(n, d)),
      hint: `Chọn ${n} trong ${d} miếng bằng nhau.`,
      steps: [`Cả bánh có ${d} miếng bằng nhau.`, `Cần tô ${n} miếng.`, `Phân số là ${n}/${d}.`],
      speech: `Tô màu ${n} phần ${d} cái bánh.`,
    });
  }

  private addFractionQuestion(): MiniRound['q'] {
    const d = [5, 6, 8, 10][Math.floor(Math.random() * 4)];
    const a = 1 + Math.floor(Math.random() * Math.max(1, d / 2 - 1));
    const b = 1 + Math.floor(Math.random() * (d - a - 1));
    const n = a + b;
    return this.makeQuestion({
      topic: 'fraction',
      prompt: `${a}/${d} + ${b}/${d} = ? Hãy tô kết quả`,
      answer: frac(n, d),
      choices: uniqueChoiceValues([frac(a + b, d + d), frac(Math.max(1, n - 1), d), frac(Math.min(d - 1, n + 1), d), frac(a, d)], frac(n, d)),
      hint: 'Cùng mẫu số: cộng các tử số.',
      steps: [`Mẫu số đều là ${d}.`, `Cộng tử số: ${a} + ${b} = ${n}.`, `Kết quả là ${n}/${d}.`],
    });
  }

  private shareQuestion(): MiniRound['q'] {
    const friends = this.grade === 1 ? 2 : [2, 3, 4][Math.floor(Math.random() * 3)];
    const each = 1 + Math.floor(Math.random() * 3);
    const total = friends * each;
    const choices = uniqueChoiceValues([String(each + 1), String(Math.max(1, each - 1)), String(friends), String(total)], String(each));
    return this.makeQuestion({
      topic: 'div',
      prompt: `Chia ${total} miếng pizza cho ${friends} bạn. Mỗi bạn mấy miếng?`,
      answer: String(each),
      choices,
      hint: `Chia đều ${total} miếng thành ${friends} phần.`,
      steps: [`Có ${total} miếng.`, `Chia cho ${friends} bạn: ${total} : ${friends} = ${each}.`, `Mỗi bạn được ${each} miếng.`],
    });
  }

  private shake(obj: THREE.Object3D): void {
    const x = obj.position.x;
    this.tween(0.35, (k) => (obj.position.x = x + Math.sin(k * Math.PI * 8) * 0.16 * (1 - k)), { ease: 'linear' });
    this.fx.burst('dust', obj.getWorldPosition(new THREE.Vector3()), { count: 10, spread: 0.6 });
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.selected.clear();
      this.clearChoices();
      this.clearSubmit();
      let round: MiniRound;
      if (this.grade <= 2) {
        const q = this.shareQuestion();
        const total = Number(q.prompt.match(/Chia (\d+)/)?.[1] ?? 8);
        this.renderPizza(Math.min(12, total));
        q.context = 'Chạm đĩa có số miếng đúng!';
        round = this.ask(q, { prompt: q.prompt });
        this.makeChoicePlates(round);
      } else {
        const q = this.grade >= 5 && this.round % 2 === 1 ? this.addFractionQuestion() : this.fractionQuestion();
        const d = Number(q.answer.split('/')[1]);
        this.renderPizza(d);
        round = this.ask(q, { prompt: q.prompt });
        this.makeSubmit();
      }
      this.activeRound = round;
      await round.done;
      this.activeRound = null;
      this.fx.burst('confetti', [0, 2.2, 0], { count: 30, spread: 1.8 });
      sfx('coin');
      await this.wait(0.35);
      if (!(await this.nextRound())) break;
    }
  }
}

defineMini(
  {
    id: 'pizza',
    name: 'Chia bánh – phân số',
    icon: '🍕',
    skill: 'Phân số / chia',
    topics: ['fraction', 'div'],
    desc: 'Cắt bánh thành phần bằng nhau, tô miếng bánh hoặc chia cho bạn thú.',
    rounds: 6,
    color: '#ff9f68',
    unlock: 3,
  },
  (info, host) => new PizzaGame(info, host),
);
