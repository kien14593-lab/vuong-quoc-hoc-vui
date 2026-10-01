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

export { MINI_ORDER, miniDef, miniList, type MiniDef, type MiniId } from './registry';
export type { MiniHost, MiniInfo, MiniResult } from './base';
export { currentMini, runMini } from './launch';
