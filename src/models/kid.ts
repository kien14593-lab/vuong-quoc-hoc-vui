import * as THREE from 'three';
import { isKid, kidKey, playerKey, type Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { compactModel } from '../engine/merge';
import type { V3 } from './autorig';
import { buildAcc, buildBag, buildHat, PLAYER_DEMOS, wear, type PlayerOpts } from './character';
import { glbLoaded, glbSpec, type GlbSockets, type GlbSpec } from './glb';
import { isRawModels, modelDef, overrideModel, type ModelDef } from './registry';
import type { Rig } from './rig';

/**
 * BÉ (NHÂN VẬT CHÍNH) BẰNG MÔ HÌNH AI: khóa 'player' dựng bé trai / bé gái mặc bộ đồ đang chọn
 * (player_trai, player_gai__the_thao... – xem core/outfits.ts) rồi gắn mũ, balo, phụ kiện vào chỗ gắn đồ
 * (đầu, thân) tính từ hình dáng mô hình. Mô hình AI chưa tải xong / lỗi → bé dựng bằng code (character.ts).
 *
 * Đồ đeo vẫn là đồ dựng bằng code của bé cũ (character.ts), được co giãn cho vừa bé AI:
 *  - đồ trên đầu (mũ, kính): hộp đầu bé cũ (rộng 0.94, cằm −0.418 → đỉnh tóc 0.47, gáy −0.47 → mặt 0.44)
 *    khớp vào hộp đầu bé AI (điểm neo head, headR, headTop, faceZ);
 *  - đồ trên thân (balo, nơ, khăn, áo choàng, huy chương): co đều theo cỡ thân, áp vào mặt trước / lưng ngực
 *    hoặc quanh cổ của bé AI.
 * Lệch chút ít thì chỉnh trong cau-hinh.json, mục của bé: "gan-do": { "dau": [x, y, z, to], "than": [...] }.
 */

/** Hộp đầu của bé dựng bằng code (hệ tọa độ đầu, mét). */
const HEAD = { halfW: 0.47, chin: -0.418, top: 0.47, back: -0.47, face: 0.44 };
/** Thân bé dựng bằng code (hệ tọa độ thân, gốc ở hông): ngực ở độ cao 0.33 (bán kính 0.256), cổ ở 0.5. */
const BODY = { chestY: 0.33, chestR: 0.256, neckY: 0.5 };

type Where = 'front' | 'back' | 'neck';
/** Phụ kiện đeo trên thân: áp vào đâu. */
const ACC_AT: Record<string, Where> = { bowtie: 'front', medal: 'front', scarf: 'neck', cape: 'back' };

/** Tinh chỉnh chỗ gắn đồ của từng bé (config.json "dress", từ cau-hinh.json "gan-do"): dịch [x, y, z] (mét) và phóng to. */
type DressTweak = NonNullable<GlbSpec['dress']>;

function tweakOf(key: string): DressTweak {
  return glbSpec(key)?.dress ?? {};
}

function holder(name: string, parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  for (const p of parts) g.add(p);
  return g;
}

/** Đặt nhóm đồ trên đầu (hệ tọa độ đầu bé cũ) vào chỗ gắn đầu của bé AI. */
function fitHead(g: THREE.Group, sk: GlbSockets, tw: DressTweak['head']): void {
  const a = sk.anchors;
  const j = sk.joints.neck;
  const k = tw?.[3] ?? 1;
  const kx = (a.headR[0] / HEAD.halfW) * k;
  const ky = ((a.headTop - (a.head[1] - a.headR[1])) / (HEAD.top - HEAD.chin)) * k;
  const kz = ((a.faceZ - (a.head[2] - a.headR[2])) / (HEAD.face - HEAD.back)) * k;
  // Điểm (0, đỉnh tóc, mặt) của bé cũ trùng (giữa đầu, đỉnh đầu, mặt) của bé AI.
  g.scale.set(kx, ky, kz);
  g.position.set(a.head[0] - j[0] + (tw?.[0] ?? 0), a.headTop - HEAD.top * ky - j[1] + (tw?.[1] ?? 0), a.faceZ - HEAD.face * kz - j[2] + (tw?.[2] ?? 0));
  sk.head.add(g);
}

/** Đặt nhóm đồ trên thân (hệ tọa độ thân bé cũ, gốc ở hông) vào chỗ gắn thân của bé AI. */
function fitBody(g: THREE.Group, sk: GlbSockets, where: Where, tw: DressTweak['body']): void {
  const a = sk.anchors;
  const j = sk.joints.pelvis;
  const s = (((a.neck[1] - j[1]) / BODY.neckY + a.chestHalfW / BODY.chestR) / 2) * (tw?.[3] ?? 1);
  // Điểm tựa trên bé cũ → điểm tương ứng trên bé AI (mặt trước ngực / lưng / cổ).
  let from: V3;
  let to: V3;
  if (where === 'neck') {
    from = [0, BODY.neckY, 0];
    to = a.neck;
  } else {
    const z = where === 'front' ? BODY.chestR : -BODY.chestR;
    from = [0, BODY.chestY, z];
    to = [j[0], a.chestY, where === 'front' ? a.chestFrontZ : a.chestBackZ];
  }
  g.scale.setScalar(s);
  g.position.set(to[0] - from[0] * s - j[0] + (tw?.[0] ?? 0), to[1] - from[1] * s - j[1] + (tw?.[1] ?? 0), to[2] - from[2] * s - j[2] + (tw?.[2] ?? 0));
  sk.body.add(g);
}

/** Gắn mũ, balo, phụ kiện lên bé AI. Trả về false khi mô hình không có chỗ gắn đồ. */
function dress(root: THREE.Object3D, key: string, eq: Partial<Equipped>): boolean {
  const sk = root.userData.sockets as GlbSockets | undefined;
  if (!sk) return false;
  const rig = root.userData.rig as Rig;
  const tw = tweakOf(key);
  const groups: THREE.Group[] = [];
  const head = (name: string, parts: THREE.Object3D[]) => {
    if (!parts.length) return;
    const g = holder(name, parts);
    fitHead(g, sk, tw.head);
    groups.push(g);
  };
  const body = (name: string, parts: THREE.Object3D[], where: Where) => {
    if (!parts.length) return;
    const g = holder(name, parts);
    fitBody(g, sk, where, tw.body);
    groups.push(g);
  };
  const hat = wear(eq.hat);
  if (hat) head('wearHat', buildHat(hat));
  const bag = wear(eq.backpack);
  if (bag) {
    const parts = buildBag(bag);
    // Dây đeo nằm trước ngực, cặp nằm sau lưng.
    body('wearStraps', parts.filter((p) => p.position.z > 0), 'front');
    body('wearBag', parts.filter((p) => p.position.z <= 0), 'back');
  }
  const acc = wear(eq.acc);
  if (acc) {
    const hg = new THREE.Group();
    const bg = new THREE.Group();
    buildAcc(acc, hg, bg, rig);
    head('wearAccHead', [...hg.children]);
    body('wearAcc', [...bg.children], ACC_AT[acc.style] ?? 'front');
  }
  for (const g of groups) {
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = false;
    });
    if (!isRawModels()) compactModel(g);
  }
  return true;
}

/** Bé nào, mặc gì (tùy chọn dựng; thiếu thì lấy mẫu xem thử thứ i). */
function resolve(o: PlayerOpts): { kid: Kid; eq: Partial<Equipped> } {
  const d = PLAYER_DEMOS[(o.i ?? 0) % PLAYER_DEMOS.length];
  return { kid: isKid(o.kid) ? o.kid : d.kid, eq: o.eq ?? d.eq };
}

/** Khóa mô hình AI sẽ dùng để vẽ bé lúc này (đã tải xong); null = dùng bé dựng bằng code. */
export function kidModelKey(o: PlayerOpts = {}): string | null {
  const { kid, eq } = resolve(o);
  for (const k of [playerKey(kid, eq.outfit), kidKey(kid)]) if (glbLoaded(k)) return k;
  return null;
}

overrideModel('player', (base: ModelDef<PlayerOpts> | undefined) => ({
  ...base,
  build: (o: PlayerOpts = {}) => {
    const { kid, eq } = resolve(o);
    const key = kidModelKey(o);
    const def = key ? modelDef(key) : undefined;
    if (key && def) {
      const root = def.build({});
      if (!root.userData.missing) {
        if (!dress(root, key, eq) && (eq.hat || eq.backpack || eq.acc)) console.warn(`[bé] ${key}: không có chỗ gắn đồ – không đeo được mũ, balo, phụ kiện`);
        root.userData.kid = kid;
        root.userData.modelKey = key;
        return root;
      }
    }
    if (!base) throw new Error('thiếu mô hình bé dựng bằng code');
    const root = base.build({ ...o, kid, eq });
    root.userData.kid = kid;
    return root;
  },
  height: (o: PlayerOpts = {}) => {
    const key = kidModelKey(o);
    const h = key ? modelDef(key)?.height : undefined;
    if (typeof h === 'function') return h({});
    if (typeof h === 'number') return h;
    return typeof base?.height === 'function' ? base.height(o) : base?.height ?? 1.8;
  },
  desc: 'Bé (nhân vật chính): bé trai / bé gái mô hình AI, mặc bộ đồ đang chọn',
}));
