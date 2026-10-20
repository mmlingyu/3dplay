import { ITEMS } from './game-data.js';
import { CREATION_LIMITS as L, CAPABILITIES, JOINTS, STAMPS, TRUTH_MODES, EDIT_COLORS, EDIT_SHAPES, EDIT_ANCHORS, EDIT_SIZES, partLabel } from './creation-data.js';
import { analyzeLocal, assemblyOrder, attachProblem, capabilityStatus, partTypeCounts, proposalFromLook, resolveColor, validateProposal } from './creation-rules.js';
import { CreationView } from './creation-3d.js';
import { engineStatus, searchAssets, fetchAsset, publishAsset, recognizeSketch, startAnalysis, pollRun } from './engine-client.js';
import { localVisionSupported, recognizeLocalSketch } from './local-vision.js';
import { parseLookText } from './look-text.js';

export const CREATION_TITLES = { idea: '想法画板', lab: '发明实验室' };

const PEN_COLORS = ['#3d4a3f', '#d97a5f', '#5b8fd8', '#8fb26f', '#f0c95c', '#b57b48'];
const QUICK_IDEAS = ['小汽车', '自行车', '风车', '小船', '椅子', '小猫', '小狗', '小鸟'];
const DEG = Math.PI / 180;
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ---------- SVG pictures drawn from the same geometry data as the 3D models ----------

function projectShape(s, [ox, oy, oz]) {
  const [x, y, z] = [s.at[0] + ox, s.at[1] + oy, s.at[2] + oz];
  const axis = s.axis || 'y';
  const sc = s.scale || [1, 1, 1];
  const fill = resolveColor(s.color);
  if (s.shape === 'box') return { kind: 'rect', x, y, z, w: s.size[0], h: s.size[1], rot: s.rot?.[2] || 0, fill };
  if (s.shape === 'sphere') return { kind: 'ellipse', x, y, z, rx: s.radius * sc[0], ry: s.radius * sc[1], fill };
  if (s.shape === 'torus') {
    const outer = s.radius + s.tube;
    if (axis === 'z') return { kind: 'ring', x, y, z, r: s.radius, tube: s.tube, fill };
    return { kind: 'rect', x, y, z, w: axis === 'x' ? s.tube * 2 : outer * 2, h: axis === 'y' ? s.tube * 2 : outer * 2, rot: 0, fill };
  }
  const r = s.radius * Math.max(sc[0], sc[2]), len = s.length * sc[1];
  if (axis === 'z') return { kind: 'ellipse', x, y, z, rx: r, ry: r, fill };
  const w = axis === 'x' ? len : r * 2, h = axis === 'y' ? len : r * 2;
  if (s.shape === 'cone') return { kind: 'cone', x, y, z, w, h, axis, fill };
  return { kind: 'rect', x, y, z, w, h, rot: s.rot?.[2] || 0, fill };
}

function svgPicture(items, size, label) {
  if (!items.length) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const it of items) {
    const hw = it.w ? it.w / 2 : it.rx ?? (it.r + it.tube), hh = it.h ? it.h / 2 : it.ry ?? (it.r + it.tube);
    minX = Math.min(minX, it.x - hw); maxX = Math.max(maxX, it.x + hw);
    minY = Math.min(minY, it.y - hh); maxY = Math.max(maxY, it.y + hh);
  }
  const span = Math.max(maxX - minX, maxY - minY, 0.2) * 1.12;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const f = n => Math.round(n * 1000) / 1000;
  const body = items.sort((a, b) => a.z - b.z).map(it => {
    const x = f(it.x - cx), y = f(cy - it.y), stroke = 'stroke="#3d4a3f" stroke-opacity=".35" stroke-width="' + f(span * .012) + '"';
    if (it.kind === 'rect') return `<rect x="${f(x - it.w / 2)}" y="${f(y - it.h / 2)}" width="${f(it.w)}" height="${f(it.h)}" rx="${f(Math.min(it.w, it.h) * .18)}" fill="${it.fill}" ${stroke}${it.rot ? ` transform="rotate(${f(-it.rot)} ${x} ${y})"` : ''}/>`;
    if (it.kind === 'ellipse') return `<ellipse cx="${x}" cy="${y}" rx="${f(it.rx)}" ry="${f(it.ry)}" fill="${it.fill}" ${stroke}/>`;
    if (it.kind === 'ring') return `<circle cx="${x}" cy="${y}" r="${f(it.r)}" fill="none" stroke="${it.fill}" stroke-width="${f(it.tube * 2)}"/>`;
    const pts = it.axis === 'x' ? [[x - it.w / 2, y - it.h / 2], [x + it.w / 2, y], [x - it.w / 2, y + it.h / 2]] : [[x - it.w / 2, y + it.h / 2], [x, y - it.h / 2], [x + it.w / 2, y + it.h / 2]];
    return `<polygon points="${pts.map(p => p.map(f).join(',')).join(' ')}" fill="${it.fill}" ${stroke}/>`;
  }).join('');
  return `<svg class="creation-thumb" viewBox="${f(-span / 2)} ${f(-span / 2)} ${f(span)} ${f(span)}" width="${size}" height="${size}" role="img" aria-label="${label}">${body}</svg>`;
}

export function partThumb(type, size = 40) {
  return svgPicture(type.geometry.map(s => projectShape(s, [0, 0, 0])), size, type.name);
}

export function figureThumb(figure, size = 56) {
  const items = [], pivots = new Map();
  for (const part of figure.parts) {
    const base = part.parent ? pivots.get(part.parent) : [0, 0, 0];
    const at = part.pivot.map((v, i) => v + base[i]);
    pivots.set(part.id, at);
    for (const s of part.shapes) items.push(projectShape(s, at));
  }
  return svgPicture(items, size, figure.name);
}

function blueprintThumb(bp, catalog, size = 56) {
  const items = [];
  for (const slot of bp.parts) {
    const quarter = ((slot.rotY || 0) / 90) % 2 === 1;
    for (const s of catalog.get(slot.typeId).geometry) {
      const shape = quarter && s.shape === 'box' ? { ...s, size: [s.size[2], s.size[1], s.size[0]] } : s;
      items.push(projectShape(shape, slot.at));
    }
  }
  return svgPicture(items, size, bp.name);
}

// ---------- studio ----------

export function createCreationStudio({ game, svg, button, escapeHTML, notify, speak, toast, open, onPlaceFigure }) {
  const say = text => { try { speak(text); } catch { /* speech is optional */ } };
  const blankIdea = () => ({ draftId: null, title: '', text: '', strokes: [], stamps: [], history: [], analysis: null, tool: 'pen' });
  const idea = { ...blankIdea(), color: PEN_COLORS[0], width: 6 };
  const lab = { bpId: null, figId: null, tab: 'blueprint', explode: false, feedback: '', lastExperiment: null, piece: { shape: 'sphere', anchor: 'body', size: 'medium', color: EDIT_COLORS[0] } };
  let root = null, mounted = null, view = null, drawing = null, abort = null, engineInfo = null, runAbort = null, shelf = [];

  const c = () => game.state.creation;
  const visionMode = () => c().settings.vision === 'cloud' ? 'cloud' : 'local';
  const catalog = () => game.creationCatalog();
  const nameOfItem = id => ITEMS[id]?.name || id;
  const asmOf = bpId => c().assemblies.find(a => a.blueprintId === bpId) || null;
  const filledOf = bpId => { const asm = asmOf(bpId); return asm ? game.filledSlots(asm.id) : new Set(); };

  // ----- idea board -----

  function ideaBody() {
    const drafts = c().drafts;
    return `<div class="idea-layout">
      <section class="idea-form">
        <label class="idea-field"><strong>① 我想造</strong><input id="idea-title" maxlength="${L.titleLength}" placeholder="比如：小汽车、小猫" value="${escapeHTML(idea.title)}"></label>
        <div class="idea-quick" role="group" aria-label="快速选一个">${QUICK_IDEAS.map(q => button('idea-quick', q, { className: 'chip-btn', data: { text: q } })).join('')}</div>
        <label class="idea-field"><strong>想法（可以不写）</strong><textarea id="idea-text" maxlength="${L.ideaLength}" rows="2" placeholder="它用来做什么？有几个轮子？">${escapeHTML(idea.text)}</textarea></label>
        ${drafts.length ? `<details class="panel-details"><summary>我的草稿 ${drafts.length}</summary><div class="idea-drafts">${drafts.map(d => button('idea-load', escapeHTML(d.title || d.idea || d.id), { className: `chip-btn${d.id === idea.draftId ? ' selected' : ''}`, data: { id: d.id } })).join('')}${button('idea-new', '＋ 新的一张', { className: 'chip-btn' })}</div></details>` : ''}
      </section>
      <section class="idea-board">
        <strong>② 画出来</strong>
        <div class="idea-tools" role="group" aria-label="画笔">
          ${PEN_COLORS.map(col => button('idea-color', '', { className: `swatch${idea.tool === 'pen' && idea.color === col ? ' selected' : ''}`, data: { color: col }, label: '换颜色' }).replace('<button', `<button style="--swatch:${col}"`)).join('')}
          ${button('idea-width', idea.width > 6 ? '粗笔' : '细笔', { className: 'chip-btn' })}
          ${button('idea-undo', '撤销', { className: 'chip-btn', disabled: !idea.strokes.length && !idea.stamps.length })}
          ${button('idea-clear', '清空', { className: 'chip-btn', disabled: !idea.strokes.length && !idea.stamps.length })}
        </div>
        <div class="idea-stamps" role="group" aria-label="部件贴纸">${Object.entries(STAMPS).map(([id, s]) => button('idea-stamp', `${partThumb(catalog().get(s.partType), 26)}<span>${s.label}</span>`, { className: `stamp-btn${idea.tool === id ? ' selected' : ''}`, data: { stamp: id } })).join('')}</div>
        <canvas id="idea-canvas" aria-label="画板。用手指或鼠标画；选了贴纸后点一下就贴上。"></canvas>
        <small>贴纸能帮系统认出部件；也可以只画画。</small>
      </section>
      <div class="idea-actions">
        <div class="idea-vision" role="group" aria-label="看图用哪个模型">${button('idea-vision', '本机 SmolVLM 256', { className: `chip-btn${visionMode() === 'local' ? ' selected' : ''}`, data: { mode: 'local' } })}${button('idea-vision', '在线图像模型', { className: `chip-btn${visionMode() === 'cloud' ? ' selected' : ''}`, data: { mode: 'cloud' } })}</div>
        ${button('idea-analyze', '③ 让系统看看', { className: 'primary-btn' })}
      </div>
      <section class="creation-dynamic idea-result" aria-live="polite">${analysisView()}</section>
    </div>`;
  }

  function proposalCard(proposal, sourceKey, heading) {
    const cat = catalog();
    if (proposal.kind === 'figure') {
      return `<article class="proposal-card"><header>${figureThumb(proposal.figure, 72)}<div><h4>${escapeHTML(heading)}</h4><p>${escapeHTML(proposal.summary)}</p></div></header>
        <p class="proposal-route">这是<strong>造物</strong>：直接捏出模型，放进背包，再摆到河谷里。</p>
        <p class="proposal-parts">${proposal.figure.parts.map(p => escapeHTML(p.id)).join(' · ')}</p>
        ${notesView(proposal.notes)}
        ${button('idea-adopt', '做出来，放进背包', { className: 'primary-btn', data: { source: sourceKey } })}</article>`;
    }
    if (proposal.kind !== 'assembly' || !proposal.blueprint) {
      return `<article class="proposal-card"><h4>${escapeHTML(heading)}</h4><p>${escapeHTML(proposal.summary)}</p>${(proposal.recognized || []).length ? `<p>认出了：${proposal.recognized.map(r => `${escapeHTML(r.label)}×${r.count}`).join('、')}</p>` : ''}${(proposal.questions || []).map(q => `<p class="panel-note">${escapeHTML(q)}</p>`).join('')}</article>`;
    }
    const core = new Map(proposal.coreAdditions.map(a => [a.slot, a.reason]));
    const coreTypes = [...new Set(proposal.blueprint.parts.filter(p => core.has(p.id)).map(p => p.typeId))];
    return `<article class="proposal-card"><header>${blueprintThumb(proposal.blueprint, cat, 72)}<div><h4>${escapeHTML(heading)}</h4><p>${escapeHTML(proposal.summary)}</p></div></header>
      <p class="proposal-route">这是<strong>机器</strong>：拆成部件 → 采材料 → 做部件 → 拼装 → 实验。</p>
      <ul class="proposal-recognized">${proposal.recognized.map(r => `<li>${partThumb(cat.get(r.partTypeId), 30)}<span>${escapeHTML(r.label)} ×${r.count}</span><small>${r.from === 'sketch' ? '你画的' : r.from === 'idea' ? '你写的' : '真实的也需要'}</small></li>`).join('')}</ul>
      ${coreTypes.length ? `<div class="proposal-core"><strong>AI 补充的核心部件</strong>${coreTypes.map(t => `<p>${partThumb(cat.get(t), 22)}<b>${escapeHTML(cat.get(t).name)}</b>：${escapeHTML(proposal.coreAdditions.find(a => proposal.blueprint.parts.find(p => p.id === a.slot)?.typeId === t).reason)}</p>`).join('')}</div>` : ''}
      ${proposal.newPartTypes.length ? `<div class="proposal-core"><strong>新部件候选</strong>${proposal.newPartTypes.map(t => `<p>${partThumb(t, 22)}<b>${escapeHTML(t.name)}</b>：${escapeHTML(t.realNote || '')}</p>`).join('')}</div>` : ''}
      ${notesView(proposal.notes)}
      ${button('idea-adopt', '用这张图纸，去实验室', { className: 'primary-btn', data: { source: sourceKey } })}</article>`;
  }

  function notesView(notes = []) {
    if (!notes.length) return '';
    return `<details class="panel-details"><summary>哪些是真的，哪些是游戏简化</summary>${notes.map(n => `<p><span class="truth-tag truth-${n.mode}">${TRUTH_MODES[n.mode]}</span>${escapeHTML(n.text)}</p>`).join('')}</details>`;
  }

  function analysisView() {
    const a = idea.analysis;
    if (!a) return `<p class="panel-note">写下名字、画一画，再点“让系统看看”。也可以直接用下面大家已经做好的。</p>${sharedShelf(shelf, shelf.length ? `大家共用的发明 ${shelf.length} 个` : '')}`;
    const engine = a.engine;
    const engineLine = !c().settings.engine ? '<p class="panel-note">家长关掉了发明家小屋，现在只用本机分析。</p>'
      : engine.status === 'offline' ? `<p class="panel-note">${escapeHTML((engine.message || '发明家小屋现在没有连上').replace(/[。！]?$/, '。'))}${a.local?.kind === 'figure' || a.local?.blueprint ? '上面的模型现在就能用。' : '先用本机的方案。'}</p>`
      : engine.status === 'working' ? `<p class="panel-note engine-working"><span class="spinner" aria-hidden="true"></span>${escapeHTML(engine.message || '发明家小屋正在看你的画…')}</p>`
      : engine.status === 'failed' ? `<p class="panel-note warning">${escapeHTML((engine.message || '发明家小屋这次没想出来').replace(/[。！]?$/, '。'))}先用本机的方案。</p>` : '';
    const engineHeading = engine.via === 'vision' ? '图像模型看出' : engine.via === 'local-vision' ? '本机小模型看出' : '发明家小屋补充';
    const localNote = engine.via === 'local-vision' ? '<p class="panel-note">这是浏览器里的 SmolVLM 256，画没有上传。要看得更全，可改选上面的「在线图像模型」。</p>' : '';
    return `${a.local ? proposalCard(a.local, 'local', '马上看到 · 本机分析') : ''}${engineLine}${engine.proposal ? proposalCard(engine.proposal, 'engine', engineHeading) : ''}${localNote}${a.asset ? proposalCard(a.asset.proposal, 'asset', `共享资产 · ${a.asset.title}`) : ''}${sharedShelf(a.shared, a.shared?.length ? `别的小朋友做过 ${a.shared.length} 个` : '')}`;
  }

  function sharedShelf(list, heading) {
    if (!list?.length) return '';
    return `<details class="panel-details" open><summary>${escapeHTML(heading)}</summary><p class="panel-note">点一下就能用。这些是大家共用的，存在服务器上，刷新也不会丢。</p><div class="shared-assets">${list.map(s => button('idea-shared', `<strong>${escapeHTML(s.title)}</strong><small>${s.kind === 'figure' ? '造物' : '机器'} · 用过 ${s.uses || 0} 次</small>`, { className: 'chip-btn', data: { id: s.id } })).join('')}</div></details>`;
  }

  function stampPath(ctx, type, x, y, s) {
    ctx.lineWidth = s * .14; ctx.strokeStyle = '#3d4a3f'; ctx.fillStyle = '#dda66e';
    ctx.beginPath();
    if (type === 'wheel') { ctx.arc(x, y, s * .45, 0, Math.PI * 2); ctx.fillStyle = '#485c52'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, s * .15, 0, Math.PI * 2); ctx.fillStyle = '#f0e2c0'; }
    else if (type === 'bar') { ctx.rect(x - s * .55, y - s * .06, s * 1.1, s * .12); ctx.fillStyle = '#73847b'; }
    else if (type === 'board') ctx.rect(x - s * .6, y - s * .18, s * 1.2, s * .36);
    else if (type === 'seat') { ctx.rect(x - s * .35, y - s * .12, s * .7, s * .24); ctx.rect(x - s * .05, y, s * .1, s * .4); }
    else if (type === 'handle') { ctx.rect(x - s * .45, y - s * .3, s * .9, s * .1); ctx.rect(x - s * .05, y - s * .3, s * .1, s * .7); ctx.fillStyle = '#73847b'; }
    else if (type === 'blade') { for (let i = 0; i < 4; i++) { const t = i * Math.PI / 2; ctx.moveTo(x, y); ctx.ellipse(x + Math.cos(t) * s * .3, y + Math.sin(t) * s * .3, s * .3, s * .1, t, 0, Math.PI * 2); } }
    else if (type === 'hull') { ctx.moveTo(x - s * .6, y - s * .1); ctx.lineTo(x + s * .6, y - s * .1); ctx.quadraticCurveTo(x + s * .4, y + s * .35, x, y + s * .35); ctx.quadraticCurveTo(x - s * .4, y + s * .35, x - s * .6, y - s * .1); }
    ctx.fill(); ctx.stroke();
  }

  function paint(canvas, scale = 1) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of idea.strokes) {
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w * scale;
      ctx.beginPath();
      s.p.forEach(([x, y], i) => i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h));
      if (s.p.length === 1) ctx.lineTo(s.p[0][0] * w + .1, s.p[0][1] * h);
      ctx.stroke();
    }
    for (const st of idea.stamps) stampPath(ctx, st.type, st.x * w, st.y * h, Math.min(w, h) * .16);
  }

  function sketchDataUrl() {
    if (!idea.strokes.length && !idea.stamps.length) return null;
    const out = document.createElement('canvas');
    out.width = 512; out.height = 384;
    paint(out, 512 / Math.max(1, drawing?.canvas.width || 512));
    return out.toDataURL('image/png');
  }

  function mountIdea() {
    const canvas = root.querySelector('#idea-canvas');
    if (!canvas) return;
    const signal = abort.signal;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      canvas.width = Math.round(rect.width * Math.min(devicePixelRatio || 1, 2));
      canvas.height = Math.round(canvas.width * .66);
      paint(canvas, canvas.width / rect.width);
    };
    drawing = { canvas, stroke: null, resize };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    signal.addEventListener('abort', () => observer.disconnect());
    const point = event => { const r = canvas.getBoundingClientRect(); return [Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (event.clientY - r.top) / r.height))]; };
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drawing.stroke) return;
      event.preventDefault();
      const [x, y] = point(event);
      if (idea.tool !== 'pen') {
        if (idea.stamps.length >= L.stamps) { toast(`最多贴 ${L.stamps} 个贴纸。`); return; }
        idea.stamps.push({ type: idea.tool, x, y });
        idea.history.push('stamp');
        say(`贴了一个${STAMPS[idea.tool].label}。`);
        resize(); refreshTools(); return;
      }
      if (idea.strokes.length >= L.strokes) { toast('画板画满啦，可以撤销几笔。'); return; }
      canvas.setPointerCapture(event.pointerId);
      drawing.stroke = { id: event.pointerId, s: { c: idea.color, w: idea.width, p: [[x, y]] } };
      idea.strokes.push(drawing.stroke.s);
      idea.history.push('stroke');
      resize();
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      const st = drawing.stroke;
      if (!st || st.id !== event.pointerId) return;
      const [x, y] = point(event), last = st.s.p.at(-1);
      if (Math.hypot(x - last[0], y - last[1]) < .006 || st.s.p.length >= L.pointsPerStroke) return;
      st.s.p.push([x, y]);
      const ctx = canvas.getContext('2d'), scale = canvas.width / canvas.getBoundingClientRect().width;
      ctx.strokeStyle = st.s.c; ctx.lineWidth = st.s.w * scale; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(last[0] * canvas.width, last[1] * canvas.height); ctx.lineTo(x * canvas.width, y * canvas.height); ctx.stroke();
    }, { signal });
    const end = event => { if (drawing.stroke?.id === event.pointerId) { drawing.stroke = null; refreshTools(); } };
    canvas.addEventListener('pointerup', end, { signal });
    canvas.addEventListener('pointercancel', end, { signal });
    root.querySelector('#idea-title')?.addEventListener('input', e => { idea.title = e.target.value; }, { signal });
    root.querySelector('#idea-text')?.addEventListener('input', e => { idea.text = e.target.value; }, { signal });
    resize();
  }

  function refreshTools() {
    const tools = root?.querySelector('.idea-tools');
    if (!tools) return;
    for (const action of ['idea-undo', 'idea-clear']) tools.querySelector(`[data-action="${action}"]`).disabled = !idea.strokes.length && !idea.stamps.length;
    tools.querySelectorAll('[data-action="idea-color"]').forEach(b => b.classList.toggle('selected', idea.tool === 'pen' && b.dataset.color === idea.color));
    tools.querySelector('[data-action="idea-width"]').textContent = idea.width > 6 ? '粗笔' : '细笔';
    root.querySelectorAll('[data-action="idea-stamp"]').forEach(b => b.classList.toggle('selected', idea.tool === b.dataset.stamp));
  }

  function refreshDynamic() {
    const box = root?.querySelector('.creation-dynamic');
    if (!box) return;
    const scroll = root.querySelector('.panel-body')?.scrollTop;
    box.innerHTML = mounted === 'idea' ? analysisView() : labSide();
    if (scroll !== undefined) root.querySelector('.panel-body').scrollTop = scroll;
  }

  async function analyze() {
    const title = idea.title.trim(), text = idea.text.trim();
    if (!title && !text && !idea.strokes.length && !idea.stamps.length) { toast('先写下想造什么，或者画一画。'); return; }
    const saved = game.saveDraft({ id: idea.draftId, title, idea: text, strokes: idea.strokes, stamps: idea.stamps });
    if (!saved.ok) { notify(saved); return; }
    idea.draftId = saved.id;
    const draft = c().drafts.find(d => d.id === saved.id);
    const local = analyzeLocal(draft);
    idea.analysis = { draftId: draft.id, local, engine: { status: c().settings.engine ? 'working' : 'off' }, shared: [], asset: null };
    say(local.summary);
    refreshDynamic();
    root?.querySelector('.idea-result')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (!c().settings.engine) return;
    runAbort?.abort();
    runAbort = new AbortController();
    const analysis = idea.analysis, signal = runAbort.signal;
    engineInfo = await engineStatus();
    document.dispatchEvent(new CustomEvent('valley-account'));
    if (signal.aborted) return;
    const sketch = sketchDataUrl();
    const useLook = (look, via) => {
      const checked = validateProposal(proposalFromLook(draft, look), { customTypes: c().partTypes });
      if (!checked.ok) throw new Error(checked.errors[0]);
      analysis.engine = { status: 'done', via, proposal: checked.proposal };
      say(checked.proposal.summary);
    };
    const mode = visionMode();
    if (sketch && mode === 'local') {
      if (!localVisionSupported()) {
        analysis.engine = { status: 'offline', message: '这台浏览器不能跑本机 SmolVLM 256。可以改选「在线图像模型」。' };
        refreshDynamic();
        return;
      }
      analysis.engine = { status: 'working', message: '本机 SmolVLM 256 正在看你的画。画留在这台电脑上，第一次要下载模型。' };
      refreshDynamic();
      try {
        const text = await recognizeLocalSketch(draft, sketch, { signal, onProgress: message => { analysis.engine.message = message; if (mounted === 'idea') refreshDynamic(); } });
        if (signal.aborted) return;
        useLook(parseLookText(text), 'local-vision');
      } catch (error) {
        if (signal.aborted) return;
        analysis.engine = { status: 'failed', message: error.message || '本机小模型这次没看成。' };
      }
      if (mounted === 'idea') refreshDynamic();
      return;
    }
    if (sketch && mode === 'cloud') {
      if (!engineInfo.signedIn || !engineInfo.imageModel) {
        analysis.engine = { status: 'offline', message: !engineInfo.signedIn
          ? '在线图像模型要先登录。也可以改选「本机 SmolVLM 256」。'
          : (engineInfo.reason || '在线图像模型现在没有连上。可以改选「本机 SmolVLM 256」。') };
        refreshDynamic();
        return;
      }
      analysis.engine = { status: 'working', message: '在线图像模型正在看你的画…' };
      refreshDynamic();
      try {
        const look = await recognizeSketch(draft, sketch);
        if (signal.aborted) return;
        useLook(look, 'vision');
        searchAssets(title || text).then(list => { if (!signal.aborted && idea.analysis) { idea.analysis.shared = list.slice(0, 6); refreshDynamic(); } });
      } catch (error) {
        if (signal.aborted) return;
        analysis.engine = { status: 'failed', message: error.message };
      }
      if (mounted === 'idea') refreshDynamic();
      return;
    }
    if (!engineInfo.signedIn) {
      analysis.engine = { status: 'offline', message: engineInfo.available === false
        ? (engineInfo.reason || '发明家小屋现在没有连上。')
        : '图像模型还不能看这张画。先点右上角「登录」，用和游戏相同的网址登好，再点一次。' };
      refreshDynamic();
      return;
    }
    searchAssets(title || text).then(list => { if (!signal.aborted) { analysis.shared = list.slice(0, 6); refreshDynamic(); } });
    if (!engineInfo.available) {
      analysis.engine = { status: 'offline', message: engineInfo.reason || '发明家小屋现在没有连上。' };
      refreshDynamic();
      return;
    }
    try {
      const run = await startAnalysis(draft, sketch, local);
      if (signal.aborted) return;
      game.setDraftEngineRun(draft.id, run.runId);
      const done = await pollRun(run.runId, c().partTypes, { signal, onUpdate: r => { analysis.engine.message = r.progress || ''; if (mounted === 'idea') refreshDynamic(); } });
      analysis.engine = { status: 'done', proposal: done.proposal, assetId: done.assetId || null };
      say('发明家小屋补充好了，看看它加了什么。');
    } catch (error) {
      if (signal.aborted) return;
      analysis.engine = { status: 'failed', message: error.message };
    }
    if (mounted === 'idea') refreshDynamic();
  }

  async function useShared(id) {
    try {
      const asset = await fetchAsset(id, c().partTypes);
      if (!idea.analysis) idea.analysis = { draftId: idea.draftId, local: null, engine: { status: 'off' }, shared: shelf, asset };
      else idea.analysis.asset = asset;
      refreshDynamic();
    } catch (error) { toast(error.message); }
  }

  function adopt(source) {
    const a = idea.analysis;
    const proposal = source === 'engine' ? a?.engine.proposal : source === 'asset' ? a?.asset?.proposal : a?.local;
    if (!proposal) return;
    const assetId = source === 'engine' ? a.engine.assetId : source === 'asset' ? a.asset.id : null;
    const result = game.adoptProposal(proposal, { assetId });
    notify(result);
    if (!result.ok) return;
    if (source === 'local') {
      publishAsset(proposal).then(shared => {
        toast(`已经存进大家共用的资产库：${shared.title}`);
        loadShelf();
      }).catch(() => {});
    }
    lab.feedback = ''; lab.lastExperiment = null;
    if (result.blueprintId) { lab.bpId = result.blueprintId; lab.tab = 'blueprint'; open('lab'); }
    else { lab.figId = result.figureId; lab.tab = 'figures'; open('lab'); }
  }

  function loadShelf(query = '') {
    searchAssets(query).then(list => {
      shelf = list.slice(0, 12);
      if (mounted === 'idea') refreshDynamic();
    }).catch(() => {});
  }

  function loadDraft(id) {
    const d = c().drafts.find(x => x.id === id);
    if (!d) return;
    Object.assign(idea, blankIdea(), { draftId: d.id, title: d.title, text: d.idea, strokes: structuredClone(d.strokes), stamps: structuredClone(d.stamps) });
    idea.history = [...d.strokes.map(() => 'stroke'), ...d.stamps.map(() => 'stamp')];
  }

  // ----- invention lab -----

  function connectionDiagram(bp, cat, filled) {
    const pts = bp.parts.map(p => p.at);
    const spread = i => Math.max(...pts.map(p => p[i])) - Math.min(...pts.map(p => p[i]));
    const top = spread(2) > spread(1) * 1.3;
    const W = 320, H = 200, pad = 30;
    const xs = pts.map(p => p[0]), vs = pts.map(p => top ? p[2] : -p[1]);
    const sx = Math.max(.4, Math.max(...xs) - Math.min(...xs)), sv = Math.max(.4, Math.max(...vs) - Math.min(...vs));
    const k = Math.min((W - pad * 2) / sx, (H - pad * 2) / sv);
    const ox = (W - sx * k) / 2 - Math.min(...xs) * k, ov = (H - sv * k) / 2 - Math.min(...vs) * k;
    const placed = [];
    const pos = new Map(bp.parts.map((p, i) => {
      let x = xs[i] * k + ox, y = vs[i] * k + ov;
      while (placed.some(([a, b]) => Math.hypot(a - x, b - y) < 22)) { x += 14; y += 14; }
      placed.push([x, y]);
      return [p.id, [x, y]];
    }));
    const core = new Set((bp.coreAdditions || []).map(a => a.slot));
    const colors = { fixed: '#8b9c9b', revolute: '#d97a5f', steer: '#5b8fd8', drive: '#e0a33a' };
    const lines = bp.joints.map(j => {
      const [x1, y1] = pos.get(j.a.part), [x2, y2] = pos.get(j.b.part);
      const kind = cat.get(bp.parts.find(p => p.id === j.a.part).typeId).ports.find(p => p.id === j.a.port).joint;
      const live = filled.has(j.a.part) && filled.has(j.b.part);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[kind]}" stroke-width="${live ? 4 : 2.5}" ${live ? '' : 'stroke-dasharray="5 4"'} stroke-linecap="round"/>`;
    }).join('');
    const nodes = bp.parts.map(p => {
      const [x, y] = pos.get(p.id), type = cat.get(p.typeId), on = filled.has(p.id);
      return `<g class="diagram-node${on ? ' filled' : ''}${lab.highlight === p.id ? ' highlight' : ''}" data-action="lab-slot" data-slot="${p.id}" role="button" tabindex="0" aria-label="${escapeHTML(type.name)}，${on ? '已装好，点一下取下' : '还没装，点一下装上'}">
        <circle cx="${x}" cy="${y}" r="13" fill="${on ? resolveColor(type.geometry[0].color) : '#fffaf0'}" stroke="#3d4a3f" stroke-width="1.5" ${on ? '' : 'stroke-dasharray="3 3"'}/>
        ${core.has(p.id) ? `<text x="${x + 9}" y="${y - 9}" class="diagram-ai">AI</text>` : ''}
        <text x="${x}" y="${y + 26}" text-anchor="middle" class="diagram-label">${escapeHTML(type.name)}</text></g>`;
    }).join('');
    const legend = [...new Set(bp.joints.map(j => cat.get(bp.parts.find(p => p.id === j.a.part).typeId).ports.find(p => p.id === j.a.port).joint))]
      .map(kind => `<span><i style="background:${colors[kind]}"></i>${JOINTS[kind].label}</span>`).join('');
    return `<svg class="connection-diagram" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="${top ? '俯视' : '侧视'}连接示意图">${lines}${nodes}</svg><div class="diagram-legend">${legend}<span>${top ? '从上往下看' : '从侧面看'} · 虚线是还没装</span></div>`;
  }

  function labSide() {
    if (lab.tab === 'figures') return figuresSide();
    const bp = game.blueprint(lab.bpId);
    if (!bp) return '<p class="panel-note">图纸夹是空的。先去想法画板画一个想造的东西。</p>';
    const cat = catalog(), filled = filledOf(bp.id), asm = asmOf(bp.id);
    const counts = partTypeCounts(bp), need = game.partsNeeded(bp.id), plan = game.materialPlan(bp.id);
    const installed = {};
    for (const slot of bp.parts) if (filled.has(slot.id)) installed[slot.typeId] = (installed[slot.typeId] || 0) + 1;
    const inBag = id => game.bagParts(id).length;
    const core = new Map((bp.coreAdditions || []).map(a => [bp.parts.find(p => p.id === a.slot)?.typeId, a.reason]));
    const status = capabilityStatus(bp, cat, filled);
    const atWorld = asm?.status === 'world';
    const total = bp.parts.length, done = filled.size;
    const next = assemblyOrder(bp).find(id => !filled.has(id) && !attachProblem(bp, cat, filled, id));
    const nextType = next && cat.get(bp.parts.find(p => p.id === next).typeId);
    const needTotal = Object.values(need).reduce((a, n) => a + n, 0);
    const steps = plan.steps.map(s => {
      const enough = Object.entries(s.inputs).every(([item, n]) => (game.state.inventory[item] || 0) >= n);
      return `<li>${svg(s.item, 22)}<span>${escapeHTML(s.name)}：得到${escapeHTML(nameOfItem(s.output.item))} ${s.batches * s.output.count} 个</span>${button('lab-process', `加工 ${s.batches} 次`, { className: 'chip-btn', data: { recipe: s.recipeId, batches: s.batches }, disabled: !enough })}</li>`;
    }).join('');
    return `<section class="lab-section"><h3>① 部件清单 <small>${total} 个</small></h3>
        <ul class="lab-parts">${Object.entries(counts).map(([id, n]) => {
          const type = cat.get(id);
          return `<li>${partThumb(type, 36)}<div><strong>${escapeHTML(type.name)} ×${n}</strong><small>已装 ${installed[id] || 0} · 背包 ${inBag(id)}${core.has(id) ? ' · <b class="ai-badge">AI 补充</b>' : ''}</small>${core.has(id) ? `<small class="core-reason">${escapeHTML(core.get(id))}</small>` : ''}</div><span class="truth-tag truth-${type.truthMode}">${TRUTH_MODES[type.truthMode]}</span></li>`;
        }).join('')}</ul></section>
      <section class="lab-section"><h3>② 连接示意图</h3>${connectionDiagram(bp, cat, filled)}</section>
      <section class="lab-section"><h3>③ 材料和加工</h3>
        ${needTotal ? `<p>还要做 ${needTotal} 个部件：${Object.entries(need).map(([id, n]) => `${escapeHTML(cat.get(id).name)}×${n}`).join('、')}</p>
        <ul class="lab-materials">${plan.requirements.map(r => `<li class="${r.missing ? 'missing' : 'ok'}">${svg(r.item, 24)}<span>${escapeHTML(r.name)} ${r.available}/${r.required}</span></li>`).join('')}</ul>
        ${steps ? `<p class="lab-subhead">先加工</p><ul class="lab-steps">${steps}</ul>` : ''}
        ${plan.gather.length ? `<p class="lab-subhead">去采集</p><ul class="lab-gather">${plan.gather.map(g => `<li>${svg(g.item, 22)}<span>去<b>${escapeHTML(g.place)}</b>采${escapeHTML(g.name)} ×${g.count}</span></li>`).join('')}</ul>` : ''}
        ${plan.status === 'no-valid-source' ? '<p class="panel-note warning">有材料在河谷里还找不到来源。</p>' : ''}
        ${button('lab-craft', `制作全部部件（${needTotal} 个）`, { className: 'primary-btn', disabled: plan.status !== 'ready' })}`
        : '<p class="panel-note">部件都做好了，可以拼装。</p>'}
      </section>
      <section class="lab-section"><h3>④ 拼装 <small>${done}/${total}</small></h3>
        <div class="lab-progress"><i style="width:${Math.round(done / total * 100)}%"></i></div>
        <p>${atWorld ? '作品还在河谷原来的位置。装上或拆下，改的就是这一件。' : done === total ? '全部装好了！去做实验吧。' : nextType ? `下一步：装上<b>${escapeHTML(nextType.name)}</b>。点三维图里的虚影，或连接图里的圆圈。` : '背包里的部件不够，先去上面制作。'}</p>
        <div class="lab-buttons">${button('lab-auto', '一键拼装', { className: 'secondary-btn', disabled: done === total })}${button('lab-disassemble', '全部拆开', { className: 'secondary-btn', disabled: !done })}</div>
      </section>
      <section class="lab-section"><h3>⑤ 实验</h3>
        <div class="lab-buttons">${Object.keys(CAPABILITIES).filter(cap => bp.capabilities.includes(cap) || status[cap].ok).map(cap => button('lab-experiment', CAPABILITIES[cap].label, { className: `chip-btn${status[cap].ok ? '' : ' muted'}`, data: { cap } })).join('')}</div>
        ${lab.lastExperiment ? `<p class="lab-result ${lab.lastExperiment.ok ? 'ok' : 'fail'}" role="status">${escapeHTML(lab.lastExperiment.text)}${lab.lastExperiment.note ? `<small><span class="truth-tag truth-${lab.lastExperiment.truthMode}">${TRUTH_MODES[lab.lastExperiment.truthMode]}</span>${escapeHTML(lab.lastExperiment.note)}</small>` : ''}</p>` : '<p class="panel-note">缺部件时也能试，看看哪里不行。</p>'}
        ${asm?.experiments.length ? `<details class="panel-details"><summary>实验记录 ${asm.experiments.length}</summary>${asm.experiments.map(e => `<p>${e.ok ? '✔' : '✘'} ${escapeHTML(e.text)}</p>`).join('')}</details>` : ''}
      </section>
      <section class="lab-section"><h3>⑥ 实验场</h3>
        <div class="lab-buttons">${atWorld ? button('lab-recall', '送回实验室', { className: 'primary-btn' }) : button('lab-deploy', '送到实验场', { className: 'primary-btn', disabled: done !== total })}
        ${button('lab-delete', '删除图纸', { className: 'secondary-btn', disabled: Boolean(done) })}</div>
        <small>实验场在实验室西边、补给仓库北边。送回来以后可以拆开，部件会回到背包，重新组装不用再花材料。</small>
      </section>`;
  }

  function chipRow(action, options, current, key) {
    return `<div class="lab-buttons" role="group">${Object.entries(options).map(([id, label]) => button(action, label, { className: `chip-btn${current === id ? ' selected' : ''}`, data: { [key]: id } })).join('')}</div>`;
  }

  function figureEditor(fig) {
    if (!fig) return '';
    const piece = lab.piece;
    const rootId = fig.figure.parts[0]?.id;
    return `<section class="lab-section"><h3>在原来的上面改</h3>
      <p>加上一块，或给现有的换颜色。还是「${escapeHTML(fig.figure.name)}」，${fig.placed ? '还在河谷原来的位置。' : '还在背包里。'}不会另做一个。</p>
      <p class="lab-subhead">要加的样子</p>
      ${chipRow('figure-shape', EDIT_SHAPES, piece.shape, 'shape')}
      ${chipRow('figure-anchor', EDIT_ANCHORS, piece.anchor, 'anchor')}
      ${chipRow('figure-size', EDIT_SIZES, piece.size, 'size')}
      <div class="lab-buttons" role="group" aria-label="颜色">${EDIT_COLORS.map(color => button('figure-swatch', `<i class="swatch" style="background:${color}"></i>`, { className: `chip-btn swatch-btn${piece.color === color ? ' selected' : ''}`, data: { color }, label: color })).join('')}</div>
      ${button('figure-add', '加上去', { className: 'primary-btn' })}
      <ul class="figure-edit">${fig.figure.parts.map(part => {
        const blocked = part.id === rootId || fig.figure.parts.some(item => item.parent === part.id);
        return `<li><strong>${partLabel(part.id)}</strong>${button('figure-recolor', '换成这个颜色', { className: 'chip-btn', data: { id: part.id } })}${blocked ? '' : button('figure-remove', '拿掉', { className: 'chip-btn', data: { id: part.id } })}</li>`;
      }).join('')}</ul></section>`;
  }

  function figuresSide() {
    const figs = c().figures;
    if (!figs.length) return '<p class="panel-note">还没有造物。在想法画板写“小猫”画一只试试。</p>';
    const selected = figs.find(f => f.id === lab.figId) || null;
    return `${figureEditor(selected)}<ul class="figure-list">${figs.map(f => `<li class="${f.id === lab.figId ? 'selected' : ''}">${button('lab-figure', `${figureThumb(f.figure, 48)}<span><strong>${escapeHTML(f.figure.name)}</strong><small>${f.placed ? '在河谷里' : '在背包里'}</small></span>`, { className: 'figure-pick', data: { id: f.id } })}
      ${f.placed ? button('figure-recall', '收回背包', { className: 'chip-btn', data: { id: f.id } }) : button('figure-place', '放到河谷', { className: 'primary-btn', data: { id: f.id } })}
      ${f.placed ? '' : button('figure-delete', '删除', { className: 'chip-btn', data: { id: f.id } })}</li>`).join('')}</ul>
      <p class="panel-note">造物是摆件，不会吃东西、长大，也不是真的动物。</p>`;
  }

  function labBody() {
    const bps = c().blueprints, figs = c().figures;
    if (!game.blueprint(lab.bpId)) lab.bpId = bps.at(-1)?.id || null;
    if (!figs.some(f => f.id === lab.figId)) lab.figId = figs.at(-1)?.id || null;
    if (lab.tab === 'blueprint' && !lab.bpId && figs.length) lab.tab = 'figures';
    const cat = catalog();
    const tabs = `<div class="lab-tabs" role="group" aria-label="图纸夹">${bps.map(b => button('lab-select', `${blueprintThumb(b, cat, 30)}<span>${escapeHTML(b.name)}</span>`, { className: `lab-tab${lab.tab === 'blueprint' && b.id === lab.bpId ? ' selected' : ''}`, data: { id: b.id } })).join('')}${figs.length ? button('lab-figures', `<span>造物 ${figs.length}</span>`, { className: `lab-tab${lab.tab === 'figures' ? ' selected' : ''}` }) : ''}${button('lab-idea', '＋ 画新的', { className: 'lab-tab' })}</div>`;
    const empty = !bps.length && !figs.length;
    return `${tabs}${empty ? '<p class="panel-note">图纸夹是空的。先去想法画板写下想造的东西、画出来。</p>' : `<div class="lab-layout">
      <section class="lab-stage"><canvas id="creation-canvas" aria-label="三维拼装台。点虚影装上部件，点装好的部件取下，左右拖动转一转。"></canvas>
        ${lab.tab === 'blueprint' ? `<div class="lab-stage-tools">${button('lab-explode', lab.explode ? '合起来' : '拆开看看', { className: 'chip-btn' })}<span>点虚影装上 · 点部件取下 · 拖动转一转</span></div>` : '<div class="lab-stage-tools"><span>拖动转一转</span></div>'}
        <p id="lab-feedback" class="lab-feedback" role="status">${escapeHTML(lab.feedback)}</p></section>
      <section class="lab-side creation-dynamic">${labSide()}</section></div>`}`;
  }

  function showStage() {
    if (!view) return;
    if (lab.tab === 'figures') {
      const fig = c().figures.find(f => f.id === lab.figId);
      if (fig) view.showFigure(fig.figure);
      return;
    }
    const bp = game.blueprint(lab.bpId);
    if (!bp) return;
    view.showAssembly(bp, catalog(), filledOf(bp.id), { highlight: lab.highlight });
    view.setExplode(lab.explode);
  }

  function mountLab() {
    const canvas = root.querySelector('#creation-canvas');
    if (!canvas) return;
    view = new CreationView(canvas, { onSlot: slotId => toggleSlot(slotId) });
    showStage();
  }

  function setFeedback(text) {
    lab.feedback = text;
    const el = root?.querySelector('#lab-feedback');
    if (el) el.textContent = text;
  }

  function after(result, { stage = true } = {}) {
    setFeedback(result.message || '');
    notify(result);
    if (stage) showStage();
    refreshDynamic();
  }

  function ensureAssembly() {
    const created = game.createAssembly(lab.bpId);
    return created.ok ? created.assemblyId : (notify(created), null);
  }

  function toggleSlot(slotId) {
    const bp = game.blueprint(lab.bpId);
    if (!bp) return;
    const asmId = ensureAssembly();
    if (!asmId) return;
    lab.highlight = slotId;
    const result = game.filledSlots(asmId).has(slotId) ? game.detachSlot(asmId, slotId) : game.attachSlot(asmId, slotId);
    lab.lastExperiment = null;
    after(result);
  }

  function experiment(cap) {
    const asmId = ensureAssembly();
    if (!asmId) return;
    const result = game.experiment(asmId, cap);
    lab.lastExperiment = result;
    say(result.text);
    setFeedback(result.text);
    if (result.ok) { lab.explode = false; view?.setExplode(false); view?.showAssembly(game.blueprint(lab.bpId), catalog(), filledOf(lab.bpId), { lit: cap === 'light' }); view?.play(cap); }
    refreshDynamic();
  }

  // ----- shared hooks for panels.js -----

  function body(type, context = {}) {
    if (type === 'lab') {
      if (context.blueprintId) { lab.bpId = context.blueprintId; lab.tab = 'blueprint'; }
      if (context.figureId) { lab.figId = context.figureId; lab.tab = 'figures'; }
      return labBody();
    }
    return ideaBody();
  }

  function mount(type, panelRoot) {
    unmount();
    root = panelRoot;
    mounted = type;
    abort = new AbortController();
    if (type === 'idea') { mountIdea(); loadShelf(idea.title || idea.text); }
    if (type === 'lab') mountLab();
  }

  function unmount() {
    abort?.abort();
    abort = null;
    view?.dispose();
    view = null;
    drawing = null;
    mounted = null;
  }

  function handle(action, target) {
    const data = target.dataset;
    if (action === 'idea-quick') { idea.title = data.text; const input = root.querySelector('#idea-title'); if (input) input.value = data.text; say(`想造${data.text}。画一画吧！`); return true; }
    if (action === 'idea-color') { idea.color = data.color; idea.tool = 'pen'; refreshTools(); return true; }
    if (action === 'idea-width') { idea.width = idea.width > 6 ? 5 : 12; idea.tool = 'pen'; refreshTools(); return true; }
    if (action === 'idea-stamp') { idea.tool = idea.tool === data.stamp ? 'pen' : data.stamp; say(idea.tool === 'pen' ? '换回画笔。' : `点画板，贴上${STAMPS[data.stamp].label}。`); refreshTools(); return true; }
    if (action === 'idea-undo') { (idea.history.pop() === 'stamp' ? idea.stamps : idea.strokes).pop(); drawing?.resize(); refreshTools(); return true; }
    if (action === 'idea-clear') { idea.strokes = []; idea.stamps = []; idea.history = []; drawing?.resize(); refreshTools(); return true; }
    if (action === 'idea-analyze') { analyze(); return true; }
    if (action === 'idea-vision') { notify(game.setVision(data.mode)); open('idea'); return true; }
    if (action === 'idea-adopt') { adopt(data.source); return true; }
    if (action === 'idea-shared') { useShared(data.id); return true; }
    if (action === 'idea-load') { loadDraft(data.id); open('idea'); return true; }
    if (action === 'idea-new') { Object.assign(idea, blankIdea()); open('idea'); return true; }
    if (action === 'lab-select') { lab.bpId = data.id; lab.tab = 'blueprint'; lab.lastExperiment = null; lab.feedback = ''; open('lab'); return true; }
    if (action === 'lab-figures') { lab.tab = 'figures'; lab.feedback = ''; open('lab'); return true; }
    if (action === 'lab-idea') { open('idea'); return true; }
    if (action === 'lab-slot') { toggleSlot(data.slot); return true; }
    if (action === 'lab-explode') { lab.explode = !lab.explode; view?.setExplode(lab.explode); target.textContent = lab.explode ? '合起来' : '拆开看看'; return true; }
    if (action === 'lab-process') {
      let result = null, made = 0;
      for (let i = 0; i < Number(data.batches || 1); i++) { result = game.processRecipe(data.recipe); if (!result.ok) break; made++; }
      after(made > 1 && result.ok ? { ...result, message: `加工了 ${made} 次。${result.message}` } : result, { stage: false });
      return true;
    }
    if (action === 'lab-craft') { after(game.craftParts(lab.bpId, uid()), { stage: false }); return true; }
    if (action === 'lab-auto') { const id = ensureAssembly(); if (id) after(game.autoAssemble(id)); return true; }
    if (action === 'lab-disassemble') { const asm = asmOf(lab.bpId); if (asm) { lab.lastExperiment = null; after(game.disassemble(asm.id)); } return true; }
    if (action === 'lab-experiment') { experiment(data.cap); return true; }
    if (action === 'lab-deploy') { const asm = asmOf(lab.bpId); if (asm) after(game.deployAssembly(asm.id)); return true; }
    if (action === 'lab-recall') { const asm = asmOf(lab.bpId); if (asm) after(game.recallAssembly(asm.id)); return true; }
    if (action === 'lab-delete') {
      const asm = asmOf(lab.bpId);
      if (asm) { const removed = game.deleteAssembly(asm.id); if (!removed.ok) { notify(removed); return true; } }
      const result = game.deleteBlueprint(lab.bpId);
      notify(result);
      if (result.ok) { lab.bpId = null; open('lab'); }
      return true;
    }
    if (action === 'lab-figure') { lab.figId = data.id; showStage(); refreshDynamic(); return true; }
    if (action === 'figure-shape' || action === 'figure-anchor' || action === 'figure-size' || action === 'figure-swatch') {
      if (data.shape) lab.piece.shape = data.shape;
      if (data.anchor) lab.piece.anchor = data.anchor;
      if (data.size) lab.piece.size = data.size;
      if (data.color) lab.piece.color = data.color;
      refreshDynamic();
      return true;
    }
    if (action === 'figure-add') { after(game.addPiece(lab.figId, lab.piece)); return true; }
    if (action === 'figure-recolor') { after(game.recolorFigurePart(lab.figId, data.id, lab.piece.color)); return true; }
    if (action === 'figure-remove') { after(game.removeFigurePart(lab.figId, data.id)); return true; }
    if (action === 'figure-place') { const result = onPlaceFigure(data.id); notify(result); if (mounted === 'lab') refreshDynamic(); else open('inventory'); return true; }
    if (action === 'figure-recall') { const result = game.recallFigure(data.id); notify(result); if (mounted === 'lab') refreshDynamic(); else open('inventory'); return true; }
    if (action === 'figure-delete') { const result = game.deleteFigure(data.id); notify(result); if (result.ok) open(mounted === 'lab' ? 'lab' : 'inventory'); return true; }
    if (action === 'open-lab') { open('lab', data.id ? { blueprintId: data.id } : {}); return true; }
    if (action === 'creation-engine-toggle') { notify(game.setEngineEnabled(!c().settings.engine)); engineInfo = null; open('pause'); return true; }
    return false;
  }

  function inventorySection() {
    const cat = catalog(), parts = game.bagParts(), figs = c().figures, bps = c().blueprints;
    if (!parts.length && !figs.length && !bps.length) return '';
    const grouped = {};
    for (const p of parts) grouped[p.typeId] = (grouped[p.typeId] || 0) + 1;
    return `<section class="inventory-creations"><h3>我的发明</h3>
      ${Object.keys(grouped).length ? `<div class="creation-bag">${Object.entries(grouped).map(([id, n]) => `<span class="creation-chip">${partThumb(cat.get(id), 34)}<strong>${escapeHTML(cat.get(id).name)}</strong><small>×${n}</small></span>`).join('')}</div>` : ''}
      ${figs.length ? `<div class="creation-bag">${figs.map(f => `<span class="creation-chip">${figureThumb(f.figure, 40)}<strong>${escapeHTML(f.figure.name)}</strong>${f.placed ? button('figure-recall', '收回', { className: 'chip-btn', data: { id: f.id } }) : button('figure-place', '放到河谷', { className: 'chip-btn', data: { id: f.id } })}</span>`).join('')}</div>` : ''}
      ${bps.length ? `<div class="creation-bag">${bps.map(b => button('open-lab', `${blueprintThumb(b, cat, 34)}<strong>${escapeHTML(b.name)}</strong><small>${filledOf(b.id).size}/${b.parts.length}</small>`, { className: 'creation-chip', data: { id: b.id } })).join('')}</div>` : ''}
    </section>`;
  }

  function pauseSection() {
    const on = c().settings.engine;
    return `<details class="panel-details"><summary>给家长：发明家小屋 ${on ? '已开启' : '已关闭'}</summary>
      <p>开启时，点“让系统看看”会把作品名称、想法文字和画板图片发给家里的创作服务，由 AI 补充部件和模型。AI 只给出数据，游戏会逐项检查后才使用，不会运行 AI 写的程序。</p>
      <p>检查通过的模型会存进共享资产库，其他小朋友也能用；共享库只保存模型、部件和名称，不保存画板原图和想法原文。</p>
      <p>关闭后只用本机分析，内置的部件和动物照样能做。看图默认用浏览器里的 SmolVLM 256，画板上可以改成在线图像模型。</p>
      ${button('creation-engine-toggle', on ? '关闭发明家小屋' : '开启发明家小屋', { className: on ? 'secondary-btn' : 'primary-btn' })}</details>`;
  }

  function snapshot() {
    return {
      panel: mounted,
      idea: { draftId: idea.draftId, title: idea.title, strokes: idea.strokes.length, stamps: idea.stamps.length, tool: idea.tool, local: idea.analysis?.local.kind || null, engine: idea.analysis?.engine.status || null },
      lab: { tab: lab.tab, blueprintId: lab.bpId, figureId: lab.figId, filled: lab.bpId ? filledOf(lab.bpId).size : 0, explode: lab.explode, experiment: lab.lastExperiment?.capability || null },
    };
  }

  return { body, mount, unmount, handle, isLive: type => mounted === type, inventorySection, pauseSection, snapshot };
}
