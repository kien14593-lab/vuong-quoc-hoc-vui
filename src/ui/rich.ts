import { h } from './dom';

/**
 * Chữ có phần tiếng Anh «…»: phần tiếng Anh hiện đậm, màu xanh (không có dấu «»); phần còn lại giữ nguyên.
 * Chữ không có «» trả về đúng chuỗi ban đầu (câu hỏi Toán hiện y như trước).
 */
export function rich(text: string): string | Node[] {
  if (!text.includes('«')) return text;
  const out: Node[] = [];
  const re = /«([^»]*)»/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    out.push(h('b.en', { lang: 'en' }, m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}
