import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../src/game-state.js';

const { isBackendRequest, installStaticPreviewFetchGuard, staticPreviewEnabled } = await import('../src/static-preview.js');

test('static preview flag is on only for 1', () => {
  assert.equal(staticPreviewEnabled(), false);
  assert.equal(staticPreviewEnabled('1'), true);
  assert.equal(staticPreviewEnabled(1), true);
  assert.equal(staticPreviewEnabled('0'), false);
  assert.equal(staticPreviewEnabled('true'), false);
  assert.equal(staticPreviewEnabled(''), false);
  assert.equal(staticPreviewEnabled(undefined), false);
});

test('backend paths cover auth, tutors, valley, creation and account', () => {
  const base = 'https://mmlingyu.github.io/3dplay/';
  const blocked = [
    '/api/auth/me',
    '/api/knowledge/tutors',
    '/api/knowledge/tutors?valley=ri',
    '/api/knowledge/tutors?valley=mei',
    '/api/knowledge/tutors?valley=xing',
    '/api/valley',
    '/api/creation',
    '/api/creation/capabilities',
    '/api/creation/assets?q=ball',
    '/api/creation/runs/abc',
    '/account',
    '/account/',
    '/account/login',
    'https://mmlingyu.github.io/api/auth/me',
    'https://mmlingyu.github.io/account',
    'https://example.test/api/valley',
  ];
  for (const url of blocked) assert.equal(isBackendRequest(url, base), true, url);
  const allowed = [
    '/3dplay/assets/index.js',
    '/3dplay/favicon.svg',
    './npc/moon.svg',
    '/apples',
    '/accounting',
    'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
    '',
  ];
  for (const url of allowed) assert.equal(isBackendRequest(url, base), false, url);
  assert.equal(isBackendRequest(new Request('https://mmlingyu.github.io/api/valley')), true);
});

test('preview guard returns local responses and still loads game files', async () => {
  const seen = [];
  const scope = {
    location: { href: 'https://mmlingyu.github.io/3dplay/' },
    fetch: async (url) => {
      seen.push(String(url));
      return new Response('ok', { status: 200 });
    },
    Response,
  };
  assert.equal(installStaticPreviewFetchGuard(scope, true), true);
  for (const url of ['/api/auth/me', '/api/knowledge/tutors', '/api/valley', '/api/creation/capabilities', 'https://mmlingyu.github.io/account/login']) {
    const response = await scope.fetch(url, { method: 'PUT' });
    assert.equal(response.status, 503, url);
    assert.equal((await response.json()).local, true);
  }
  assert.deepEqual(seen, []);
  const asset = await scope.fetch('/3dplay/assets/index.js');
  assert.equal(asset.status, 200);
  assert.deepEqual(seen, ['/3dplay/assets/index.js']);
  assert.equal(installStaticPreviewFetchGuard(scope, true), false);
  assert.equal(installStaticPreviewFetchGuard({ fetch: async () => new Response(null, { status: 200 }) }, false), false);
});

test('pages workflow sets the preview flag only on the build step', () => {
  const text = readFileSync(new URL('../.github/workflows/preview.yml', import.meta.url), 'utf8');
  assert.match(text, /VITE_BASE: \/3dplay\/\n\s+VITE_STATIC_PREVIEW: "1"/);
  assert.equal(text.split('VITE_STATIC_PREVIEW').length - 1, 1);
});

test('default sources still request auth, tutors, valley and creation', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const { accountSession, engineStatus, searchAssets } = await import('../src/engine-client.js');
    const session = await accountSession();
    assert.equal(session.online, false);
    assert.equal(session.user, null);
    const status = await engineStatus();
    assert.equal(status.available, false);
    assert.deepEqual(await searchAssets('球'), []);
    const { loadTutorPack } = await import('../src/tutor-data.js');
    const he = await loadTutorPack('he');
    assert.ok(Array.isArray(he.characters));
    const ri = await loadTutorPack('ri');
    assert.ok(ri.characters.some((item) => item.id));
    const { startValleySync } = await import('../src/valley-sync.js');
    const game = {
      storage: { getItem() { return null; }, setItem() {} },
      exportSave: () => JSON.stringify(createInitialState()),
      importSave: () => ({ ok: true }),
      subscribe() { return () => {}; },
      save() { return { ok: true }; },
      damagedSaveText: '',
    };
    const sync = startValleySync(game);
    const space = await sync.bind({ id: 'user-preview', name: '小谷' });
    assert.equal(space.source, 'offline');
    const urls = calls.map((item) => item.url);
    assert.ok(urls.includes('/api/auth/me'), urls.join(','));
    assert.ok(urls.some((url) => url.startsWith('/api/knowledge/tutors')), urls.join(','));
    assert.ok(urls.some((url) => url.includes('valley=ri')), urls.join(','));
    assert.ok(urls.includes('/api/valley'), urls.join(','));
    assert.ok(urls.some((url) => url.startsWith('/api/creation/')), urls.join(','));
  } finally {
    globalThis.fetch = original;
  }
});
