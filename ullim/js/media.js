/* 울림 — 오디오 자료실: 내장 샘플 합성, 가져온 파일 해독, 캐시, 파형 요약 */
(function (U) {
'use strict';

const bufs = new Map();   // key → Promise<AudioBuffer>
const done = new Map();   // key → AudioBuffer
const meta = new Map();   // ref → {name, duration, bpm, loop}
const peaksCache = new Map();
const revCache = new WeakMap();
let decodeCtx = null;

function key(ref, sr) { return ref + '@' + sr; }
function cached(ref, sr) { return done.get(key(ref, sr)) || null; }

function get(ref, sr) {
  if (!ref) return Promise.reject(new Error('no ref'));
  const k = key(ref, sr);
  if (bufs.has(k)) return bufs.get(k);
  let p;
  if (ref.startsWith('gen:')) {
    const g = U.GEN[ref.slice(4)];
    if (!g) p = Promise.reject(new Error('없는 내장 샘플: ' + ref));
    else p = Promise.resolve().then(() => g.render(sr)).then(limitPeak);
  } else if (ref.startsWith('user:')) {
    p = U.store.getAudio(ref.slice(5)).then(rec => {
      if (!rec) throw Object.assign(new Error('이 브라우저에 없는 오디오 파일이에요: ' + ref), { missing: true });
      if (!meta.has(ref)) meta.set(ref, { name: rec.name, duration: rec.duration, bpm: rec.bpm, loop: rec.loop });
      return decode(rec.bytes.slice(0), sr);
    });
  } else p = Promise.reject(new Error('알 수 없는 오디오: ' + ref));
  p = p.then(buf => {
    done.set(k, buf);
    const m = meta.get(ref) || {};
    if (m.duration == null) meta.set(ref, Object.assign(m, { duration: buf.duration }));
    U.emit('media', ref);
    return buf;
  });
  p.catch(() => bufs.delete(k));
  bufs.set(k, p);
  return p;
}
/* 만든 샘플이 0 dB를 넘지 않게 */
function limitPeak(buf) {
  let pk = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; } }
  if (pk > 0.95) {
    const g = 0.95 / pk;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  }
  return buf;
}
function decode(bytes, sr) {
  const ctx = U.OfflineCtx(2, 1, sr);
  return new Promise((res, rej) => {
    const r = ctx.decodeAudioData(bytes, res, rej);
    if (r && r.then) r.then(res, rej);
  });
}
function info(ref) {
  if (meta.has(ref)) return meta.get(ref);
  if (ref && ref.startsWith('gen:')) {
    const g = U.GEN[ref.slice(4)];
    if (g) {
      const m = { name: g.name, bpm: g.bpm || 120, loop: !!g.beats, duration: g.beats ? g.beats * 60 / g.bpm : null };
      meta.set(ref, m);
      return m;
    }
  }
  return { name: ref, bpm: 120, loop: false, duration: null };
}
function setInfo(ref, m) { meta.set(ref, Object.assign(info(ref), m)); }

/* 파형 그리기용: 구간마다 [최소, 최대] */
function peaks(ref, buf, n) {
  n = n || 2048;
  const k = ref + '#' + n + '@' + buf.sampleRate;
  if (peaksCache.has(k)) return peaksCache.get(k);
  const out = new Float32Array(n * 2);
  const ch = [];
  for (let c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c));
  const step = buf.length / n;
  for (let i = 0; i < n; i++) {
    let lo = 0, hi = 0;
    const a = Math.floor(i * step), b = Math.min(buf.length, Math.floor((i + 1) * step));
    const inc = Math.max(1, Math.floor((b - a) / 64));
    for (const d of ch) for (let j = a; j < b; j += inc) { const v = d[j]; if (v < lo) lo = v; if (v > hi) hi = v; }
    out[i * 2] = lo; out[i * 2 + 1] = hi;
  }
  peaksCache.set(k, out);
  return out;
}
function reversed(buf) {
  let r = revCache.get(buf);
  if (!r) {
    r = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), o = r.getChannelData(c);
      for (let i = 0, n = d.length; i < n; i++) o[i] = d[n - 1 - i];
    }
    revCache.set(buf, r);
  }
  return r;
}

/* 루프인지, 원래 템포가 얼마인지 짐작한다 */
function guessTempo(name, duration) {
  const m = /(\d{2,3}(?:\.\d+)?)\s*bpm/i.exec(name) || /[_\-\s](\d{2,3})(?:[_\-\s.]|$)/.exec(name);
  if (m) {
    const bpm = parseFloat(m[1]);
    if (bpm >= 60 && bpm <= 200 && duration > 0.8) return { bpm, loop: true };
  }
  if (duration < 1.2 || duration > 40) return { bpm: 120, loop: false };
  let best = null;
  for (const beats of [2, 4, 8, 16, 32, 64]) {
    const bpm = beats * 60 / duration;
    if (bpm < 70 || bpm > 180) continue;
    const score = Math.abs(Math.log2(bpm / 118));
    if (!best || score < best.score) best = { bpm, score };
  }
  return best ? { bpm: U.round(best.bpm, 2), loop: true } : { bpm: 120, loop: false };
}

/* 파일을 가져와 이 브라우저에 저장하고 ref를 돌려준다 */
async function importFile(file, sr) {
  const bytes = await file.arrayBuffer();
  const hash = await U.hashBytes(bytes);
  const ref = 'user:' + hash;
  const buf = await decode(bytes.slice(0), sr);
  const name = file.name.replace(/\.[^.]+$/, '');
  const t = guessTempo(file.name, buf.duration);
  const rec = { hash, name, bytes, duration: buf.duration, bpm: t.bpm, loop: t.loop, size: bytes.byteLength, type: file.type, created: Date.now() };
  try { await U.store.putAudio(rec); } catch (e) { console.warn(e); U.toast && U.toast('이 브라우저에 오디오를 저장하지 못했어요. 지금은 쓸 수 있지만 새로 열면 사라져요.', 'error'); }
  meta.set(ref, { name, duration: buf.duration, bpm: t.bpm, loop: t.loop });
  const k = key(ref, sr);
  done.set(k, buf);
  bufs.set(k, Promise.resolve(buf));
  U.emit('media', ref);
  return ref;
}
/* 녹음처럼 이미 버퍼가 있을 때 */
async function addBuffer(buf, name, bpm) {
  const wav = U.encodeWav([buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)], buf.sampleRate, 16);
  const bytes = await wav.arrayBuffer();
  const hash = await U.hashBytes(bytes);
  const ref = 'user:' + hash;
  const rec = { hash, name, bytes, duration: buf.duration, bpm, loop: false, size: bytes.byteLength, type: 'audio/wav', created: Date.now() };
  try { await U.store.putAudio(rec); } catch (e) { console.warn(e); }
  meta.set(ref, { name, duration: buf.duration, bpm, loop: false });
  const k = key(ref, buf.sampleRate);
  done.set(k, buf);
  bufs.set(k, Promise.resolve(buf));
  return ref;
}

/* ================= 내장 샘플 합성 도구 ================= */
/* 드럼 패턴을 오디오 루프로: hits = [[종류, 박, 세기, {tune,decay,tone}, 팬]] */
async function renderHits(sr, bpm, beats, hits, opts) {
  opts = opts || {};
  const len = Math.ceil(beats * 60 / bpm * sr);
  const out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: sr });
  const L = out.getChannelData(0), R = out.getChannelData(1);
  for (const [type, b, vel, o, pan] of hits) {
    const buf = await U.renderDrum(type, Object.assign({ tune: 0, decay: 0.5, tone: 0.5 }, o), sr);
    const d = buf.getChannelData(0);
    const start = Math.round(b * 60 / bpm * sr);
    const g = (vel == null ? 1 : vel) * (opts.gain || 0.9);
    const p = pan || 0;
    const gl = g * Math.cos((p + 1) * Math.PI / 4) * 1.41, gr = g * Math.sin((p + 1) * Math.PI / 4) * 1.41;
    for (let i = 0; i < d.length; i++) {
      const j = (start + i) % len; // 루프 끝을 넘으면 앞으로 감는다
      L[j] += d[i] * gl;
      R[j] += d[i] * gr;
    }
  }
  if (opts.crunch) for (const ch of [L, R]) for (let i = 0; i < len; i++) ch[i] = Math.tanh(ch[i] * opts.crunch) / Math.tanh(opts.crunch);
  return out;
}
/* 악기 장치를 오프라인에서 연주해 루프로 */
async function renderInstrument(sr, bpm, beats, kind, p, notes, tail) {
  const len = Math.ceil((beats * 60 / bpm + (tail || 0)) * sr);
  const ctx = U.OfflineCtx(2, len, sr);
  const fake = { ctx, offline: true, bpm, keyOf: () => ({ root: 0, scale: 'major' }) };
  const dev = U.makeDevice(kind, { p });
  const inst = new U.DEVICE_CLASSES[kind](fake, dev);
  inst.out.connect(ctx.destination);
  await inst.ready;
  for (const n of notes) inst.playNote(n.p, n.v || 100, n.s * 60 / bpm, n.d * 60 / bpm);
  const buf = await ctx.startRendering();
  if (tail) {
    // 꼬리를 앞으로 감아 끊김 없는 루프로
    const loopLen = Math.ceil(beats * 60 / bpm * sr);
    const out = new AudioBuffer({ length: loopLen, numberOfChannels: 2, sampleRate: sr });
    for (let c = 0; c < 2; c++) {
      const s = buf.getChannelData(c), o = out.getChannelData(c);
      for (let i = 0; i < s.length; i++) o[i % loopLen] += s[i];
    }
    return out;
  }
  return buf;
}
/* 모음 소리 (포먼트 합성) */
const VOWELS = { a: [800, 1150, 2900, 3900], o: [450, 800, 2830, 3800], e: [400, 1600, 2700, 3300], i: [300, 2300, 3000, 3700], u: [350, 650, 2700, 3800] };
async function renderVowels(sr, seq, each, pitch) {
  const total = seq.length * each + 0.3;
  const ctx = U.OfflineCtx(2, Math.ceil(total * sr), sr);
  const out = U.gainNode(ctx, 0.9);
  out.connect(ctx.destination);
  seq.forEach((v, k) => {
    const t0 = k * each;
    const f0 = U.mtof(pitch + (v.length > 1 ? +v.slice(1) : 0));
    const vow = VOWELS[v[0]] || VOWELS.a;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.value = f0;
    const vib = ctx.createOscillator(); const vg = U.gainNode(ctx, 14);
    vib.frequency.value = 5.3; vib.connect(vg); vg.connect(src.detune);
    const env = U.gainNode(ctx, 0);
    const amps = [1, 0.5, 0.25, 0.12];
    vow.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 8 + i * 3;
      const g = U.gainNode(ctx, amps[i] * 4);
      src.connect(bp); bp.connect(g); g.connect(env);
    });
    const br = U.noiseSource(ctx, true); const bg = U.gainNode(ctx, 0.04); const bhp = ctx.createBiquadFilter();
    bhp.type = 'highpass'; bhp.frequency.value = 2500;
    br.connect(bhp); bhp.connect(bg); bg.connect(env);
    env.connect(out);
    const len = each * (seq.length > 1 ? 0.92 : 1);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.5, t0 + 0.06);
    env.gain.setValueAtTime(0.5, t0 + len - 0.12);
    env.gain.linearRampToValueAtTime(0, t0 + len);
    for (const s of [src, vib, br]) { s.start(t0); s.stop(t0 + len + 0.05); }
  });
  return U.trimBuffer(await ctx.startRendering(), total);
}
/* 로봇 보컬: 톱니파 버즈를 모음 포먼트로 거르고(보코더 느낌), 자음은 잡음 조각으로 붙인다.
   음절 하나가 칸 하나(each초)에 딱 들어가서, 같은 길이로 자르면 그대로 찹이 된다.
   syl: [[자음+모음, 음높이, 끝 음높이(없으면 그대로)], ...] */
const NASAL = { m: [280, 1000, 2300, 3300], n: [280, 1500, 2500, 3400] };
const GLIDE = { r: [430, 1300, 1650, 3200], y: VOWELS.i, w: VOWELS.u };
const STOP = { h: 0.05, k: 0.04, p: 0.03, t: 0.035, s: 0.085, b: 0.012, d: 0.012, g: 0.012 };
async function renderRobot(sr, syl, each) {
  const total = syl.length * each;
  const ctx = U.OfflineCtx(2, Math.ceil(total * sr), sr);
  const bus = U.gainNode(ctx, 1);
  bus.connect(ctx.destination);
  syl.forEach(([s, pitch, pitchEnd], k) => {
    const t0 = k * each;
    const cons = s.length > 1 ? s[0] : '';
    const vow = VOWELS[s[s.length - 1]] || VOWELS.a;
    const end = t0 + each - 0.035; // 다음 칸 앞을 조금 비워 두어 찹이 깔끔하게
    const tv = t0 + (STOP[cons] || 0); // 목소리가 나오기 시작하는 때
    const from = NASAL[cons] || GLIDE[cons] || vow;
    // 버즈: 톱니파 + 한 옥타브 아래 사각파, 떨림 없이 곧게
    const f0 = U.mtof(pitch), f1 = U.mtof(pitchEnd != null ? pitchEnd : pitch);
    const saw = ctx.createOscillator(), sub = ctx.createOscillator();
    saw.type = 'sawtooth'; sub.type = 'square';
    const subG = U.gainNode(ctx, 0.45), voiced = U.gainNode(ctx, 0);
    saw.connect(voiced); sub.connect(subG); subG.connect(voiced);
    for (const [o, mul] of [[saw, 1], [sub, 0.5]]) {
      o.frequency.setValueAtTime(f0 * mul, t0);
      if (pitchEnd != null) o.frequency.setTargetAtTime(f1 * mul, tv + 0.08, 0.06);
      o.start(t0); o.stop(end + 0.02);
    }
    const amps = [1, 0.6, 0.32, 0.18];
    const formants = vow.map((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 9 + i * 3;
      bp.frequency.setValueAtTime(from[i], t0);
      if (from !== vow) bp.frequency.setTargetAtTime(f, tv + 0.02, 0.025);
      const g = U.gainNode(ctx, amps[i] * 5);
      voiced.connect(bp); bp.connect(g); g.connect(bus);
      return bp;
    });
    voiced.gain.setValueAtTime(0, t0);
    voiced.gain.setValueAtTime(0, tv);
    voiced.gain.linearRampToValueAtTime(NASAL[cons] ? 0.5 : 1, tv + 0.012);
    if (NASAL[cons]) voiced.gain.linearRampToValueAtTime(1, tv + 0.07);
    voiced.gain.setValueAtTime(1, end - 0.03);
    voiced.gain.linearRampToValueAtTime(0, end);
    // 자음: 잡음 조각
    if (!STOP[cons]) return;
    const nz = U.noiseSource(ctx, true), ng = U.gainNode(ctx, 0);
    nz.start(t0); nz.stop(tv + 0.05);
    nz.connect(ng);
    if (cons === 'h') {
      // 숨소리: 모음 포먼트로 거른 잡음이라 속삭이는 모음처럼 들린다
      for (const bp of formants) ng.connect(bp);
      ng.gain.setValueAtTime(0, t0);
      ng.gain.linearRampToValueAtTime(0.35, t0 + 0.012);
      ng.gain.setValueAtTime(0.35, tv);
      ng.gain.linearRampToValueAtTime(0, tv + 0.03);
      return;
    }
    const fl = ctx.createBiquadFilter();
    const shape = { k: ['highpass', 1800, 0.6], t: ['highpass', 3500, 0.55], p: ['lowpass', 1200, 0.6], s: ['highpass', 5000, 0.35], b: ['lowpass', 800, 0.3], d: ['highpass', 2500, 0.3], g: ['bandpass', 1500, 0.3] }[cons];
    fl.type = shape[0]; fl.frequency.value = shape[1];
    ng.connect(fl); fl.connect(bus);
    const a = cons === 's' ? 0.02 : 0.004;
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(shape[2], t0 + a);
    ng.gain.setValueAtTime(shape[2], Math.max(t0 + a, tv - 0.012));
    ng.gain.linearRampToValueAtTime(0, tv + 0.004);
  });
  const buf = await ctx.startRendering();
  // 2:1 표본 잡기와 살짝 일그러뜨리기로 기계 같은 질감. 칸 끝에 남는 필터 울림은 잘라 낸다
  let pk = 0;
  const tail = Math.round(0.035 * sr), fade = Math.round(0.008 * sr), cell = Math.round(each * sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 1; i < d.length; i += 2) d[i] = d[i - 1];
    for (let i = 0; i < d.length; i++) {
      const j = (i % cell) - (cell - tail);
      const g = j < 0 ? 1 : Math.max(0, 1 - j / fade);
      d[i] = Math.tanh(d[i] * 2) * g;
      const a = Math.abs(d[i]);
      if (a > pk) pk = a;
    }
  }
  if (pk > 1e-6) for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= 0.9 / pk; }
  return buf;
}
async function renderFx(sr, kind) {
  if (kind === 'riser' || kind === 'down') {
    const dur = 4;
    const ctx = U.OfflineCtx(2, Math.ceil(dur * sr), sr);
    const n = U.noiseSource(ctx, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    const g = U.gainNode(ctx, 0);
    const up = kind === 'riser';
    bp.frequency.setValueAtTime(up ? 250 : 7000, 0);
    bp.frequency.exponentialRampToValueAtTime(up ? 9000 : 180, dur);
    g.gain.setValueAtTime(up ? 0.02 : 0.9, 0);
    g.gain.linearRampToValueAtTime(up ? 0.9 : 0.01, dur - 0.02);
    g.gain.linearRampToValueAtTime(0, dur);
    n.connect(bp); bp.connect(g); g.connect(ctx.destination); n.start(0);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(up ? 110 : 880, 0); o.frequency.exponentialRampToValueAtTime(up ? 880 : 80, dur);
    const og = U.gainNode(ctx, 0); const lp = ctx.createBiquadFilter(); lp.frequency.value = 2400;
    og.gain.setValueAtTime(0, 0); og.gain.linearRampToValueAtTime(0.12, up ? dur - 0.05 : 0.2); og.gain.linearRampToValueAtTime(0, dur);
    o.connect(lp); lp.connect(og); og.connect(ctx.destination); o.start(0);
    return ctx.startRendering();
  }
  // impact
  const dur = 3;
  const ctx = U.OfflineCtx(2, Math.ceil(dur * sr), sr);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(90, 0); o.frequency.exponentialRampToValueAtTime(28, 1.5);
  const og = U.gainNode(ctx, 0);
  og.gain.setValueAtTime(0, 0); og.gain.linearRampToValueAtTime(1, 0.004); og.gain.setTargetAtTime(0, 0.01, 0.5);
  const sh = ctx.createWaveShaper(); sh.curve = U.satCurve('soft', 8, 8);
  o.connect(og); og.connect(sh); sh.connect(ctx.destination); o.start(0);
  const n = U.noiseSource(ctx, true); const lp = ctx.createBiquadFilter(); lp.frequency.setValueAtTime(5000, 0); lp.frequency.exponentialRampToValueAtTime(200, 1.5);
  const ng = U.gainNode(ctx, 0); ng.gain.setValueAtTime(0.7, 0); ng.gain.setTargetAtTime(0, 0.01, 0.35);
  n.connect(lp); lp.connect(ng); ng.connect(ctx.destination); n.start(0);
  const buf = await ctx.startRendering();
  // 짧은 잔향
  const ir = U.makeIR({ sampleRate: sr, createBuffer: (c, l, r) => new AudioBuffer({ numberOfChannels: c, length: l, sampleRate: r }) }, 2.2, 0.7, 4000);
  const c2 = U.OfflineCtx(2, buf.length, sr);
  const s = c2.createBufferSource(); s.buffer = buf;
  const cv = c2.createConvolver(); cv.buffer = ir;
  const wet = U.gainNode(c2, 0.35);
  s.connect(c2.destination); s.connect(cv); cv.connect(wet); wet.connect(c2.destination); s.start(0);
  return c2.startRendering();
}

U.media = { get, cached, info, setInfo, peaks, reversed, guessTempo, importFile, addBuffer, decode, renderHits, renderInstrument, renderVowels, renderRobot, renderFx };
})(window.U = window.U || {});
