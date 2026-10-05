/**
 * Luồng phụ giải mã ảnh trong GLB cho models/glb-image.ts: nhận ảnh nén (Blob), trả về ImageBitmap (chuyển giao,
 * không chép). WebKit giải mã ảnh của createImageBitmap(Blob) ngay trên luồng gọi, nên gọi ở đây thì khung hình
 * trên iPhone/iPad không bị giật.
 */

export interface ImgRequest {
  id: number;
  blob: Blob;
  options: ImageBitmapOptions;
}

/** `fatal`: luồng phụ không giải mã được ảnh nào (đừng gửi thêm). */
export type ImgReply = { id: number; bmp: ImageBitmap } | { id: number; error: string; fatal?: boolean };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ImgRequest>) => void) | null;
  postMessage(msg: ImgReply, transfer?: Transferable[]): void;
};

scope.onmessage = async (e) => {
  const { id, blob, options } = e.data;
  if (typeof createImageBitmap !== 'function') {
    scope.postMessage({ id, error: 'luồng phụ không có createImageBitmap', fatal: true });
    return;
  }
  try {
    const bmp = await createImageBitmap(blob, options);
    scope.postMessage({ id, bmp }, [bmp]);
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
