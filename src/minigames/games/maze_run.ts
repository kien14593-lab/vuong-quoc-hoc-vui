import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, cyl, group, rbox, torus } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { fitPlate, numberBadge, textPlate } from '../../engine/text';
import { MAZE_TOPICS } from '../../math/curriculum';
import type { Question } from '../../math/types';
import { MiniGame } from '../base';
import { defineMini } from '../registry';

type GateChoice = THREE.Group & { userData: { value: string; home: THREE.Vector3 } };

/** Mọi cửa cùng một màu – tô riêng cửa đúng sẽ lộ đáp án. */
const DOOR_COLOR = '#d7a56d';

function shuffle<T>(a: T[]): T[] {
  return [...a].sort(() => Math.random() - 0.5);
}

class MazeRunGame extends MiniGame {
  private player!: THREE.Group;
  private chest!: THREE.Group;
  private choices: GateChoice[] = [];
  private signs: THREE.Object3D[] = [];
  private pathZ = 4.2;
  private playerBack = 2;

  protected build(): void {
    this.sky('#a7d8ff', '#eaf6e4', 35, 100);
    this.ground('#a9d66f', 80, 80);
    this.setJunctionCamera();
    this.player = this.model('player', undefined, [0, 0, this.pathZ + this.playerBack], Math.PI, 0.9);
    this.anim(this.player)!.move = 0.15;

    for (let z = 2.6; z > -7.5; z -= 2.1) {
      this.model('maze_wall', { len: 3.2, h: 1.35, flowers: z > -2 }, [-3.4, 0, z], 0, 1);
      this.model('maze_wall', { len: 3.2, h: 1.35, flowers: z < -2 }, [3.4, 0, z], 0, 1);
      this.model('maze_wall', { len: 2.0, h: 1.1 }, [-1.3, 0, z - 0.9], Math.PI / 2, 1);
      this.model('maze_wall', { len: 2.0, h: 1.1 }, [1.3, 0, z + 0.9], Math.PI / 2, 1);
    }
    this.chest = group([
      rbox(1.05, 0.65, 0.8, 0.08, '#b98552', { p: [0, 0.35, 0] }),
      rbox(1.1, 0.25, 0.85, 0.09, '#ffd166', { p: [0, 0.76, 0] }),
      box(0.14, 0.72, 0.86, '#8a5a3b', { p: [0, 0.48, 0.01], cast: false }),
      ball(0.12, PAL.gold, { p: [0, 0.62, 0.43], seg: 10, shiny: 80 }),
    ], { p: [0, 0, -8.0] });
    this.scene.add(this.chest);

    this.onPointer('tap', (e) => {
      const hit = this.pick(e.clientX, e.clientY, this.choices);
      if (!hit || !this.current) return;
      const r = this.current.submit(hit.userData.value);
      if (!r.correct) void this.bump(hit);
    });
    this.onKey((e) => {
      if (!this.current) return;
      const idx = e.code === 'ArrowLeft' ? 0 : e.code === 'ArrowUp' ? 1 : e.code === 'ArrowRight' ? 2 : -1;
      const c = this.choices[idx];
      if (c) {
        const r = this.current.submit(c.userData.value);
        if (!r.correct) void this.bump(c);
      }
    });
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearChoices();
      const q = this.mazeQuestion();
      this.setJunctionCamera();
      this.spawnChoices(q);
      const round = this.ask(q, { prompt: q.prompt, visual: true });
      await round.done;
      const correct = this.choices.find((c) => c.userData.value === q.answer);
      if (correct) await this.openAndMove(correct);
      this.fx.burst('sparkle', [this.player.position.x, 1.4, this.player.position.z], { count: 22, spread: 1.2 });
      if (!(await this.nextRound(0.55))) break;
    }
    await this.tween(0.65, (k) => {
      this.player.position.set(0, Math.sin(k * Math.PI) * 0.4, this.pathZ + (-8 - this.pathZ) * k);
      this.player.rotation.y = Math.PI;
    }, { ease: 'inOutCubic' });
    this.fx.burst('confetti', [0, 1.8, -8], { count: 80, spread: 2.5 });
    sfx('coin');
  }

  protected tick(_dt: number, t: number): void {
    this.chest.rotation.y = Math.sin(t * 1.2) * 0.08;
    for (const c of this.choices) c.position.y = c.userData.home.y + Math.sin(t * 2 + c.position.x) * 0.035;
  }

  private mazeQuestion(): Question {
    if (this.isEn) return this.enQ({ short: true, count: 3 });
    const q = this.question(MAZE_TOPICS[this.grade]);
    const choices = q.choices.length >= 3 ? q.choices.map((c) => c.value) : shuffle([q.answer, String(Number(q.answer) + 1), String(Number(q.answer) - 1)]);
    return { ...q, choices: shuffle(choices.slice(0, 3).includes(q.answer) ? choices.slice(0, 3) : [q.answer, ...choices.slice(0, 2)]).map((v) => ({ label: v, value: v })) };
  }

  private spawnChoices(q: Question): void {
    const z = this.pathZ + 0.15;
    const xs = [-1.2, 0, 1.2];
    q.choices.slice(0, 3).forEach((c, i) => {
      const door = this.answerGate(c.label, DOOR_COLOR);
      door.position.set(xs[i], 0, z);
      this.scene.add(door);
      (door as GateChoice).userData.value = c.value;
      (door as GateChoice).userData.home = door.position.clone();
      this.choices.push(door as GateChoice);
    });
  }

  private answerGate(label: string, color: string): THREE.Group {
    const g = new THREE.Group();
    for (const x of [-0.62, 0.62]) {
      g.add(rbox(0.28, 1.65, 0.42, 0.08, '#e2d3b0', { p: [x, 0.82, 0], seg: 2 }));
      g.add(cyl(0.18, 0.2, 0.16, '#c8bda6', { p: [x, 1.68, 0], seg: 10 }));
    }
    g.add(torus(0.63, 0.08, '#d8d0c2', { p: [0, 1.52, 0.02], arc: 180, seg: 8, ts: 16 }));
    g.add(rbox(1.1, 1.0, 0.12, 0.06, tint(color, 0.02), { p: [0, 0.73, 0.08], seg: 2 }));
    const o = { bg: '#fff8ee', color: PAL.ink, border: color, pad: 16, radius: 18, weight: 900 };
    let plate: THREE.Mesh;
    // Cửa cách nhau 1.2: nhãn chữ không rộng quá 1.1 để không chồng lên nhau.
    if (this.isEn) plate = fitPlate(label, 1.1, 0.48, o);
    else {
      const displayLabel = label.startsWith('Hình ') ? label.replace('Hình ', 'Hình\n') : label;
      plate = textPlate(displayLabel, displayLabel.includes('\n') ? 0.72 : 0.48, o);
      const aspect = (plate.geometry as THREE.PlaneGeometry).parameters.width / (plate.geometry as THREE.PlaneGeometry).parameters.height;
      if (aspect > 2.75) plate.scale.setScalar(2.75 / aspect);
    }
    plate.position.set(0, 1.15, 0.9);
    g.add(plate);
    return g;
  }

  private clearChoices(): void {
    for (const c of this.choices) this.remove(c);
    this.choices = [];
    for (const s of this.signs) this.remove(s);
    this.signs = [];
  }

  private async bump(g: GateChoice): Promise<void> {
    sfx('wrong');
    const x = g.position.x;
    await this.tween(0.28, (k) => {
      g.position.x = x + Math.sin(k * Math.PI * 5) * 0.12 * (1 - k);
      this.player.rotation.z = Math.sin(k * Math.PI * 5) * 0.12;
    });
    g.position.x = x;
    this.player.rotation.z = 0;
    this.ui.flash('Oops! Thử cửa khác nhé', 'warn', 850);
  }

  private async openAndMove(g: GateChoice): Promise<void> {
    sfx('open');
    const startZ = this.player.position.z;
    const endZ = this.pathZ - 1.2;
    await this.tween(0.35, (k) => {
      g.position.y = g.userData.home.y + k * 1.2;
      g.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.12);
    }, { ease: 'outCubic' });
    await this.tween(0.55, (k) => {
      this.player.position.x = g.position.x * (1 - k);
      this.player.position.z = startZ + (endZ - startZ) * k;
      this.player.position.y = Math.sin(k * Math.PI) * 0.18;
      const st = this.anim(this.player);
      if (st) st.move = 1;
    }, { ease: 'inOutCubic' });
    this.pathZ -= 1.65;
    this.player.position.x = 0;
    this.player.position.z = this.pathZ + this.playerBack;
    this.anim(this.player)!.move = 0.15;
  }

  private setJunctionCamera(): void {
    this.view([0, 8.0, this.pathZ + 7.4], [0, 0.8, this.pathZ - 1.45], 42);
  }
}

defineMini(
  {
    id: 'maze_run',
    name: '🌀 Mê cung – logic và toán',
    icon: '🌀',
    skill: 'Logic, phép tính, so sánh',
    topics: ['add', 'sub', 'compare', 'sequence'],
    desc: 'Chạm cánh cửa có đáp án đúng để mở đường tới rương báu.',
    rounds: 6,
    color: '#b79cff',
    unlock: 1,
    en: {
      name: 'Mê cung chữ',
      skill: 'Từ vựng, chữ cái',
      desc: 'Chạm cánh cửa có từ hoặc chữ cái đúng để mở đường tới rương báu.',
    },
    both: 'Mê cung',
    enTopics: ['en_vocab', 'en_phonics', 'en_spell'],
  },
  (info, host) => new MazeRunGame(info, host),
);
