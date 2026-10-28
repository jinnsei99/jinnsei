/* 울림 — 입력: 단축키, 컴퓨터 건반, MIDI 장치 */
(function (U) {
'use strict';
const { ui } = U;
const A = U.act;
const pr = () => U.project;

/* ================= 컴퓨터 건반 ================= */
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 };
const held = new Map(); // code → {track ids, pitch}
function liveTargets() {
  const armed = pr().tracks.filter(t => t.type === 'midi' && t.arm);
  if (armed.length) return armed.map(t => t.id);
  const t = U.selTrack();
  return t && t.type === 'midi' ? [t.id] : [];
}
function kbDown(e) {
  if (e.code === 'KeyZ') { ui.octave = Math.max(-1, ui.octave - 1); kbStatus(); return true; }
  if (e.code === 'KeyX') { ui.octave = Math.min(8, ui.octave + 1); kbStatus(); return true; }
  if (e.code === 'KeyC') { ui.velocity = Math.max(1, ui.velocity - 20); kbStatus(); return true; }
  if (e.code === 'KeyV') { ui.velocity = Math.min(127, ui.velocity + 20); kbStatus(); return true; }
  const off = KEYMAP[e.code];
  if (off == null) return false;
  if (e.repeat || held.has(e.code)) return true;
  const p = (ui.octave + 2) * 12 + off;
  if (p < 0 || p > 127) return true;
  U.ensureAudio();
  const ids = liveTargets();
  if (!ids.length) { U.toast('MIDI 트랙을 고르거나 ● 녹음 준비를 켜 주세요.'); return true; }
  for (const id of ids) U.engine.liveOn(id, p, ui.velocity);
  held.set(e.code, { ids, p });
  U.emit('livenote', { p, on: true });
  return true;
}
function kbUp(e) {
  const h = held.get(e.code);
  if (!h) return false;
  held.delete(e.code);
  for (const id of h.ids) U.engine.liveOff(id, h.p);
  U.emit('livenote', { p: h.p, on: false });
  return true;
}
function releaseAll() {
  for (const [code] of held) kbUp({ code });
  if (U.padsView) U.padsView.releaseAll();
  U.engine && U.engine.allLiveOff();
}
function kbStatus() {
  U.toast('건반 옥타브 C' + ui.octave + ' · 세기 ' + ui.velocity);
  U.inval('status');
}
U.setKeyboard = function (on) {
  ui.keyboard = on;
  U.setPref('keyboard', on);
  if (!on) releaseAll();
  U.inval('transport', 'status');
  U.toast(on ? '컴퓨터 건반을 켰어요. A~K 줄로 연주해요.' : '컴퓨터 건반을 껐어요.');
};
U.setDraw = function (on) { ui.draw = on; U.inval('transport', 'detail'); };
U.setAutoMode = function (on) { ui.auto = on; U.inval('transport', 'arrange'); if (on && ui.view !== 'arrange') U.setView('arrange'); };

/* ================= 단축키 ================= */
function onKeyDown(e) {
  if (U.isTyping(e)) return;
  if (document.querySelector('.dlg-back')) return;
  const mod = U.modKey(e);
  // 패드 글자 키가 먼저 (패드 화면, 또는 건반을 켠 루프 패드 트랙)
  if (!mod && !e.altKey && U.padsView.keyDown(e)) { e.preventDefault(); return; }
  if (ui.keyboard && !mod && !e.altKey && kbDown(e)) { e.preventDefault(); return; }
  const k = e.key;
  const ctx = ui.focus || (ui.view === 'arrange' ? 'arrange' : 'session');
  const roll = U.clipView.midi && (ctx === 'roll' || ctx === 'detail');
  const done = () => { e.preventDefault(); e.stopPropagation(); };
  if (mod) {
    switch (e.code) {
      case 'KeyZ': done(); e.shiftKey ? A.redo() : A.undo(); return;
      case 'KeyY': done(); A.redo(); return;
      case 'KeyS': done(); U.saveNow(); return;
      case 'KeyK': done(); U.quick.open(); return;
      case 'KeyF': done(); if (!ui.browserOpen) U.toggleBrowser(true); U.browserView.focusSearch(); return;
      case 'KeyD': done(); duplicate(ctx, roll); return;
      case 'KeyE': done(); if (U.arrangeView.splitAtCursor()) U.toast('클립을 나눴어요'); return;
      case 'KeyL': done(); U.arrangeView.loopSelection(); return;
      case 'KeyJ': done(); if (ui.arrSel.length) { ui.arrSel = A.consolidate(ui.arrSel); U.inval('arrange-draw'); } return;
      case 'KeyU': done(); if (U.clipView.midi) U.clipView.quantizeSel(); return;
      case 'KeyA': if (roll) { done(); U.clipView.selectAll(); } else if (ctx === 'arrange') { done(); U.arrangeView.selectAll(); } return;
      case 'KeyC': if (roll && U.clipView.copySel()) { done(); U.toast('복사했어요'); } return;
      case 'KeyX': if (roll && U.clipView.copySel(true)) done(); return;
      case 'KeyV': if (roll && U.clipView.paste()) done(); return;
      case 'Digit1': done(); if (roll || ctx !== 'arrange') U.clipView.gridNarrow(1); else { ui.arr.gridMul = Math.min(4, ui.arr.gridMul * 2); U.arrangeView.draw(); } return;
      case 'Digit2': done(); if (roll || ctx !== 'arrange') U.clipView.gridNarrow(-1); else { ui.arr.gridMul = Math.max(0.25, ui.arr.gridMul / 2); U.arrangeView.draw(); } return;
      case 'Digit3': done(); U.clipView.toggleTri(); return;
      case 'Digit4': done(); if (roll) U.clipView.toggleSnap(); else { ui.arr.snap = !ui.arr.snap; U.toast(ui.arr.snap ? '스냅 켬' : '스냅 끔'); U.inval('arrange'); } return;
    }
    if (e.altKey && e.code === 'KeyB') { done(); U.toggleBrowser(); return; }
    return;
  }
  if (e.altKey) return;
  switch (k) {
    case ' ': done(); A.togglePlay(e.shiftKey); return;
    case 'Tab': done(); if (e.shiftKey) U.toggleDetailKind(); else U.toggleSongView(); return;
    case 'F9': done(); A.setRecord(!U.engine.recording); return;
    case 'F2': done(); renameSel(); return;
    case 'Escape': if (A.cancelCountIn()) { done(); return; } ui.arrSel = []; ui.timeSel = null; U.inval('arrange-draw'); return;
    case 'Delete': case 'Backspace': done(); if (ui.mapMode && U.unmapTarget()) return; del(ctx, roll); return;
    case 'Enter': if (ctx === 'session' && ui.slot) { done(); U.ensureAudio(); U.engine.launch(ui.slot.t, ui.slot.s); } return;
    case '+': case '=': done(); U.arrangeView.zoomAt(1.4, U.arrangeView.width / 2); return;
    case '-': done(); U.arrangeView.zoomAt(1 / 1.4, U.arrangeView.width / 2); return;
  }
  switch (e.code) {
    case 'KeyB': done(); U.setDraw(!ui.draw); return;
    case 'KeyA': done(); U.setAutoMode(!ui.auto); return;
    case 'KeyM': done(); U.setKeyboard(!ui.keyboard); return;
    case 'KeyP': done(); U.togglePads(); return;
    case 'Digit0': if (roll) { done(); U.clipView.muteSel(); } return;
  }
  if (k.startsWith('Arrow')) {
    const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
    const dy = k === 'ArrowUp' ? 1 : k === 'ArrowDown' ? -1 : 0;
    if (roll) { if (U.clipView.nudge(dx, dy * (e.shiftKey ? 12 : 1))) done(); return; }
    if (ctx === 'session') { done(); moveSlot(dx, -dy); }
  }
}
function onKeyUp(e) {
  if (U.padsView.keyUp(e)) { e.preventDefault(); return; }
  if (ui.keyboard && kbUp(e)) e.preventDefault();
}
function duplicate(ctx, roll) {
  if (roll) { U.clipView.duplicateSel(); return; }
  if (ctx === 'arrange') { U.arrangeView.dup(); return; }
  if (ctx === 'session') {
    if (ui.slot && U.trackById(pr(), ui.slot.t) && U.trackById(pr(), ui.slot.t).slots[ui.slot.s]) A.duplicateClip(ui.slot.t, ui.slot.s);
    else A.duplicateScene(ui.scene);
    return;
  }
  const t = U.selTrack();
  if (t) A.duplicateTrack(t.id);
}
function del(ctx, roll) {
  if (roll) { U.clipView.deleteSel(); return; }
  if (ctx === 'arrange') { U.arrangeView.del(); return; }
  if (ctx === 'session' && ui.slot) { A.deleteSlot(ui.slot.t, ui.slot.s); return; }
  if (ctx === 'devices' && ui.selDevice) {
    const r = U.deviceById(pr(), ui.selDevice);
    if (r) A.removeDevice(r.track.id, r.dev.id);
  }
}
function renameSel() {
  const r = U.clipRef();
  if (r && (ui.focus === 'session' || ui.focus === 'arrange' || ui.focus === 'roll')) {
    U.ask('클립 이름', '이름', r.clip.name).then(v => { if (v != null) A.clipProp(ui.clip, c => { c.name = v; }, '클립 이름'); });
    return;
  }
  const t = U.selTrack();
  if (t) U.ask('트랙 이름', '이름', t.name || U.trackLabel(pr(), t)).then(v => { if (v != null) A.renameTrack(t.id, v); });
}
function moveSlot(dx, dy) {
  const p = pr();
  let ti = Math.max(0, p.tracks.findIndex(t => ui.slot ? t.id === ui.slot.t : t.id === ui.track));
  let s = ui.slot ? ui.slot.s : ui.scene;
  ti = U.clamp(ti + dx, 0, p.tracks.length - 1);
  s = U.clamp(s + dy, 0, p.scenes.length - 1);
  const t = p.tracks[ti];
  U.sessionView.selectSlot(t, s, !!t.slots[s]);
}

/* ================= MIDI 장치 ================= */
let midi = null;
const midiHeld = new Map();
async function connectMidi(ask) {
  if (!navigator.requestMIDIAccess) {
    if (ask) U.toast(U.isIOS ? '아이패드·아이폰의 브라우저는 MIDI 장치를 지원하지 않아요. 패드 화면의 패드와 건반으로 쳐 주세요.' : '이 브라우저는 MIDI 장치를 지원하지 않아요. 크롬이나 엣지를 써 보세요.', 'error');
    return false;
  }
  if (!ask) {
    try {
      const st = await navigator.permissions.query({ name: 'midi' });
      if (st.state !== 'granted') return false;
    } catch (e) { return false; }
  }
  try {
    midi = await navigator.requestMIDIAccess();
  } catch (e) {
    if (ask) U.toast('MIDI 장치에 연결하지 못했어요. 브라우저 권한을 확인해 주세요.', 'error');
    return false;
  }
  const bind = () => { for (const inp of midi.inputs.values()) inp.onmidimessage = onMidi; U.inval('status'); };
  bind();
  midi.onstatechange = bind;
  if (ask) U.toast(midiCount() ? 'MIDI 장치 ' + midiCount() + '개를 연결했어요.' : 'MIDI 장치를 찾지 못했어요. 장치를 꽂은 뒤 다시 눌러 주세요.');
  return true;
}
/* ================= MIDI 매핑 =================
   매핑 모드에서 노브를 누르고 장치의 손잡이를 돌리면 이어진다 */
function mapKey(m) { return JSON.stringify(m.t); }
U.mapFor = json => (pr().midimap || []).find(m => mapKey(m) === json) || null;
U.setMapMode = function (on) {
  ui.mapMode = on;
  ui.mapTarget = null;
  document.body.classList.toggle('map-mode', on);
  document.querySelectorAll('.map-target').forEach(el => el.classList.remove('map-target'));
  U.inval('transport', 'status');
  if (on) U.toast(midiCount() ? '바꿀 노브나 페이더를 누른 뒤 MIDI 장치의 손잡이를 돌려 주세요.' : 'MIDI 장치를 먼저 연결해 주세요 (상태 줄의 "MIDI 연결").');
};
U.midiLearn = function (el) {
  document.querySelectorAll('.map-target').forEach(x => x.classList.remove('map-target'));
  el.classList.add('map-target');
  ui.mapTarget = el.dataset.map;
  const m = U.mapFor(ui.mapTarget);
  U.setInfo('MIDI 매핑', m ? '지금 CC ' + m.cc + '(채널 ' + (m.ch + 1) + ')에 이어져 있어요. 다른 손잡이를 돌리면 바꿔요. Delete를 누르면 끊어요.' : '이제 MIDI 장치의 손잡이나 페이더를 돌려 주세요.');
};
function learnCC(ch, cc) {
  const p = pr();
  if (!p.midimap) p.midimap = [];
  const t = JSON.parse(ui.mapTarget);
  p.midimap = p.midimap.filter(m => !(m.ch === ch && m.cc === cc) && mapKey(m) !== ui.mapTarget);
  p.midimap.push({ ch, cc, t });
  U.commit('MIDI 매핑');
  U.toast('CC ' + cc + '에 이었어요.');
  document.querySelectorAll('[data-map]').forEach(el => { const m = U.mapFor(el.dataset.map); if (m) el.dataset.cc = 'CC' + m.cc; else delete el.dataset.cc; });
}
U.unmapTarget = function () {
  if (!ui.mapTarget) return false;
  const p = pr();
  p.midimap = (p.midimap || []).filter(m => mapKey(m) !== ui.mapTarget);
  U.commit('MIDI 매핑 끊기');
  document.querySelectorAll('[data-map]').forEach(el => { if (el.dataset.map === ui.mapTarget) delete el.dataset.cc; });
  return true;
};
const commitCC = U.debounce(() => U.commit('MIDI 컨트롤'), 500);
function applyCC(m, val) {
  const n = val / 127, t = m.t;
  if (t.k === 'dev') {
    const r = U.deviceById(pr(), t.d);
    if (!r) return;
    const spec = U.DEV[r.dev.kind].byId[t.p];
    if (spec) A.setParam(t.d, t.p, U.fromNorm(spec, n), false);
  } else if (t.k === 'vol') A.setMixer(t.tr, 'vol', U.round(U.posToDb(n), 1), false);
  else if (t.k === 'pan') A.setMixer(t.tr, 'pan', U.round(n * 2 - 1, 3), false);
  else if (t.k === 'send') {
    const i = pr().returns.findIndex(r => r.id === t.r);
    if (i >= 0) A.setMixer(t.tr, 'send', U.round(U.posToDb(n * U.dbToPos(0)), 1), false, i);
  }
  const json = JSON.stringify(t);
  document.querySelectorAll('[data-map]').forEach(el => { if (el.dataset.map === json && el.update) el.update(); });
  commitCC();
}
function onCC(ch, cc, val) {
  if (ui.mapMode && ui.mapTarget) { learnCC(ch, cc); return; }
  for (const m of pr().midimap || []) if (m.cc === cc && m.ch === ch) applyCC(m, val);
}

function midiCount() { return midi ? [...midi.inputs.values()].filter(i => i.state === 'connected').length : 0; }
function onMidi(ev) {
  const [st, d1, d2] = ev.data;
  const type = st & 0xf0;
  if (type === 0xb0) { onCC(st & 0x0f, d1, d2); return; }
  if (type === 0x90 && d2 > 0) {
    U.ensureAudio();
    const ids = liveTargets();
    for (const id of ids) U.engine.liveOn(id, d1, d2);
    midiHeld.set(d1, ids);
    U.emit('livenote', { p: d1, on: true });
  } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
    const ids = midiHeld.get(d1) || liveTargets();
    for (const id of ids) U.engine.liveOff(id, d1);
    midiHeld.delete(d1);
    U.emit('livenote', { p: d1, on: false });
  }
}

function init() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  connectMidi(false);
}
U.input = { init, connectMidi, midiCount, liveTargets, onMidi };
})(window.U = window.U || {});
