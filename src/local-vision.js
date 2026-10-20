export function localVisionSupported() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

let worker = null;
let requestId = 0;
let pending = null;

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./local-vision.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = event => pending?.(event.data || {});
  worker.onerror = event => pending?.({ status: 'error', data: event.message || '本机小模型没有启动。' });
  return worker;
}

export function recognizeLocalSketch(draft, dataUrl, { onProgress = () => {}, signal } = {}) {
  if (!localVisionSupported()) return Promise.reject(new Error('这台浏览器不能在本地看图。'));
  const id = ++requestId;
  const current = ensureWorker();
  return new Promise((resolve, reject) => {
    const finish = (error, value) => {
      signal?.removeEventListener('abort', onAbort);
      if (id !== requestId) return;
      pending = null;
      if (error) reject(error);
      else resolve(value);
    };
    const onAbort = () => {
      current.postMessage({ type: 'interrupt' });
      finish(new Error('已取消。'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    pending = message => {
      if (id !== requestId) return;
      if (message.status === 'progress' || message.status === 'initiate' || message.status === 'download') {
        const pct = Number.isFinite(message.progress) ? ` ${Math.round(message.progress)}%` : '';
        onProgress(`本机小模型正在准备${pct}。第一次要下载，画不会上传。`);
      } else if (message.status === 'update' || message.status === 'start') {
        onProgress('本机小模型正在看你的画。画留在这台电脑上。');
      } else if (message.status === 'complete') {
        finish(null, message.output || '');
      } else if (message.status === 'error') {
        finish(new Error(message.data || '本机小模型这次没看成。'));
      }
    };
    current.postMessage({
      type: 'generate',
      data: { image: dataUrl, title: draft.title || '', idea: draft.idea || '' },
    });
  });
}
