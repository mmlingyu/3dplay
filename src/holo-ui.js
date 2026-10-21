/** Star-net panels. HTML only: no 3D text. */

import { countWord } from './voice-lines.js';
import {
  GLOW_COLORS,
  HOLO_PADS,
  VISORS,
  arenaPlan,
  domePlan,
  dotMarks,
  glowName,
  gradeStage,
  growthPair,
  holoAge,
  makeStage,
  tierCap,
  tierLabel,
} from './holo-data.js';
import { ARENA_SPEAK, DOME_HOME, DOME_SPEAK, FESTIVAL_LINE, SHIP_LINE } from './xing-data.js';

const SEED = 'xing-1';

function padById(id) {
  return HOLO_PADS.find((pad) => pad.id === id) || HOLO_PADS[0];
}

function echoPoints(pad, stage, attempt) {
  const y = Math.round((pad.y + 0.2) * 10) / 10;
  if (stage.kind === 'path' && Array.isArray(attempt)) {
    return attempt.slice(0, 120).map((cell) => {
      const [x, z] = String(cell).split(',').map(Number);
      return {
        x: Math.round((pad.x + ((x || 0) - 4) * 0.35) * 10) / 10,
        y,
        z: Math.round((pad.z + ((z || 0) - 4) * 0.35) * 10) / 10,
      };
    });
  }
  const steps = Math.max(2, Array.isArray(attempt) ? attempt.length : 2);
  return Array.from({ length: Math.min(120, steps) }, (_, index) => ({
    x: Math.round((pad.x + Math.sin(index) * 0.4) * 10) / 10,
    y,
    z: Math.round((pad.z + index * 0.15) * 10) / 10,
  }));
}

export function mountHoloUi({ game, speak, toast, world, band, onPaint, tour }) {
  const panel = document.getElementById('holo-panel');
  const back = document.getElementById('holo-back');
  const skip = document.getElementById('holo-skip');
  let view = '';
  let stage = null;
  let lamps = [];
  let picked = [];
  let path = [];
  let hints = 0;
  let started = 0;
  let note = '';

  function holo() {
    return game.state.travel?.realms?.xing?.holo || null;
  }

  function ageBand() {
    return band?.() || game.state.settings?.ageBand || null;
  }

  function touring() {
    return Boolean(tour?.());
  }

  function say(text) {
    try { speak?.(text); } catch { /* pictures still work */ }
  }

  function close() {
    view = '';
    stage = null;
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
    onPaint?.();
  }

  function paint(html) {
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = html;
    onPaint?.();
  }

  function openAvatar() {
    view = 'avatar';
    stage = null;
    const record = holo();
    if (!record) return;
    const current = record.avatar || {};
    const swatches = Object.entries(GLOW_COLORS).map(([key, item]) => {
      const on = record.unlocked.includes(item.id);
      const pressed = current.glow === key;
      return `<button type="button" class="holo-swatch${pressed ? ' on' : ''}" data-holo="glow" data-id="${key}" ${on ? '' : 'disabled'} aria-pressed="${pressed}" aria-label="${item.name}${on ? '' : '，之后解锁'}"><i style="background:${item.color}"></i>${item.name}</button>`;
    }).join('');
    const visors = Object.entries(VISORS).map(([key, item]) => {
      const pressed = current.visor === key;
      return `<button type="button" class="secondary-btn${pressed ? ' on' : ''}" data-holo="visor" data-id="${key}" aria-pressed="${pressed}">${item.name}</button>`;
    }).join('');
    const glow = GLOW_COLORS[current.glow] || GLOW_COLORS.cyan;
    paint(`<h2>星核化身</h2><div class="holo-preview" style="--glow:${glow.color}" aria-hidden="true"><span></span></div><p>现在的光是${glowName(current.glow) || '青'}。</p><div class="holo-swatches">${swatches}</div><div class="panel-row">${visors}</div><p class="holo-quiet">外骨骼、背件和印记这一期先留着。</p><div class="panel-row"><button type="button" class="primary-btn" data-holo="close">先离开</button><button type="button" class="secondary-btn" data-holo="speak" data-text="这是你的光的身体。点颜色可以换光。">听一听</button></div>`);
  }

  function openTier() {
    view = 'tier';
    stage = null;
    game.recordHoloGrowth?.();
    const record = holo();
    if (!record) return;
    const age = ageBand();
    const cap = tierCap(age);
    const pair = growthPair(record);
    const zones = record.zones || {};
    const fromZone = (key) => Math.min(100, ((zones[key] || []).length || 0) * 34);
    const axes = [
      ['数', record.growth.at(-1)?.count || Math.min(100, (record.starlight.challenge || 0) * 4)],
      ['形', fromZone('shape')],
      ['力', record.growth.at(-1)?.force || Math.min(100, (record.starlight.field || 0) * 4)],
      ['星图', fromZone('chart')],
      ['码', fromZone('code')],
    ];
    const rows = axes.map(([name, value]) => (
      `<div class="holo-axis"><span>${name}</span><b style="width:${Math.max(8, value)}%"></b></div>`
    )).join('');
    const past = pair.past;
    const now = pair.current;
    const compare = past && now
      ? `数：一周前 ${past.count}，现在 ${now.count}。力：一周前 ${past.force}，现在 ${now.force}。只和自己比。`
      : '这是最近的自己。过一周再打开，就和那时比。没有别人的榜。';
    const colors = Object.values(GLOW_COLORS).map((item) => {
      const on = record.unlocked.includes(item.id);
      return `<li>${item.name}${on ? '，已经有了' : `，${item.tier} 阶之后`}</li>`;
    }).join('');
    const storedNote = record.tier > cap ? `存着的是 ${record.tier} 阶，这个年龄先显示到这里。` : '';
    paint(`<h2>星阶</h2><p class="holo-tier">${tierLabel(record.tier, age)}</p><p>${storedNote}</p><div class="holo-axes" aria-label="成长">${rows}</div><p>${compare}</p><ul class="holo-colors">${colors}</ul><p class="holo-quiet">星光来自数之环，也来自外星谷里已经做过的观察。故事先记着 0。</p><div class="panel-row"><button type="button" class="primary-btn" data-holo="close">先离开</button><button type="button" class="secondary-btn" data-holo="speak" data-text="这是你的星阶。只和自己比。">听一听</button></div>`);
  }

  function openStage(stageId) {
    const made = makeStage(ageBand(), stageId, SEED);
    stage = made;
    view = 'stage';
    lamps = [];
    picked = [];
    path = [];
    hints = 0;
    started = performance.now();
    note = '';
    const record = holo();
    const spot = padById(stageId);
    if (made.kind === 'count') world?.()?.setStarDots?.(made.n);
    else world?.()?.setStarDots?.(0);
    if (made.echo && record?.echo?.[stageId]?.path?.length) world?.()?.showEcho?.(record.echo[stageId].path);
    else world?.()?.showEcho?.([]);
    if (made.echo && !record?.echo?.[stageId]) note = '这是你的第一次记录';
    renderStage();
    say(made.speak);
  }

  function renderStage() {
    if (!stage) return;
    const young = holoAge(ageBand()) === 'young';
    let body = '';
    if (stage.kind === 'count') {
      const dots = '●'.repeat(stage.n);
      const buttons = Array.from({ length: stage.lamps }, (_, index) => {
        const on = lamps.includes(index);
        return `<button type="button" class="holo-lamp${on ? ' on' : ''}" data-holo="lamp" data-index="${index}" aria-label="灯 ${index + 1}，${on ? '已经亮' : '还没亮'}"></button>`;
      }).join('');
      body = `<p class="holo-dots" aria-label="光点">${dots}</p><div class="holo-lamps">${buttons}</div>`;
    } else if (stage.kind === 'pair10' || stage.kind === 'pair12') {
      body = `<div class="holo-blocks">${stage.blocks.map((value, index) => {
        const on = picked.includes(index);
        return `<button type="button" class="holo-block${on ? ' on' : ''}" data-holo="block" data-index="${index}" aria-pressed="${on}" aria-label="能量块 ${index + 1}，${value} 点">${dotMarks(value)}</button>`;
      }).join('')}</div>`;
    } else if (stage.kind === 'calc' || stage.kind === 'base4' || stage.kind === 'pick') {
      body = `<p>${stage.prompt}</p><div class="panel-row">${stage.choices.map((choice) => `<button type="button" class="secondary-btn" data-holo="choice" data-value="${choice}" aria-label="${choice}">${choice}</button>`).join('')}</div>`;
    } else if (stage.kind === 'path') {
      const cells = [];
      for (let y = 1; y <= stage.grid; y += 1) {
        for (let x = 1; x <= stage.grid; x += 1) {
          const id = `${x},${y}`;
          const on = path.includes(id);
          cells.push(`<button type="button" class="holo-cell${on ? ' on' : ''}" data-holo="cell" data-cell="${id}" aria-label="坐标 ${x},${y}">${on ? path.indexOf(id) + 1 : ''}</button>`);
        }
      }
      body = `<p>${stage.prompt}</p><div class="holo-grid">${cells.join('')}</div>`;
    }
    const later = young ? '' : '';
    const lead = stage.kind === 'count'
      ? '数一数星棱身上的光点，点亮一样多的灯。'
      : (stage.kind === 'pair10' || stage.kind === 'pair12' || stage.kind === 'pick' ? stage.prompt : '');
    paint(`<h2>${stage.title}</h2><p>${lead}</p>${body}<p class="holo-note" role="status">${note}</p>${later}<div class="panel-row"><button type="button" class="primary-btn" data-holo="done" aria-label="点好了">好</button><button type="button" class="secondary-btn" data-holo="speak" data-text="${stage.speak}">听一听</button><button type="button" class="secondary-btn" data-holo="close">先离开</button></div><p class="holo-quiet">错了可以再试。不扣东西，也可以先走。</p>`);
  }

  function attemptOf() {
    if (!stage) return null;
    if (stage.kind === 'count') return lamps.slice();
    if (stage.kind === 'pair10' || stage.kind === 'pair12') return picked.map((index) => stage.blocks[index]);
    if (stage.kind === 'path') return path.slice();
    return null;
  }

  function finish(attempt) {
    if (!stage) return;
    const graded = gradeStage(stage, attempt);
    const pad = padById(stage.id);
    const record = {
      ok: graded.ok,
      ms: Math.max(1, Math.round(performance.now() - started)),
      steps: Array.isArray(attempt) ? attempt.length : 1,
      correct: graded.ok ? 1 : 0,
      hints,
      path: echoPoints(pad, stage, Array.isArray(attempt) ? attempt : [0, 1]),
    };
    const saved = game.noteHoloStage(stage.id, record);
    if (!graded.ok) {
      hints += 1;
      note = `${graded.hint || '再试一次也没关系。'} ${saved.report?.text || ''}`.trim();
      panel?.classList.add('holo-dim');
      setTimeout(() => panel?.classList.remove('holo-dim'), 700);
      say(graded.hint || note);
      renderStage();
      return;
    }
    note = saved.report?.text || '点亮了。';
    toast?.(note);
    say(note);
    world?.()?.applyAvatar?.(holo());
    renderStage();
  }

  function openDome() {
    view = 'dome';
    stage = null;
    const got = game.state.travel?.realms?.xing?.storyShard === true;
    if (got) {
      world?.()?.setDomeFilled?.(true);
      paint(`<h2>星之片</h2><p>${DOME_HOME}</p><div class="panel-row"><button type="button" class="primary-btn" data-holo="close">先离开</button><button type="button" class="secondary-btn" data-holo="speak" data-text="${DOME_HOME}">听一听</button></div>`);
      say(DOME_HOME);
      return;
    }
    const plan = domePlan(ageBand(), touring());
    say(plan.speak);
    if (plan.mode === 'dir') {
      const dirs = [['north', '北'], ['east', '东'], ['south', '南'], ['west', '西']];
      const buttons = dirs.map(([id, name]) => `<button type="button" class="primary-btn" data-holo="dome-dir" data-dir="${id}" aria-label="${name}">${name}</button>`).join('');
      paint(`<h2>补星图</h2><p>${plan.prompt}</p><div class="panel-row">${buttons}</div><div class="panel-row"><button type="button" class="secondary-btn" data-holo="speak" data-text="${plan.speak}">听一听</button><button type="button" class="secondary-btn" data-holo="close">先离开</button></div>`);
      return;
    }
    paint(`<h2>补星图</h2><p>${plan.prompt}</p><div class="panel-row"><button type="button" class="primary-btn holo-star" data-holo="dome-home" aria-label="补上这块">★ 补上这块</button></div><div class="panel-row"><button type="button" class="secondary-btn" data-holo="speak" data-text="${DOME_SPEAK}">听一听</button><button type="button" class="secondary-btn" data-holo="close">先离开</button></div>`);
  }

  function applyDome(choice) {
    const result = game.claimXingShard?.(choice, { tour: touring(), ageBand: ageBand() });
    if (!result?.ok) {
      toast?.(result?.message || '再点一次也没关系。');
      say(result?.message || '再点一次也没关系。');
      return;
    }
    world?.()?.setDomeFilled?.(true);
    toast?.(result.message);
    say(result.line || DOME_HOME);
    paint(`<h2>星之片</h2><p>${result.message || ''}</p><p>${result.line || DOME_HOME}</p><div class="panel-row"><button type="button" class="primary-btn" data-holo="close">先离开</button><button type="button" class="secondary-btn" data-holo="speak" data-text="${DOME_HOME}">听一听</button></div>`);
  }

  function openZones() {
    view = 'zones';
    stage = null;
    const buttons = [
      ['shape-1', '形之阵'],
      ['force-1', '力之台'],
      ['chart-1', '星图之路'],
      ['code-1', '码之门'],
    ].map(([id, name]) => `<button type="button" class="primary-btn" data-holo="zone" data-stage="${id}" aria-label="${name}">${name}</button>`).join('');
    paint(`<h2>星区</h2><p>点一个星区。做错了可以再试，不扣东西。</p><div class="panel-row">${buttons}</div><div class="panel-row"><button type="button" class="secondary-btn" data-holo="ship" aria-label="咕咕号星图">咕咕号星图</button><button type="button" class="secondary-btn" data-holo="arena" aria-label="一起算">一起算</button><button type="button" class="secondary-btn" data-holo="festival" aria-label="双月">双月</button></div><div class="panel-row"><button type="button" class="secondary-btn" data-holo="close">先离开</button></div>`);
  }

  function openArena() {
    view = 'arena';
    stage = null;
    const plan = arenaPlan(ageBand());
    say(plan.speak);
    const buttons = plan.choices.map((choice) => `<button type="button" class="primary-btn" data-holo="arena-choice" data-value="${choice}" aria-label="${choice}">${choice}</button>`).join('');
    paint(`<h2>一起算</h2><p>${plan.prompt}</p><p>${ARENA_SPEAK}</p><div class="panel-row">${buttons}</div><div class="panel-row"><button type="button" class="secondary-btn" data-holo="speak" data-text="${ARENA_SPEAK}">听一听</button><button type="button" class="secondary-btn" data-holo="zones">回到星区</button></div>`);
  }

  function openFestival() {
    view = 'festival';
    stage = null;
    say(FESTIVAL_LINE);
    paint(`<h2>双月团圆夜</h2><div class="holo-moons" aria-hidden="true"><i></i><i></i></div><p>${FESTIVAL_LINE}</p><p class="holo-quiet">看一看就好。不评分，不限时。</p><div class="panel-row"><button type="button" class="primary-btn" data-holo="speak" data-text="${FESTIVAL_LINE}">听一听</button><button type="button" class="secondary-btn" data-holo="close">先离开</button></div>`);
  }

  function openShip() {
    say(SHIP_LINE);
    toast?.(SHIP_LINE);
    openStage('chart-1');
  }

  function onClick(event) {
    const button = event.target.closest('[data-holo]');
    if (!button || !panel?.contains(button)) return;
    const act = button.dataset.holo;
    if (act === 'close') { close(); return; }
    if (act === 'speak') { say(button.dataset.text || stage?.speak || ''); return; }
    if (act === 'glow') {
      const key = button.dataset.id;
      if (game.setHoloAvatar({ glow: key })) {
        world?.()?.applyAvatar?.(holo());
        say(glowName(key));
        openAvatar();
      }
      return;
    }
    if (act === 'visor') {
      if (game.setHoloAvatar({ visor: button.dataset.id })) {
        world?.()?.applyAvatar?.(holo());
        openAvatar();
      }
      return;
    }
    if (act === 'lamp') {
      const index = Number(button.dataset.index);
      lamps = lamps.includes(index) ? lamps.filter((item) => item !== index) : lamps.concat(index);
      renderStage();
      const word = countWord(lamps.length);
      if (word) say(word);
      return;
    }
    if (act === 'block') {
      const index = Number(button.dataset.index);
      if (picked.includes(index)) picked = picked.filter((item) => item !== index);
      else if (picked.length < 2) picked = picked.concat(index);
      renderStage();
      return;
    }
    if (act === 'choice') {
      finish(button.dataset.value);
      return;
    }
    if (act === 'cell') {
      const cell = button.dataset.cell;
      if (!path.includes(cell)) path = path.concat(cell);
      const graded = gradeStage(stage, path);
      if (!graded.ok && path.length >= (stage.answer?.length || 1)) {
        hints += 1;
        note = graded.hint;
        path = [];
        say(note);
      }
      renderStage();
      if (graded.ok) finish(path.length ? path : stage.answer);
      return;
    }
    if (act === 'done') finish(attemptOf());
    if (act === 'dome-home') applyDome('home');
    if (act === 'dome-dir') applyDome(button.dataset.dir);
    if (act === 'zone') openStage(button.dataset.stage);
    if (act === 'zones') openZones();
    if (act === 'ship') openShip();
    if (act === 'arena') openArena();
    if (act === 'festival') openFestival();
    if (act === 'arena-choice') {
      const plan = arenaPlan(ageBand());
      if (button.dataset.value !== plan.answer) {
        toast?.('再点一次也没关系。');
        say('再点一次也没关系。');
        return;
      }
      const saved = game.noteHoloTogether?.();
      toast?.(saved?.message || '看台亮了。');
      say(saved?.message || ARENA_SPEAK);
      paint(`<h2>一起算</h2><p>${saved?.message || '看台亮了。没有输赢，也没有排名。'}</p><div class="panel-row"><button type="button" class="primary-btn" data-holo="close">先离开</button></div>`);
    }
  }

  panel?.addEventListener('click', onClick);
  back?.addEventListener('click', () => {
    world?.()?.leaveHolo?.();
    close();
  });
  skip?.addEventListener('click', () => world?.()?.skipHolo?.());
  document.getElementById('holo-avatar-open')?.addEventListener('click', openAvatar);
  document.getElementById('holo-tier-open')?.addEventListener('click', openTier);
  document.getElementById('holo-stage-open')?.addEventListener('click', () => openStage('num-1'));
  document.getElementById('holo-dome-open')?.addEventListener('click', openDome);
  document.getElementById('holo-zones-open')?.addEventListener('click', openZones);

  return {
    close,
    openAvatar,
    openTier,
    openStage,
    openDome,
    openZones,
    peek() {
      return stage ? { id: stage.id, kind: stage.kind, answer: stage.answer, n: stage.n, blocks: stage.blocks, points: stage.points, note } : null;
    },
  };
}
