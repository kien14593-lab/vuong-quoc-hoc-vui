import type { ZoneId } from '../../core/state';
import type { Spawn, Zone } from '../zone';
import { CastleZone } from './castle';
import { ForestZone } from './forest';
import { HouseZone } from './house';
import { MazeZone } from './maze';
import { ParkZone } from './park';
import { VillageZone } from './village';
import { ZooZone } from './zoo';

/**
 * Danh sách khu vực. Mỗi khu vực nằm trong một tệp riêng (`zones/<tên>.ts`) và chỉ cần
 * kế thừa `Zone` + viết `build()`.
 */
const ZONES: Record<ZoneId, new (spawn: Spawn) => Zone> = {
  village: VillageZone,
  house: HouseZone,
  forest: ForestZone,
  maze: MazeZone,
  park: ParkZone,
  zoo: ZooZone,
  castle: CastleZone,
};

/** Dựng một khu vực (đã sẵn sàng để `engine.setStage` + `enter()`). */
export function createZone(id: ZoneId, spawn: Spawn = 'start'): Zone {
  const Z = ZONES[id] ?? VillageZone;
  return new Z(spawn).init();
}
