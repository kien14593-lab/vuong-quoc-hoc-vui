import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { lodLevels, type LodReply, type LodRequest } from './lod-core';

/**
 * Luồng phụ rút gọn lưới cho world/lod.ts: nhận dữ liệu đỉnh thô, trả về chỉ mục mọi mức (chuyển giao, không chép),
 * để việc rút gọn nặng không làm giật khung hình trên máy yếu.
 */

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<LodRequest>) => void) | null;
  postMessage(msg: LodReply, transfer?: Transferable[]): void;
};

scope.onmessage = async (e) => {
  const { id } = e.data;
  try {
    if (!MeshoptSimplifier.supported) throw new Error('máy không hỗ trợ WebAssembly');
    await MeshoptSimplifier.ready;
    const { index, levels } = await lodLevels(MeshoptSimplifier, e.data);
    scope.postMessage({ id, index, levels }, [index.buffer]);
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
