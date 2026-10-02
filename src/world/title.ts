import * as THREE from 'three';
import { engine, type Quality, type Stage } from '../engine/core';
import { setupLights, setupSky, type LightRig } from '../engine/lighting';
import { bakeStatic, disposeTree } from '../engine/merge';
import { buildModel, collectTicks } from '../models/registry';
import { Actor } from './actor';
import { Terrain, TERRAIN_COLORS, waterUniforms } from './terrain';

/**
 * Khung cảnh 3D phía sau màn hình tiêu đề: một góc làng nhỏ, các bạn thú đi dạo,
 * camera bay vòng chậm rãi.
 */
export class TitleStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 420);
  private lights: LightRig;
  private ticks: ((dt: number, t: number) => void)[] = [];
  private actors: Actor[] = [];
  private ang = 0.35;
  private disposed = false;

  constructor() {
    setupSky(this.scene, '#9fd8f7', '#fdeef4', 44, 120);
    this.lights = setupLights(this.scene, engine.quality, 24);
    this.lights.follow(new THREE.Vector3(0, 0, 0));
    const t = new Terrain({ hw: 18, hd: 18, r: 12 }, 22, TERRAIN_COLORS.grass, 5);
    const statics = new THREE.Group();
    const put = (key: string, x: number, z: number, rot = 0, opts: Record<string, unknown> = {}, scale = 1, reserve = 1.6): THREE.Object3D => {
      const o = buildModel(key, opts);
      o.position.set(x, 0, z);
      o.rotation.y = (rot * Math.PI) / 180;
      if (scale !== 1) o.scale.multiplyScalar(scale);
      statics.add(o);
      if (reserve > 0) t.reserve(x, z, reserve);
      return o;
    };

    t.plaza(0, 0, 5.2);
    t.path([[0, 5], [0, 26]], 2.4);
    t.path([[-5, -1], [-26, -4]], 2.4);
    t.path([[5, 0.5], [26, 3]], 2.4);
    t.pond(9.5, 9.5, 3.4, 2.4);
    t.meadow(-9, 8, 3.4, ['#ffffff', '#ffd6e7', '#fff3a6'], 4);
    t.meadow(8, -9, 3);

    put('fountain', 0, 0, 0, {}, 1, 2.6);
    put('house_cottage', -9.5, -6.5, 25, { v: 1 }, 1, 3.4);
    put('shop_math', 8.5, -7, -20, {}, 1, 3.6);
    put('house_player', -11, 4.5, 75, {}, 1, 3.6);
    put('windmill', 3, -15, -10, {}, 1, 3);
    put('house_cottage', 13, 1.5, -95, { v: 3 }, 1, 3.2);
    put('gate_arch', 0, 17, 180, { text: 'Vương Quốc Học Vui', color: '#ff9ec4', w: 5 }, 1, 2.4);
    put('lamp_post', 3.6, 4.6);
    put('lamp_post', -3.8, -4.4);
    put('bench', -4.4, 3.4, 140, {}, 1, 1.2);
    put('flower_bed', 4.6, -3.4, -30, {}, 1, 1.4);
    put('well', 6.5, 6, 0, {}, 1, 1.4);
    put('notice_board', -5.2, -2.6, 60, {}, 1, 1.4);
    for (const [x, z] of [[8.2, 9], [10.8, 10.2]]) put('lilypad', x, z, x * 30, {}, 1, 0);
    put('critter_duck', 9.8, 8.8, 40, {}, 1, 0);
    const trees: [string, number, number][] = [
      ['tree_blossom', -15, -2], ['tree_round', -6, -13], ['tree_apple', 15, -7.5], ['tree_round', 16.5, 8], ['tree_blossom', 4.5, 14],
      ['tree_tall', -5.5, 14.5], ['tree_round', -16, 11], ['tree_pine', 11, -14], ['tree_blossom', -13.5, -12], ['tree_round', 19, -2],
      ['tree_tall', -20, 3.5], ['tree_round', 7, 19], ['tree_pine', -9, 20], ['tree_apple', -19, -9], ['tree_round', 20, 12],
    ];
    for (const [k, x, z] of trees) put(k, x, z, x * 37, {}, 0.95 + ((x * 7 + z * 3) % 5) * 0.06, 1.8);
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 6 + rnd() * 18;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (t.onPath(x, z, 0.4) || t.isReserved(x, z, 0.2) || t.waterDist(x, z) < 0.8) continue;
      put(['flower', 'tulip', 'grass', 'grass', 'bush', 'mushroom'][Math.floor(rnd() * 6)], x, z, rnd() * 360, {}, 0.8 + rnd() * 0.5, 0.5);
    }
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const d = 24 + rnd() * 6;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (t.onPath(x, z, 1)) continue;
      put(['tree_round', 'tree_pine', 'tree_tall', 'tree_blossom'][Math.floor(rnd() * 4)], x, z, rnd() * 360, {}, 1 + rnd() * 0.4, 0);
    }

    this.scene.add(t.buildGround());
    const water = t.buildWater();
    if (water) this.scene.add(water);
    const baked = bakeStatic(statics, 24);
    this.scene.add(baked.group);
    this.ticks.push(...collectTicks(baked.group));

    const cast: [string, number, number, number, number, Record<string, unknown>?][] = [
      ['npc_rabbit', 1.8, 4.2, 15, 0],
      ['npc_bear', -2.2, 5.4, -20, 0],
      ['npc_cat', 6.6, -3.8, -60, 1.8],
      ['npc_villager', -6, 1.5, 90, 2.2, { v: 0 }],
      ['npc_villager', 3.2, -6.5, 200, 2.2, { v: 2 }],
      ['pet_dog', 0.2, 6.6, 0, 2.5],
    ];
    for (const [key, x, z, rot, wander, opts] of cast) {
      const a = new Actor(key, { x, z, rot, opts });
      if (wander) a.wander = { x, z, r: wander, next: engine.t + 1 + Math.random() * 3, pause: [2, 5] };
      this.scene.add(a.root);
      this.actors.push(a);
    }
    this.actors[0].waving = true;
  }

  update(dt: number, t: number): void {
    if (this.disposed) return;
    this.ang += dt * 0.045;
    const r = 25;
    this.camera.position.set(Math.sin(this.ang) * r, 10.5, Math.cos(this.ang) * r);
    this.camera.lookAt(0, 4.4, 0);
    for (const a of this.actors) a.update(dt, t);
    if (Math.sin(t * 0.5) > 0.6) this.actors[0].waving = true;
    else this.actors[0].waving = false;
    for (const fn of this.ticks) fn(dt, t);
    waterUniforms.uTime.value = t;
  }

  onQuality(q: Quality): void {
    this.lights.setQuality(q);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const a of this.actors) a.dispose();
    this.scene.traverse((o) => {
      if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
    });
    disposeTree(this.scene);
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.scene.clear();
  }
}
