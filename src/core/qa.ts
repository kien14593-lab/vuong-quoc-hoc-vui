/** Chế độ kiểm thử (?qa=1 trên địa chỉ trang): ghi nhật ký giọng đọc vào window.__vqVoiceLog. */
export const QA = typeof location !== 'undefined' && new URLSearchParams(location.search).get('qa') === '1';
