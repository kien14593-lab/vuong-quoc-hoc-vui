/** Nạp toàn bộ mô hình (mỗi tệp tự đăng ký vào sổ). */
import './character';
import './nature';
import './buildings';
import './npcs';
import './animals';
import './structures';
import './props';
import './landmarks';
import './furniture';
import './items3d';
import './zone_maze';
import './zone_castle';
// Mô hình tệp GLB (CC0 + AI) thay cho mô hình dựng bằng code cùng khóa – cần `await preloadGlb()` lúc khởi động.
import './glb_ai';

export { buildModel, modelKeys, modelDef, hasModel, collectTicks, modelHeight } from './registry';
export { animateRig, rigOf } from './rig';
export { preloadGlb, setGlbEnabled, glbReport, glbKeys } from './glb';