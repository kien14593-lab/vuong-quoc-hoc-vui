import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { DECOR_SLOT_NAMES, ITEMS, PLANTS, item as itemDef, type DecorSlot } from '../../core/items';
import { flag, giveItem, hasItem, itemCount, profile, save, setDecor, setFlag, takeItem } from '../../core/state';
import { BADGES, badgeDef } from '../../core/progression';
import { ME } from '../../game/cast';
import { reward } from '../../game/story';
import { st } from '../../game/subject-text';
import { button, h } from '../../ui/dom';
import { say } from '../../ui/dialog';
import { openModal } from '../../ui/modal';
import { openBag } from '../../ui/screens/bag';
import { openMiniHub } from '../../ui/screens/minihub';
import { toast } from '../../ui/toast';
import { Zone, type Interactable, type Spawn } from '../zone';
import type { Label } from '../labels';
import '../../styles/zone-house.css';

type DecorObj = { slot: DecorSlot; obj: THREE.Object3D; label?: Label };
type PlantObj = { i: number; planter: THREE.Object3D; plant?: THREE.Object3D; label: Label };
type BadgeIcon = 'plus' | 'maze' | 'times' | 'scholar' | 'explorer';

const DECOR_SLOTS = Object.keys(DECOR_SLOT_NAMES) as DecorSlot[];
const SEED_IDS = ['seed_sunflower', 'seed_tomato', 'seed_strawberry', 'seed_magic'] as const;
const PLANTER_POS: [number, number][] = [
  [-3.15, 6.6],
  [0, 6.75],
  [3.15, 6.6],
];

function v3(a: readonly number[]): [number, number, number] {
  return [Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0)];
}

function badgeIcon(id: string): BadgeIcon {
  if (badgeDef(id)?.subject === 'english') return 'scholar';
  if (id.includes('me-cung')) return 'maze';
  if (id.includes('nhan')) return 'times';
  if (id.includes('toan') || id.includes('hiep-si')) return 'scholar';
  if (id.includes('tham') || id.includes('vuon')) return 'explorer';
  return 'plus';
}

function cloneMats(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    const mat = m.material;
    if (!mat) return;
    m.material = Array.isArray(mat) ? mat.map((x) => x.clone()) : mat.clone();
  });
}

function setOpacity(o: THREE.Object3D, opacity: number): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    const mat = m.material;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const x of mats) {
      const mm = x as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
      mm.transparent = opacity < 0.99;
      mm.opacity = opacity;
      mm.depthWrite = opacity >= 0.99;
    }
  });
}

/** 🏠 NGÔI NHÀ CỦA BẠN – trang trí, vườn cây, thú cưng và huy hiệu. */
export class HouseZone extends Zone {
  private room: THREE.Object3D | null = null;
  private walls = new Map<string, THREE.Object3D>();
  private decorObjs: DecorObj[] = [];
  private plantObjs: PlantObj[] = [];
  private badgeObjs: THREE.Object3D[] = [];
  private decorInters: Interactable[] = [];
  private plantInters: Interactable[] = [];
  private wardrobe: THREE.Object3D | null = null;
  private wardrobeOpen = false;

  constructor(spawn: Spawn) {
    super(
      {
        id: 'house',
        title: 'Ngôi Nhà Của Bạn',
        icon: '🏠',
        sub: 'Trang trí, trồng cây, huy hiệu',
        music: 'house',
        area: { hw: 10.5, hd: 10, r: 3 },
        margin: 8,
        ground: '#d7f0c2',
        sky: ['#bde7ff', '#fff5d6'],
        fog: [35, 95],
        mood: { sky: '#fff6df', ground: '#d7a56d', sun: '#fff2cf', ambient: 0.68, hemi: 1.7 },
        seed: 61,
        cam: { yaw: 0, pitch: 55, dist: 14, minDist: 10, maxDist: 18 },
        spawns: {
          start: { x: 0, z: 3.25, rot: 180 },
          from_village: { x: 0, z: 3.25, rot: 180 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    this.terrain.path([[0, 3.9], [0, 6.4], [0, 9.4]], 1.8, { kind: 'stone' });
    this.terrain.patch(0, 6.6, 5.2, '#b8de7f', 0.75);

    this.room = this.place('room_home', 0, 0, { dynamic: true, opts: { wall: '#ffe4ef' }, reserve: 5.2 });
    cloneMats(this.room);
    for (const name of ['wallN', 'wallS', 'wallW', 'wallE']) {
      const w = this.room.getObjectByName(name);
      if (w) this.walls.set(name, w);
    }
    this.addTick(() => this.updateWalls());

    this.place('furn_bed', -3.55, 2.25, { rot: 90, opts: { color: '#7ec8e3' }, scale: 1.02 });
    this.place('furn_table', 0.7, 1.35, { rot: 20 });
    this.place('furn_chair', 1.0, 2.42, { rot: 200, opts: { color: '#ffd6e8' } });
    this.place('furn_desk', -3.25, -2.45, { rot: 0, dynamic: true, name: 'desk' });
    this.wardrobe = this.place('furn_wardrobe', 4.1, -3.08, { rot: -20, dynamic: true, name: 'wardrobe' });
    this.place('furn_badge_shelf', 0, -3.65, { rot: 0, dynamic: true, name: 'badgeShelf' });
    if (profile().badges.length > 5) this.place('furn_badge_shelf', 3.0, -3.65, { rot: 0, dynamic: true, name: 'badgeShelf2' });
    this.place('food_bowl', 3.65, 2.55, { dynamic: true, name: 'petBowl' });

    this.sign(0, -3.7, '🏅 Kệ huy hiệu', { y: 1.75, maxDist: 22 });
    this.sign(0, 6.65, '🌱 Vườn nhỏ', { y: 1.6, maxDist: 26 });
    this.sign(0, 9.55, 'Về Làng 🏡', { y: 1.6, maxDist: 30 });
    this.portal(0, 9.55, 'village', 'from_house', { label: 'Về Làng 🏡', r: 1.45, rot: 180 });

    this.interact({ id: 'wardrobe', x: 4.1, z: -3.0, r: 2.0, label: 'Mở tủ đồ', icon: '👕', obj: this.wardrobe ?? undefined, run: () => this.openWardrobe() });
    this.interact({ id: 'desk', x: -3.25, z: -2.1, r: 2.0, label: 'Luyện tập', icon: '🎮', run: () => openMiniHub((id) => void this.playMini(id)) });
    this.interact({ id: 'bed', x: -3.55, z: 2.25, r: 2.0, label: 'Nghỉ ngơi', icon: '🛏️', run: () => this.bedTalk() });
    this.interact({ id: 'badges', x: 0, z: -3.55, r: 2.6, label: 'Xem huy hiệu', icon: '🏅', run: () => openBag('badges') });
    this.interact({ id: 'pet-bowl', x: 3.65, z: 2.55, r: 1.7, label: 'Cho thú cưng ăn', icon: '💖', run: () => this.feedPet() });

    this.buildDecor();
    this.buildGarden();
    this.buildBadges();
    this.addCosyDetails();
  }

  protected onEnter(first: boolean): void {
    if (!flag('house.seedGift')) {
      giveItem('seed_sunflower', 1);
      setFlag('house.seedGift');
      toast('Bạn nhận 1 hạt hướng dương để thử trồng cây!', { icon: '🌻', tone: 'good', ms: 3600 });
    }
    if (first && !flag('house.welcome')) {
      void this.runInteract({ id: 'house:intro', x: 0, z: 0, r: 0, label: '', icon: '', run: () => this.welcome() });
    }
  }

  objective(): { text: string; icon?: string } | null {
    const p = profile();
    if (!flag('house.welcome')) return { text: 'Khám phá căn nhà mới của bạn', icon: '🏠' };
    if (p.plants.some((pl) => pl.seed && PLANTS[pl.seed] && pl.growth >= PLANTS[pl.seed].stages)) return { text: 'Thu hoạch cây đã chín trong vườn', icon: '🌻' };
    if (p.plants.some((pl) => !pl.seed) && SEED_IDS.some((id) => hasItem(id))) return { text: 'Trồng hạt giống vào ô vườn', icon: '🌱' };
    return { text: 'Trang trí nhà, chăm thú cưng hoặc luyện tập', icon: '🏠' };
  }

  private async welcome(): Promise<void> {
    setFlag('house.welcome');
    await say(ME, ['Đây là nhà của mình!', st('house.intro'), 'Mình thử trồng hạt hướng dương đầu tiên nhé!']);
    await this.showPoint(0, 1.2, 6.6, 1.3, 11);
  }

  private addCosyDetails(): void {
    this.place('flower_pot', -4.6, 3.55, { collide: false, reserve: false, scale: 0.8 });
    this.place('flower_pot', 4.6, 3.55, { collide: false, reserve: false, scale: 0.8 });
    this.place('fence', -5.3, 8.7, { opts: { len: 5.0, style: 'picket' }, rot: 0, collide: false });
    this.place('fence', 5.3, 8.7, { opts: { len: 5.0, style: 'picket' }, rot: 0, collide: false });
    this.place('fence', -6.7, 6.2, { opts: { len: 4.4, style: 'picket' }, rot: 90, collide: false });
    this.place('fence', 6.7, 6.2, { opts: { len: 4.4, style: 'picket' }, rot: 90, collide: false });
    this.place('tree_blossom', -7.4, 7.6, { scale: 0.8, collide: false });
    this.place('tree_round', 7.4, 7.4, { scale: 0.8, collide: false });
    this.place('mailbox', -1.45, 9.1, { rot: 12, scale: 0.8, collide: false });
    this.place('gate_arch', 0, 9.4, { opts: { text: 'Về Làng', color: '#ffd6e8', w: 2.2 }, scale: 0.72, collide: false });
    this.place('garden_watering_can', -4.8, 6.0, { rot: -24, scale: 0.8, collide: false });
    this.place('garden_tool_bench', 5.0, 6.2, { rot: -18, scale: 0.82, collide: false });
    for (const z of [4.85, 5.55, 6.25, 6.95, 7.65, 8.35]) this.place('garden_stepping_stone', (z % 2 - 0.5) * 0.18, z, { rot: z * 37, scale: 0.9, collide: false, reserve: false });
    this.place('flower_bed', -4.9, 8.7, { opts: { len: 2.7 }, rot: 0, scale: 0.9, collide: false, reserve: false });
    this.place('flower_bed', 4.9, 8.7, { opts: { len: 2.7 }, rot: 0, scale: 0.9, collide: false, reserve: false });
    this.scatter(['grass'], 12, { x: 0, z: 7.1, hw: 8.5, hd: 2.3, gap: 0.9, collide: false });
    const butterflies = [
      this.place('critter_butterfly', -4.2, 7.4, { dynamic: true, collide: false, reserve: false, scale: 0.9 }),
      this.place('critter_butterfly', 4.15, 7.8, { dynamic: true, collide: false, reserve: false, scale: 0.85 }),
    ];
    this.addTick((_dt, t) => {
      butterflies.forEach((b, i) => {
        b.position.x += Math.sin(t * 1.3 + i * 2) * 0.002;
        b.position.y = 0.8 + Math.sin(t * 2.4 + i) * 0.18;
        b.rotation.y += 0.035;
      });
    });
  }

  private updateWalls(): void {
    if (!this.room) return;
    const sx = Math.sin(this.cam.yaw);
    const sz = Math.cos(this.cam.yaw);
    const normals: Record<string, [number, number]> = {
      wallN: [0, -1],
      wallS: [0, 1],
      wallW: [-1, 0],
      wallE: [1, 0],
    };
    for (const [name, wall] of this.walls) {
      const [nx, nz] = normals[name] ?? [0, 0];
      const facing = nx * sx + nz * sz > 0.35;
      setOpacity(wall, facing ? 0.16 : 1);
    }
  }

  private buildDecor(): void {
    for (const it of this.decorInters) this.removeInteract(it);
    this.decorInters = [];
    for (const d of this.decorObjs) {
      this.removeObj(d.obj);
      d.label?.remove();
    }
    this.decorObjs = [];
    const slots = (this.room?.userData.slots ?? {}) as Record<DecorSlot, { p: readonly number[]; rotY: number }>;
    for (const slot of DECOR_SLOTS) {
      const s = slots[slot];
      if (!s) continue;
      const [x, y, z] = v3(s.p);
      const id = profile().decor[slot] ?? null;
      const def = id ? itemDef(id) : undefined;
      const obj = def?.style
        ? this.place(`decor_${def.style}`, x, z, {
          y,
          rot: s.rotY,
          opts: { color: def.color, color2: def.color2 },
          dynamic: true,
          collide: !slot.startsWith('wall') && slot !== 'rug',
          reserve: false,
        })
        : new THREE.Object3D();
      if (def) {
        this.tween(0.38, (k) => obj.scale.setScalar((def ? 1 : 0.34) * (0.55 + 0.45 * k)), { ease: 'outBack' });
      }
      const label = !def ? this.sign(x, z, '✦＋', { y: y > 0.5 ? y + 0.6 : 1.0, cls: 'sign small', maxDist: 18 }) : undefined;
      this.decorObjs.push({ slot, obj, label });
      this.decorInters.push(this.interact({
        id: `decor:${slot}`,
        x,
        z,
        r: slot.startsWith('wall') ? 2.2 : 1.7,
        label: `Đổi ${DECOR_SLOT_NAMES[slot]}`,
        icon: '🛋️',
        obj,
        run: () => this.openDecorPicker(slot),
      }));
    }
  }

  private openDecorPicker(slot: DecorSlot): void {
    const defs = ITEMS.filter((it) => it.cat === 'decor' && it.slot === slot && hasItem(it.id));
    const grid = h('div.house-grid');
    const refresh = () => {
      grid.replaceChildren();
      grid.append(
        button('Để trống', () => {
          setDecor(slot, null);
          sfx('pop');
          modal.close();
          this.buildDecor();
        }, 'house-card'),
      );
      for (const d of defs) {
        grid.append(
          button([
            h('span.house-card-icon', '🛋️'),
            h('span.house-card-name', d.name),
          ], () => {
            setDecor(slot, d.id);
            sfx('pop');
            modal.close();
            this.buildDecor();
            toast(`Đã đặt ${d.name}!`, { icon: '🏠', tone: 'good' });
          }, 'house-card'),
        );
      }
      if (!defs.length) grid.append(h('div.house-empty', 'Bạn chưa có đồ cho vị trí này. Hãy mua đồ trang trí ở cửa hàng của Cô Mèo nhé!'));
    };
    const modal = openModal({ title: `Trang trí: ${DECOR_SLOT_NAMES[slot]}`, icon: '🏠', width: 1280, body: grid, className: 'house-modal' });
    refresh();
  }

  private buildGarden(): void {
    for (const it of this.plantInters) this.removeInteract(it);
    this.plantInters = [];
    for (const p of this.plantObjs) {
      if (p.plant) this.removeObj(p.plant);
      this.removeObj(p.planter);
      p.label.remove();
    }
    this.plantObjs = [];
    const plants = profile().plants;
    for (let i = 0; i < PLANTER_POS.length; i++) {
      const [x, z] = PLANTER_POS[i];
      const planter = this.place('planter', x, z, { dynamic: true, name: `planter${i}` });
      const pl = plants[i] ?? (plants[i] = { seed: null, growth: 0 });
      let plant: THREE.Object3D | undefined;
      const def = pl.seed ? PLANTS[pl.seed] : undefined;
      const stage = def ? Math.min(pl.growth, def.stages) : 0;
      if (pl.seed && def) {
        plant = this.place(`plant_${pl.seed}`, x, z, { y: (planter.userData.plantY as number | undefined) ?? 0.25, opts: { stage }, dynamic: true, collide: false, reserve: false });
      }
      const txt = def ? `${def.name} ${Math.min(pl.growth, def.stages)}/${def.stages}${pl.growth >= def.stages ? ' ✨' : ''}` : 'Ô trống';
      const label = this.sign(x, z, `🌱 ${txt}`, { y: 1.25, cls: 'sign small', maxDist: 26 });
      this.plantObjs.push({ i, planter, plant, label });
      this.plantInters.push(this.interact({
        id: `planter:${i}`,
        x,
        z,
        r: 2.25,
        label: pl.seed && def && pl.growth >= def.stages ? 'Thu hoạch' : pl.seed ? 'Xem cây' : 'Trồng cây',
        icon: '🌱',
        obj: plant ?? planter,
        run: () => this.usePlanter(i),
      }));
    }
  }

  private usePlanter(i: number): void {
    const pl = profile().plants[i];
    if (!pl.seed) {
      this.openSeedPicker(i);
      return;
    }
    const def = PLANTS[pl.seed];
    if (!def) return;
    if (pl.growth < def.stages) {
      toast(`${def.name} đang lớn: ${pl.growth}/${def.stages}. ${st('house.grow')}`, { icon: '🌱', tone: 'good', ms: 3400 });
      return;
    }
    reward({ ...def.harvest, badge: 'nha-lam-vuon' }, { x: 0.5, y: 0.4 });
    setFlag('house.harvest');
    this.fx.burst('confetti', [PLANTER_POS[i][0], 1.1, PLANTER_POS[i][1]], { count: 28, spread: 1.0 });
    sfx('correct');
    pl.seed = null;
    pl.growth = 0;
    save();
    this.buildGarden();
    this.buildBadges();
  }

  private openSeedPicker(i: number): void {
    const owned = SEED_IDS.filter((id) => hasItem(id));
    if (!owned.length) {
      toast('Bạn chưa có hạt giống. Hãy ghé cửa hàng của Cô Mèo nhé!', { icon: '🌱', tone: 'warn', ms: 3600 });
      return;
    }
    const grid = h('div.house-grid');
    const modal = openModal({ title: 'Chọn hạt giống', icon: '🌱', width: 1180, body: grid, className: 'house-modal' });
    for (const id of owned) {
      const d = itemDef(id);
      grid.append(
        button([
          h('span.house-card-icon', '🌱'),
          h('span.house-card-name', `${d?.name ?? id} ×${itemCount(id)}`),
        ], () => {
          if (!takeItem(id)) return;
          const pl = profile().plants[i];
          pl.seed = id.replace(/^seed_/, '');
          pl.growth = 0;
          save();
          modal.close();
          this.buildGarden();
          this.fx.burst('sparkle', [PLANTER_POS[i][0], 0.9, PLANTER_POS[i][1]], { count: 18, spread: 0.7 });
          toast(`Đã trồng ${d?.name ?? 'hạt giống'}!`, { icon: '🌱', tone: 'good' });
        }, 'house-card'),
      );
    }
  }

  private buildBadges(): void {
    for (const b of this.badgeObjs) this.removeObj(b);
    this.badgeObjs = [];
    const earned = profile().badges.slice(0, 10);
    const shelves = [
      { x: 0, z: -3.65 },
      { x: 3.0, z: -3.65 },
    ];
    earned.forEach((id, i) => {
      const def = BADGES.find((b) => b.id === id);
      const shelf = shelves[Math.floor(i / 5)] ?? shelves[1];
      const slot = i % 5;
      const obj = this.place('badge', shelf.x - 0.8 + slot * 0.4, shelf.z, { y: 1.2, rot: 0, opts: { icon: badgeIcon(id), color: def?.color ?? '#ffd166' }, dynamic: true, collide: false, reserve: false, scale: 0.8 });
      this.badgeObjs.push(obj);
    });
  }

  private openWardrobe(): void {
    if (this.wardrobe) {
      this.wardrobeOpen = !this.wardrobeOpen;
      const l = this.wardrobe.getObjectByName('doorL');
      const r = this.wardrobe.getObjectByName('doorR');
      const dir = this.wardrobeOpen ? 1 : 0;
      this.tween(0.35, (k) => {
        const a = dir ? k : 1 - k;
        if (l) l.rotation.y = a * 0.65;
        if (r) r.rotation.y = -a * 0.65;
      }, { ease: 'outCubic' });
      sfx('door');
    }
    openBag('wear');
  }

  private async bedTalk(): Promise<void> {
    await say(ME, ['Chiếc giường êm quá!', st('house.bed')]);
    this.fx.burst('heart', [-3.55, 1.2, 2.25], { count: 12, spread: 0.7 });
  }

  private async feedPet(): Promise<void> {
    if (!this.pet) {
      toast('Bạn chưa có thú cưng. Hãy nhận nuôi một bạn ở cửa hàng nhé!', { icon: '🐾', tone: 'warn', ms: 3600 });
      return;
    }
    this.bubble(this.pet.root, 'Ngon quá!', 1.3, 1800);
    const y0 = this.pet.root.position.y;
    this.tween(0.55, (k) => {
      this.pet!.root.position.y = y0 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.22;
    });
    this.fx.burst('heart', [this.pet.root.position.x, 1.0, this.pet.root.position.z], { count: 16, spread: 0.8 });
    sfx('correct');
    await this.wait(0.6);
    if (this.pet) this.pet.root.position.y = y0;
  }
}
