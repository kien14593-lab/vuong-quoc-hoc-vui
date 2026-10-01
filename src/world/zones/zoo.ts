import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { addTickets, giveItem, hasItem, profile, setFlag, takeItem } from '../../core/state';
import { CAST, villager } from '../../game/cast';
import { mixedQuestion, storyQuestion } from '../../game/challenge';
import { bearStage, checkBadges, on, reward, ZOO_TICKETS, zoneLock } from '../../game/story';
import { say } from '../../ui/dialog';
import { toast } from '../../ui/toast';
import { Zone, type Spawn } from '../zone';

const APPLE_ITEM = 'apple_basket';
const BANANA_ITEM = 'banana_bunch';
const FISH_ITEM = 'fish_bucket';

/** 🦁 SỞ THÚ KỲ DIỆU – chăm sóc muông thú bằng toán học và kết thúc hành trình Chú Gấu. */
export class ZooZone extends Zone {
  private gate!: THREE.Object3D;
  private giraffes: THREE.Object3D[] = [];
  private giraffeFlock?: {
    body: THREE.InstancedMesh;
    neck: THREE.InstancedMesh;
    head: THREE.InstancedMesh;
    muzzle: THREE.InstancedMesh;
    legs: THREE.InstancedMesh;
    spots: THREE.InstancedMesh;
    eyes: THREE.InstancedMesh;
    ossicones: THREE.InstancedMesh;
  };
  private monkeys: THREE.Object3D[] = [];
  private penguins: THREE.Object3D[] = [];
  private penguinFlock?: {
    body: THREE.InstancedMesh;
    belly: THREE.InstancedMesh;
    head: THREE.InstancedMesh;
    face: THREE.InstancedMesh;
    beak: THREE.InstancedMesh;
    feet: THREE.InstancedMesh;
  };
  private appleBasket!: THREE.Object3D;
  private bananaBunch!: THREE.Object3D;
  private fishBucket!: THREE.Object3D;

  constructor(spawn: Spawn) {
    super(
      {
        id: 'zoo',
        title: 'Sở Thú Kỳ Diệu',
        icon: '🦁',
        sub: 'Chăm sóc động vật bằng toán học',
        music: 'zoo',
        area: { hw: 30, hd: 28, r: 11 },
        margin: 16,
        ground: '#bfe58a',
        sky: ['#9fdcff', '#fff4d0'],
        fog: [55, 135],
        cam: { yaw: 0, pitch: 51, dist: 13.5, minDist: 10, maxDist: 28 },
        seed: 41,
        spawns: {
          start: { x: -9, z: 24, rot: 180 },
          from_park: { x: -9, z: 24, rot: 180 },
          from_maze: { x: -26, z: -14.2, rot: 90 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    const t = this.terrain;

    t.plaza(0, 17.2, 6.2);
    t.plaza(0, 2.2, 7.5);
    t.path([[-10, 30], [-8, 23.8], [-3.2, 18.2], [0, 15.2]], 3.0);
    t.path([[0, 15.2], [0, 8.2], [0, 2.2]], 3.2);
    t.path([[0, 2.2], [-10.4, -3.6], [-16, -7.8]], 2.8);
    t.path([[0, 2.2], [11.2, -0.8], [17.2, -4.2]], 2.8);
    t.path([[0, 2.2], [2.5, -9.2], [2.8, -16.2]], 2.8);
    t.path([[0, 2.2], [-9.5, 5.5], [-17, 6.0]], 2.4);
    t.path([[-17, 6.0], [-25.5, -4.5], [-33, -14]], 2.8);
    t.path([[-10, 24], [-15.5, 28]], 2.8);
    t.meadow(-20, 13, 4.5, ['#fff4a8', '#ffd6e7', '#ffffff'], 5);
    t.meadow(20, 12, 4.0);
    t.meadow(18, -16, 4.5, ['#ffffff', '#ffd6e7', '#fff3a6'], 4);

    this.buildEntrance();
    this.buildCentralHub();
    this.buildGiraffes();
    this.buildMonkeys();
    this.buildPenguins();
    this.buildDecorativeEnclosures();
    this.buildNpcAndActivities();
    this.buildPortals();
    this.buildDecoration();
    this.applySolvedState();
  }

  protected wantsBuddy(): boolean {
    const s = bearStage();
    if (s === 'reward' || s === 'done') return false;
    return super.wantsBuddy();
  }

  protected buddyTalk(): Promise<void> {
    if (!on('zoo.open')) return say(CAST.gau, `Mình hồi hộp quá! Chúng ta cần đưa ${ZOO_TICKETS} vé cho Bác Voi nhé.`);
    if (!on('zoo.giraffe')) return say(CAST.gau, 'Bạn Hươu cao cổ ở phía tây đang chờ chúng mình giúp đấy!');
    return say(CAST.gau, 'Sở thú đẹp quá! Mình thích được ở đây cùng các bạn muông thú.');
  }

  objective(): { text: string; icon?: string } | null {
    if (!on('zoo.open')) return { text: `Đưa ${ZOO_TICKETS} vé cho Bác Voi để mở cổng`, icon: '🎟️' };
    if (!on('zoo.giraffe')) return { text: 'Giúp hươu cao cổ ăn táo', icon: '🦒' };
    if (bearStage() === 'reward') return { text: 'Gặp Chú Gấu ở chuồng hươu', icon: '🐻' };
    if (!on('zoo.monkey')) return { text: 'Cho khỉ ăn chuối', icon: '🐒' };
    if (!on('zoo.penguins')) return { text: 'Cho chim cánh cụt ăn cá', icon: '🐧' };
    return { text: 'Khám phá Sở Thú Kỳ Diệu', icon: '🦁' };
  }

  private buildEntrance(): void {
    this.place('ticket_booth', -3.7, 17.2, { rot: 20, dynamic: true });
    this.sign(-3.7, 17.2, '🎟️ Quầy vé', { y: 3.4 });
    this.gate = this.place('zoo_gate', 0, 11.2, { dynamic: true, reserve: 4.4 });
    this.sign(0, 11.2, '🦁 Cổng Sở Thú', { y: 4.4, maxDist: 42 });
    this.npc(CAST.voi.art, 3.7, 16.4, {
      name: CAST.voi.name,
      color: CAST.voi.color,
      rot: -25,
      r: 2.8,
      mark: () => (!on('zoo.open') ? '!' : ''),
      talk: () => this.talkElephant(),
    });
    this.place('fence', -4.6, 11.2, { opts: { len: 5, style: 'picket' }, rot: 0 });
    this.place('fence', 4.6, 11.2, { opts: { len: 5, style: 'picket' }, rot: 0 });
    for (const x of [-2.4, -1.2, 1.2, 2.4]) this.place('flower_pot', x, 13.7, { collide: false });
    for (const [x, z, r] of [[-2.9, 12.4, 0], [2.9, 12.4, 0], [-1.7, 10.8, 90], [1.7, 10.8, 90]] as [number, number, number][]) {
      this.place('balloon_bunch', x, z, { rot: r, collide: false, scale: 0.82 });
    }
    this.place('signpost', -6.6, 18.5, { rot: 25, opts: { labels: ['Bản đồ', 'Sở thú'] }, collide: false });
  }

  private buildCentralHub(): void {
    this.place('fountain', 0, 2.2, { scale: 0.72, collide: false, reserve: 1.6 });
    this.place('zoo_topiary', 0, 2.2, { y: 0.54, scale: 0.42, rot: 25, opts: { style: 'elephant' }, collide: false });
    this.sign(0, 3.55, '🗺️ Quảng trường muông thú', { y: 1.9, maxDist: 36 });
    for (const [x, z, r, len] of [
      [-2.3, 4.1, 22, 2.0],
      [2.3, 4.1, -22, 2.0],
      [-2.6, 0.2, -22, 1.8],
      [2.6, 0.2, 22, 1.8],
    ] as [number, number, number, number][]) this.place('hedge', x, z, { rot: r, opts: { len, h: 0.45 }, collide: false });
    for (const [x, z, r] of [[-3.2, 2.2, 90], [3.2, 2.2, 90], [0, 5.1, 0], [0, -0.7, 0]] as [number, number, number][]) this.place('flower_bed', x, z, { rot: r, collide: false, scale: 0.78 });
    this.place('balloon_stand', 4.7, 3.8, { rot: -35, dynamic: true, collide: false, scale: 0.82 });
    this.place('ice_cream_cart', 5.7, 1.1, { rot: -85, collide: false });
    this.place('fountain', -4.8, 0.2, { scale: 0.28, collide: false });
  }

  private buildGiraffes(): void {
    this.place('enclosure', -16.2, -7.8, { opts: { w: 11, d: 8.4 }, rot: 0, reserve: 6.5 });
    this.terrain.patch(-16.2, -7.8, 5.1, '#d7efa2', 0.7);
    this.sign(-16.2, -3.0, '🦒 Nhà hươu cao cổ', { y: 2.2 });
    this.place('giraffe_feeding_deck', -10.8, -4.2, { rot: 182, dynamic: true, reserve: 1.7 });
    this.place('bench', -10.2, -1.1, { rot: 25 });
    for (const [x, z, s] of [[-19.8, -5.7, 1.45], [-13.0, -10.6, 1.35], [-20.0, -10.0, 1.25]] as [number, number, number][]) this.place('tree_round', x, z, { scale: s, collide: false });
    this.appleBasket = this.place('apple_basket', -10.3, -4.2, { y: 1.14, dynamic: true, collide: false, scale: 1.15 });
    this.appleBasket.visible = hasItem(APPLE_ITEM) && !on('zoo.giraffe');
    const spots: [number, number, number][] = [
      [-18.9, -7.6, 38],
      [-16.0, -9.7, -8],
      [-13.2, -6.2, -48],
    ];
    this.giraffes = spots.map(([x, z, r]) => {
      const p = new THREE.Object3D();
      p.position.set(x, 0, z);
      p.rotation.y = THREE.MathUtils.degToRad(r);
      p.scale.setScalar(1.34);
      this.dynamics.add(p);
      return p;
    });
    this.buildGiraffeFlock();
    this.interact({
      id: 'zoo:giraffe:quiz',
      x: -11.2,
      z: -3.8,
      r: 2.4,
      label: 'Chuẩn bị táo',
      icon: '🍎',
      obj: this.giraffes[2],
      enabled: () => on('zoo.open') && !on('zoo.giraffe') && !hasItem(APPLE_ITEM),
      run: () => this.prepareAnimal('giraffe'),
    });
    this.interact({
      id: 'zoo:giraffe:feed',
      x: -10.7,
      z: -4.2,
      r: 2.3,
      label: 'Cho hươu ăn',
      icon: '🍎',
      obj: this.appleBasket,
      prio: 3,
      enabled: () => on('zoo.open') && !on('zoo.giraffe') && hasItem(APPLE_ITEM),
      run: () => this.feedGiraffes(),
    });
  }

  private buildMonkeys(): void {
    this.place('enclosure', 17.2, -4.2, { opts: { w: 10.5, d: 8 }, reserve: 6.2 });
    this.terrain.patch(17.2, -4.2, 4.9, '#bfe58a', 0.58);
    this.sign(17.2, 0.6, '🐒 Sân khỉ tinh nghịch', { y: 2.2 });
    this.place('monkey_frame', 17.2, -4.5, { collide: false, scale: 1.15 });
    for (const [x, z, r] of [[14.2, -6.9, 20], [20.2, -6.4, -35], [19.9, -1.9, 160]] as [number, number, number][]) this.place('tree_palm', x, z, { scale: 0.92, rot: r, collide: false });
    for (const [x, z, r] of [[14.8, -2.2, 35], [19.4, -3.0, -20]] as [number, number, number][]) this.place('log', x, z, { rot: r, scale: 1.35, collide: false });
    this.bananaBunch = this.place('banana_bunch', 12.1, -1.5, { dynamic: true, collide: false, scale: 1.15 });
    this.bananaBunch.visible = hasItem(BANANA_ITEM) && !on('zoo.monkey');
    this.monkeys = [
      this.place('animal_monkey', 14.7, -3.8, { rot: 30, scale: 1.05, dynamic: true, collide: false }),
      this.place('animal_monkey', 17.8, -4.5, { y: 1.55, rot: -20, scale: 0.95, dynamic: true, collide: false }),
      this.place('animal_monkey', 19.5, -5.8, { y: 0.95, rot: -80, scale: 0.9, dynamic: true, collide: false }),
    ];
    this.addTick((_dt, tt) => {
      this.monkeys[1].position.y = 1.55 + Math.sin(tt * 2.2) * 0.08;
      this.monkeys[1].rotation.z = Math.sin(tt * 2.2) * 0.14;
      this.monkeys[2].rotation.x = 0.25 + Math.sin(tt * 1.8) * 0.16;
    });
    this.interact({
      id: 'zoo:monkey:quiz',
      x: 12.2,
      z: -1.7,
      r: 2.4,
      label: 'Chuẩn bị chuối',
      icon: '🍌',
      obj: this.monkeys[0],
      enabled: () => on('zoo.open') && !on('zoo.monkey') && !hasItem(BANANA_ITEM),
      run: () => this.prepareAnimal('monkey'),
    });
    this.interact({
      id: 'zoo:monkey:feed',
      x: 12.2,
      z: -1.7,
      r: 2.4,
      label: 'Cho khỉ ăn',
      icon: '🍌',
      obj: this.bananaBunch,
      prio: 3,
      enabled: () => on('zoo.open') && !on('zoo.monkey') && hasItem(BANANA_ITEM),
      run: () => this.feedMonkeys(),
    });
    this.miniSpot('monkey', 22.7, 1.5, { model: 'question_board', rot: -35, scale: 0.9 });
  }

  private buildPenguins(): void {
    this.place('penguin_pool', 2.8, -16.2, { dynamic: true, scale: 1.85, reserve: 6.2 });
    this.sign(2.8, -12.7, '🐧 Hồ cánh cụt', { y: 2.0 });
    this.fishBucket = this.place('fish_bucket', -1.2, -11.3, { dynamic: true, collide: false, scale: 1.05 });
    this.fishBucket.visible = hasItem(FISH_ITEM) && !on('zoo.penguins');
    const base: [number, number, number][] = [];
    const centers: [number, number][] = [[-1.8, -16.0], [1.0, -18.1], [4.0, -16.05]];
    for (let g = 0; g < 3; g++) {
      const [gx, gz] = centers[g];
      this.place('penguin_ice_floe', gx + 0.25, gz + 0.2, { rot: g === 1 ? 12 : -8, collide: false, scale: 1.05 });
      for (let i = 0; i < 4; i++) base.push([gx + (i % 2) * 0.55, gz + Math.floor(i / 2) * 0.5, g]);
    }
    this.penguins = base.map(([x, z, group]) => {
      const p = new THREE.Object3D();
      p.position.set(x, 0, z);
      p.rotation.y = THREE.MathUtils.degToRad([-20, 10, 24][group] ?? 0);
      this.dynamics.add(p);
      return p;
    });
    this.buildPenguinFlock();
    this.interact({
      id: 'zoo:penguin:quiz',
      x: -1.4,
      z: -11.4,
      r: 2.4,
      label: 'Chuẩn bị cá',
      icon: '🐟',
      obj: this.penguins[0],
      enabled: () => on('zoo.open') && !on('zoo.penguins') && !hasItem(FISH_ITEM),
      run: () => this.prepareAnimal('penguins'),
    });
    this.interact({
      id: 'zoo:penguin:feed',
      x: -1.4,
      z: -11.4,
      r: 2.4,
      label: 'Cho cánh cụt ăn',
      icon: '🐟',
      obj: this.fishBucket,
      prio: 3,
      enabled: () => on('zoo.open') && !on('zoo.penguins') && hasItem(FISH_ITEM),
      run: () => this.feedPenguins(),
    });
  }

  private buildDecorativeEnclosures(): void {
    this.place('enclosure', -17.5, 7.8, { opts: { w: 9.5, d: 7 }, reserve: 5.7 });
    this.terrain.patch(-17.5, 7.8, 4.6, '#ead08b', 0.74);
    this.sign(-17.5, 11.8, '🦁 Sư tử thân thiện', { y: 2.1 });
    this.place('rock_big', -16.2, 7.0, { scale: 1.15, collide: false });
    this.place('rock', -15.2, 6.4, { scale: 1.5, collide: false });
    this.place('animal_lion', -16.4, 7.5, { y: 0.55, rot: 180, scale: 1.05, collide: false });
    this.place('animal_lion', -19.2, 8.2, { rot: 25, scale: 0.95, collide: false });
    this.place('animal_lion', -14.9, 9.2, { rot: -40, scale: 0.58, collide: false });
    this.place('tree_round', -20.7, 5.7, { scale: 1.15, collide: false });
    this.place('hay_bale', -18.8, 5.3, { rot: 12, collide: false });

    this.place('enclosure', 16.8, 9.0, { opts: { w: 10, d: 7 }, reserve: 5.8 });
    this.terrain.patch(16.8, 9.0, 4.8, '#dfc777', 0.72);
    this.sign(16.8, 13.0, '🦓 Đồng cỏ ngựa vằn', { y: 2.1 });
    this.place('animal_zebra', 14.2, 8.2, { rot: 110, scale: 0.9, collide: false });
    this.place('animal_zebra', 18.7, 9.5, { rot: -60, scale: 0.82, collide: false });
    this.place('animal_zebra', 16.7, 6.4, { rot: 25, scale: 0.78, collide: false });
    this.place('animal_zebra', 19.1, 7.2, { rot: -120, scale: 0.72, collide: false });
    for (const [x, z, r] of [[13.2, 10.9, 18], [20.8, 7.8, -20]] as [number, number, number][]) this.place('tree_round', x, z, { rot: r, scale: 0.88, collide: false });
    this.place('hay_bale', 15.2, 11.1, { rot: 20, collide: false });
    this.place('hay_bale', 15.9, 11.4, { rot: -8, collide: false });
    this.place('crate', 19.9, 11.0, { opts: { color: '#6cb8ff' }, rot: 0, scale: 1.1, collide: false });

    this.terrain.pond(18, -17, 4.0, 2.65);
    this.place('enclosure', 18, -17, { opts: { w: 9.4, d: 7.0 }, reserve: 5.7 });
    this.sign(18, -13.5, '🦛 Hồ hà mã', { y: 2.1 });
    this.place('zoo_hippo_float', 18.2, -17.0, { y: -0.06, rot: -20, scale: 1.08, collide: false });
    this.place('zoo_hippo_float', 15.8, -16.1, { y: -0.08, rot: 45, scale: 0.86, collide: false });
    for (const [x, z, r] of [[14.6, -14.7, 20], [21.2, -18.3, -35], [20.7, -15.2, 70]] as [number, number, number][]) this.place('reeds', x, z, { rot: r, collide: false, scale: 0.9 });
    for (const [x, z] of [[16.8, -18.5], [19.4, -15.3], [20.5, -17.4]] as [number, number][]) this.place('lilypad', x, z, { collide: false });
    this.place('rock_big', 14.4, -18.8, { scale: 0.65, collide: false });

  }

  private buildNpcAndActivities(): void {
    const keeper = villager(5);
    this.npc('npc_villager', -3.4, 2.9, {
      name: 'Chú Tư Giữ Thú',
      color: keeper.color,
      opts: { v: 5 },
      wander: 2.3,
      talk: async () => {
        if (!on('zoo.open')) await say(keeper, 'Bác Voi ở quầy vé sẽ mở cổng khi bạn có đủ vé nhé!');
        else await say(keeper, 'Bạn hãy ghé từng chuồng, giải toán rồi cho các bạn thú ăn. Các bạn ấy thích bạn lắm!');
      },
    });
    this.npc(CAST.nai.art, 7.6, 4.7, {
      name: CAST.nai.name,
      color: CAST.nai.color,
      wander: 2.4,
      talk: async () => {
        await say(CAST.nai, 'Mình có một câu đố nhỏ về các con vật đây!');
        await this.quiz(mixedQuestion(), { src: 'zoo:riddle', speaker: CAST.nai, title: 'Câu đố sở thú', icon: '🧩' }, [7.6, 1.2, 4.7], 10);
        await say(CAST.nai, 'Bạn thông minh quá! Khám phá tiếp nhé.');
      },
    });
    this.npc(CAST.gau.art, -12.3, -2.8, {
      name: CAST.gau.name,
      color: CAST.gau.color,
      rot: 180,
      r: 2.7,
      visible: () => bearStage() === 'reward' || bearStage() === 'done',
      mark: () => (bearStage() === 'reward' ? '!' : ''),
      talk: () => this.talkBearAtZoo(),
    });
    this.place('umbrella_table', 8.4, 12.5, { rot: 20 });
    this.place('ice_cream_cart', 11.6, 13.6, { rot: -30 });
    this.place('trash_bin', 6.0, 11.8);
    for (const [x, z, r] of [[-7, 3.8, 20], [7.2, -5.8, -35], [-6.5, -12.2, 145]] as [number, number, number][]) this.place('bench', x, z, { rot: r });
  }

  private buildPortals(): void {
    this.place('signpost', -13.8, 22.8, { rot: -20, opts: { labels: ['Khu vui chơi', 'Sở thú'] } });
    this.portal(-15.5, 26.4, 'park', 'from_zoo', { label: 'Khu Vui Chơi', lock: () => zoneLock('park'), rot: 180 });
    this.place('signpost', -24.8, -11.4, { rot: 75, opts: { labels: ['Mê Cung', 'Sở thú'] } });
    this.portal(-28.2, -14.6, 'maze', 'from_zoo', {
      label: 'Mê Cung Toán Học',
      lock: () => (on('maze.exit') ? null : 'Lối này là cửa ra của Mê Cung – hãy vào Mê Cung từ Rừng Phép Tính nhé!'),
      rot: 90,
    });
  }

  private buildDecoration(): void {
    for (const [x, z] of [[-3, 20.8], [3, 20.6], [-2.7, 7.8], [2.7, 7.8], [-7.5, -2.6], [7.5, -2.8], [0, -7.4]] as [number, number][]) this.place('lamp_post', x, z);
    for (const [x, z] of [[-22, 15], [22, 16], [-23, -2], [24, -4], [-6, -21], [10, -22], [-6, 9], [8, 8], [-8, -10]] as [number, number][]) this.place('tree_palm', x, z, { rot: x * 11, scale: 1.05, collide: false });
    for (const [x, z, r, len] of [
      [-4.9, 8.6, -8, 2.2],
      [4.9, 8.6, 8, 2.2],
      [-5.8, 5.8, 35, 2.0],
      [5.8, 5.4, -35, 2.0],
      [-7.9, -0.1, 55, 2.3],
      [8.3, -1.4, -65, 2.3],
      [-2.6, -7.8, 12, 2.0],
      [2.8, -7.8, -12, 2.0],
    ] as [number, number, number, number][]) this.place('hedge', x, z, { rot: r, opts: { len, h: 0.38 }, collide: false });
    for (const [x, z, r] of [[-8.7, 2.6, 45], [8.9, 2.1, -45], [-3.9, -8.8, 12], [5.6, -8.2, -18], [-11.6, 15.4, 45], [11.4, 15.2, -45]] as [number, number, number][]) {
      this.place('flower_bed', x, z, { rot: r, collide: false, scale: 0.74 });
    }
    this.place('zoo_topiary', -5.7, 12.9, { opts: { style: 'elephant' }, rot: 25, collide: false });
    this.place('zoo_topiary', 5.8, 12.8, { opts: { style: 'bunny' }, rot: -30, collide: false });
    this.place('zoo_topiary', -6.8, -6.9, { opts: { style: 'bunny' }, rot: 135, collide: false, scale: 0.92 });
    this.place('zoo_topiary', 8.9, -7.7, { opts: { style: 'elephant' }, rot: -125, collide: false, scale: 0.9 });
    for (const [x, z, r] of [[-2.8, 15.0, 25], [2.7, 15.0, -20], [-3.0, 10.1, -20], [3.0, 10.1, 20]] as [number, number, number][]) this.place('fence', x, z, { opts: { len: 1.2, style: 'picket', color: '#ff9ec7' }, rot: r, collide: false });
    this.scatter(['tree_round', 'tree_palm', 'tree_blossom', 'tree_apple'], 8, { gap: 4.8, scale: [0.85, 1.08] });
    this.scatter(['bush', 'flower_bed', 'rock', 'mushroom'], 16, { gap: 2.5, scale: [0.8, 1.1], collide: false });
    this.scatter(['flower', 'tulip', 'grass', 'grass'], 55, { gap: 0.9, collide: false, pathGap: 0.45 });
    this.border(['tree_round', 'tree_palm', 'tree_tall', 'bush']);
    const birds = [
      this.place('critter_bird', -21.2, 17.4, { dynamic: true, collide: false, scale: 0.9 }),
      this.place('critter_butterfly', 20.5, 13.7, { dynamic: true, collide: false }),
    ];
    this.addTick((_dt, tt) => {
      birds[0].position.y = 0.8 + Math.sin(tt * 2) * 0.08;
      birds[1].position.set(20.5 + Math.cos(tt * 0.8) * 2, 1.3 + Math.sin(tt * 2.1) * 0.25, 13.7 + Math.sin(tt * 1.1) * 1.2);
      birds[1].rotation.y = -tt * 0.8;
    });
  }

  private applySolvedState(): void {
    this.setGateOpen(on('zoo.open'), false);
    if (on('zoo.giraffe')) this.poseGiraffesFed(1);
    if (on('zoo.monkey')) this.poseMonkeysFed(1);
    if (on('zoo.penguins')) this.posePenguinsFed(1);
  }

  private async talkElephant(): Promise<void> {
    if (on('zoo.open')) {
      await say(CAST.voi, ['Chào mừng bạn quay lại Sở Thú Kỳ Diệu!', 'Các bạn thú đang đợi bạn ở bên trong đấy.']);
      return;
    }
    const have = profile().tickets;
    if (have >= ZOO_TICKETS) {
      await say(CAST.voi, [`Bạn có đủ ${ZOO_TICKETS} vé rồi! Bác sẽ mở cổng Sở Thú cho bạn nhé.`, 'Vé bay vào quầy nào!']);
      sfx('coin');
      this.fx.burst('star', [-3.7, 1.7, 17.2], { count: 24, spread: 1.1 });
      this.fx.burst('sparkle', [0, 1.8, 11.2], { count: 30, spread: 1.4 });
      addTickets(-ZOO_TICKETS);
      setFlag('zoo.open');
      await this.openGateScene();
      await say(CAST.voi, ['Mời bạn vào! Hãy giúp các bạn hươu, khỉ và chim cánh cụt nhé.', 'Nhớ: giải toán xong thì tự tay cho các bạn ấy ăn trong thế giới nha!']);
    } else {
      await say(CAST.voi, [`Để mở cổng cần ${ZOO_TICKETS} vé. Bạn đang có ${have} vé.`, 'Bốn vé ở Khu Vui Chơi, một vé ở cửa ra Mê Cung. Cố lên nhé!']);
      toast(`Cần thêm ${ZOO_TICKETS - have} vé nữa`, { icon: '🎟️', tone: 'warn' });
    }
  }

  private async openGateScene(): Promise<void> {
    this.setGateOpen(true, true);
    sfx('door');
    this.fx.burst('confetti', [0, 2.4, 11.2], { count: 50, spread: 2 });
    await this.showPoint(0, 1.4, 9.2, 1.2, 12);
  }

  private setGateOpen(open: boolean, animate: boolean): void {
    const l = this.gate.getObjectByName('gateL');
    const r = this.gate.getObjectByName('gateR');
    this.setSolid(this.gate, !open);
    const set = (k: number) => {
      if (l) l.rotation.y = -1.2 * k;
      if (r) r.rotation.y = 1.2 * k;
    };
    if (!animate) set(open ? 1 : 0);
    else void this.tween(0.8, (k) => set(k), { ease: 'outCubic' });
  }

  private async prepareAnimal(kind: 'giraffe' | 'monkey' | 'penguins'): Promise<void> {
    const data = {
      giraffe: { speaker: CAST.nai, title: 'Chuẩn bị táo', icon: '🍎', item: APPLE_ITEM, obj: this.appleBasket, line: 'Giỏi quá! Giỏ táo đã sẵn sàng. Hãy tới bục thấp để cho hươu ăn nhé.' },
      monkey: { speaker: CAST.nai, title: 'Chuẩn bị chuối', icon: '🍌', item: BANANA_ITEM, obj: this.bananaBunch, line: 'Tuyệt vời! Nải chuối đã sẵn sàng. Mang tới cho các bạn khỉ nhé.' },
      penguins: { speaker: CAST.nai, title: 'Chuẩn bị cá', icon: '🐟', item: FISH_ITEM, obj: this.fishBucket, line: 'Chính xác! Xô cá đã sẵn sàng. Hãy cho các bạn cánh cụt ăn nhé.' },
    }[kind];
    await this.quiz(storyQuestion(kind), { src: `zoo:${kind}`, speaker: data.speaker, title: data.title, icon: data.icon }, data.obj, 11);
    giveItem(data.item, 1);
    data.obj.visible = true;
    this.fx.burst('sparkle', data.obj.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 24, spread: 0.8 });
    sfx('pop');
    await say(data.speaker, data.line);
  }

  private async feedGiraffes(): Promise<void> {
    if (!hasItem(APPLE_ITEM)) {
      await say(CAST.nai, 'Mình cần chuẩn bị giỏ táo trước. Hãy giải bài toán ở chuồng hươu nhé!');
      return;
    }
    takeItem(APPLE_ITEM);
    this.appleBasket.visible = false;
    await say(CAST.nai, 'Bạn đặt táo lên bục nhé. Các bạn hươu đang cúi xuống ăn kìa!');
    await this.showPoint(-15.8, 2.2, -7.5, 0.8, 11);
    sfx('correct');
    this.poseGiraffesFed(0);
    await this.wait(1.1);
    setFlag('zoo.giraffe');
    checkBadges();
    this.fx.burst('heart', [-15.8, 2.7, -7.6], { count: 34, spread: 2.1 });
    this.buddy?.celebrate(2);
    await say(CAST.gau, bearStage() === 'reward' ? 'Cảm ơn bạn! Mình gặp được bạn hươu rồi!' : 'Bạn cho hươu ăn khéo quá!');
  }

  private poseGiraffesFed(finalK: number): void {
    this.giraffes.forEach((g, i) => {
      const start = g.rotation.x;
      const end = -0.18 - i * 0.035;
      if (finalK >= 1) g.rotation.x = end;
      else void this.tween(0.75, (k) => {
        g.rotation.x = start + (end - start) * k;
        g.position.y = Math.sin(k * Math.PI) * 0.08;
      }, { delay: i * 0.12, ease: 'inOutCubic' });
    });
  }

  private buildGiraffeFlock(): void {
    const n = this.giraffes.length;
    const mats = {
      hide: new THREE.MeshStandardMaterial({ color: '#e7b85f', roughness: 0.6 }),
      patch: new THREE.MeshStandardMaterial({ color: '#9b6431', roughness: 0.64 }),
      muzzle: new THREE.MeshStandardMaterial({ color: '#f4cf8a', roughness: 0.56 }),
      eye: new THREE.MeshStandardMaterial({ color: '#2b2233', roughness: 0.35 }),
    };
    const sphere = new THREE.SphereGeometry(1, 10, 8);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    const body = new THREE.InstancedMesh(sphere, mats.hide, n);
    const neck = new THREE.InstancedMesh(cyl, mats.hide, n);
    const head = new THREE.InstancedMesh(sphere, mats.hide, n);
    const muzzle = new THREE.InstancedMesh(sphere, mats.muzzle, n);
    const legs = new THREE.InstancedMesh(cyl, mats.hide, n * 4);
    const spots = new THREE.InstancedMesh(sphere, mats.patch, n * 8);
    const eyes = new THREE.InstancedMesh(sphere, mats.eye, n * 2);
    const ossicones = new THREE.InstancedMesh(cyl, mats.patch, n * 2);
    const root = new THREE.Group();
    root.add(body, neck, head, muzzle, legs, spots, eyes, ossicones);
    this.dynamics.add(root);
    this.giraffeFlock = { body, neck, head, muzzle, legs, spots, eyes, ossicones };
    this.updateGiraffeFlock();
    this.addTick(() => this.updateGiraffeFlock());
  }

  private updateGiraffeFlock(): void {
    const flock = this.giraffeFlock;
    if (!flock) return;
    const dummy = new THREE.Object3D();
    const setPart = (mesh: THREE.InstancedMesh, i: number, g: THREE.Object3D, off: [number, number, number], scale: [number, number, number], extraRot: [number, number, number] = [0, 0, 0]) => {
      const s = g.scale.x;
      const e = new THREE.Euler(g.rotation.x + extraRot[0], g.rotation.y + extraRot[1], g.rotation.z + extraRot[2]);
      const o = new THREE.Vector3(off[0] * s, off[1] * s, off[2] * s).applyEuler(new THREE.Euler(g.rotation.x, g.rotation.y, g.rotation.z));
      dummy.position.set(g.position.x + o.x, g.position.y + o.y, g.position.z + o.z);
      dummy.rotation.copy(e);
      dummy.scale.set(scale[0] * s, scale[1] * s, scale[2] * s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };
    const legOffsets: [number, number, number][] = [[0.24, 0.45, 0.42], [-0.24, 0.45, 0.42], [0.24, 0.45, -0.42], [-0.24, 0.45, -0.42]];
    const spotOffsets: [number, number, number][] = [[0.28, 1.14, 0.32], [-0.24, 1.0, -0.28], [0.18, 1.24, -0.12], [0.02, 1.78, 0.35], [-0.04, 2.08, 0.3], [0.08, 2.38, 0.24], [0.0, 2.84, 0.08], [-0.16, 2.74, 0.0]];
    this.giraffes.forEach((g, i) => {
      setPart(flock.body, i, g, [0, 1.02, 0], [0.46, 0.34, 0.64]);
      setPart(flock.neck, i, g, [0, 1.86, 0.34], [0.12, 0.78, 0.12], [0.16, 0, 0]);
      setPart(flock.head, i, g, [0, 2.75, 0.14], [0.28, 0.28, 0.32]);
      setPart(flock.muzzle, i, g, [0, 2.69, 0.43], [0.21, 0.13, 0.16]);
      legOffsets.forEach((off, j) => setPart(flock.legs, i * 4 + j, g, off, [0.07, 0.48, 0.07]));
      spotOffsets.forEach((off, j) => setPart(flock.spots, i * 8 + j, g, off, [0.09, 0.055, 0.035]));
      setPart(flock.eyes, i * 2, g, [0.12, 2.82, 0.43], [0.035, 0.045, 0.018]);
      setPart(flock.eyes, i * 2 + 1, g, [-0.12, 2.82, 0.43], [0.035, 0.045, 0.018]);
      setPart(flock.ossicones, i * 2, g, [0.08, 3.02, 0.08], [0.025, 0.11, 0.025]);
      setPart(flock.ossicones, i * 2 + 1, g, [-0.08, 3.02, 0.08], [0.025, 0.11, 0.025]);
    });
    for (const mesh of Object.values(flock)) mesh.instanceMatrix.needsUpdate = true;
  }

  private async feedMonkeys(): Promise<void> {
    if (!hasItem(BANANA_ITEM)) {
      await say(CAST.nai, 'Hãy chuẩn bị nải chuối bằng bài toán ở sân khỉ trước nhé!');
      return;
    }
    takeItem(BANANA_ITEM);
    this.bananaBunch.visible = false;
    await say(CAST.nai, 'Chuối tới rồi! Các bạn khỉ nhảy vui quá!');
    sfx('pop');
    this.poseMonkeysFed(0);
    this.fx.burst('heart', [17.2, 1.6, -4.2], { count: 30, spread: 2 });
    await this.wait(1.0);
    setFlag('zoo.monkey');
    checkBadges();
  }

  private poseMonkeysFed(finalK: number): void {
    this.monkeys.forEach((m, i) => {
      if (finalK >= 1) {
        m.rotation.z = (i - 1) * 0.08;
        return;
      }
      const y0 = m.position.y;
      void this.tween(0.85, (k) => {
        m.position.y = y0 + Math.sin(k * Math.PI * 2) * 0.5 * (1 - k * 0.2);
        m.rotation.z = Math.sin(k * Math.PI * 4) * 0.25;
      }, { delay: i * 0.12, ease: 'outCubic' });
    });
  }

  private async feedPenguins(): Promise<void> {
    if (!hasItem(FISH_ITEM)) {
      await say(CAST.nai, 'Hãy chuẩn bị xô cá bằng bài toán ở hồ cánh cụt trước nhé!');
      return;
    }
    takeItem(FISH_ITEM);
    this.fishBucket.visible = false;
    await say(CAST.nai, 'Cá ngon đây! Các bạn cánh cụt trượt xuống nước rồi!');
    sfx('splash');
    this.posePenguinsFed(0);
    this.fx.burst('splash', [2.8, 0.6, -16.2], { count: 34, spread: 2.2 });
    await this.wait(1.2);
    setFlag('zoo.penguins');
    checkBadges();
  }

  private posePenguinsFed(finalK: number): void {
    this.penguins.forEach((p, i) => {
      const tx = 1.1 + (i % 4) * 0.55;
      const tz = -16.9 + Math.floor(i / 4) * 0.7;
      if (finalK >= 1) {
        p.position.set(tx, 0.08, tz);
        p.rotation.y = (i % 3 - 1) * 0.18;
        return;
      }
      const sx = p.position.x;
      const sz = p.position.z;
      void this.tween(1.05, (k) => {
        p.position.x = sx + (tx - sx) * k;
        p.position.z = sz + (tz - sz) * k;
        p.position.y = Math.sin(k * Math.PI) * 0.18;
        p.rotation.z = Math.sin(k * Math.PI * 4) * 0.1;
      }, { delay: (i % 4) * 0.05, ease: 'inOutCubic' });
    });
  }

  private buildPenguinFlock(): void {
    const n = this.penguins.length;
    const root = new THREE.Group();
    const mats = {
      black: new THREE.MeshStandardMaterial({ color: '#202733', roughness: 0.58 }),
      white: new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.52 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ff9f2e', roughness: 0.5 }),
    };
    const sphere = new THREE.SphereGeometry(1, 10, 8);
    const foot = new THREE.BoxGeometry(1, 1, 1);
    const body = new THREE.InstancedMesh(sphere, mats.black, n);
    const belly = new THREE.InstancedMesh(sphere, mats.white, n);
    const head = new THREE.InstancedMesh(sphere, mats.black, n);
    const face = new THREE.InstancedMesh(sphere, mats.white, n);
    const beak = new THREE.InstancedMesh(sphere, mats.orange, n);
    const feet = new THREE.InstancedMesh(foot, mats.orange, n * 2);
    root.add(body, belly, head, face, beak, feet);
    this.dynamics.add(root);
    this.penguinFlock = { body, belly, head, face, beak, feet };
    this.updatePenguinFlock();
    this.addTick(() => this.updatePenguinFlock());
  }

  private updatePenguinFlock(): void {
    const flock = this.penguinFlock;
    if (!flock) return;
    const dummy = new THREE.Object3D();
    const setPart = (mesh: THREE.InstancedMesh, i: number, p: THREE.Object3D, off: [number, number, number], scale: [number, number, number]) => {
      const o = new THREE.Vector3(off[0], off[1], off[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation.y);
      dummy.position.set(p.position.x + o.x, p.position.y + o.y, p.position.z + o.z);
      dummy.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
      dummy.scale.set(scale[0], scale[1], scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };
    this.penguins.forEach((p, i) => {
      setPart(flock.body, i, p, [0, 0.42, 0], [0.28, 0.42, 0.24]);
      setPart(flock.belly, i, p, [0, 0.40, 0.09], [0.18, 0.29, 0.08]);
      setPart(flock.head, i, p, [0, 0.86, 0], [0.23, 0.23, 0.21]);
      setPart(flock.face, i, p, [0, 0.84, 0.10], [0.15, 0.15, 0.06]);
      setPart(flock.beak, i, p, [0, 0.82, 0.24], [0.08, 0.04, 0.11]);
      setPart(flock.feet, i * 2, p, [-0.09, 0.04, 0.09], [0.12, 0.035, 0.18]);
      setPart(flock.feet, i * 2 + 1, p, [0.09, 0.04, 0.09], [0.12, 0.035, 0.18]);
    });
    for (const mesh of Object.values(flock)) mesh.instanceMatrix.needsUpdate = true;
  }

  private async talkBearAtZoo(): Promise<void> {
    if (bearStage() === 'reward') {
      await say(CAST.gau, ['Bạn ơi, cảm ơn bạn đã đưa mình tới đây và giúp hươu cao cổ!', 'Mình muốn tặng bạn phần thưởng của nhà thám hiểm.']);
      reward({ xp: 50, coins: 20, badge: 'nha-tham-hiem' });
      setFlag('bear.done');
      this.fx.burst('confetti', [-12.3, 1.8, -2.8], { count: 55, spread: 2 });
      this.fx.burst('heart', [-15.8, 2.8, -7.6], { count: 30, spread: 2 });
      this.giraffes.forEach((g, i) => void this.tween(0.7, (k) => (g.position.y = Math.sin(k * Math.PI * 2) * 0.08), { delay: i * 0.1 }));
      sfx('star');
      this.refreshMarks();
      await say(CAST.gau, 'Từ giờ mình sẽ ở lại Sở Thú để chơi với các bạn thú. Khi nào rảnh bạn ghé thăm mình nhé!');
    } else {
      await say(CAST.gau, on('bear.done') ? 'Mình ở đây rất vui. Cảm ơn bạn, nhà thám hiểm nhỏ!' : 'Bạn giúp hươu cao cổ trước nhé, rồi mình sẽ cảm ơn bạn thật nhiều!');
    }
  }
}
