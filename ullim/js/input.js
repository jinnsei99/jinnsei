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
  let ids = liveTargets();
  if (!ids.length) { U.toast('MIDI 트랙을 고르거나 ● 녹음 준비를 켜 주세요.'); return true; }
  // 드럼 · 루프 패드 트랙은 패드 글자로 친다 (그 트랙에는 건반 음을 보내지 않는다)
  if (U.padsView.kbPads()) { ids = ids.filter(id => !isPadTrack(U.trackById(pr(), id))); if (!ids.length) return true; }
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
  midiAllOff();
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
  const kp = on && U.padsView.kbPads();
  U.toast(!on ? '컴퓨터 건반을 껐어요.' : kp && kp.keys ? '컴퓨터 건반을 켰어요. ' + U.trackLabel(pr(), kp.t) + '은(는) 글자 키로 쳐요: ' + kp.keys + (kp.drums ? '. 다른 트랙을 고르면 A~K 줄이 건반이 돼요.' : '') : kp ? '컴퓨터 건반을 켰어요. 루프 패드는 패드 화면의 키 지정으로 글자를 정해 주세요.' : '컴퓨터 건반을 켰어요. A~K 줄로 연주해요.');
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

/* ================= MIDI 장치 =================
   건반(세기 → 터치 감도), 패드(드럼 트랙으로), 노브 8개(소리 다듬기 손잡이), 피치 벤드 · 모드 휠 · 누르는 힘(애프터터치), 서스테인.
   M-VAVE SMK-25 mini · Akai MPK mini MK3 같은 작은 건반을 꽂으면 바로 쓰도록 맞췄다. 패드 채널과 노브 번호가 장치마다 다르면 'MIDI 장치' 창에서 알아낸다 */
let midi = null;
const MC = Object.assign({ padCh: 9, curve: 'normal', fixed: 100, pb: 2, at: 'vib', knobs: [], devKnobs: {} }, U.pref('midiCfg', null) || {});
if (!MC.devKnobs) MC.devKnobs = {};   // 장치 이름 → 알아본 노브 (장치를 바꿔 꽂아도 그 장치의 노브로)
const saveCfg = () => U.setPref('midiCfg', MC);
/* 터치 감도: 들어온 세기 → 칠 세기 */
const CURVES = {
  light: v => 127 * Math.pow(v / 127, 0.6),   // 가볍게: 살살 쳐도 크게
  normal: v => v,
  heavy: v => 127 * Math.pow(v / 127, 1.6),   // 무겁게: 세게 쳐야 크게
  fixed: () => MC.fixed                       // 고정: 늘 같은 세기
};
const curveVel = v => U.clamp(Math.round((CURVES[MC.curve] || CURVES.normal)(v)), 1, 127);
/* 노브 8개가 움직이는 것: 건반이 치는 트랙의 소리 다듬기 손잡이와 트랙 볼륨 */
const KNOBS = [['bright', '밝기'], ['len', '길이'], ['width', '두께'], ['drive', '드라이브'], ['space', '공간'], ['vel', '세기 반응'], ['vol', '음량'], ['fader', '트랙 볼륨']];
const midiHeld = new Map();   // '채널:음' → {ids, p}
const sustained = new Map();  // 서스테인 페달로 붙잡아 둔 음
const X = { bend: 0, mod: 0, press: 0, sus: false, poly: new Map(), tracks: new Set(), keyCh: new Map() };
let learn = null;             // {what: 'pad'} · {what: 'knob', i, ch, cc, vals, timer}

let flashT = 0;
function act(o) {
  U.emit('midi', o);
  const b = document.querySelector('.st-midi');
  if (!b) return;
  b.classList.add('act');
  clearTimeout(flashT);
  flashT = setTimeout(() => b.classList.remove('act'), 120);
}
let hintAt = 0;
const hintOnce = msg => { const now = Date.now(); if (now - hintAt > 4000) { hintAt = now; U.toast(msg); } };

async function connectMidi(ask) {
  if (!navigator.requestMIDIAccess) {
    if (ask) U.toast(U.isIOS ? '아이패드·아이폰의 브라우저는 MIDI 장치를 지원하지 않아요. 컴퓨터의 크롬·엣지에서 연결해 주세요.' : '이 브라우저는 MIDI 장치를 지원하지 않아요. 크롬이나 엣지를 써 보세요.', 'error');
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
  const bind = () => {
    for (const inp of midi.inputs.values()) inp.onmidimessage = e => onMidi(e, inp);
    U.inval('status');
    U.emit('midi', { k: 'devices' });
    greet();
  };
  bind();
  midi.onstatechange = bind;
  if (ask) U.toast(midiCount() ? 'MIDI 장치 ' + midiCount() + '개를 연결했어요.' : 'MIDI 장치를 찾지 못했어요. 장치를 꽂은 뒤 다시 눌러 주세요.');
  return true;
}
function devices() { return midi ? [...midi.inputs.values()].map(i => ({ id: i.id, name: i.name || 'MIDI 장치', maker: i.manufacturer || '', on: i.state === 'connected' })) : []; }
/* ---------- 잘 알려진 건반 ----------
   이름으로 알아본다. MPK mini MK3는 노브 8개가 CC 70~77, 패드가 10번 채널로 정해져 있어 알아보기 없이 바로 쓰고,
   SMK-25 mini는 장치 설정에 따라 달라서 노브만 한 번 알아보기 */
const PROFILES = [
  { id: 'mpk3', name: 'Akai MPK mini MK3', test: d => /mpk\s*mini\s*(3|iii|mk\s*3|play)/i.test(d.name), knobs: [70, 71, 72, 73, 74, 75, 76, 77], pads: 'mpc',
    hello: '건반은 누른 세기대로, 패드(A·B 뱅크)는 드럼 트랙으로, 노브 8개는 소리 다듬기 손잡이로, 조이스틱은 피치 벤드 · 모드로 바로 써요.',
    panel: '노브 8개(CC 70~77)는 이어 두었어요 · 조이스틱 좌우 = 피치 벤드, 위 = 모드 · 패드 A·B 뱅크 = 드럼 패드 1~16 · 노트 리피트 · 아르페지에이터는 건반 쪽에서' },
  { id: 'smk', name: 'M-VAVE SMK-25 mini', test: d => /smk|m-?vave/i.test(d.name + ' ' + (d.maker || '')), pref: 'midiSMK',
    hello: '건반은 누른 세기대로, 패드는 드럼 트랙으로 가요. 노브는 MIDI 장치 창에서 한 번 알아보기를 해 주세요.',
    panel: '노브는 장치 설정에 따라 번호가 달라서 한 번 알아보기를 해 주세요 · 피치 벤드 · 모드 버튼, 서스테인 버튼도 돼요' }
];
const profileOf = d => (d && PROFILES.find(p => p.test(d))) || null;
const isSMK = d => (profileOf(d) || {}).id === 'smk';
/* 아는 건반을 처음 꽂으면 한 번 알려 준다 */
function greet() {
  for (const d of devices()) {
    const pf = d.on && profileOf(d);
    if (!pf) continue;
    const key = pf.pref || 'midiHello:' + pf.id;
    if (U.pref(key, false)) continue;
    U.setPref(key, true);
    U.toast(pf.name + '을(를) 찾았어요. ' + pf.hello);
  }
  U.emit('midi', { k: 'learn', done: true });
}
/* 노브 목록: 그 장치에서 알아본 노브 → 아는 건반의 정해진 노브 → 장치를 모를 때 알아본 노브 */
const profKnobs = {};
function knobsFor(dev) {
  if (dev && MC.devKnobs[dev]) return MC.devKnobs[dev];
  const pf = dev && profileOf({ name: dev });
  if (pf && pf.knobs) return profKnobs[pf.id] || (profKnobs[pf.id] = pf.knobs.map(cc => ({ ch: -1, cc, mode: 'auto', src: pf.id })));
  return MC.knobs;
}
/* 지금 쓰는 장치: 마지막으로 무언가 보낸 장치(아직 꽂혀 있으면), 아니면 처음 연결된 장치 */
function curDev() {
  const on = devices().filter(x => x.on);
  if (X.dev && on.some(x => x.name === X.dev)) return X.dev;
  return on.length ? on[0].name : X.dev || '';
}
const knobs = () => knobsFor(curDev());
const kMatch = (k, ch, cc) => !!k && k.cc === cc && (k.ch === ch || k.ch === -1);
/* 지우기: 이 장치에서 알아본 것 → (없으면) 아는 건반은 정해진 노브라 그대로, 모르는 건반은 공통으로 알아본 것 */
function clearKnobs() {
  const dev = curDev(), pf = dev && profileOf({ name: dev });
  if (dev && MC.devKnobs[dev]) delete MC.devKnobs[dev];
  else if (!(pf && pf.knobs)) MC.knobs = [];
  saveCfg();
  U.emit('midi', { k: 'learn', done: true });
}

/* ---------- 건반 · 패드 ---------- */
const isPadTrack = t => !!t && t.type === 'midi' && ['drums', 'looppad'].includes((U.instrumentOf(t) || {}).kind);
/* 건반으로 드럼 치기: 드럼 머신의 패드 16개는 GM 자리(C1 36 ~ D#2 51)에 있다 (C 킥 · D 스네어 · F# 닫힌 햇 · A# 열린 햇 …).
   그 자리의 음은 그대로 치고, 바깥 음은 두 옥타브씩 접어서 건반이 어느 옥타브에 있든 킷 한 벌이 손 밑에 온다.
   두 옥타브 가운데 아래 옥타브는 C1~B1(킥 · 스네어 · 햇 · 탐), 위 옥타브의 C~D#는 C2~D#2(탬버린 · 크래시 · 라이드), E~B는 다시 햇 · 탐 */
function drumNote(p) {
  if (p === 35) return 36;   // GM의 어쿠스틱 베이스 드럼 → 킥
  let q = 36 + (((p - 36) % 24) + 24) % 24;
  if (q >= 52) q -= 12;
  return q;
}
const drumTrack = id => { const t = U.trackById(pr(), id), d = t && U.instrumentOf(t); return d && d.kind === 'drums' ? t : null; };
const noteFor = (id, p) => (drumTrack(id) ? drumNote(p) : p);
/* 건반이 치는 드럼 트랙 (MIDI 장치 창이 건반 위에 드럼 이름을 적는다) */
function keysDrum() { for (const id of liveTargets()) { const t = drumTrack(id); if (t) return t; } return null; }
function drumPadName(t, q) { const d = t && U.instrumentOf(t), pd = d && d.data && d.data.pads && d.data.pads[q - 36]; return pd ? pd.name || '패드 ' + (q - 35) : ''; }
const heldOff = h => { h.ids.forEach((id, i) => U.engine.liveOff(id, h.ps ? h.ps[i] : h.p)); };
/* 패드가 칠 트랙: 녹음 준비한 패드 트랙 → 고른 트랙(드럼 · 루프 패드면) → 연주 화면에 띄운 패드 트랙 → 첫 드럼 머신 → 첫 루프 패드 */
function padTarget() {
  const list = pr().tracks.filter(isPadTrack);
  if (!list.length) return null;
  const armed = list.filter(t => t.arm);
  if (armed.length) return armed.map(t => t.id);
  const st = U.selTrack(), pt = U.padsShown() && ui.padTrack && U.trackById(pr(), ui.padTrack);
  const one = isPadTrack(st) ? st : isPadTrack(pt) ? pt : list.find(t => U.instrumentOf(t).kind === 'drums') || list[0];
  return [one.id];
}
function noteOn(ch, p, v) {
  U.ensureAudio();
  const pad = ch === MC.padCh;
  const ids = (pad && padTarget()) || liveTargets();
  if (!ids.length) { hintOnce('MIDI 트랙을 고르거나 ● 녹음 준비를 켜 주세요.'); return; }
  const vel = curveVel(v), key = ch + ':' + p;
  if (!pad) X.keyCh.set(ch, (X.keyCh.get(ch) || 0) + 1);   // 건반이 주로 오는 채널 (패드 알아보기에서 본다)
  // 서스테인으로 붙잡아 둔 같은 음은 놓고 새로 친다
  const s = sustained.get(key);
  if (s) { sustained.delete(key); heldOff(s); }
  // 드럼 트랙으로 가는 음은 킷의 패드 자리로 (건반으로 드럼 치기)
  const ps = ids.map(id => noteFor(id, p));
  ids.forEach((id, i) => U.engine.liveOn(id, ps[i], vel));
  midiHeld.set(key, { ids, p, ps });
  U.emit('livenote', { p, on: true, src: 'midi' });
  const dt = !pad && drumTrack(ids[0]);
  act({ k: pad ? 'pad' : 'note', ch, p, v, vel, ids, drum: dt ? { q: ps[0], name: drumPadName(dt, ps[0]) } : null });
}
function noteOff(ch, p) {
  const key = ch + ':' + p, h = midiHeld.get(key);
  if (X.poly.delete(p)) pressure(X.poly.size ? Math.max(...X.poly.values()) : 0);
  if (!h) return;
  midiHeld.delete(key);
  act({ k: 'off', ch, p, pad: ch === MC.padCh });
  // 서스테인 페달을 밟고 있으면 뗄 때까지 울린다 (패드는 그대로)
  if (X.sus && ch !== MC.padCh) { sustained.set(key, h); return; }
  heldOff(h);
  U.emit('livenote', { p, on: false, src: 'midi' });
}
function setSustain(on) {
  X.sus = on;
  if (!on) {
    for (const [key, h] of sustained) if (!midiHeld.has(key)) { heldOff(h); U.emit('livenote', { p: h.p, on: false, src: 'midi' }); }
    sustained.clear();
  }
  act({ k: 'sus', on });
}
function midiAllOff() {
  for (const [, h] of midiHeld) heldOff(h);
  for (const [, h] of sustained) heldOff(h);
  midiHeld.clear();
  sustained.clear();
}

/* ---------- 표현: 피치 벤드 · 모드 휠 · 누르는 힘 ---------- */
function exprTo(o) {
  const ids = liveTargets();
  for (const id of ids) { U.engine.expr(id, o); X.tracks.add(id); }
  // 표현을 받던 트랙이 바뀌면 제자리로
  for (const id of [...X.tracks]) if (!ids.includes(id)) { U.engine.expr(id, { bend: 0, vib: 0 }); X.tracks.delete(id); }
}
const vibOf = () => 40 * Math.max(X.mod, MC.at === 'vib' ? X.press : 0);   // 비브라토 깊이 (센트)
function pitchBend(v14) { X.bend = (v14 - 8192) / 8192; exprTo({ bend: X.bend * MC.pb * 100 }); act({ k: 'bend', v: X.bend }); }
function modWheel(v) { X.mod = v / 127; exprTo({ vib: vibOf() }); act({ k: 'mod', v: X.mod }); }
function pressure(v) { X.press = v / 127; exprTo({ vib: vibOf() }); act({ k: 'press', v: X.press }); }
function polyPressure(ch, p, v) {
  if (ch === MC.padCh) { act({ k: 'press', v: v / 127, pad: true, p }); return; }
  if (v > 0) X.poly.set(p, v); else X.poly.delete(p);
  pressure(X.poly.size ? Math.max(...X.poly.values()) : 0);
}

/* ---------- 노브 ----------
   끝없이 도는 노브(엔코더)는 '얼마나 돌렸는지'를 보낸다: 1 · 127(2의 보수) 또는 65 · 63(64 기준). 보통 노브는 0~127 자리 */
const REL2 = v => v <= 7 || v >= 121, REL64 = v => v >= 57 && v <= 71;
const relDelta = (mode, v) => (mode === 'rel64' ? v - 64 : v < 64 ? v : v - 128);
const ccSeen = new Map();
/* 이 CC는 어떤 노브인가: 알아본 노브는 그 방식, 아니면 들어오는 값으로 알아낸다.
   가운데 값이면 보통 노브, 같은 작은 값이 이어지면 끝없는 노브, 한두 칸씩 바뀌면 보통 노브. 아직 모르면 'wait' (그 값은 건너뛴다, 값이 튀지 않게) */
function ccMode(ch, cc, v) {
  const k = knobs().find(x => kMatch(x, ch, cc));
  if (k && k.mode !== 'auto') return k.mode;
  const key = ch + ':' + cc, sn = ccSeen.get(key) || { vals: [], mode: null };
  ccSeen.set(key, sn);
  if (!sn.mode) {
    const prev = sn.vals.length ? sn.vals[sn.vals.length - 1] : null;
    sn.vals.push(v);
    if (sn.vals.length > 4) sn.vals.shift();
    if (!REL2(v) && !REL64(v)) sn.mode = 'abs';
    else if (prev === v) sn.mode = REL64(v) ? 'rel64' : 'rel2';
    else if (prev != null && Math.abs(prev - v) <= 2) sn.mode = 'abs';
    else if (sn.vals.length >= 4) sn.mode = REL64(v) ? 'rel64' : 'rel2';
    if (sn.mode && k) { k.mode = sn.mode; if (!k.src) saveCfg(); }
  }
  return sn.mode || 'wait';
}
function knobTrack() { const ids = liveTargets(); return ids.length ? U.trackById(pr(), ids[0]) : null; }
function knobGet(t, id) {
  if (!t) return null;
  if (id === 'fader') return U.dbToPos(t.vol);
  return U.shapeKnob ? U.shapeKnob.get(t, id) : null;
}
const commitKnob = U.debounce(() => U.commit('MIDI 노브'), 600);
function knobTurn(i, val, mode) {
  const t = knobTrack(), id = KNOBS[i][0];
  const cur = knobGet(t, id);
  if (cur == null) return null;   // 이 소리에는 없는 손잡이 (앰프가 없으면 드라이브처럼)
  if (mode === 'wait') return cur;
  const m = mode === 'abs' ? val / 127 : U.clamp(cur + relDelta(mode, val) / 100, 0, 1);
  if (id === 'fader') A.setMixer(t.id, 'vol', U.round(U.posToDb(m), 1), false);
  else U.shapeKnob.set(t, id, m, false);
  commitKnob();
  return m;
}
/* 노브 알아보기: 1번부터 차례로 오른쪽으로 돌리면 그 CC와 방식을 배운다 */
function learnKnob(ch, cc, v) {
  const L = learn;
  if (L.cc == null || L.cc !== cc || L.ch !== ch) {
    if (L.list.some((k, j) => j < L.i && kMatch(k, ch, cc))) return;   // 앞에서 배운 노브를 아직 돌리는 중
    if (L.cc != null) finishKnob();
    if (!learn) return;
    L.cc = cc; L.ch = ch; L.vals = [];
  }
  L.vals.push(v);
  clearTimeout(L.timer);
  if (L.vals.length >= 4) finishKnob();
  else L.timer = setTimeout(finishKnob, 450);
}
function finishKnob() {
  const L = learn;
  if (!L || L.what !== 'knob' || L.cc == null) return;
  clearTimeout(L.timer);
  const vals = L.vals, v = vals[vals.length - 1], same = vals.length >= 2 && vals.every(x => x === vals[0]);
  // 오른쪽으로 돌리면 보통 노브는 값이 커지고, 끝없는 노브는 같은 작은 값(1 또는 65)이 이어진다. 하나만 왔으면 쓰면서 알아낸다
  const mode = same && REL2(v) ? 'rel2' : same && REL64(v) ? 'rel64' : vals.length >= 2 || (!REL2(v) && !REL64(v)) ? 'abs' : 'auto';
  const i = L.i, cc = L.cc;
  L.list[i] = { ch: L.ch, cc, mode };
  saveCfg();
  ccSeen.delete(L.ch + ':' + cc);
  L.i++;
  L.cc = null;
  L.vals = [];
  if (L.i >= KNOBS.length) { learn = null; U.toast('노브 8개를 모두 이었어요.'); }
  U.emit('midi', { k: 'learn', what: 'knob', i, cc, mode, done: !learn });
}
function startLearn(what) {
  if (learn && learn.timer) clearTimeout(learn.timer);
  learn = what === 'knob' ? { what, i: 0, cc: null, vals: [], list: [] } : what === 'pad' ? { what } : null;
  // 알아본 노브는 그 장치 것으로 둔다 (장치를 모르면 공통)
  if (what === 'knob') { const dev = curDev(); if (dev) MC.devKnobs[dev] = learn.list; else MC.knobs = learn.list; }
  U.emit('midi', { k: 'learn', what, start: true });
}
function stopLearn() {
  if (learn && learn.what === 'knob') { finishKnob(); saveCfg(); }
  learn = null;
  U.emit('midi', { k: 'learn', done: true });
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
/* 이은 노브로 값을 바꾼다. 끝없이 도는 노브면 지금 값에서 조금씩 */
function applyCC(m, val, mode) {
  const t = m.t;
  const to = cur => (mode === 'abs' ? val / 127 : U.clamp(cur + relDelta(mode, val) / 100, 0, 1));
  if (t.k === 'dev') {
    const r = U.deviceById(pr(), t.d);
    if (!r) return;
    const spec = U.DEV[r.dev.kind].byId[t.p];
    if (spec) A.setParam(t.d, t.p, U.fromNorm(spec, to(U.toNorm(spec, r.dev.p[t.p]))), false);
  } else {
    const tr = U.trackById(pr(), t.tr);
    if (!tr) return;
    if (t.k === 'vol') A.setMixer(t.tr, 'vol', U.round(U.posToDb(to(U.dbToPos(tr.vol))), 1), false);
    else if (t.k === 'pan') A.setMixer(t.tr, 'pan', U.round(to((tr.pan + 1) / 2) * 2 - 1, 3), false);
    else if (t.k === 'send') {
      const i = pr().returns.findIndex(r => r.id === t.r), top = U.dbToPos(0);
      if (i >= 0) A.setMixer(t.tr, 'send', U.round(U.posToDb(to(U.dbToPos(tr.sends[i] == null ? U.OFF_DB : tr.sends[i]) / top) * top), 1), false, i);
    }
  }
  const json = JSON.stringify(t);
  document.querySelectorAll('[data-map]').forEach(el => { if (el.dataset.map === json && el.update) el.update(); });
  commitCC();
}
function onCC(ch, cc, val) {
  if (learn && learn.what === 'knob' && cc !== 1 && cc !== 64 && cc < 120) { learnKnob(ch, cc, val); act({ k: 'cc', ch, cc, v: val, learning: true }); return; }
  if (ui.mapMode && ui.mapTarget) { learnCC(ch, cc); return; }
  const maps = (pr().midimap || []).filter(m => m.cc === cc && m.ch === ch);
  if (maps.length) { const mode = ccMode(ch, cc, val); if (mode !== 'wait') for (const m of maps) applyCC(m, val, mode); act({ k: 'cc', ch, cc, v: val, mapped: true }); return; }
  if (cc === 1) { modWheel(val); return; }
  if (cc === 64) { setSustain(val >= 64); return; }
  if (cc === 120 || cc === 123) { midiAllOff(); return; }
  const i = knobs().findIndex(k => kMatch(k, ch, cc));
  const m = i >= 0 ? knobTurn(i, val, ccMode(ch, cc, val)) : null;
  act({ k: 'cc', ch, cc, v: val, knob: i, m });
}

function midiCount() { return midi ? [...midi.inputs.values()].filter(i => i.state === 'connected').length : 0; }
function onMidi(ev, inp) {
  const d = ev.data, st = d[0];
  if (st >= 0xf0) return;   // 클럭 · 시스템 메시지
  if (inp && inp.name && X.dev !== inp.name) { X.dev = inp.name; U.emit('midi', { k: 'dev', name: inp.name }); }
  const type = st & 0xf0, ch = st & 0x0f, d1 = d[1], d2 = d[2];
  switch (type) {
    case 0x90:
      if (d2 > 0) { if (learn && learn.what === 'pad') learnPad(ch); noteOn(ch, d1, d2); }
      else noteOff(ch, d1);
      return;
    case 0x80: noteOff(ch, d1); return;
    case 0xb0: onCC(ch, d1, d2); return;
    case 0xe0: if (ch !== MC.padCh) pitchBend((d2 << 7) | d1); return;
    case 0xd0: if (ch !== MC.padCh) pressure(d1); else act({ k: 'press', v: d1 / 127, pad: true }); return;
    case 0xa0: polyPressure(ch, d1, d2); return;
    case 0xc0: act({ k: 'pc', ch, v: d1 }); return;
  }
}
/* 건반이 주로 오는 채널 (아직 안 쳤으면 1번) */
function keysChannel() { let best = 0, n = 0; for (const [c, k] of X.keyCh) if (k > n) { n = k; best = c; } return best; }
function learnPad(ch) {
  if (ch === keysChannel() && ch !== MC.padCh) {
    learn = null;
    U.emit('midi', { k: 'learn', what: 'pad', same: true, ch, done: true });
    U.toast('패드가 건반과 같은 ' + (ch + 1) + '번 채널로 와요. 이대로면 패드도 건반 트랙으로 가요. 건반의 편집 앱(M-VAVE · MPK mini 3 Program Editor)에서 패드 채널을 10번으로 바꾸면 드럼 트랙으로 갈라져요.');
    return;
  }
  MC.padCh = ch;
  saveCfg();
  learn = null;
  U.emit('midi', { k: 'learn', what: 'pad', ch, done: true });
  U.toast('패드는 ' + (ch + 1) + '번 채널이에요. 이제 패드는 드럼 트랙으로 가요.');
}

function init() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  connectMidi(false);
}
U.input = {
  init, connectMidi, midiCount, liveTargets, onMidi, devices, isSMK, profileOf, PROFILES, cfg: MC, saveCfg, curveVel, CURVES, KNOBS,
  knobs, clearKnobs, curDev, startLearn, stopLearn, learning: () => learn, padTarget, knobTrack, knobGet, state: X, drumNote, keysDrum, drumPadName,
  supported: () => !!navigator.requestMIDIAccess, connected: () => !!midi
};
})(window.U = window.U || {});
