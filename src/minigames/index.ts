/** Nạp toàn bộ trò chơi nhỏ (mỗi tệp tự đăng ký). */
import './games/number_match';
import './games/shoot_answer';
import './games/runner';
import './games/maze_run';
import './games/fishing';
import './games/market';
import './games/clock';
import './games/builder';
import './games/pizza';
import './games/train';
import './games/monkey';
import './games/wheel';

import { setMiniMode } from './registry';
import { subject } from '../game/subject';

/** Tên trò chơi hiện theo môn của hồ sơ đang chơi. */
setMiniMode(subject);

export {
  MINI_ORDER, miniCard, miniDef, miniList, miniName, miniShort, miniTitle, unlockLines,
  type MiniCard, type MiniDef, type MiniId, type MiniText,
} from './registry';
export type { MiniHost, MiniInfo, MiniResult } from './base';
export { currentMini, runMini } from './launch';
