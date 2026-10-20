import { CATALOG_VERSION } from './creation-data.js';
import { validateProposal } from './creation-rules.js';

const BASE = (typeof window !== 'undefined' && window.CREATION_ENGINE_URL) || '/api/creation';
const POLL_MS = 2500;
const MAX_WAIT_MS = 6 * 60 * 1000;

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...options });
  if (!response.ok) {
    const detail = await response.json().then(body => body?.detail).catch(() => '');
    throw new Error(typeof detail === 'string' && detail ? detail : `发明家小屋暂时连不上（${response.status}）`);
  }
  return response.json();
}

export async function engineStatus() {
  try { return await request('/capabilities'); }
  catch { return { available: false }; }
}

export async function accountSession() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (response.ok) return { online: true, user: (await response.json()).user || null };
    if (response.status === 401 || response.status === 403) return { online: true, user: null };
    return { online: false, user: null };
  } catch {
    return { online: false, user: null };
  }
}

export async function currentUser() {
  return (await accountSession()).user;
}

// Shared library: assets other children already made and the server validated.
export async function searchAssets(query) {
  try { return (await request(`/assets?q=${encodeURIComponent(query || '')}`)).assets || []; }
  catch { return []; }
}

export async function fetchAsset(id, customTypes) {
  const asset = await request(`/assets/${encodeURIComponent(id)}`);
  const checked = validateProposal(asset.proposal, { customTypes });
  if (!checked.ok) throw new Error(`共享资产没有通过检查：${checked.errors[0]}`);
  return { ...asset, proposal: checked.proposal };
}

export async function publishAsset(proposal, extra = {}) {
  return request('/assets', {
    method: 'POST',
    body: JSON.stringify({
      proposal,
      title: extra.title || proposal.title || '',
      keywords: extra.keywords || [proposal.title, proposal.templateId].filter(Boolean),
    }),
  });
}

export async function recognizeSketch(draft, sketchDataUrl) {
  return request('/recognize', {
    method: 'POST',
    body: JSON.stringify({ title: draft.title, idea: draft.idea, sketch: sketchDataUrl }),
  });
}

export async function startAnalysis(draft, sketchDataUrl, local) {
  return request('/analyze', {
    method: 'POST',
    body: JSON.stringify({
      catalogVersion: CATALOG_VERSION,
      draft: { title: draft.title, idea: draft.idea, stamps: draft.stamps },
      sketch: sketchDataUrl,
      local: { kind: local.kind, templateId: local.templateId || null },
    }),
  });
}

export async function pollRun(runId, customTypes, { onUpdate = () => {}, signal } = {}) {
  const started = Date.now();
  while (!signal?.aborted) {
    const run = await request(`/runs/${encodeURIComponent(runId)}`);
    onUpdate(run);
    if (run.status === 'done') {
      const checked = validateProposal(run.proposal, { customTypes });
      if (!checked.ok) throw new Error(`方案没有通过检查：${checked.errors[0]}`);
      return { ...run, proposal: checked.proposal };
    }
    if (run.status === 'failed') throw new Error(run.error || '发明家小屋这次没想出来。');
    if (Date.now() - started > MAX_WAIT_MS) throw new Error('发明家小屋想得太久了，先用本机方案。');
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  throw new Error('已取消。');
}
