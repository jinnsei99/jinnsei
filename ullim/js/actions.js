/* 울림 — 편집 동작: 트랙·장치·클립·씬·어레인지먼트·트랜스포트·프로젝트 */
(function (U) {
'use strict';
const A = U.act = {};
const pr = () => U.project;
const eng = () => U.engine;
const T = id => U.trackById(pr(), id);
const commit = (label, info) => U.commit(label, info);

/* ================= 트랙 ================= */
A.addTrack = function (type, index) {
  const sel = U.selTrack();
  if (index == null) {
    const i = pr().tracks.indexOf(sel);
    index = i >= 0 ? i + 1 : pr().tracks.length;
  }
  const t = U.addTrack(pr(), type, index);
  U.ui.track = t.id;
  commit(type === 'midi' ? 'MIDI 트랙 추가' : '오디오 트랙 추가');
  return t;
};
A.addReturn = function () {
  if (pr().returns.length >= 6) { U.toast('리턴 트랙은 6개까지 만들 수 있어요.'); return; }
  const t = U.addReturn(pr(), 'reverb');
  U.ui.track = t.id;
  commit('리턴 트랙 추가');
};
A.deleteTrack = function (id) {
  const p = pr();
  const t = T(id);
  if (!t || t.type === 'master') return;
  if (t.type === 'return') U.removeReturn(p, id);
  else {
    if (p.tracks.length <= 1) { U.toast('트랙이 하나는 있어야 해요.'); return; }
    const i = p.tracks.indexOf(t);
    p.tracks.splice(i, 1);
    U.ui.track = (p.tracks[i] || p.tracks[i - 1]).id;
  }
  if (U.ui.clip && U.ui.clip.t === id) U.ui.clip = null;
  commit('트랙 지우기');
};
A.duplicateTrack = function (id) {
  const p = pr(), t = T(id);
  if (!t || !U.isPlayable(t)) return;
  const n = U.cloneTrack(p, t);
  n.name = t.name ? t.name + ' 2' : '';
  p.tracks.splice(p.tracks.indexOf(t) + 1, 0, n);
  U.ui.track = n.id;
  commit('트랙 복제');
};
A.renameTrack = function (id, name) { const t = T(id); if (!t) return; t.name = name; commit('트랙 이름'); };
A.setTrackColor = function (id, c) {
  const t = T(id);
  if (!t) return;
  t.color = c;
  commit('트랙 색');
};
A.toggleTrackFlag = function (id, key, exclusive) {
  const p = pr(), t = T(id);
  if (!t) return;
  const v = !t[key];
  if (key === 'solo' && exclusive) for (const x of p.tracks.concat(p.returns)) x.solo = false;
  if (key === 'arm' && exclusive) for (const x of p.tracks) x.arm = false;
  t[key] = v;
  commit(key === 'on' ? '트랙 켜기/끄기' : key === 'solo' ? '솔로' : '녹음 준비');
};
A.setMixer = function (id, key, v, final, idx) {
  const t = T(id);
  if (!t) return;
  if (key === 'send') t.sends[idx] = v;
  else t[key] = v;
  if (final) commit(key === 'vol' ? '볼륨' : key === 'pan' ? '팬' : '센드');
  else U.touch({ mixer: id });
};
A.moveTrack = function (id, toIndex) {
  const p = pr(), t = T(id);
  if (!t || !U.isPlayable(t)) return;
  const i = p.tracks.indexOf(t);
  p.tracks.splice(i, 1);
  p.tracks.splice(U.clamp(toIndex > i ? toIndex - 1 : toIndex, 0, p.tracks.length), 0, t);
  commit('트랙 옮기기');
};

/* ================= 장치 ================= */
function devType(kind) { return U.DEV[kind] ? U.DEV[kind].type : null; }
/* 장치를 알맞은 자리에: MIDI 이펙트 → 악기 → 오디오 이펙트 */
function insertIndex(t, kind, at) {
  const type = devType(kind);
  const firstInst = t.devices.findIndex(d => devType(d.kind) === 'instrument');
  const firstAudio = t.devices.findIndex(d => devType(d.kind) === 'audio');
  const instEnd = firstAudio < 0 ? t.devices.length : firstAudio;
  const midiEnd = firstInst >= 0 ? firstInst : instEnd;
  if (type === 'midi') return at == null ? midiEnd : U.clamp(at, 0, midiEnd);
  if (type === 'instrument') return midiEnd;
  return at == null ? t.devices.length : U.clamp(at, midiEnd + (firstInst >= 0 ? 1 : 0), t.devices.length);
}
A.addDevice = function (trackId, kind, opts) {
  opts = opts || {};
  const t = T(trackId);
  if (!t) return null;
  const type = devType(kind);
  if ((type === 'instrument' || type === 'midi') && t.type !== 'midi') {
    U.toast(type === 'instrument' ? '악기는 MIDI 트랙에만 넣을 수 있어요.' : 'MIDI 이펙트는 MIDI 트랙에만 넣을 수 있어요.');
    return null;
  }
  const dev = opts.dev || U.makeDevice(kind, opts.preset ? { p: opts.preset } : null);
  if (opts.presetName) dev.preset = opts.presetName;
  if (type === 'instrument') removeInstrument(t);
  t.devices.splice(insertIndex(t, kind, opts.at), 0, dev);
  U.ui.track = t.id;
  commit(U.devName(dev) + ' 넣기');
  return dev;
};
function removeInstrument(t) {
  const inst = U.instrumentOf(t);
  if (!inst) return;
  const grp = inst.grp;
  const gone = t.devices.filter(d => d === inst || (grp && d.grp === grp));
  t.devices = t.devices.filter(d => !gone.includes(d));
  for (const d of gone) dropAuto(t, d.id);
}
/* 트랙에서 빠진 장치의 자동화도 지운다 */
function dropAuto(t, devId) {
  for (const k of Object.keys(t.auto)) if (k.startsWith('dev:' + devId + ':')) delete t.auto[k];
}
/* 사운드 프리셋: 악기와 그 프리셋의 이펙트를 함께 바꾼다.
   o.browse: 소리 고르기 창에서 넘겨 들어 보는 중이라 '최근 쓴 소리'에 남기지 않는다 */
A.loadSound = function (trackId, sound, o) {
  let t = T(trackId);
  if (!t || t.type !== 'midi') { t = A.addTrack('midi'); }
  const devs = U.soundDevices(sound);
  const grp = U.uid('g');
  for (const d of devs) d.grp = grp;
  removeInstrument(t);
  const at = insertIndex(t, sound.kind);
  t.devices.splice(at, 0, ...devs);
  if (!t.name) t.name = sound.name;
  U.ui.track = t.id;
  commit(sound.name + ' 불러오기');
  if (!(o && o.browse)) U.favs.noteRecent(sound);
  return t;
};
A.loadKit = function (trackId, kit) {
  let t = T(trackId);
  if (!t || t.type !== 'midi') t = A.addTrack('midi');
  removeInstrument(t);
  const d = U.kitDevice(kit);
  t.devices.splice(insertIndex(t, 'drums'), 0, d);
  if (!t.name || /MIDI$/.test(U.trackLabel(pr(), t))) t.name = kit.name;
  U.ui.track = t.id;
  commit(kit.name + ' 불러오기');
  return t;
};
A.loadLoopKit = function (trackId, kit) {
  let t = T(trackId);
  if (!t || t.type !== 'midi') t = A.addTrack('midi');
  removeInstrument(t);
  t.devices.splice(insertIndex(t, 'looppad'), 0, U.loopKitDevice(kit));
  if (!t.name || /MIDI$/.test(U.trackLabel(pr(), t))) t.name = kit.name;
  U.ui.track = t.id;
  commit(kit.name + ' 불러오기');
  return t;
};
A.removeDevice = function (trackId, devId) {
  const t = T(trackId);
  if (!t) return;
  t.devices = t.devices.filter(d => d.id !== devId);
  dropAuto(t, devId);
  commit('장치 지우기');
};
A.moveDevice = function (trackId, devId, toIndex, toTrackId) {
  const t = T(trackId), dst = T(toTrackId || trackId);
  if (!t || !dst) return;
  const i = t.devices.findIndex(d => d.id === devId);
  if (i < 0) return;
  const [d] = t.devices.splice(i, 1);
  if (dst !== t && devType(d.kind) !== 'audio' && dst.type !== 'midi') { t.devices.splice(i, 0, d); U.toast('이 장치는 MIDI 트랙에만 둘 수 있어요.'); return; }
  if (dst === t && toIndex > i) toIndex--;
  if (devType(d.kind) === 'instrument' && dst !== t) removeInstrument(dst);
  dst.devices.splice(insertIndex(dst, d.kind, toIndex), 0, d);
  // 다른 트랙으로 옮기면 그 장치의 자동화도 따라간다
  if (dst !== t) for (const k of Object.keys(t.auto)) if (k.startsWith('dev:' + d.id + ':')) { dst.auto[k] = t.auto[k]; delete t.auto[k]; }
  commit('장치 옮기기');
};
A.toggleDevice = function (devId) {
  const r = U.deviceById(pr(), devId);
  if (!r) return;
  r.dev.on = !r.dev.on;
  commit(r.dev.on ? '장치 켜기' : '장치 끄기');
};
A.setParam = function (devId, pid, v, final) {
  const r = U.deviceById(pr(), devId);
  if (!r) return;
  r.dev.p[pid] = v;
  const node = eng() && eng().nodes.get(r.track.id);
  const inst = node && node.devs.get(devId);
  if (inst && !inst.auto.has(pid)) inst.set(pid, v);
  if (final) commit(U.DEV[r.dev.kind].byId[pid] ? U.DEV[r.dev.kind].byId[pid].label : '파라미터');
};
A.applyPreset = function (devId, name, p) {
  const r = U.deviceById(pr(), devId);
  if (!r) return;
  r.dev.p = Object.assign(U.defaults(r.dev.kind), p);
  r.dev.preset = name;
  commit(name + ' 프리셋');
};
A.setDeviceData = function (devId, fn, label, live) {
  const r = U.deviceById(pr(), devId);
  if (!r) return;
  fn(r.dev.data, r.dev);
  if (live) U.touch({ device: devId });
  else commit(label || '장치 편집');
};

/* ================= 세션 클립 ================= */
function ensureScenes(n) {
  const p = pr();
  while (p.scenes.length < n) {
    p.scenes.push(U.newScene());
    for (const t of p.tracks) t.slots.push(null);
  }
}
A.createClip = function (trackId, slot, len) {
  const t = T(trackId);
  if (!t || t.type !== 'midi') { U.toast('빈 MIDI 클립은 MIDI 트랙에만 만들 수 있어요.'); return null; }
  ensureScenes(slot + 1);
  const c = U.newMidiClip(len || U.barLen(pr().sig), { color: t.color });
  t.slots[slot] = c;
  U.ui.slot = { t: t.id, s: slot };
  U.showClip({ t: t.id, s: slot });
  commit('새 MIDI 클립');
  return c;
};
A.putClip = function (trackId, slot, clip, label) {
  const t = T(trackId);
  if (!t) return;
  ensureScenes(slot + 1);
  t.slots[slot] = clip;
  U.ui.slot = { t: t.id, s: slot };
  U.ui.clip = { t: t.id, s: slot };
  U.ui.track = t.id;
  commit(label || '클립 넣기');
};
A.deleteSlot = function (trackId, slot) {
  const t = T(trackId);
  if (!t || !t.slots[slot]) return;
  t.slots[slot] = null;
  if (U.ui.clip && U.ui.clip.t === trackId && U.ui.clip.s === slot) U.ui.clip = null;
  commit('클립 지우기');
};
A.duplicateClip = function (trackId, slot) {
  const p = pr(), t = T(trackId);
  if (!t || !t.slots[slot]) return;
  let to = slot + 1;
  if (t.slots[to]) {
    // 아래에 빈 씬을 끼워 넣는다
    p.scenes.splice(to, 0, U.newScene());
    for (const x of p.tracks) x.slots.splice(to, 0, null);
  }
  ensureScenes(to + 1);
  t.slots[to] = U.cloneClip(t.slots[slot]);
  U.ui.slot = { t: t.id, s: to };
  U.ui.clip = { t: t.id, s: to };
  commit('클립 복제');
};
A.moveClip = function (from, to, copy) {
  const a = T(from.t), b = T(to.t);
  if (!a || !b || !a.slots[from.s]) return;
  const c = a.slots[from.s];
  if (c.type === 'audio' && b.type !== 'audio') { U.toast('오디오 클립은 오디오 트랙에만 놓을 수 있어요.'); return; }
  if (c.type === 'midi' && b.type !== 'midi') { U.toast('MIDI 클립은 MIDI 트랙에만 놓을 수 있어요.'); return; }
  if (a === b && from.s === to.s) return;
  ensureScenes(to.s + 1);
  b.slots[to.s] = copy ? U.cloneClip(c) : c;
  if (!copy) a.slots[from.s] = null;
  U.ui.slot = { t: b.id, s: to.s };
  U.ui.clip = { t: b.id, s: to.s };
  commit(copy ? '클립 복사' : '클립 옮기기');
};
A.clipProp = function (ref, fn, label, live) {
  const r = U.clipRef(ref);
  if (!r) return;
  fn(r.clip, r);
  if (live) U.touch({ clip: r.clip.id });
  else commit(label || '클립 편집');
};
A.insertTemplate = function (trackId, slot, tpl) {
  let t = T(trackId);
  if (!t || t.type !== 'midi') { U.toast('MIDI 클립은 MIDI 트랙에 넣어요.'); return; }
  const made = tpl.make(pr().key);
  const c = U.newMidiClip(made.len, { name: tpl.name, color: t.color, notes: made.notes });
  A.putClip(t.id, slot, c, tpl.name);
  return c;
};
A.insertAudio = async function (trackId, slot, ref) {
  let t = T(trackId);
  if (!t || t.type !== 'audio') t = A.addTrack('audio');
  const sr = eng().ctx.sampleRate;
  try { await U.media.get(ref, sr); } catch (e) { U.toast('오디오를 불러오지 못했어요.', 'error'); return; }
  const inf = U.media.info(ref);
  const c = U.newAudioClip(ref, inf, { color: t.color });
  A.putClip(t.id, slot, c, '오디오 클립');
  return c;
};

/* ================= 씬 ================= */
A.insertScene = function (at) {
  const p = pr();
  at = at == null ? p.scenes.length : at;
  p.scenes.splice(at, 0, U.newScene());
  for (const t of p.tracks) t.slots.splice(at, 0, null);
  U.ui.scene = at;
  commit('씬 추가');
};
A.duplicateScene = function (i) {
  const p = pr();
  p.scenes.splice(i + 1, 0, Object.assign(U.newScene(), { name: p.scenes[i].name, tempo: p.scenes[i].tempo }));
  for (const t of p.tracks) t.slots.splice(i + 1, 0, t.slots[i] ? U.cloneClip(t.slots[i]) : null);
  U.ui.scene = i + 1;
  commit('씬 복제');
};
A.deleteScene = function (i) {
  const p = pr();
  if (p.scenes.length <= 1) return;
  p.scenes.splice(i, 1);
  for (const t of p.tracks) t.slots.splice(i, 1);
  U.ui.scene = Math.min(i, p.scenes.length - 1);
  U.ui.clip = null;
  commit('씬 지우기');
};
A.renameScene = function (i, name) { pr().scenes[i].name = name; commit('씬 이름'); };
A.setSceneTempo = function (i, bpm) { pr().scenes[i].tempo = bpm; commit('씬 템포'); };
/* 지금 재생 중인 클립들로 새 씬 만들기 */
A.captureScene = function () {
  const p = pr();
  const playing = p.tracks.map(t => { const st = eng().clipState(t.id); return st && st.playing >= 0 ? t.slots[st.playing] : null; });
  if (!playing.some(Boolean)) { U.toast('재생 중인 클립이 없어요.'); return; }
  const at = U.ui.scene + 1;
  p.scenes.splice(at, 0, U.newScene());
  p.tracks.forEach((t, i) => t.slots.splice(at, 0, playing[i] ? U.cloneClip(playing[i]) : null));
  U.ui.scene = at;
  commit('씬 캡처');
};

/* ================= 어레인지먼트 ================= */
A.addArrClip = function (trackId, pos, clip, dur, label) {
  const t = T(trackId);
  if (!t) return null;
  const a = { id: U.uid('a'), pos: Math.max(0, pos), dur: dur || U.clipSpan(clip) * U.clipScale(clip, pr().bpm), off: 0, clip };
  t.arr.push(a);
  U.ui.clip = { t: t.id, a: a.id };
  U.ui.track = t.id;
  commit(label || '클립 넣기');
  return a;
};
A.deleteArrClips = function (list) {
  if (!list.length) return;
  for (const { t, a } of list) { const tr = T(t); if (tr) tr.arr = tr.arr.filter(x => x.id !== a); }
  if (U.ui.clip && U.ui.clip.a && list.some(x => x.a === U.ui.clip.a)) U.ui.clip = null;
  commit('클립 지우기');
};
A.split = function (trackId, id, at) {
  const t = T(trackId);
  if (!t) return;
  const a = t.arr.find(x => x.id === id);
  if (!a || at <= a.pos + 0.01 || at >= a.pos + a.dur - 0.01) return;
  const scale = U.clipScale(a.clip, pr().bpm);
  const rightDur = a.pos + a.dur - at;
  a.dur = at - a.pos;
  const b = { id: U.uid('a'), pos: at, dur: rightDur, off: a.off + a.dur / scale, clip: U.cloneClip(a.clip) };
  t.arr.push(b);
  commit('클립 나누기');
  return b;
};
A.duplicateArr = function (list) {
  if (!list.length) return [];
  let lo = Infinity, hi = -Infinity;
  for (const { t, a } of list) { const x = T(t).arr.find(y => y.id === a); if (x) { lo = Math.min(lo, x.pos); hi = Math.max(hi, x.pos + x.dur); } }
  const span = hi - lo;
  const out = [];
  for (const { t, a } of list) {
    const tr = T(t), x = tr.arr.find(y => y.id === a);
    if (!x) continue;
    const n = { id: U.uid('a'), pos: x.pos + span, dur: x.dur, off: x.off, clip: U.cloneClip(x.clip) };
    tr.arr.push(n);
    out.push({ t, a: n.id });
  }
  commit('클립 복제');
  return out;
};
/* 세션 클립을 어레인지먼트로 */
A.sessionToArr = function (from, trackId, pos) {
  const a = T(from.t), b = T(trackId);
  if (!a || !b) return;
  const c = a.slots[from.s];
  if (!c) return;
  if ((c.type === 'audio') !== (b.type === 'audio')) { U.toast(c.type === 'audio' ? '오디오 클립은 오디오 트랙에 놓아요.' : 'MIDI 클립은 MIDI 트랙에 놓아요.'); return; }
  A.addArrClip(b.id, pos, U.cloneClip(c), null, '세션 클립을 어레인지먼트로');
};
A.setAuto = function (trackId, key, pts, final) {
  const t = T(trackId);
  if (!t) return;
  if (!pts || !pts.length) delete t.auto[key];
  else t.auto[key] = pts;
  if (final) commit('자동화 편집');
  else U.touch({ auto: trackId });
};

/* ================= 트랜스포트 ================= */
A.play = function () { U.ensureAudio(); A.cancelCountIn(true); eng().play(pr().pos); };
A.stop = function () {
  const e = eng();
  if (A.cancelCountIn()) return;
  if (!e.playing) {
    // 멈춘 상태에서 다시 누르면 시작 위치를 처음으로 (같은 동작을 하는 DAW가 많다)
    if (pr().pos !== 0) { pr().pos = 0; U.inval('arrange', 'transport'); }
    return;
  }
  e.stop();
};
/* Shift+Space: 멈춘 곳에서 이어서 재생 */
A.togglePlay = function (cont) {
  U.ensureAudio();
  const e = eng();
  if (A.cancelCountIn()) return;
  if (e.playing) e.stop();
  else e.play(cont && e.lastStopB != null ? e.lastStopB : pr().pos);
};
A.setTempo = function (bpm, final) {
  bpm = U.clamp(U.round(bpm, 2), 20, 999);
  pr().bpm = bpm;
  eng().setTempo(bpm);
  if (final) commit('템포 ' + bpm);
  else U.touch({ tempo: true });
};
A.tap = (function () {
  let taps = [];
  return function () {
    const now = performance.now();
    taps = taps.filter(t => now - t < 2500);
    taps.push(now);
    if (taps.length >= 3) {
      const iv = [];
      for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
      const avg = iv.reduce((a, b) => a + b, 0) / iv.length;
      A.setTempo(60000 / avg, true);
    }
  };
})();
function ensureArmed() {
  if (pr().tracks.some(t => t.arm)) return true;
  const t = U.selTrack();
  if (t && U.isPlayable(t)) { t.arm = true; commit('녹음 준비'); return true; }
  U.toast('녹음할 트랙의 ● 버튼을 먼저 켜 주세요.');
  return false;
}
/* 카운트인: 멈춘 상태에서 녹음을 누르면 정한 마디만큼 딸깍으로 먼저 센다 (환경설정·메트로놈 오른쪽 클릭) */
const countBars = () => (eng().playing ? 0 : U.pref('countIn', 0));
A.cancelCountIn = function (quiet) {
  if (!eng().cancelCountIn()) return false;
  U.audioRec.stop();   // 세는 동안 켜 둔 마이크는 남길 것 없이 끈다
  if (!quiet) U.toast('카운트인을 멈췄어요.');
  return true;
};
A.setRecord = function (on) {
  U.ensureAudio();
  const e = eng();
  if (A.cancelCountIn()) return;   // 세는 중에 다시 누르면 그만
  if (on && !ensureArmed()) return;
  const audio = on && U.audioRec.armedAudio().length;
  const bars = on ? countBars() : 0;
  if (bars) {
    e.startCountIn(bars, at => e.setRecording(true, at), 'arr');
    if (audio) U.audioRec.start('arr', null, e.counting.tEnd);
    return;
  }
  e.setRecording(on);
  if (audio) U.audioRec.start('arr');
  if (!on) U.audioRec.stop();
};
A.setSessionRec = function (on) {
  U.ensureAudio();
  const e = eng();
  if (A.cancelCountIn()) return;
  if (on && !ensureArmed()) return;
  const slot = U.ui.slot ? U.ui.slot.s : U.ui.scene;
  const audio = on && U.audioRec.armedAudio().length;
  const bar = U.barLen(pr().sig), from = Math.floor((pr().pos || 0) / bar) * bar;
  const begin = at => e.withStart(at, () => {
    e.setSessionRec(true, slot);
    if (audio && !e.playing) e.play(from);
  });
  const bars = on ? countBars() : 0;
  if (bars) {
    e.startCountIn(bars, begin, 'sess');
    if (audio) U.audioRec.start('sess', slot, e.counting.tEnd);
    return;
  }
  if (on) begin(null);
  else e.setSessionRec(false, slot);
  if (audio) U.audioRec.start('sess', slot);
  if (!on) U.audioRec.stop();
};

/* ================= MIDI 캡처 =================
   녹음 버튼을 누르지 않고 친 연주를 나중에 클립으로 건진다 */
A.capture = function () {
  const e = eng();
  // 가장 최근에 연주한 트랙 (건반을 보내는 트랙을 먼저 본다)
  const last = id => { const n = e.nodes.get(id); return n && n.liveLog && n.liveLog.length ? n.liveLog[n.liveLog.length - 1].t0 : -1; };
  const ids = U.input.liveTargets().concat(pr().tracks.filter(t => t.type === 'midi').map(t => t.id));
  let id = null;
  for (const x of ids) if (last(x) >= 0 && (id == null || last(x) > last(id))) id = x;
  const n = id && e.nodes.get(id);
  if (!n) { U.toast('건질 연주가 없어요. 건반으로 몇 음 친 뒤 눌러 주세요.'); return; }
  const log = n.liveLog;
  let i = log.length - 1;
  while (i > 0 && log[i].t0 - log[i - 1].t0 < 3) i--;
  const phrase = log.slice(i);
  const bar = U.barLen(pr().sig);
  const playingSince = e.playing ? e.timeAt(e.startB) : Infinity;
  let toB;
  if (e.playing && phrase[0].t0 >= playingSince) toB = t => e.beatAt(t - e.latency());
  else { const t0 = phrase[0].t0; toB = t => (t - t0) * pr().bpm / 60; }
  let notes = phrase.map(x => {
    const s = toB(x.t0);
    const end = toB(x.t1 != null ? x.t1 : e.ctx.currentTime);
    return { p: x.p, s, d: Math.max(1 / 16, end - s), v: x.v };
  });
  const start = Math.floor(Math.min(...notes.map(x => x.s)) / bar + 1e-6) * bar;
  notes = notes.map(x => ({ p: x.p, s: U.round(x.s - start, 4), d: U.round(x.d, 4), v: x.v }));
  const len = Math.max(bar, Math.ceil(Math.max(...notes.map(x => x.s + x.d)) / bar - 1e-6) * bar);
  const t = T(id);
  const clip = U.newMidiClip(len, { name: '캡처', color: t.color, notes });
  n.liveLog = [];
  if (U.ui.view === 'arrange') { A.addArrClip(t.id, e.playing ? start : pr().pos, clip, len, 'MIDI 캡처'); }
  else {
    let slot = U.ui.slot && U.ui.slot.t === t.id && !t.slots[U.ui.slot.s] ? U.ui.slot.s : t.slots.findIndex(c => !c);
    if (slot < 0) slot = t.slots.length;
    A.putClip(t.id, slot, clip, 'MIDI 캡처');
    U.showClip({ t: t.id, s: slot });
  }
  U.toast('연주를 클립으로 건졌어요 (' + notes.length + '음).');
};

/* ================= 합치기 (Consolidate) ================= */
A.consolidate = function (list) {
  const byTrack = new Map();
  for (const s of list) { if (!byTrack.has(s.t)) byTrack.set(s.t, []); byTrack.get(s.t).push(s.a); }
  const out = [];
  for (const [tid, ids] of byTrack) {
    const t = T(tid);
    const clips = t.arr.filter(a => ids.includes(a.id));
    if (!clips.length || t.type !== 'midi') continue;
    const lo = Math.min(...clips.map(a => a.pos)), hi = Math.max(...clips.map(a => a.pos + a.dur));
    const notes = [];
    for (const a of clips) {
      U.forEachNote(a.clip, a.off, a.off + a.dur, (n, el, dur) => {
        const s = a.pos + (el - a.off);
        if (s < a.pos + a.dur - 1e-6) notes.push({ p: n.p, s: U.round(s - lo, 4), d: U.round(Math.min(dur, a.pos + a.dur - s), 4), v: n.v });
      });
    }
    const first = clips.slice().sort((x, y) => x.pos - y.pos)[0];
    const c = U.newMidiClip(hi - lo, { name: first.clip.name, color: first.clip.color, notes });
    t.arr = t.arr.filter(a => !ids.includes(a.id));
    const a = { id: U.uid('a'), pos: lo, dur: hi - lo, off: 0, clip: c };
    t.arr.push(a);
    out.push({ t: tid, a: a.id });
  }
  if (out.length) commit('합치기');
  else U.toast('MIDI 클립을 골라 주세요.');
  return out;
};

/* ================= 되돌리기 ================= */
A.undo = function () {
  const l = U.undo();
  if (l) U.toast('되돌림: ' + l);
};
A.redo = function () {
  const l = U.redo();
  if (l) U.toast('다시 실행: ' + l);
};
/* 되돌리기 기록에서 고른 자리로 한 번에 */
A.goHistory = function (i) {
  const hs = U.history(), from = hs.i;
  if (!U.goHistory(i)) return;
  const n = Math.abs(i - from);
  U.toast(i === 0 ? '처음 연 상태로 돌아갔어요 (' + n + '단계)' : (i < from ? '되돌림' : '다시 실행') + ' ' + n + '단계 · 지금: ' + hs.labels[i] + ' 직후');
};
})(window.U = window.U || {});
