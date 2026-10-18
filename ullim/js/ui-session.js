/* 울림 — 세션 뷰: 클립 슬롯 격자, 씬, 트랙 머리, 믹서 */
(function (U) {
'use strict';
const { h, ui, icon, info, btn } = U;
const A = U.act;
const pr = () => U.project;
let root = null, gridEl = null, mainEl = null, mixEl = null;
let slotEls = new Map();   // trackId → [slot elements]
let strips = new Map();    // trackId → strip refs
let lastStates = new Map();

function color(t) { return U.colorOf(t.color); }

/* ================= 그리기 ================= */
function build(el) {
  root = el;
  U.clear(root);
  mainEl = h('div', { class: 'sess-main' });
  gridEl = h('div', { class: 'sess-grid' });
  mainEl.append(gridEl);
  mixEl = h('div', { class: 'sess-mix' });
  root.append(mainEl, mixEl);
  mainEl.addEventListener('scroll', () => { mixEl.scrollLeft = mainEl.scrollLeft; });
  mixEl.addEventListener('scroll', () => { if (Math.abs(mainEl.scrollLeft - mixEl.scrollLeft) > 1) mainEl.scrollLeft = mixEl.scrollLeft; });
  root.addEventListener('pointerdown', () => { ui.focus = 'session'; });
  render();
}
function render() {
  if (!gridEl) return;
  const p = pr();
  const sx = mainEl.scrollLeft, sy = mainEl.scrollTop;
  U.clear(gridEl);
  slotEls = new Map();
  lastStates = new Map();
  const nT = p.tracks.length, nR = p.returns.length;
  const cols = `repeat(${nT}, var(--col)) var(--drop-col) repeat(${nR}, var(--col)) var(--mcol)`;
  gridEl.style.gridTemplateColumns = cols;
  // 머리줄
  for (const t of p.tracks) gridEl.append(trackHead(t));
  gridEl.append(newTrackZone(true));
  for (const t of p.returns) gridEl.append(trackHead(t));
  gridEl.append(masterHead());
  // 씬 줄
  p.scenes.forEach((sc, i) => {
    for (const t of p.tracks) {
      const s = slot(t, i);
      if (!slotEls.has(t.id)) slotEls.set(t.id, []);
      slotEls.get(t.id).push(s);
      gridEl.append(s);
    }
    gridEl.append(h('div', { class: 'cell dropcol' }));
    for (let r = 0; r < nR; r++) gridEl.append(h('div', { class: 'cell blank' }));
    gridEl.append(sceneCell(i));
  });
  // 정지 줄
  for (const t of p.tracks) gridEl.append(stopCell(t));
  gridEl.append(h('div', { class: 'cell dropcol' }));
  for (let r = 0; r < nR; r++) gridEl.append(h('div', { class: 'cell blank stoprow' }));
  gridEl.append(stopAllCell());
  // 믹서
  renderMixer(cols);
  mainEl.scrollLeft = sx;
  mainEl.scrollTop = sy;
  mixEl.scrollLeft = sx;
  updateStates(true);
}

function trackHead(t) {
  const p = pr();
  const sel = ui.track === t.id;
  const el = h('div', { class: 'th' + (sel ? ' sel' : '') + (t.type === 'return' ? ' ret' : ''), style: { '--c': color(t) }, dataset: { t: t.id } },
    h('span', { class: 'th-name', text: U.trackLabel(p, t) }));
  info(el, U.trackLabel(p, t), t.type === 'return' ? '리턴 트랙: 다른 트랙이 센드로 보낸 소리를 받아 이펙트를 걸어요.' : '눌러서 트랙을 고르면 아래에 장치가 보여요. 두 번 눌러 이름을 바꾸고, 오른쪽 클릭으로 메뉴를 열어요.');
  el.addEventListener('click', () => U.selectTrack(t.id, { device: true }));
  el.addEventListener('dblclick', () => U.editInline(el.querySelector('.th-name'), t.name || U.trackLabel(p, t), v => A.renameTrack(t.id, v)));
  el.addEventListener('contextmenu', e => { e.preventDefault(); U.selectTrack(t.id); trackMenu(t, { x: e.clientX, y: e.clientY }); });
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || t.type !== 'midi' && t.type !== 'audio') return;
    U.dragStart(e, { type: 'track', id: t.id }, U.trackLabel(p, t));
  });
  U.dropTarget(el, devDrop(t));
  return el;
}
function masterHead() {
  const p = pr();
  const el = h('div', { class: 'th master' + (ui.track === p.master.id ? ' sel' : ''), style: { '--c': color(p.master) } }, h('span', { class: 'th-name', text: '마스터' }));
  info(el, '마스터', '모든 트랙이 모이는 최종 출력이에요. 오른쪽 열의 ▶로 씬(가로 한 줄)을 한꺼번에 띄워요.');
  el.addEventListener('click', () => U.selectTrack(p.master.id, { device: true }));
  U.dropTarget(el, devDrop(p.master));
  return el;
}
function newTrackZone(head) {
  const el = h('div', { class: 'cell dropcol' + (head ? ' head' : '') });
  if (head) {
    el.append(icon('plus'));
    info(el, '새 트랙', '여기에 악기, 사운드, 샘플, 클립을 끌어다 놓으면 새 트랙이 생겨요. 눌러서 트랙 종류를 고를 수도 있어요.');
    el.addEventListener('click', () => U.menu([
      { label: 'MIDI 트랙', action: () => A.addTrack('midi') },
      { label: '오디오 트랙', action: () => A.addTrack('audio') },
      { label: '리턴 트랙', action: () => A.addReturn() }
    ], el));
    U.dropTarget(el, {
      accept: d => ['sound', 'kit', 'loopkit', 'device', 'sample', 'tpl', 'clip'].includes(d.type),
      drop: d => dropNewTrack(d)
    });
  }
  return el;
}
/* 새 트랙 칸에 놓으면 맨 끝에 트랙을 만든다 */
function dropNewTrack(d) {
  const end = pr().tracks.length;
  if (d.type === 'sound') A.loadSound(A.addTrack('midi', end).id, d.item);
  else if (d.type === 'kit') A.loadKit(A.addTrack('midi', end).id, d.item);
  else if (d.type === 'loopkit') A.loadLoopKit(A.addTrack('midi', end).id, d.item);
  else if (d.type === 'device') {
    const type = U.DEV[d.kind].type;
    const t = A.addTrack(type === 'audio' ? 'audio' : 'midi', end);
    A.addDevice(t.id, d.kind, { preset: d.preset, presetName: d.presetName });
  } else if (d.type === 'sample') { const t = A.addTrack('audio', end); A.insertAudio(t.id, 0, d.ref); }
  else if (d.type === 'tpl') { const t = A.addTrack('midi', end); A.insertTemplate(t.id, 0, d.item); }
  else if (d.type === 'clip') {
    const c = U.clipRef(d.from);
    if (!c) return;
    const t = A.addTrack(c.clip.type === 'audio' ? 'audio' : 'midi', end);
    A.moveClip(d.from, { t: t.id, s: d.from.s }, true);
  }
}
/* 트랙 머리·슬롯에 장치/사운드를 놓기 */
function devDrop(t) {
  return {
    accept: d => ['sound', 'kit', 'loopkit', 'device'].includes(d.type),
    drop: d => {
      if (d.type === 'sound') A.loadSound(t.id, d.item);
      else if (d.type === 'kit') A.loadKit(t.id, d.item);
      else if (d.type === 'loopkit') A.loadLoopKit(t.id, d.item);
      else A.addDevice(t.id, d.kind, { preset: d.preset, presetName: d.presetName });
      U.selectTrack(ui.track, { device: true });
    }
  };
}

function slot(t, i) {
  const c = t.slots[i];
  const sel = ui.slot && ui.slot.t === t.id && ui.slot.s === i;
  const el = h('div', { class: 'slot' + (c ? ' full' : ' empty') + (sel ? ' sel' : ''), dataset: { t: t.id, s: i } });
  if (c) {
    el.style.setProperty('--c', U.colorOf(c.color));
    const l = h('button', { class: 'launch', type: 'button', 'aria-label': '클립 재생' }, icon('play'));
    info(l, '클립 띄우기', '눌러서 클립을 재생해요. 런치 퀀타이즈에 맞춰 다음 박자 경계에서 시작해요.');
    l.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (e.button !== 0) return;
      U.ensureAudio();
      U.engine.launch(t.id, i);
      if (c.launch === 'gate') {
        const up = () => { U.engine.stopTrack(t.id); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointerup', up);
      }
      selectSlot(t, i, false);
    });
    const name = h('span', { class: 'sl-name', text: c.name || (c.type === 'audio' ? '오디오' : '') });
    const prog = h('div', { class: 'prog' });
    el.append(l, name, prog);
    info(el, c.name || '클립', '눌러서 고르면 아래 클립 뷰에 내용이 보여요. 끌어서 다른 칸이나 어레인지먼트로 옮기고, Alt를 누르고 끌면 복사해요.');
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      selectSlot(t, i, true);
      U.dragStart(e, { type: 'clip', from: { t: t.id, s: i } }, c.name || '클립');
    });
  } else {
    const armed = t.arm && t.type === 'midi';
    const l = h('button', { class: 'launch stopsq' + (armed ? ' armed' : ''), type: 'button', 'aria-label': armed ? '여기에 녹음' : '트랙 정지' }, icon(armed ? 'rec' : 'stop'));
    info(l, armed ? '여기에 녹음' : '트랙 정지', armed ? '누르면 이 칸에 새 클립을 녹음하기 시작해요.' : '이 트랙에서 재생 중인 클립을 멈춰요.');
    l.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (e.button !== 0) return;
      U.ensureAudio();
      if (armed) { selectSlot(t, i, false); A.setSessionRec(true); }
      else U.engine.stopTrack(t.id);
    });
    if (t.slots.some(Boolean) || armed) el.append(l);
    info(el, '빈 슬롯', t.type === 'midi' ? '두 번 눌러 빈 MIDI 클립을 만들어요. 브라우저의 클립이나 샘플을 끌어다 놓아도 돼요.' : '브라우저에서 오디오 샘플을 끌어다 놓으세요.');
    el.addEventListener('pointerdown', e => { if (e.button === 0) selectSlot(t, i, false); });
    el.addEventListener('dblclick', () => { if (t.type === 'midi') A.createClip(t.id, i); });
  }
  el.addEventListener('contextmenu', e => { e.preventDefault(); selectSlot(t, i, !!c); slotMenu(t, i, { x: e.clientX, y: e.clientY }); });
  U.dropTarget(el, {
    accept: d => ['clip', 'tpl', 'sample', 'sound', 'kit', 'loopkit', 'device'].includes(d.type),
    drop: (d, e) => {
      if (d.type === 'clip') A.moveClip(d.from, { t: t.id, s: i }, e.altKey || e.ctrlKey || e.metaKey);
      else if (d.type === 'tpl') A.insertTemplate(t.id, i, d.item);
      else if (d.type === 'sample') { if (t.type === 'audio') A.insertAudio(t.id, i, d.ref); else { const nt = A.addTrack('audio'); A.insertAudio(nt.id, i, d.ref); } }
      else devDrop(t).drop(d);
    }
  });
  return el;
}
function selectSlot(t, i, show) {
  ui.slot = { t: t.id, s: i };
  ui.scene = i;
  ui.track = t.id;
  if (t.slots[i]) U.showClip({ t: t.id, s: i }, show);
  else { U.emit('select', { slot: ui.slot }); U.inval('detail', 'status'); }
}
/* 선택 표시만 바꾼다 (다시 만들지 않아야 더블클릭이 끊기지 않는다) */
function markSel() {
  if (!gridEl) return;
  for (const [tid, els] of slotEls) els.forEach((s, i) => s.classList.toggle('sel', !!(ui.slot && ui.slot.t === tid && ui.slot.s === i)));
  for (const th of gridEl.querySelectorAll('.th')) th.classList.toggle('sel', th.dataset.t === ui.track || (th.classList.contains('master') && ui.track === pr().master.id));
  gridEl.querySelectorAll('.scene').forEach((sc, i) => sc.classList.toggle('sel', i === ui.scene));
  for (const [id, r] of strips) r.el.classList.toggle('sel', id === ui.track);
}
U.on('select', markSel);
function sceneCell(i) {
  const p = pr();
  const sc = p.scenes[i];
  const el = h('div', { class: 'scene' + (ui.scene === i ? ' sel' : '') });
  const l = h('button', { class: 'launch', type: 'button', 'aria-label': '씬 재생' }, icon('play'));
  info(l, '씬 띄우기', '이 줄의 클립을 모든 트랙에서 한꺼번에 띄워요. 빈 칸인 트랙은 멈춰요.');
  l.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.button) return; U.ensureAudio(); U.engine.launchScene(i); ui.scene = i; markSel(); });
  const name = h('span', { class: 'sc-name', text: (sc.name ? sc.name : String(i + 1)) });
  el.append(l, name);
  if (sc.tempo) el.append(h('span', { class: 'sc-tempo', text: sc.tempo + ' BPM' }));
  info(el, '씬 ' + (i + 1) + (sc.name ? ' · ' + sc.name : ''), '두 번 눌러 이름을 바꿔요. 오른쪽 클릭으로 씬을 넣거나 복제하고 템포를 정해요.');
  el.addEventListener('click', () => { ui.scene = i; markSel(); });
  el.addEventListener('dblclick', () => U.editInline(name, sc.name, v => A.renameScene(i, v)));
  el.addEventListener('contextmenu', e => { e.preventDefault(); sceneMenu(i, { x: e.clientX, y: e.clientY }); });
  return el;
}
function stopCell(t) {
  const el = h('div', { class: 'cell stoprow' });
  const b = btn({ icon: 'stop', cls: 'stopbtn', title: '트랙 정지', info: ['클립 정지', '이 트랙의 클립을 다음 박자 경계에서 멈춰요.'], onclick: () => U.engine.stopTrack(t.id) });
  el.append(b);
  return el;
}
function stopAllCell() {
  const el = h('div', { class: 'scene stoprow' });
  const b = btn({ icon: 'stop', cls: 'stopbtn', text: '모두 정지', info: ['모든 클립 정지', '재생 중인 클립을 모두 다음 박자 경계에서 멈춰요.'], onclick: () => U.engine.stopAll() });
  el.append(b);
  return el;
}

/* ================= 믹서 ================= */
const PAN = { label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan', info: '소리를 왼쪽이나 오른쪽으로 보내요. 더블클릭하면 가운데로.' };
const P0 = () => U.dbToPos(0);
function sendSpec(letter) {
  return { label: letter, min: 0, max: 1, def: 0, info: letter + ' 리턴 트랙으로 이 트랙 소리를 얼마나 보낼지예요. 리버브·딜레이를 여러 트랙이 함께 쓸 때 써요.', fmt: v => U.fmtParam({ unit: 'dB' }, U.posToDb(v * P0())) };
}
function renderMixer(cols) {
  U.clear(mixEl);
  strips = new Map();
  const p = pr();
  const row = h('div', { class: 'mix-row', style: { gridTemplateColumns: cols } });
  for (const t of p.tracks) row.append(strip(t));
  row.append(h('div', { class: 'strip dropcol' }));
  for (const t of p.returns) row.append(strip(t));
  row.append(strip(p.master));
  mixEl.append(row);
}
function strip(t) {
  const p = pr();
  const el = h('div', { class: 'strip' + (t.type === 'master' ? ' master' : '') + (ui.track === t.id ? ' sel' : ''), style: { '--c': color(t) } });
  const refs = { el, knobs: [] };
  // 센드
  const sends = h('div', { class: 'sends' });
  if (t.type !== 'master') {
    p.returns.forEach((r, i) => {
      if (r.id === t.id) { sends.append(h('div', { class: 'knob-gap' })); return; }
      const letter = U.returnLetter(p, r);
      const k = U.knob({
        spec: sendSpec(letter), size: 'xs', title: '센드 ' + letter,
        get: () => { const a = U.engine && U.engine.autoNow(t.id, 'send:' + r.id); return a != null ? a / P0() : U.dbToPos(t.sends[i]) / P0(); },
        set: (v, f) => A.setMixer(t.id, 'send', U.round(U.posToDb(v * P0()), 1), f, i),
        auto: () => !!t.auto['send:' + r.id],
        map: { k: 'send', tr: t.id, r: r.id }
      });
      refs.knobs.push(k);
      sends.append(k);
    });
  }
  // 팬
  const pan = U.knob({
    spec: PAN, size: 'sm', title: '팬',
    get: () => { const a = U.engine && U.engine.autoNow(t.id, 'pan'); return a != null ? a * 2 - 1 : t.pan; },
    set: (v, f) => A.setMixer(t.id, 'pan', U.round(v, 3), f),
    auto: () => !!t.auto.pan,
    map: { k: 'pan', tr: t.id }
  });
  refs.knobs.push(pan);
  // 볼륨
  const fd = U.fader({
    get: () => { const a = U.engine && U.engine.autoNow(t.id, 'vol'); return a != null ? U.posToDb(a) : t.vol; },
    set: (v, f) => { A.setMixer(t.id, 'vol', v, f); refs.db.update(); },
    map: { k: 'vol', tr: t.id }
  });
  refs.fader = fd;
  refs.db = U.numBox({ cls: 'dbbox', label: '볼륨 dB', get: () => t.vol, set: (v, f) => { A.setMixer(t.id, 'vol', v, f); fd.update(); }, fmt: v => (v <= U.OFF_DB + 0.1 ? '-∞' : v.toFixed(1)), min: U.OFF_DB, max: 6, step: 0.1, def: 0, toN: v => U.dbToPos(v), fromN: n => U.round(U.posToDb(n), 1), range: 200 });
  info(refs.db, '볼륨', '숫자를 끌거나 두 번 눌러 dB 값을 넣어요.');
  const vol = h('div', { class: 'vol' }, fd, refs.db);
  // 버튼
  const btns = h('div', { class: 'sbtns' });
  if (t.type !== 'master') {
    const num = t.type === 'return' ? U.returnLetter(p, t) : String(p.tracks.indexOf(t) + 1);
    const act = h('button', { class: 'act', type: 'button', text: num, 'aria-pressed': t.on ? 'true' : 'false' });
    info(act, '트랙 켜기/끄기', '끄면 이 트랙 소리가 나지 않아요 (뮤트).');
    act.addEventListener('click', () => A.toggleTrackFlag(t.id, 'on'));
    const solo = h('button', { class: 'solo', type: 'button', text: 'S', 'aria-pressed': t.solo ? 'true' : 'false' });
    info(solo, '솔로', '이 트랙만 들어요. ' + U.MOD + '를 누르고 누르면 여러 트랙을 함께 솔로해요.');
    solo.addEventListener('click', e => A.toggleTrackFlag(t.id, 'solo', !(e.ctrlKey || e.metaKey)));
    btns.append(act, solo);
    if (t.type === 'midi' || t.type === 'audio') {
      const arm = h('button', { class: 'arm', type: 'button', 'aria-pressed': t.arm ? 'true' : 'false', 'aria-label': '녹음 준비' }, icon('rec'));
      info(arm, '녹음 준비', '켜면 이 트랙이 컴퓨터 건반과 MIDI 장치 연주를 받아 녹음할 수 있어요.');
      arm.addEventListener('click', e => A.toggleTrackFlag(t.id, 'arm', !(e.ctrlKey || e.metaKey)));
      btns.append(arm);
    }
  }
  el.append(sends, h('div', { class: 'panrow' }, pan), vol, btns);
  el.addEventListener('pointerdown', () => { if (ui.track !== t.id) U.selectTrack(t.id); });
  strips.set(t.id, refs);
  return el;
}

/* ================= 상태 표시 (매 프레임) ================= */
let blink = false, lastBlink = 0;
function updateStates(force) {
  const e = U.engine;
  if (!e || !gridEl) return;
  const now = performance.now();
  if (now - lastBlink > 260) { blink = !blink; lastBlink = now; gridEl.classList.toggle('blink', blink); }
  for (const t of pr().tracks) {
    const st = e.clipState(t.id);
    const els = slotEls.get(t.id);
    if (!st || !els) continue;
    const prev = lastStates.get(t.id) || {};
    if (force || prev.playing !== st.playing || prev.queued !== st.queued || prev.rec !== st.recording) {
      els.forEach((s, i) => {
        s.classList.toggle('playing', st.playing === i);
        s.classList.toggle('queued', st.queued === i && st.playing !== i);
        s.classList.toggle('recording', st.recording && st.playing === i);
        if (st.playing !== i) { const pg = s.querySelector('.prog'); if (pg) pg.style.transform = 'scaleX(0)'; }
      });
      lastStates.set(t.id, { playing: st.playing, queued: st.queued, rec: st.recording });
    }
    if (st.playing >= 0 && els[st.playing]) {
      const pg = els[st.playing].querySelector('.prog');
      if (pg) pg.style.transform = 'scaleX(' + U.clamp(st.progress, 0, 1).toFixed(4) + ')';
    }
  }
}
function updateMeters() {
  const e = U.engine;
  if (!e || !mixEl || !root || root.offsetParent === null) return;
  for (const [id, r] of strips) {
    const n = e.nodes.get(id);
    if (n) r.fader.meter(n.meter());
    if (e.playing) {
      const t = U.trackById(pr(), id);
      if (t && Object.keys(t.auto).length) { for (const k of r.knobs) k.update(); r.fader.update(); }
    }
  }
}
U.frame(() => {
  if (!root || root.offsetParent === null) return;
  updateStates(false);
  updateMeters();
});

/* ================= 메뉴 ================= */
function trackMenu(t, at) {
  const p = pr();
  const playable = U.isPlayable(t);
  U.menu([
    { label: '이름 바꾸기', key: 'F2', action: () => U.ask('트랙 이름', '이름', t.name || U.trackLabel(p, t)).then(v => { if (v != null) A.renameTrack(t.id, v); }) },
    { label: '색', sub: U.colorMenu(t.color, c => A.setTrackColor(t.id, c)) },
    playable ? { label: '트랙 복제', key: U.MOD + '+D', action: () => A.duplicateTrack(t.id) } : null,
    { sep: true },
    { label: 'MIDI 트랙 넣기', action: () => A.addTrack('midi') },
    { label: '오디오 트랙 넣기', action: () => A.addTrack('audio') },
    { label: '리턴 트랙 넣기', action: () => A.addReturn() },
    { sep: true },
    t.type !== 'master' ? { label: '트랙 지우기', danger: true, key: 'Del', action: () => A.deleteTrack(t.id) } : null
  ], at);
}
function slotMenu(t, i, at) {
  const c = t.slots[i];
  const items = [];
  if (c) {
    items.push(
      { label: '재생', action: () => U.engine.launch(t.id, i) },
      { label: '이름 바꾸기', key: 'F2', action: () => U.ask('클립 이름', '이름', c.name).then(v => { if (v != null) A.clipProp({ t: t.id, s: i }, x => { x.name = v; }, '클립 이름'); }) },
      { label: '색', sub: U.colorMenu(c.color, ci => A.clipProp({ t: t.id, s: i }, x => { x.color = ci; }, '클립 색')) },
      { label: '복제', key: U.MOD + '+D', action: () => A.duplicateClip(t.id, i) },
      { label: '어레인지먼트 재생 위치에 넣기', action: () => A.sessionToArr({ t: t.id, s: i }, t.id, pr().pos) },
      { sep: true },
      { label: '지우기', key: 'Del', danger: true, action: () => A.deleteSlot(t.id, i) }
    );
  } else {
    if (t.type === 'midi') items.push({ label: '빈 MIDI 클립 만들기', key: '더블클릭', action: () => A.createClip(t.id, i) });
    items.push({ label: '오디오 파일 가져와 넣기…', action: () => U.importAudioTo(t.id, i) });
  }
  items.push({ sep: true }, { label: '씬 넣기', action: () => A.insertScene(i) });
  U.menu(items, at);
}
function sceneMenu(i, at) {
  const sc = pr().scenes[i];
  U.menu([
    { label: '씬 재생', action: () => U.engine.launchScene(i) },
    { label: '이름 바꾸기', action: () => U.ask('씬 이름', '이름', sc.name).then(v => { if (v != null) A.renameScene(i, v); }) },
    { label: sc.tempo ? '씬 템포 바꾸기 (' + sc.tempo + ')' : '씬 템포 정하기…', action: () => U.ask('씬 템포', '이 씬을 띄우면 바뀔 템포 (비우면 없음)', sc.tempo || '').then(v => { if (v == null) return; const n = parseFloat(v); A.setSceneTempo(i, isFinite(n) && n >= 20 ? U.clamp(n, 20, 999) : null); }) },
    { sep: true },
    { label: '아래에 씬 넣기', action: () => A.insertScene(i + 1) },
    { label: '씬 복제', key: U.MOD + '+D', action: () => A.duplicateScene(i) },
    { label: '재생 중인 클립으로 새 씬', action: () => { ui.scene = i; A.captureScene(); } },
    { sep: true },
    { label: '씬 지우기', danger: true, disabled: pr().scenes.length <= 1, action: () => A.deleteScene(i) }
  ], at);
}

U.renderer('session', render);
U.sessionView = { build, render, selectSlot, trackMenu, slotMenu };
})(window.U = window.U || {});
