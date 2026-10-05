import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { profile, setFlag } from '../../core/state';
import { CAST, villager } from '../../game/cast';
import { mixedQuestion, storyQuestion } from '../../game/challenge';
import { checkBadges, on, reward, zoneLock, ZOO_TICKETS } from '../../game/story';
import type { Question } from '../../math/types';
import { say } from '../../ui/dialog';
import { toast } from '../../ui/toast';
import { Zone, type PickSpot, type Spawn } from '../zone';

const FLAGS = ['park.coaster', 'park.balls', 'park.wheel', 'park.clown'] as const;
const COLORS = ['#ff6b6b', '#6cb8ff', '#ffd166', '#7bd389', '#b197fc', '#ff9ec7'];

type ParkFlag = (typeof FLAGS)[number];

/** 🎡 KHU VUI CHƠI – vé thưởng, các trò thử thách và đường tới Sở Thú. */
export class ParkZone extends Zone {
  private gate!: THREE.Object3D;
  private clown!: ReturnType<Zone['npc']>;
  private coaster!: THREE.Object3D;
  private coasterTrain: THREE.Object3D | null = null;
  private booth!: THREE.Object3D;
  private wheel!: THREE.Object3D;
  private activePick: 'balls' | 'wheel' | null = null;
  private ballChoices: THREE.Object3D[] = [];
  private wheelChoices: THREE.Object3D[] = [];
  private ticketMarks: THREE.Object3D[] = [];

  constructor(spawn: Spawn) {
    super(
      {
        id: 'park',
        title: 'Khu Vui Chơi',
        icon: '🎡',
        sub: 'Mỗi thử thách đúng nhận một vé',
        music: 'park',
        area: { hw: 34, hd: 28, r: 11 },
        margin: 16,
        seed: 31,
        ground: '#a9df76',
        sky: ['#92dcff', '#fff0c8'],
        fog: [58, 128],
        mood: { hemi: 1.35, sunI: 2.05 },
        cam: { yaw: 0.05, pitch: 52, dist: 19, minDist: 11, maxDist: 30 },
        spawns: {
          start: { x: -30.2, z: 4.2, rot: 90 },
          from_village: { x: -30.2, z: 4.2, rot: 90 },
          from_zoo: { x: 29.6, z: -19.8, rot: -110 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    const t = this.terrain;
    t.plaza(-22.5, 4.2, 5.0);
    t.plaza(-1.5, 1.0, 8.8);
    t.plaza(12.6, -8.2, 5.4);
    t.plaza(-10.6, 11.8, 4.3);
    t.plaza(12.6, 11.2, 4.2);
    t.plaza(-20.5, 0.2, 4.2);
    t.plaza(-4.5, 13.2, 3.6);
    t.plaza(20.7, 4.8, 3.8);
    t.path([[-42, 4.2], [-28, 4.2], [-18, 3.2], [-7.0, 1.4], [3, -1.6], [13.2, -8.2]], 3.0);
    t.path([[-7.0, 1.4], [-10.6, 11.8], [-14.4, 17.0]], 2.6);
    t.path([[-1.5, 1.0], [9.5, 7.0], [12.6, 11.2], [18.6, 9.0]], 2.5);
    t.path([[3, -1.6], [14.5, -11.5], [23.0, -16.7], [38, -22.5]], 2.8);
    t.path([[-20.5, 0.2], [-14.0, -6.5], [-10.6, -9.0]], 2.4);
    t.path([[-20.5, 0.2], [-11.0, 6.3], [-10.6, 11.8]], 2.3);
    t.meadow(-25, 13.5, 4.4, ['#ffffff', '#ffd6e7', '#fff3a6', '#c8facc'], 5);
    t.meadow(20, 2, 4.2, ['#ffffff', '#bfe6ff', '#ffd6e7'], 4);
    t.patch(0, 1, 9.5, '#bfe283', 0.55);

    this.portal(-32.2, 4.2, 'village', 'from_park', { label: 'Ngôi Làng', r: 1.55, rot: 90 });
    this.portal(31.8, -20.7, 'zoo', 'from_park', { label: 'Sở Thú Kỳ Diệu', lock: () => zoneLock('zoo'), r: 1.55, rot: -35 });

    this.gate = this.place('park_gate', -26.2, 4.2, { rot: 90, scale: 1.05, dynamic: true, collide: false, reserve: 4.6 });
    this.applyGateState(on('park.intro'));
    this.sign(-27.0, 8.1, '🎡 Khu Vui Chơi', { y: 3.2, maxDist: 42 });
    this.sign(26.8, -17.5, '🦁 Lối tới Sở Thú', { y: 2.6, maxDist: 42 });
    this.place('park_ticket_board', -22.3, -1.4, { rot: 8, scale: 0.95, reserve: 3.4 });
    this.createTicketMarks();

    this.booth = this.place('ball_booth', -10.8, 11.8, { rot: 175, scale: 1.05, dynamic: true, reserve: 4.2 });
    this.interact({
      id: 'park:balls',
      x: -10.8,
      z: 14.2,
      r: 2.6,
      label: 'Ném bóng',
      icon: '🎯',
      obj: this.booth,
      enabled: () => !on('park.balls') && this.activePick !== 'balls',
      run: () => this.startBalls(),
    });

    this.coaster = this.place('roller_coaster', -10.6, -9.0, { rot: -8, scale: 0.92, dynamic: true, reserve: 8.0 });
    this.coasterTrain = this.coaster.getObjectByName('train') ?? null;
    this.interact({
      id: 'park:coaster',
      x: -16.4,
      z: -6.8,
      r: 3.0,
      label: 'Đi tàu lượn',
      icon: '🎢',
      obj: this.coaster,
      enabled: () => !on('park.coaster'),
      run: () => this.coasterChallenge(),
    });

    this.wheel = this.place('ferris_wheel', 12.8, -8.0, { rot: 8, scale: 1.05, dynamic: true, reserve: 5.6 });
    this.interact({
      id: 'park:wheel',
      x: 12.6,
      z: -4.1,
      r: 3.0,
      label: 'Quay vòng quay',
      icon: '🎡',
      obj: this.wheel,
      enabled: () => !on('park.wheel') && this.activePick !== 'wheel',
      run: () => this.startWheel(),
    });

    this.place('carousel', 12.7, 11.1, { rot: -12, scale: 0.92, dynamic: true, reserve: 4.1 });
    this.place('balloon_stand', 21.0, 5.2, { rot: -35, dynamic: true, reserve: 2.8 });
    this.place('ice_cream_cart', 1.2, 10.9, { rot: -25, reserve: 2.4 });
    this.place('bunting', -17.8, 4.0, { rot: 95, opts: { len: 7 }, collide: false, dynamic: true, reserve: false });
    this.place('bunting', 4.6, 4.8, { rot: 45, opts: { len: 8 }, collide: false, dynamic: true, reserve: false });
    this.place('bunting', 21.0, -13.8, { rot: -35, opts: { len: 7 }, collide: false, dynamic: true, reserve: false });

    this.clown = this.npc(CAST.he.art, -20.5, 1.2, {
      name: CAST.he.name,
      color: CAST.he.color,
      rot: 90,
      r: 2.8,
      action: 'Gặp Bibo',
      icon: '🤹',
      mark: () => (!on('park.clown') ? '!' : this.doneCount() >= 4 && !on('park.medal') ? '!' : '★'),
      talk: () => this.talkClown(),
    });
    this.place('clown_stage', -20.7, -2.0, { rot: 10, scale: 0.92, reserve: 3.2 });

    this.place('question_board', -7.5, -16.6, { rot: -12, opts: { text: 'Tàu' }, reserve: 2.4 });
    this.miniSpot('train', -7.3, -16.4, { model: 'bench', rot: 0, r: 2.3, y: 1.6 });
    this.miniSpot('shoot_answer', -16.0, 13.8, { model: 'question_board', rot: 155, r: 2.3, y: 2.9 });
    this.miniSpot('wheel', 18.6, -4.2, { model: 'question_board', rot: -20, r: 2.3, y: 2.9 });

    this.decorate();
  }

  protected onEnter(first: boolean): void {
    if (first && !on('park.intro')) void this.runInteract({ id: 'park:intro', x: -24.5, z: 4.2, r: 0, label: '', icon: '', run: () => this.intro() });
  }

  objective(): { text: string; icon?: string } | null {
    const done = this.doneCount();
    if (done < 4) return { text: `Nhận vé ở 4 trò chơi (${done}/4) · Bạn có ${profile().tickets}/${ZOO_TICKETS} vé`, icon: '🎟️' };
    if (!on('park.medal')) return { text: 'Gặp Chú Hề Bibo để nhận huy chương', icon: '🏅' };
    return { text: `Đi tới Sở Thú khi có ${ZOO_TICKETS} vé (${profile().tickets}/${ZOO_TICKETS})`, icon: '🦁' };
  }

  protected override buddyTalk(): Promise<void> {
    return say(CAST.gau, [`Mỗi trò chơi toán học cho mình 1 vé.`, `Mình đang có ${profile().tickets}/${ZOO_TICKETS} vé để mở cổng Sở Thú.`, 'Bạn chọn trò nào trước cũng được!']);
  }

  private decorate(): void {
    this.decorateAttractions();
    this.decorateFoodCourt();
    this.decorateLights();

    const benches: [number, number, number][] = [
      [-4.4, 5.8, -28],
      [4.8, 5.5, 25],
      [16.8, 1.0, -35],
      [-20.2, 8.8, 70],
      [20.6, -13.0, -38],
      [-24.0, 1.3, 95],
      [-6.2, -4.4, 25],
      [8.6, -0.9, -18],
      [18.0, 14.7, 10],
    ];
    benches.forEach(([x, z, r]) => this.place('bench', x, z, { rot: r }));
    for (const [x, z] of [[-24, -1.2], [-17, 6.4], [-4.8, -1.2], [4.6, -3.8], [5.2, 7.2], [18, 7.5], [22.8, -11.5], [27.4, -18.5], [-14.5, -14.5], [-28.0, 8.9], [-12.2, 3.2], [0.4, 4.9], [10.8, 2.0], [15.9, -2.5], [-5.4, 15.6]] as [number, number][]) this.place('lamp_post', x, z);
    for (const [x, z, r] of [[-2.8, 13.6, 20], [6.5, 14.6, -35], [22.8, 0.6, 18], [20.0, 2.7, -18], [4.6, 9.9, 38]] as [number, number, number][]) this.place('umbrella_table', x, z, { rot: r, collide: false });
    for (const [x, z, r] of [[-18.2, 11.4, -25], [-3.6, 8.0, 18], [6.6, -8.6, 15], [19.6, -6.0, -8], [24.5, -16.2, 35], [-22.4, -2.5, 20], [-27.6, 1.4, 0], [-22.6, 9.9, -20], [-14.8, -2.7, 35], [-0.6, -4.5, 10], [9.2, 3.8, -32], [15.8, 15.2, 8], [23.1, 8.5, 25]] as [number, number, number][]) this.place('flower_bed', x, z, { rot: r, collide: false });
    for (const [x, z, r] of [[-4.9, 12.0, 10], [3.8, 12.9, -18], [18.2, 3.8, 32], [24.4, 3.3, -20], [-23.8, 6.9, 12]] as [number, number, number][]) this.place('trash_bin', x, z, { rot: r, collide: false });
    this.place('signpost', -17.4, -0.8, { rot: 68, opts: { labels: ['Tàu lượn', 'Ném bóng'] } });
    this.place('signpost', 4.6, -1.8, { rot: -30, opts: { labels: ['Vòng quay', 'Đu quay'] } });
    this.place('signpost', 24.2, -15.8, { rot: -28, opts: { labels: ['Sở Thú', 'Vé'] } });

    const tipTexts = [
      'Giải đúng một trò là được 1 vé đó!',
      'Ném bóng: số nào đúng thì mục tiêu bật tung!',
      'Vòng quay ở phía đông nam, đẹp nhất lúc trời nắng!',
      'Có đủ 5 vé thì đi Sở Thú nhé!',
    ];
    [[0, 0.8, 3.6, 3], [2, -1.8, -5.8, 2.5], [3, 19.3, 12.0, 1.4], [5, 21.5, -8.8, 1.6]].forEach(([v, x, z, w], i) => {
      const sp = villager(v);
      this.npc('npc_villager', x, z, {
        name: sp.name,
        color: sp.color,
        opts: { v },
        wander: w,
        rot: this.rnd() * 360,
        talk: () => say(sp, tipTexts[i]),
      });
    });

    this.scatter(['flower', 'tulip', 'grass', 'mushroom'], 80, { gap: 0.85, collide: false, pathGap: 0.45 });
    this.scatter(['bush', 'flower_bed', 'rock'], 20, { gap: 2.1, scale: [0.8, 1.15] });
    this.scatter(['tree_blossom', 'tree_round', 'tree_apple'], 16, { gap: 4.2, scale: [0.85, 1.15] });
    this.border(['tree_round', 'tree_blossom', 'tree_tall', 'bush'], { scale: [0.9, 1.25] });
  }

  private decorateAttractions(): void {
    const rail = (x: number, z: number, rot: number, len: number, color = '#fff8ee') =>
      this.place('fence', x, z, { rot, opts: { len, style: 'rail', color }, collide: false, reserve: false });
    const picket = (x: number, z: number, rot: number, len: number, color = '#ffffff') =>
      this.place('fence', x, z, { rot, opts: { len, color }, collide: false, reserve: false });

    // Coaster queue and safety rails.
    rail(-17.0, -4.4, 4, 4.8, '#ff6b6b');
    rail(-17.0, -9.2, 4, 4.8, '#ff6b6b');
    rail(-19.3, -6.8, 94, 4.8, '#ff6b6b');
    this.sign(-16.2, -3.4, '🎢 Tàu lượn', { y: 2.4, maxDist: 34 });
    this.place('bunting', -16.2, -4.6, { rot: 3, opts: { len: 5 }, collide: false, dynamic: true, reserve: false });

    // Ball booth queue rails and target lane.
    rail(-14.2, 13.8, 88, 4.6, '#4ecdc4');
    rail(-7.3, 13.8, 88, 4.6, '#4ecdc4');
    rail(-10.7, 16.0, 0, 6.2, '#4ecdc4');
    this.sign(-10.7, 16.9, '🎯 Ném bóng', { y: 2.45, maxDist: 34 });
    this.place('bunting', -10.8, 15.4, { rot: 0, opts: { len: 6 }, collide: false, dynamic: true, reserve: false });

    // Ferris wheel plaza.
    picket(7.0, -8.3, 90, 5.2, '#ffd166');
    picket(18.6, -8.3, 90, 5.2, '#ffd166');
    rail(12.8, -2.9, 0, 7.0, '#ffd166');
    this.sign(12.8, -2.2, '🎡 Vòng quay', { y: 2.55, maxDist: 34 });

    // Carousel ring and entry sign.
    picket(8.4, 11.2, 90, 4.6, '#ff9ec7');
    picket(16.8, 11.2, 90, 4.6, '#ff9ec7');
    rail(12.6, 15.0, 0, 6.2, '#ff9ec7');
    this.sign(12.6, 15.8, '🎠 Đu quay ngựa', { y: 2.45, maxDist: 34 });
  }

  private decorateFoodCourt(): void {
    this.place('park_food_stall', -0.6, 15.9, { rot: 12, opts: { kind: 'popcorn' }, reserve: 2.3 });
    this.place('park_food_stall', 4.4, 16.0, { rot: -8, opts: { kind: 'cotton' }, reserve: 2.3 });
    this.place('park_food_stall', 20.2, 8.4, { rot: -35, opts: { text: 'KEM', color: '#4ecdc4' }, reserve: 2.3 });
    this.place('balloon_stand', -27.8, 8.6, { rot: 40, dynamic: true, reserve: 2.5 });
    this.place('balloon_stand', 4.6, -5.2, { rot: 18, dynamic: true, reserve: 2.5 });
    this.place('balloon_stand', 24.7, -8.4, { rot: -18, dynamic: true, reserve: 2.5 });
  }

  private decorateLights(): void {
    for (const [x, z, rot, len] of [
      [-20.4, 5.1, 14, 8],
      [-8.1, 4.2, -10, 8],
      [5.2, 2.1, -28, 8],
      [15.6, -1.7, -38, 7],
      [-6.4, 12.4, 6, 7],
      [17.4, 5.6, -18, 7],
      [20.8, -13.7, -36, 7],
    ] as [number, number, number, number][]) {
      this.place('string_lights', x, z, { rot, opts: { text: String(len) }, collide: false, reserve: false });
    }
  }

  private createTicketMarks(): void {
    const done = new Set<ParkFlag>(FLAGS.filter((f) => on(f)));
    const baseX = -23.78;
    for (let i = 0; i < FLAGS.length; i++) {
      const obj = this.place('pickup_ticket', baseX + i * 0.98, -1.08, { y: 1.67, rot: 8, scale: 0.34, dynamic: true, collide: false, reserve: false });
      obj.visible = done.has(FLAGS[i]);
      this.ticketMarks.push(obj);
    }
  }

  private updateTicketBoard(): void {
    for (let i = 0; i < this.ticketMarks.length; i++) this.ticketMarks[i].visible = on(FLAGS[i]);
  }

  private applyGateState(open: boolean): void {
    const l = this.gate.getObjectByName('gateL');
    const r = this.gate.getObjectByName('gateR');
    const lock = this.gate.getObjectByName('lock');
    if (l) l.rotation.y = open ? -Math.PI * 0.55 : 0;
    if (r) r.rotation.y = open ? Math.PI * 0.55 : 0;
    if (lock) lock.visible = !open;
  }

  private async intro(): Promise<void> {
    await this.wait(0.35);
    this.clown.actor.waving = true;
    this.bubble(this.clown.actor.root, 'Xin chào! 🎪', this.clown.actor.height + 0.8, 1700);
    await this.showPoint(-26.2, 2.3, 4.2, 0.9, 12);
    sfx('door');
    const l = this.gate.getObjectByName('gateL');
    const r = this.gate.getObjectByName('gateR');
    await this.tween(0.85, (k) => {
      if (l) l.rotation.y = -Math.PI * 0.55 * k;
      if (r) r.rotation.y = Math.PI * 0.55 * k;
    }, { ease: 'outCubic' });
    const lock = this.gate.getObjectByName('lock');
    if (lock) lock.visible = false;
    setFlag('park.intro');
    await say(CAST.he, ['Chào mừng đến Khu Vui Chơi!', 'Mỗi điểm vui chơi là một thử thách toán. Giải đúng thì bạn nhận 1 vé.', `Có ${ZOO_TICKETS} vé là mở được Sở Thú. Bibo sẽ tặng huy chương khi bạn hoàn thành 4 trò ở đây!`]);
    this.clown.actor.waving = false;
  }

  private async coasterChallenge(): Promise<void> {
    await say(CAST.he, 'Tàu lượn có 3 toa, mỗi toa 6 chỗ. Mình cùng tính số ghế nhé!');
    const q = storyQuestion('coaster');
    await this.quiz(q, { src: 'park:coaster', speaker: CAST.he, title: 'Tàu lượn', icon: '🎢', rewards: false }, this.coaster, 16);
    await this.runTrain();
    this.completeAttraction('park.coaster', [this.coaster.position.x, 1.5, this.coaster.position.z]);
    await say(CAST.he, 'Vèo! Tàu chạy một vòng rồi. Bạn nhận 1 vé nhé!');
  }

  private async runTrain(): Promise<void> {
    const curve = this.coaster.userData.track as THREE.CatmullRomCurve3 | undefined;
    const train = this.coasterTrain;
    if (!curve || !train) return;
    sfx('whoosh');
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const target = new THREE.Vector3();
    await this.tween(3.6, (k) => {
      const u = k % 1;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, tan);
      train.position.copy(p);
      target.copy(p).add(tan);
      train.lookAt(target);
      const wp = train.getWorldPosition(new THREE.Vector3());
      this.focusTop(wp.x, wp.y + 0.6, wp.z, 13);
    }, { ease: 'linear' });
    await this.cam.release();
    this.fx.burst('confetti', this.coaster.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.5, 0)), { count: 38 });
  }

  private startBalls(): void {
    if (this.activePick) return;
    this.activePick = 'balls';
    this.clearBallChoices();
    const q = storyQuestion('balls');
    const slots = (this.booth.userData.slots as [number, number, number][] | undefined) ?? [];
    const spots: PickSpot[] = q.choices.map((c, i) => {
      const local = new THREE.Vector3(...(slots[i] ?? [-1.6 + i * 0.8, 1.5, -0.38]));
      const wp = this.booth.localToWorld(local.clone());
      const obj = this.place('math_ball', wp.x, wp.z, { y: wp.y, opts: { n: c.label, color: COLORS[i % COLORS.length] }, dynamic: true, collide: false, reserve: false });
      this.ballChoices.push(obj);
      return { value: c.value, label: `Ném ${c.label}`, tag: c.label, icon: '🎯', x: wp.x, z: wp.z + 0.55, r: 2.8, obj };
    });
    void this.pick(q, spots, {
      src: 'park:balls',
      speaker: CAST.he,
      title: 'Ném bóng',
      icon: '🎯',
      showVisual: false,
      rewards: false,
      tags: 1.25,
      area: { x: -10.8, z: 12.4, r: 8 },
      onWrong: async (spot) => {
        await this.throwBall(spot.obj, false);
        this.bubble(this.booth, 'Bóng bật lại rồi!', 3.2, 1600);
      },
      onRight: async (spot) => {
        await this.throwBall(spot.obj, true);
        this.fx.burst('confetti', [-10.8, 2.2, 11.0], { count: 38 });
      },
    }).then(async () => {
      this.completeAttraction('park.balls', [-10.8, 1.8, 11.8]);
      this.clearBallChoices();
      this.activePick = null;
      await say(CAST.he, 'Trúng rồi! Bạn nhận 1 vé ném bóng.');
    });
  }

  private async throwBall(obj: THREE.Object3D | undefined, good: boolean): Promise<void> {
    if (!obj) return;
    const start = obj.position.clone();
    const target = new THREE.Vector3(-10.8 + (this.rnd() - 0.5) * 2.2, 2.0 + this.rnd() * 0.6, 11.05);
    await this.tween(0.45, (k) => {
      obj.position.lerpVectors(start, target, k);
      obj.position.y += Math.sin(k * Math.PI) * 1.15;
      obj.rotation.x += 0.25;
    }, { ease: 'outCubic' });
    sfx(good ? 'pop' : 'wrong');
    if (!good) {
      const back = obj.position.clone();
      await this.tween(0.35, (k) => obj.position.lerpVectors(back, start, k), { ease: 'outCubic' });
    } else obj.visible = false;
  }

  private startWheel(): void {
    if (this.activePick) return;
    this.activePick = 'wheel';
    this.clearWheelChoices();
    const q = storyQuestion('wheel');
    const spots: PickSpot[] = q.choices.map((c, i) => {
      const x = 8.8 + i * 2.15;
      const z = -3.05;
      const obj = this.place('number_stone', x, z, { opts: { n: c.label, color: COLORS[i % COLORS.length] }, dynamic: true, collide: false, reserve: false });
      this.wheelChoices.push(obj);
      return { value: c.value, label: `Chọn ${c.label}`, tag: c.label, icon: '🎡', x, z, r: 1.25, obj };
    });
    void this.pick(q, spots, {
      src: 'park:wheel',
      speaker: CAST.he,
      title: 'Vòng quay',
      icon: '🎡',
      showVisual: true,
      rewards: false,
      tags: 1.2,
      area: { x: 12.8, z: -6.2, r: 8 },
      onWrong: async (spot) => {
        sfx('wrong');
        if (spot.obj) await this.shake(spot.obj);
      },
      onRight: async () => {
        await this.spinFerris();
        const gift = this.pickup('gift', 12.8, -3.9, { id: 'park.gift.wheel', y: 1.05 });
        if (gift) {
          gift.position.y = 4.2;
          await this.tween(0.75, (k) => (gift.position.y = 4.2 + (1.05 - 4.2) * k), { ease: 'outBounce' });
        }
      },
    }).then(async () => {
      this.completeAttraction('park.wheel', [12.8, 2.4, -7.2]);
      this.clearWheelChoices();
      this.activePick = null;
      await say(CAST.he, 'Vòng quay sáng rực rồi! Bạn nhận 1 vé và một hộp quà.');
    });
  }

  private async spinFerris(): Promise<void> {
    const wheel = this.wheel.getObjectByName('wheel');
    if (!wheel) return;
    sfx('whoosh');
    const start = wheel.rotation.z;
    await this.tween(2.2, (k) => {
      wheel.rotation.z = start + Math.PI * 6 * k;
      this.fx.burst('sparkle', this.wheel.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3((this.rnd() - 0.5) * 5, 4 + this.rnd() * 2, (this.rnd() - 0.5) * 2)), { count: 2 });
    }, { ease: 'outCubic' });
  }

  private async talkClown(): Promise<void> {
    if (!on('park.intro')) {
      await this.intro();
      return;
    }
    if (this.doneCount() >= 4 && !on('park.medal')) {
      await say(CAST.he, ['Bạn đã hoàn thành cả 4 thử thách!', 'Bibo tặng bạn Huy chương vàng. Bạn có thể đeo trong túi đồ nhé!']);
      setFlag('park.medal');
      reward({ items: { acc_medal: 1 } });
      toast('Nhận Huy chương vàng! Mở túi đồ để đeo nhé.', { icon: '🏅', tone: 'gold', ms: 4200 });
      checkBadges();
      this.clown.actor.celebrate(2);
      this.fx.burst('confetti', this.clown.actor.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.5, 0)), { count: 56 });
      return;
    }
    if (!on('park.clown')) {
      await say(CAST.he, ['Bibo có 2 câu đố tung hứng đây!', 'Trả lời đúng cả hai câu, bạn nhận thêm 1 vé nhé.']);
      this.clown.actor.celebrate(0.8);
      await this.quiz(mixedQuestion(), { src: 'park:clown:1', speaker: CAST.he, title: 'Câu đố của Bibo', icon: '🤹', rewards: false }, this.clown.actor.root, 10);
      await this.quiz(mixedQuestion(), { src: 'park:clown:2', speaker: CAST.he, title: 'Câu đố của Bibo', icon: '🤹', rewards: false }, this.clown.actor.root, 10);
      this.completeAttraction('park.clown', [this.clown.actor.pos.x, 1.6, this.clown.actor.pos.z]);
      await say(CAST.he, 'Tuyệt vời! Bạn nhận 1 vé từ Bibo.');
      return;
    }
    await say(CAST.he, [`Bạn đã có ${this.doneCount()}/4 vé trò chơi ở khu này.`, 'Hãy thử Tàu lượn, Ném bóng và Vòng quay nhé!']);
  }

  private completeAttraction(flag: ParkFlag, at: [number, number, number]): void {
    if (on(flag)) return;
    setFlag(flag);
    reward({ tickets: 1, coins: 5, xp: 10 });
    sfx('star');
    this.fx.burst('star', at, { count: 26 });
    this.buddy?.celebrate(1.2);
    this.updateTicketBoard();
    if (this.doneCount() >= 4 && !on('park.medal')) {
      toast('Đủ 4 trò rồi! Gặp Chú Hề Bibo nhận huy chương nhé.', { icon: '🏅', tone: 'gold', ms: 4200 });
      this.bubble(this.clown.actor.root, 'Lại đây nhận huy chương nhé! 🏅', this.clown.actor.height + 0.8, 3600);
    }
    this.refreshMarks();
  }

  private doneCount(): number {
    return FLAGS.filter((f) => on(f)).length;
  }

  private clearBallChoices(): void {
    for (const o of this.ballChoices) this.removeObj(o);
    this.ballChoices = [];
  }

  private clearWheelChoices(): void {
    for (const o of this.wheelChoices) this.removeObj(o);
    this.wheelChoices = [];
  }

  private async shake(obj: THREE.Object3D): Promise<void> {
    const x = obj.position.x;
    await this.tween(0.35, (k) => (obj.position.x = x + Math.sin(k * Math.PI * 8) * 0.18 * (1 - k)), { ease: 'linear' });
    obj.position.x = x;
  }
}
