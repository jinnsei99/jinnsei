/* 울림 — 프로젝트 데이터: 만들기 · 찾기 · 복제 · 되돌리기 */
(function (U) {
'use strict';

const OFF_DB = -70; // 센드/볼륨에서 -∞ 대신 쓰는 값

/* ================= 만들기 ================= */
function newScene() { return { id: U.uid('s'), name: '', tempo: null }; }

function newTrack(type, o) {
  o = o || {};
  return {
    id: U.uid('t'), type,
    name: o.name || '',
    color: o.color != null ? o.color : 0,
    on: true, solo: false, arm: false,
    vol: o.vol != null ? o.vol : 0, pan: 0,
    sends: [], devices: o.devices || [],
    slots: [], arr: [], auto: {}
  };
}

function newMidiClip(len, o) {
  o = o || {};
  len = len || 4;
  return {
    id: U.uid('c'), type: 'midi',
    name: o.name || '', color: o.color != null ? o.color : 0,
    notes: o.notes || [],
    start: 0, end: len, loop: { on: o.loop !== false, start: 0, end: len },
    launch: 'trigger', quant: 'global', legato: false,
    follow: { on: false, a: 'next', b: 'none', chance: 1, time: len },
    scale: o.scale || null, groove: true
  };
}
/* 오디오 클립 위치 단위는 '샘플 박'(원래 BPM 기준) */
function newAudioClip(ref, info, o) {
  o = o || {};
  const bpm = info.bpm || 120;
  const sb = info.duration * bpm / 60;
  const len = info.loop ? Math.max(0.25, Math.round(sb * 4) / 4) : sb;
  return {
    id: U.uid('c'), type: 'audio',
    name: o.name || info.name || '오디오', color: o.color != null ? o.color : 0,
    ref, warp: !!info.loop, mode: info.loop ? info.mode || 'beats' : 'repitch', bpm,
    gain: 0, trans: 0, rev: false,
    start: 0, end: len, loop: { on: !!info.loop, start: 0, end: len },
    launch: 'trigger', quant: 'global', legato: false,
    follow: { on: false, a: 'next', b: 'none', chance: 1, time: 4 }
  };
}

function trackLabel(pr, t) {
  if (t.name) return t.name;
  if (t.type === 'master') return '마스터';
  if (t.type === 'return') return String.fromCharCode(65 + pr.returns.indexOf(t)) + ' 리턴';
  return (pr.tracks.indexOf(t) + 1) + ' ' + (t.type === 'midi' ? 'MIDI' : '오디오');
}
function returnLetter(pr, t) { return String.fromCharCode(65 + pr.returns.indexOf(t)); }
function sceneLabel(pr, i) { const s = pr.scenes[i]; return (s && s.name) || String(i + 1); }

function addTrack(pr, type, index, o) {
  o = o || {};
  const t = newTrack(type, o);
  if (o.color == null) t.color = (pr.tracks.length * 3 + (type === 'audio' ? 6 : 0)) % U.COLORS.length;
  t.slots = pr.scenes.map(() => null);
  t.sends = pr.returns.map(() => OFF_DB);
  if (type === 'midi' && !o.devices) t.devices.push(U.makeDevice('polysynth'));
  if (index == null || index < 0 || index > pr.tracks.length) pr.tracks.push(t);
  else pr.tracks.splice(index, 0, t);
  return t;
}
function addReturn(pr, fx, name) {
  const t = newTrack('return', { name: name || '', color: 18 + pr.returns.length % 2 });
  if (fx) t.devices.push(U.makeDevice(fx, fx === 'reverb' || fx === 'delay' ? { p: { mix: 1 } } : null));
  pr.returns.push(t);
  for (const tr of pr.tracks.concat(pr.returns)) while (tr.sends.length < pr.returns.length) tr.sends.push(OFF_DB);
  t.sends = pr.returns.map(() => OFF_DB);
  return t;
}
function removeReturn(pr, id) {
  const i = pr.returns.findIndex(r => r.id === id);
  if (i < 0) return;
  pr.returns.splice(i, 1);
  for (const tr of pr.tracks.concat(pr.returns)) tr.sends.splice(i, 1);
  for (const tr of allTracks(pr)) delete tr.auto['send:' + id];
}

function newProject(name) {
  const pr = {
    v: 1, id: U.uid('p'), name: name || '새 프로젝트',
    bpm: 120, sig: [4, 4], key: { root: 0, scale: 'major' }, swing: 0, quant: '1bar',
    loop: { on: false, start: 0, end: 16 }, metro: false, pos: 0,
    tracks: [], returns: [], master: null, scenes: [],
    created: Date.now(), updated: Date.now()
  };
  pr.master = newTrack('master', { name: '', color: 19 });
  for (let i = 0; i < 8; i++) pr.scenes.push(newScene());
  addReturn(pr, 'reverb');
  addReturn(pr, 'delay');
  addTrack(pr, 'midi');
  addTrack(pr, 'midi');
  addTrack(pr, 'audio');
  addTrack(pr, 'audio');
  return pr;
}

/* 불러온 프로젝트를 지금 형식으로 맞춘다 */
function normalize(pr) {
  if (!pr || typeof pr !== 'object' || !Array.isArray(pr.tracks)) throw new Error('프로젝트 형식이 아니에요.');
  const base = newProject();
  for (const k of ['bpm', 'sig', 'key', 'swing', 'quant', 'loop', 'metro', 'pos', 'name', 'id']) if (pr[k] == null) pr[k] = base[k];
  pr.bpm = U.clamp(+pr.bpm || 120, 20, 999);
  if (!Array.isArray(pr.scenes) || !pr.scenes.length) pr.scenes = [newScene()];
  if (!Array.isArray(pr.returns)) pr.returns = [];
  if (!pr.master) pr.master = newTrack('master', { color: 19 });
  if (!Array.isArray(pr.midimap)) pr.midimap = [];
  for (const t of allTracks(pr)) {
    const d = newTrack(t.type);
    for (const k in d) if (t[k] == null) t[k] = d[k];
    if (!t.id) t.id = U.uid('t');
    while (t.slots.length < pr.scenes.length) t.slots.push(null);
    t.slots.length = t.type === 'midi' || t.type === 'audio' ? pr.scenes.length : 0;
    while (t.sends.length < pr.returns.length) t.sends.push(OFF_DB);
    t.sends.length = pr.returns.length;
    for (const dev of t.devices) {
      if (!U.DEV[dev.kind]) continue;
      dev.p = Object.assign(U.defaults(dev.kind), dev.p || {});
      if (!dev.id) dev.id = U.uid('d');
      if (dev.on == null) dev.on = true;
      if (dev.kind === 'drums' && (!dev.data || !Array.isArray(dev.data.pads))) dev.data = { pads: U.clone(U.DEFAULT_KIT), sel: 0 };
      if (dev.kind === 'looppad') dev.data = U.fixLoopPad(dev.data);
    }
    t.devices = t.devices.filter(dev => U.DEV[dev.kind]);
    for (const c of t.slots) if (c) fixClip(c);
    for (const a of t.arr) { fixClip(a.clip); if (a.off == null) a.off = 0; }
  }
  return pr;
}
function fixClip(c) {
  if (!c.id) c.id = U.uid('c');
  if (!c.loop) c.loop = { on: true, start: 0, end: c.end || 4 };
  if (c.start == null) c.start = 0;
  if (c.end == null) c.end = c.loop.end;
  if (!c.follow) c.follow = { on: false, a: 'next', b: 'none', chance: 1, time: 4 };
  if (!c.launch) c.launch = 'trigger';
  if (!c.quant) c.quant = 'global';
  if (c.type === 'midi' && !Array.isArray(c.notes)) c.notes = [];
  if (c.type === 'midi' && c.groove == null) c.groove = true;
}

/* ================= 찾기 ================= */
function allTracks(pr) { return pr.tracks.concat(pr.returns, [pr.master]); }
function trackById(pr, id) { return allTracks(pr).find(t => t.id === id) || null; }
function deviceById(pr, id) {
  for (const t of allTracks(pr)) for (const d of t.devices) if (d.id === id) return { track: t, dev: d };
  return null;
}
function isPlayable(t) { return t && (t.type === 'midi' || t.type === 'audio'); }
function instrumentOf(t) { return t.devices.find(d => U.DEV[d.kind] && U.DEV[d.kind].type === 'instrument') || null; }

/* 클립 한 바퀴 길이 (클립 자신의 박 단위) */
function clipSpan(c) { return c.loop.on ? c.loop.end - c.loop.start : c.end - c.start; }
/* 프로젝트 박으로 본 배율: 워프를 끈 오디오 클립은 원래 속도로 재생된다 */
function clipScale(c, bpm) { return c.type === 'audio' && !c.warp ? bpm / c.bpm : 1; }

function cloneClip(c) {
  const n = U.clone(c);
  n.id = U.uid('c');
  return n;
}
function cloneDevice(d) { const n = U.clone(d); n.id = U.uid('d'); return n; }
function cloneTrack(pr, t) {
  const n = U.clone(t);
  n.id = U.uid('t');
  n.devices = n.devices.map(d => Object.assign(d, { id: U.uid('d') }));
  const map = {};
  t.devices.forEach((d, i) => { map[d.id] = n.devices[i].id; });
  n.slots = n.slots.map(c => (c ? Object.assign(c, { id: U.uid('c') }) : null));
  n.arr = n.arr.map(a => Object.assign(a, { id: U.uid('a'), clip: Object.assign(a.clip, { id: U.uid('c') }) }));
  const auto = {};
  for (const k in n.auto) {
    const m = /^dev:([^:]+):(.+)$/.exec(k);
    auto[m && map[m[1]] ? 'dev:' + map[m[1]] + ':' + m[2] : k] = n.auto[k];
  }
  n.auto = auto;
  n.solo = false;
  n.arm = false;
  return n;
}

/* 어레인지먼트 길이: 마지막 클립 끝 */
function arrangementEnd(pr) {
  let end = 0;
  for (const t of pr.tracks) for (const a of t.arr) end = Math.max(end, a.pos + a.dur);
  return end;
}

/* ================= 되돌리기 ================= */
const H = { stack: [], labels: [], i: -1, max: 150 };
function snapshot() { return JSON.stringify(U.project); }
function resetHistory() {
  H.stack = [snapshot()];
  H.labels = ['열기'];
  H.i = 0;
}
/* 바꾼 내용을 확정: 되돌리기 목록에 넣고, 엔진·화면·저장에 알린다 */
function commit(label, info) {
  const pr = U.project;
  pr.updated = Date.now();
  const s = snapshot();
  if (H.stack[H.i] !== s) {
    H.stack.length = H.i + 1;
    H.labels.length = H.i + 1;
    H.stack.push(s);
    H.labels.push(label || '편집');
    if (H.stack.length > H.max) { H.stack.shift(); H.labels.shift(); }
    H.i = H.stack.length - 1;
  }
  U.emit('change', Object.assign({ label }, info));
}
/* 드래그 도중처럼 아직 확정하지 않은 바뀜: 소리와 화면만 따라오게 */
function touch(info) { U.emit('change', Object.assign({ live: true }, info)); }
function restore(i) {
  H.i = i;
  U.project = normalize(JSON.parse(H.stack[i]));
  U.emit('project', { undo: true });
  U.emit('change', { undo: true });
}
function undo() {
  if (H.i <= 0) return null;
  const label = H.labels[H.i];
  restore(H.i - 1);
  return label;
}
function redo() {
  if (H.i >= H.stack.length - 1) return null;
  restore(H.i + 1);
  return H.labels[H.i];
}
function canUndo() { return H.i > 0; }
function canRedo() { return H.i < H.stack.length - 1; }
function setProject(pr) {
  U.project = normalize(pr);
  resetHistory();
  U.emit('project', { load: true });
  U.emit('change', { load: true });
}

Object.assign(U, {
  OFF_DB, newScene, newTrack, newMidiClip, newAudioClip, trackLabel, returnLetter, sceneLabel,
  addTrack, addReturn, removeReturn, newProject, normalize, fixClip,
  allTracks, trackById, deviceById, isPlayable, instrumentOf, clipSpan, clipScale,
  cloneClip, cloneDevice, cloneTrack, arrangementEnd,
  commit, touch, undo, redo, canUndo, canRedo, setProject, resetHistory
});
})(window.U = window.U || {});
