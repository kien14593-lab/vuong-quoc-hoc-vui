import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { profile, setFlag } from '../../core/state';
import { CAST } from '../../game/cast';
import { adaptiveQuestion, mixedQuestion, storyQuestion } from '../../game/challenge';
import { mazeKeys, on, reward } from '../../game/story';
import { MAZE_TOPICS } from '../../math/curriculum';
import type { Question } from '../../math/types';
import { say } from '../../ui/dialog';
import { toast } from '../../ui/toast';
import type { Npc, PickSpot, Spawn } from '../zone';
import { Zone } from '../zone';

type DoorRec = { obj: THREE.Object3D; x: number; z: number; value: string; label: string; correct: boolean; opened?: boolean };
type Junction = {
  id: 1 | 2 | 3;
  title: string;
  x: number;
  z: number;
  topicIndex: number;
  correctDoor: 0 | 1 | 2 | 3;
  doors: DoorRec[];
  key: [number, number];
};

const INTRO_FLAG = 'maze.intro';
const EXIT_FLAG = 'maze.exit';
const STAR_ID = 'maze.star.1';
const FLAGS = {
  j: (n: number) => `maze.j${n}`,
  key: (n: number) => `maze.key${n}`,
  keyPickup: (n: number) => `maze.pick.key${n}`,
};

const WALL_H = 1.68;
const LOW_WALL_H = 1.25;

/** 🌀 MÊ CUNG KỲ BÍ – chọn cửa bằng đáp án, tìm 3 chìa khóa rồi mở cổng sang Sở Thú. */
export class MazeZone extends Zone {
  private robot!: Npc;
  private junctions: Junction[] = [];
  private exitGate: THREE.Object3D | null = null;
  private exitBunting: THREE.Object3D | null = null;

  constructor(spawn: Spawn) {
    super(
      {
        id: 'maze',
        title: 'Mê Cung Kỳ Bí',
        icon: '🌀',
        sub: 'Chọn đúng cánh cửa để tìm chìa khóa',
        music: 'maze',
        area: { hw: 30, hd: 26, r: 8 },
        margin: 16,
        seed: 21,
        ground: '#b8de83',
        fog: [46, 105],
        mood: { sun: '#fff1b5', sky: '#9fd8f7', ground: '#78b85f' },
        cam: { yaw: 0, pitch: 64, dist: 22, minDist: 12, maxDist: 32 },
        spawns: {
          start: { x: -22.5, z: 20.5, rot: 130 },
          from_forest: { x: -22.5, z: 20.5, rot: 130 },
          from_zoo: { x: 25.4, z: -6.2, rot: -90 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    this.buildGround();
    this.buildWalls();
    this.buildJunctions();
    this.buildExit();
    this.buildSideContent();
    this.buildDecor();

    this.portal(-27.6, 22.3, 'forest', 'from_maze', { label: 'Rừng Thông Thái', r: 1.4, rot: 45 });
    this.portal(28.2, -6.2, 'zoo', 'from_maze', {
      label: 'Sở Thú Kỳ Diệu',
      r: 1.5,
      rot: -90,
      lock: () => (on(EXIT_FLAG) ? null : 'Cửa ra của Mê Cung còn khóa – hãy tìm 3 chìa khóa nhé!'),
    });
  }

  protected onEnter(first: boolean): void {
    if ((first || !on(INTRO_FLAG)) && !on(INTRO_FLAG)) {
      void this.runInteract({ id: 'maze:intro', x: 0, z: 0, r: 0, label: '', icon: '', run: () => this.intro() });
    }
  }

  override objective(): { text: string; icon?: string } | null {
    const k = mazeKeys();
    if (k < 3) return { text: `Tìm 3 chìa khóa trong Mê Cung (${k}/3)`, icon: '🗝️' };
    if (!on(EXIT_FLAG)) return { text: 'Đến cổng phía đông và mở cửa ra Mê Cung', icon: '🚪' };
    return { text: 'Đi sang Sở Thú Kỳ Diệu ở phía đông', icon: '🎟️' };
  }

  protected override async buddyTalk(): Promise<void> {
    const k = mazeKeys();
    if (k < 3) {
      await say(CAST.gau, [`Mình đã thấy ${k}/3 chìa khóa rồi.`, 'Bạn chọn cửa theo đáp án trên bảng nhé. Sai thì mình quay lại thử cửa khác!']);
      const next = this.junctions.find((j) => !on(FLAGS.key(j.id)));
      if (next) await this.showPoint(next.x, 1, next.z, 1.1, 13);
      return;
    }
    if (!on(EXIT_FLAG)) {
      await say(CAST.gau, ['Đủ 3 chìa khóa rồi! Mình cùng mở cổng sang Sở Thú nhé.', 'Robot Bíp đang đứng gần cổng phía đông đó.']);
      await this.showPoint(23.2, 1.4, -6.2, 1.1, 13);
      return;
    }
    await say(CAST.gau, 'Tuyệt quá! Mình có vé Sở Thú rồi. Đi gặp Bác Voi thôi!');
  }

  private buildGround(): void {
    const t = this.terrain;
    const main = { color: '#efe4ff', edge: '#cdb4db', kind: 'stone' as const };
    const side = { color: '#e2f6d5', edge: '#a9dca0', kind: 'dirt' as const };
    t.path([[-30, 23], [-24, 20.5], [-18, 16.5], [-15, 14]], 3, main);
    t.path([[-15, 14], [-10, 14], [-6, 14], [-3, 8.5], [-3, 6]], 3, main);
    t.path([[-3, 6], [2, 6], [6, 6], [8.5, 1], [9, -2]], 3, main);
    t.path([[9, -2], [14, -2], [17, -2], [21, -5.2], [30, -6.2]], 3, main);
    t.path([[-15, 14], [-15, 20], [-20, 20]], 2.4, side);
    t.path([[-15, 14], [-15, 8.5], [-20.5, 8.5]], 2.4, side);
    t.path([[-3, 6], [-3, 12], [2, 12]], 2.4, side);
    t.path([[-3, 6], [-3, 0.5], [-8.5, 0.5]], 2.4, side);
    t.path([[9, -2], [9, 3.5], [14, 3.5]], 2.4, side);
    t.path([[9, -2], [9, -8], [3.5, -8]], 2.4, side);
    t.path([[-24, 10], [-22, 4], [-17, 2]], 2.1, side);
    t.path([[-7, -9], [-3, -13], [2, -12]], 2.1, side);
    t.plaza(-15, 14, 3.4);
    t.plaza(-3, 6, 3.4);
    t.plaza(9, -2, 3.4);
    t.plaza(23, -6.2, 3.1);
    t.meadow(-23, 10, 3.5, ['#ffffff', '#ff9ec7', '#ffd166'], 3);
    t.meadow(0, -12, 3.2, ['#b197fc', '#ffffff', '#4ecdc4'], 3);
  }

  private wall(x: number, z: number, len: number, rot = 0, h = WALL_H, flowers = false): void {
    this.place('maze_wall', x, z, { rot, opts: { len, h, flowers }, reserve: false });
  }

  private buildWalls(): void {
    for (const [x, z, len, rot, h, flowers] of [
      [-21, 22.8, 11, 25, LOW_WALL_H, true],
      [-18.5, 12.3, 12, 25, WALL_H, false],
      [-12.1, 17.7, 8, 90, LOW_WALL_H, true],
      [-17.9, 10.2, 8, 90, WALL_H, false],
      [-10.5, 16.2, 5, 0, LOW_WALL_H, true],
      [-10.5, 11.8, 5, 0, WALL_H, false],
      [-4.8, 16.2, 7, 90, WALL_H, true],
      [-7.7, 8.2, 8, 25, WALL_H, false],
      [0.5, 8.2, 9, 25, LOW_WALL_H, true],
      [-6.2, 3.9, 7, 90, WALL_H, false],
      [0.2, 3.7, 7, 90, LOW_WALL_H, true],
      [4.5, 8.2, 6, 0, WALL_H, true],
      [4.8, 3.7, 6, 0, LOW_WALL_H, false],
      [6.4, 0.2, 8, 28, WALL_H, false],
      [11.8, 0.3, 8, 28, LOW_WALL_H, true],
      [6.2, -4.2, 7, 90, WALL_H, false],
      [12.2, -4.5, 7, 90, LOW_WALL_H, true],
      [15.2, -0.1, 6, 0, WALL_H, false],
      [15.5, -4.4, 6, 0, LOW_WALL_H, true],
      [20.4, -2.9, 7, 45, WALL_H, false],
      [20.7, -9.4, 7, 45, LOW_WALL_H, true],
      [-20.7, 5.8, 8, 20, WALL_H, true],
      [-25.2, 8.5, 8, 90, LOW_WALL_H, false],
      [-21.3, 0.6, 9, 90, WALL_H, true],
      [-8.5, -4.8, 9, 0, WALL_H, true],
      [-4.8, -10.5, 7, 45, LOW_WALL_H, false],
      [1.8, -15, 8, 90, WALL_H, true],
      [4.7, -9.2, 6, 0, LOW_WALL_H, false],
    ] as [number, number, number, number, number, boolean][]) {
      this.wall(x, z, len, rot, h, flowers);
    }

    this.place('gate_arch', -24.5, 21.8, { rot: 45, opts: { text: 'Mê Cung', color: '#7bd389', w: 4.3 } });
    this.sign(-24.5, 21.8, '🌀 Lối vào Mê Cung', { y: 3.4, maxDist: 38 });
  }

  private buildJunctions(): void {
    const topics = MAZE_TOPICS[profile().grade];
    const configs: Omit<Junction, 'doors'>[] = [
      { id: 1, title: 'Cửa chìa khóa 1', x: -15, z: 14, topicIndex: 0, correctDoor: 0, key: [-6.2, 14] },
      { id: 2, title: 'Cửa chìa khóa 2', x: -3, z: 6, topicIndex: 1, correctDoor: 1, key: [6.2, 6] },
      { id: 3, title: 'Cửa chìa khóa 3', x: 9, z: -2, topicIndex: 2, correctDoor: 2, key: [17.1, -2] },
    ];

    for (const cfg of configs) {
      const q = adaptiveQuestion(topics[cfg.topicIndex % topics.length]);
      const j: Junction = { ...cfg, doors: [] };
      this.place('question_board', cfg.x, cfg.z - 2.5, { rot: 0, scale: 0.72, dynamic: true, collide: false, reserve: 1.2 });
      this.sign(cfg.x, cfg.z - 2.6, `🧩 ${cfg.title}`, { y: 2.5, cls: 'sign small', maxDist: 28 });
      const spots = this.doorSpots(cfg.id, cfg.x, cfg.z, q, cfg.correctDoor);
      j.doors = spots;
      this.junctions.push(j);

      if (on(FLAGS.j(cfg.id))) spots.filter((d) => d.correct).forEach((d) => this.openDoor(d, true));
      this.interact({
        id: `maze:j${cfg.id}:start`,
        x: cfg.x,
        z: cfg.z,
        r: 3,
        label: on(FLAGS.j(cfg.id)) ? 'Cửa đã mở' : 'Chọn cửa đáp án',
        icon: '🚪',
        enabled: () => !on(FLAGS.j(cfg.id)),
        run: () => {
          void this.startJunction(j, q);
        },
      });

      this.place('maze_key_pedestal', cfg.key[0], cfg.key[1], { dynamic: true, collide: false, reserve: 1.4 });
      if (!on(FLAGS.key(cfg.id))) {
        this.pickup('key', cfg.key[0], cfg.key[1], {
          id: FLAGS.keyPickup(cfg.id),
          y: 1.35,
          onPick: () => {
            if (on(FLAGS.key(cfg.id))) return;
            setFlag(FLAGS.j(cfg.id));
            setFlag(FLAGS.key(cfg.id));
            reward({ xp: 10 });
            sfx('unlock');
            this.buddy?.celebrate(1.1);
            toast(`Bạn đã tìm được chìa khóa ${mazeKeys()}/3!`, { icon: '🗝️', tone: 'gold' });
            this.refreshMarks();
          },
        });
      }
    }
  }

  private doorSpots(id: number, x: number, z: number, q: Question, correctDoor: number): DoorRec[] {
    const layouts: [number, number, number][] =
      id === 1
        ? [
            [x + 3.25, z, -90],
            [x, z - 3.25, 0],
            [x, z + 3.25, 180],
          ]
        : id === 2
          ? [
              [x, z - 3.25, 0],
              [x + 3.25, z, -90],
              [x, z + 3.25, 180],
              [x - 3.25, z, 90],
            ]
          : [
              [x, z - 3.25, 0],
              [x, z + 3.25, 180],
              [x + 3.25, z, -90],
              [x - 3.25, z, 90],
            ];
    const rightChoice = q.choices.find((c) => c.value === q.answer || q.accept?.includes(c.value)) ?? q.choices[0];
    const wrongChoices = q.choices.filter((c) => c !== rightChoice);
    return layouts.slice(0, q.choices.length).map(([dx, dz, rot], i) => {
      const c = i === correctDoor ? rightChoice : (wrongChoices.shift() ?? rightChoice);
      const obj = this.place('maze_door', dx, dz, { rot, opts: { n: c.label, color: ['#d7a56d', '#7aa7e0', '#b197fc', '#ff9ec7'][i % 4] }, dynamic: true, reserve: 1.5 });
      return { obj, x: dx, z: dz, value: c.value, label: c.label, correct: i === correctDoor };
    });
  }

  private startJunction(j: Junction, q: Question): void {
    const doors = this.alignCorrectDoor(j, q);
    const spots: PickSpot[] = doors.map((d) => ({ value: d.value, x: d.x, z: d.z, r: 2.1, obj: d.obj, label: `Cửa ${d.label}`, icon: '🚪', tag: d.label }));
    this.robot.actor.face(j.x, j.z);
    this.bubble(this.robot.actor.root, 'Hãy chọn cửa có đáp án đúng!', this.robot.actor.height + 0.8, 2600);
    void this.pick(q, spots, {
      src: `maze:j${j.id}`,
      speaker: CAST.robot,
      title: j.title,
      icon: '🚪',
      area: { x: j.x, z: j.z, r: 7 },
      showVisual: true,
      tags: 3.0,
      onWrong: async (spot) => {
        const d = doors.find((door) => door.obj === spot.obj);
        if (d) {
          this.openDoor(d);
          await this.wait(0.45);
        }
        await say(CAST.robot, 'Oops! Đây chưa phải đường đúng rồi. Hãy quay lại và thử một cánh cửa khác nhé!');
      },
      onRight: async (spot) => {
        const d = doors.find((door) => door.obj === spot.obj);
        if (d) this.openDoor(d);
        setFlag(FLAGS.j(j.id));
        sfx('correct');
        this.fx.burst('sparkle', [spot.x, 1.2, spot.z], { count: 24 });
        this.bubble(this.robot.actor.root, 'Đúng rồi! Chìa khóa ở phía sau cửa.', this.robot.actor.height + 0.8, 2800);
        await this.showPoint(j.key[0], 1.3, j.key[1], 1.1, 12);
      },
    }).then(() => this.refreshMarks());
  }

  private alignCorrectDoor(j: Junction, q: Question): DoorRec[] {
    const right = j.doors.find((d) => d.correct);
    if (right && !(right.value === q.answer || q.accept?.includes(right.value))) right.correct = false;
    return j.doors;
  }

  private openDoor(d: DoorRec, instant = false): void {
    if (d.opened && !instant) return;
    d.opened = true;
    this.setSolid(d.obj, false);
    const leaf = d.obj.getObjectByName('door');
    if (!leaf) return;
    if (instant) {
      leaf.rotation.y = -Math.PI * 0.55;
      return;
    }
    sfx('door');
    void this.tween(0.45, (k) => {
      leaf.rotation.y = -Math.sin((k * Math.PI) / 2) * Math.PI * 0.55;
    });
  }

  private buildExit(): void {
    this.exitGate = this.place('maze_exit_gate', 23.2, -6.2, { rot: 90, dynamic: true, reserve: 2.5, collide: !on(EXIT_FLAG) });
    if (on(EXIT_FLAG)) this.openExitGate(true);
    this.sign(23.2, -6.2, '🚪 Cửa ra Sở Thú', { y: 3.7, maxDist: 38 });
    this.robot = this.npc(CAST.robot.art, 20.9, -8.0, {
      name: CAST.robot.name,
      color: CAST.robot.color,
      rot: 35,
      r: 2.5,
      mark: () => (mazeKeys() >= 3 && !on(EXIT_FLAG) ? '!' : mazeKeys() < 3 ? '?' : '★'),
      talk: () => this.talkRobot(),
    });
    this.interact({
      id: 'maze:exitGate',
      x: 23.2,
      z: -6.2,
      r: 2.7,
      label: on(EXIT_FLAG) ? 'Cổng đã mở' : 'Mở cổng',
      icon: '🗝️',
      obj: this.exitGate,
      enabled: () => !on(EXIT_FLAG),
      run: () => this.openExit(),
    });
  }

  private async talkRobot(): Promise<void> {
    const k = mazeKeys();
    if (!on(INTRO_FLAG)) return this.intro();
    if (k < 3) {
      await say(CAST.robot, [`Bạn đã có ${k}/3 chìa khóa.`, 'Mỗi ngã rẽ có một câu hỏi. Hãy đi qua cánh cửa mang đáp án đúng nhé!']);
      const next = this.junctions.find((j) => !on(FLAGS.key(j.id)));
      if (next) await this.showPoint(next.x, 1.2, next.z, 1.2, 13);
      return;
    }
    if (!on(EXIT_FLAG)) {
      await say(CAST.robot, ['Đủ 3 chìa khóa rồi. Cổng cuối đang chờ bạn giải một phép tính nữa!', 'Hãy chạm vào cánh cổng lớn nhé.']);
      await this.showPoint(23.2, 1.5, -6.2, 1.1, 12);
      return;
    }
    await say(CAST.robot, ['Cổng đã mở. Vé này dùng để vào Sở Thú Kỳ Diệu.', 'Bác Voi cần 5 vé. Bạn sẽ lấy thêm 4 vé nữa ở Khu Vui Chơi nhé!']);
  }

  private async openExit(): Promise<void> {
    const k = mazeKeys();
    if (k < 3) {
      await say(CAST.robot, `Bạn còn thiếu ${3 - k} chìa khóa nữa. Mình cùng tìm tiếp nhé!`);
      const next = this.junctions.find((j) => !on(FLAGS.key(j.id)));
      if (next) await this.showPoint(next.x, 1.2, next.z, 1.2, 13);
      return;
    }
    await this.quiz(storyQuestion('mazeDoor'), { src: 'maze:exit', speaker: CAST.robot, title: 'Mở cửa Mê Cung', icon: '🚪' }, this.exitGate ?? [23.2, 1.4, -6.2], 12);
    setFlag(EXIT_FLAG);
    this.openExitGate();
    reward({ tickets: 1, stars: 1, xp: 25, coins: 10, badge: 'vua-me-cung' });
    this.robot.actor.celebrate(1.7);
    this.buddy?.celebrate(1.7);
    this.fx.burst('confetti', [23.2, 2.2, -6.2], { count: 60 });
    await say(CAST.robot, ['Bíp bíp! Cổng đã mở rồi!', 'Đây là một vé Sở Thú. Bác Voi cần 5 vé để mở cổng.', 'Bạn sẽ nhận thêm 4 vé ở Khu Vui Chơi. Cùng đi tiếp nào!']);
    this.refreshMarks();
  }

  private openExitGate(instant = false): void {
    if (!this.exitGate) return;
    this.setSolid(this.exitGate, false);
    if (this.exitBunting) this.exitBunting.visible = true;
    const l = this.exitGate.getObjectByName('doorL');
    const r = this.exitGate.getObjectByName('doorR');
    if (instant) {
      if (l) l.rotation.y = -Math.PI * 0.48;
      if (r) r.rotation.y = Math.PI * 0.48;
      return;
    }
    sfx('unlock');
    void this.tween(0.8, (k) => {
      const a = Math.sin((k * Math.PI) / 2) * Math.PI * 0.48;
      if (l) l.rotation.y = -a;
      if (r) r.rotation.y = a;
    });
  }

  private buildSideContent(): void {
    this.miniSpot('maze_run', -22.6, 16.4, { model: 'question_board', rot: 35, scale: 0.72, r: 2.2, y: 2.5 });
    this.pickup('star', -22.2, 4.2, { id: STAR_ID, y: 1.05 });
    this.place('maze_key_pedestal', -22.2, 4.2, { scale: 0.75, collide: false });
    this.sign(-22.2, 4.2, '⭐ Góc bí mật', { y: 1.9, cls: 'sign small', maxDist: 24 });

    this.npc(CAST.rua.art, -5.8, -12.7, {
      name: CAST.rua.name,
      color: CAST.rua.color,
      rot: 25,
      // Mai rùa sâu ≈1.4 m, đầu to: đẩy bé ra xa hơn vật cản 0.52 của mô hình để mặt và mai không lẹm vào bé.
      radius: 0.7,
      action: 'Giải đố',
      icon: '🧩',
      talk: async (npc) => {
        await say(CAST.rua, ['Chậm mà chắc là bí quyết đi mê cung.', 'Ông có một câu đố nhỏ cho cháu đây.']);
        await this.quiz(mixedQuestion(MAZE_TOPICS[profile().grade]), { src: 'maze:turtle', speaker: CAST.rua, title: 'Câu đố của Ông Rùa', icon: '🧩' }, npc.actor, 10);
        await say(CAST.rua, 'Tuyệt lắm! Cháu nhớ nhìn biển chỉ dẫn và đi từng bước nhé.');
      },
    });
    this.npc(CAST.soc.art, -23.7, 9.3, {
      name: CAST.soc.name,
      color: CAST.soc.color,
      rot: 110,
      action: 'Hỏi mẹo',
      icon: '💡',
      talk: async (npc) => {
        await say(CAST.soc, ['Nếu gặp nhiều cửa, cháu đọc câu hỏi trước rồi nhìn số trên từng cửa.', 'Cô Sóc tặng cháu một bài luyện nhanh nhé!']);
        await this.quiz(mixedQuestion(MAZE_TOPICS[profile().grade]), { src: 'maze:squirrel', speaker: CAST.soc, title: 'Mẹo đi mê cung', icon: '💡' }, npc.actor, 10);
      },
    });
  }

  private buildDecor(): void {
    for (const [x, z] of [[-17.6, 16.5], [-12.5, 11.5], [-5.5, 8.6], [-0.6, 3.5], [6.4, 0.5], [11.6, -4.6]] as [number, number][]) {
      this.place('bush', x, z, { scale: 0.85, collide: false, reserve: false });
      this.place('flower_pot', x + 0.7, z - 0.35, { scale: 0.75, collide: false, reserve: false });
    }
    this.place('fountain', -15, 18.7, { scale: 0.55, collide: false, reserve: 1.2 });
    this.exitBunting = this.place('maze_bunting', 22.9, -6.2, { rot: 90, y: 3.05, dynamic: true, collide: false, reserve: false });
    this.exitBunting.visible = on(EXIT_FLAG);
    for (const [x, z, r] of [
      [-24.5, 18.3, 20],
      [-18, 13, -15],
      [-8, 11, 12],
      [0.8, 8.8, -10],
      [7.5, 1.2, 20],
      [16.5, -4.5, -18],
      [21.2, -9.2, 12],
      [-12, 16, 45],
      [2.5, 5.6, -35],
      [12.8, -1.7, 25],
    ] as [number, number, number][]) {
      this.place('lamp_post', x, z, { rot: r });
    }
    this.scatter(['flower', 'tulip', 'grass', 'mushroom'], 95, { gap: 0.75, collide: false, pathGap: 0.25 });
    this.scatter(['bush', 'flower_bed', 'rock'], 16, { gap: 2.4, scale: [0.75, 1.05], collide: false, pathGap: 0.9 });
    this.border(['tree_pine', 'tree_round', 'tree_tall', 'bush'], { band: 10, scale: [0.9, 1.25] });
    const flies = [
      this.place('critter_butterfly', -16.8, 15.8, { dynamic: true, collide: false, reserve: false }),
      this.place('critter_butterfly', 7.5, -5.6, { dynamic: true, collide: false, reserve: false }),
    ];
    this.addTick((_dt, t) => {
      flies.forEach((b, i) => {
        const a = t * (0.55 + i * 0.12) + i * 2.8;
        const cx = i ? 8.8 : -16;
        const cz = i ? -5.3 : 15.2;
        b.position.set(cx + Math.cos(a) * 1.8, 1.1 + Math.sin(t * 2.4 + i) * 0.28, cz + Math.sin(a * 1.25) * 1.2);
        b.rotation.y = -a + Math.PI / 2;
      });
    });
  }

  private async intro(): Promise<void> {
    setFlag(INTRO_FLAG);
    await this.wait(0.45);
    this.robot.actor.waving = true;
    this.bubble(this.robot.actor.root, 'Bíp bíp! Xin chào!', this.robot.actor.height + 0.8, 1800);
    await this.wait(0.8);
    this.robot.actor.waving = false;
    await say(CAST.robot, ['Chào mừng bạn đến Mê Cung Kỳ Bí!', 'Ở mỗi ngã rẽ, bạn sẽ thấy nhiều cánh cửa có số.', 'Hãy giải câu hỏi rồi đi qua cánh cửa mang đáp án đúng.']);
    await this.showPoint(this.junctions[0].x, 1.2, this.junctions[0].z, 1.4, 13);
    await say(CAST.robot, ['Nếu chọn chưa đúng, không sao cả. Cửa đó chỉ là phòng cụt nhỏ.', 'Bạn quay lại và thử cánh cửa khác nhé. Mục tiêu là tìm đủ 3 chìa khóa!']);
  }
}
