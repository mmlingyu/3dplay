/** GitHub Pages preview has no IdeaLab backend. Set VITE_STATIC_PREVIEW=1 at build time. */

function readStaticPreviewFlag() {
  try {
    return import.meta.env.VITE_STATIC_PREVIEW;
  } catch {
    return undefined;
  }
}

export function staticPreviewEnabled(flag = readStaticPreviewFlag()) {
  return flag === '1' || flag === 1;
}

export function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

/** True for this game's backend paths, including absolute URLs on any host. */
export function isBackendRequest(input, base) {
  const raw = requestUrl(input);
  if (!raw) return false;
  const origin = base || (typeof location !== 'undefined' ? location.href : 'http://localhost/');
  let pathname = '';
  try {
    pathname = new URL(raw, origin).pathname;
  } catch {
    return false;
  }
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/account' || pathname.startsWith('/account/');
}

export function installStaticPreviewFetchGuard(scope = globalThis, enabled = staticPreviewEnabled()) {
  if (!enabled || !scope || typeof scope.fetch !== 'function' || scope.__valleyStaticFetchGuard) return false;
  const native = scope.fetch.bind(scope);
  scope.__valleyStaticFetchGuard = true;
  scope.fetch = (input, init) => {
    const base = scope.location?.href;
    if (isBackendRequest(input, base)) {
      return Promise.resolve(new scope.Response(JSON.stringify({ local: true, offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return native(input, init);
  };
  return true;
}

export function markLocalPlayAccount(doc = typeof document !== 'undefined' ? document : null) {
  if (!staticPreviewEnabled() || !doc) return;
  const chip = doc.getElementById('account-chip');
  const label = doc.getElementById('account-label');
  const dot = doc.getElementById('account-dot');
  if (label) label.textContent = '本地游玩';
  if (chip) {
    chip.classList.add('local-play');
    chip.removeAttribute('href');
    chip.removeAttribute('target');
    chip.removeAttribute('rel');
    delete chip.dataset.signedIn;
    chip.title = '本地游玩，只记在这台浏览器里。';
    chip.setAttribute('aria-disabled', 'true');
  }
  if (dot) dot.style.background = '#84a369';
}

if (typeof window !== 'undefined') installStaticPreviewFetchGuard(window);
