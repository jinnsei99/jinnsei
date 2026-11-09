/* 울림 — 장치 실행부 1: 공통 바탕, 악기 5종, MIDI 이펙트 4종 */
(function (U) {
'use strict';
const { envOn, envOff, envEnd, stopAt, smooth, velGain, gainNode, mtof, dbToGain, clamp } = U;

/* ================= 모든 장치의 바탕 ================= */
class Device {
  constructor(eng, dev) {
    this.eng = eng;
    this.ctx = eng.ctx;
    this.dev = dev;
    this.kind = dev.kind;
    this.spec = U.DEV[dev.kind];
    this.v = Object.assign({}, dev.p); // 지금 소리에 쓰는 값 (자동화가 덮어쓸 수 있음)
    this.on = dev.on !== false;
    this.auto = new Set(); // 재생 중 자동화가 잡고 있는 파라미터
    this.ready = Promise.resolve();
  }
  /* 프로젝트 값과 맞춘다 */
  sync(dev) {
    this.dev = dev;
    for (const id in dev.p) {
      if (this.auto.has(id)) continue;
      if (dev.p[id] !== this.v[id]) this.set(id, dev.p[id]);
    }
    if ((dev.on !== false) !== this.on) { this.on = dev.on !== false; this.setOn(this.on); }
    if (this.syncData) this.syncData(dev.data);
  }
  set(id, val, t) {
    this.v[id] = val;
    this.param(id, val, t == null ? this.ctx.currentTime : t);
  }
  setAuto(id, val, t) { this.auto.add(id); this.set(id, val, t); }
  releaseAuto() {
    if (!this.auto.size) return;
    const ids = [...this.auto];
    this.auto.clear();
    for (const id of ids) if (this.dev.p[id] !== undefined) this.set(id, this.dev.p[id]);
  }
  param() {}
  setOn() {}
  onTempo() {}
  dispose() {}
}

/* ================= 악기 바탕: 보이스 관리 ================= */
class Instrument extends Device {
  constructor(eng, dev) {
    super(eng, dev);
    this.out = gainNode(this.ctx, 1);
    this.voices = [];
    this.maxVoices = 24;
  }
  setOn(on) { smooth(this.out.gain, on ? this.outLevel() : 0, this.ctx.currentTime, 0.01); }
  outLevel() { return dbToGain(this.v.vol != null ? this.v.vol : 0); }
  noteOn(p, v, t, live) {
    if (!this.on) return null;
    this.prune(t);
    let n = 0, oldest = null;
    for (const vo of this.voices) {
      if (vo.end > t && vo.t0 <= t + 1e-4) { n++; if (!oldest || vo.t0 < oldest.t0) oldest = vo; }
    }
    if (n >= this.maxVoices && oldest) this.kill(oldest, t);
    const vo = this.voice(p, v, t);
    if (!vo) return null;
    vo.p = p; vo.t0 = t; vo.t1 = Infinity; vo.live = !!live;
    if (vo.end == null) vo.end = Infinity;
    this.voices.push(vo);
    if (this.ex) this.exTo(vo);
    return vo;
  }
  noteOff(vo, t) {
    if (!vo || vo.t1 <= t) return;
    vo.t1 = t;
    this.release(vo, t);
  }
  playNote(p, v, t, dur) {
    const vo = this.noteOn(p, v, t, false);
    if (vo) this.noteOff(vo, t + Math.max(0.008, dur));
    return vo;
  }
  /* 시각 t 이후를 지운다: 아직 시작 안 한 음은 없애고, 울리는 음은 t에서 뗀다 */
  cut(t, withLive) {
    for (const vo of this.voices) {
      if (vo.live && !withLive) continue;
      if (vo.t0 >= t - 1e-4) this.kill(vo, t);
      else if (vo.t1 > t) { vo.t1 = t; this.release(vo, t); }
    }
  }
  kill(vo, t) {
    vo.t1 = Math.min(vo.t1, t);
    vo.end = Math.min(vo.end, t + 0.03);
    this.silence(vo, t);
  }
  silence(vo, t) {
    if (vo.amp) { vo.amp.gain.cancelScheduledValues(t); vo.amp.gain.setTargetAtTime(0, t, 0.004); }
    for (const s of vo.srcs || []) stopAt(s, t + 0.03);
  }
  prune(t) {
    if (this.voices.length < 12) return;
    const keep = [];
    for (const vo of this.voices) {
      if (vo.end < t - 0.1) this.free(vo);
      else keep.push(vo);
    }
    this.voices = keep;
  }
  free(vo) {
    if (this.ex) for (const s of vo.srcs || []) if (s.detune) { try { this.ex.bus.disconnect(s.detune); } catch (e) { /* 무시 */ } }
    for (const n of vo.nodes || []) { try { n.disconnect(); } catch (e) { /* 무시 */ } }
  }
  activeVoices(t) { return this.voices.filter(vo => vo.end > t && vo.t0 <= t + 0.01); }
  /* ---------- 건반의 표현: 피치 벤드 · 비브라토 (MIDI 건반의 벤드 · 모드 휠 · 누르는 힘) ----------
     악기마다 '표현 버스' 하나를 두고 울리는 음의 소스(오실레이터 · 샘플)마다 detune에 더한다. 음마다 정한 값은 그대로 둔다.
     o.bend: 센트, o.vib: 비브라토 깊이(센트). 패드 악기는 하지 않는다 */
  expr(o, t) {
    if (this.isPads) return;
    t = t == null ? this.ctx.currentTime : t;
    const ex = this.ex || this.makeExpr();
    if (o.bend != null) ex.bend.offset.setTargetAtTime(o.bend, t, 0.006);
    if (o.vib != null) ex.depth.gain.setTargetAtTime(o.vib, t, 0.04);
  }
  makeExpr() {
    const ctx = this.ctx;
    const bend = ctx.createConstantSource(), lfo = ctx.createOscillator();
    const depth = gainNode(ctx, 0), bus = gainNode(ctx, 1);
    bend.offset.value = 0;
    lfo.frequency.value = 5.6;
    lfo.connect(depth); depth.connect(bus); bend.connect(bus);
    bend.start(); lfo.start();
    this.ex = { bend, lfo, depth, bus };
    for (const vo of this.voices) if (vo.end > ctx.currentTime) this.exTo(vo);
    return this.ex;
  }
  exTo(vo) { for (const s of vo.srcs || []) if (s.detune) { try { this.ex.bus.connect(s.detune); } catch (e) { /* 무시 */ } } }
  /* 울리는 소리를 모두 끊는다 (패드 화면의 '모두 멈춤') */
  stopAll(t) { for (const vo of this.voices) if (vo.end > t) this.kill(vo, t); }
  dispose() {
    const t = this.ctx.currentTime;
    for (const vo of this.voices) this.kill(vo, t);
    setTimeout(() => {
      for (const vo of this.voices) this.free(vo);
      try { this.out.disconnect(); } catch (e) { /* 무시 */ }
      if (this.ex) { try { this.ex.bend.stop(); this.ex.lfo.stop(); this.ex.bus.disconnect(); } catch (e) { /* 무시 */ } }
    }, 100);
  }
}

/* ================= Poly Synth ================= */
function filterQ(type, res) {
  return type === 'bp' ? 0.7 + res * 14 : -3 + res * 26;
}
function biquadType(ft) { return ft === 'hp12' ? 'highpass' : ft === 'bp' ? 'bandpass' : ft === 'notch' ? 'notch' : 'lowpass'; }

class PolySynth extends Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.vbus = gainNode(ctx, 0.5);
    this.trem = gainNode(ctx, 1);
    this.vbus.connect(this.trem);
    this.trem.connect(this.out);
    this.lfo = ctx.createOscillator();
    this.lfoP = gainNode(ctx, 0);
    this.lfoF = gainNode(ctx, 0);
    this.lfoA = gainNode(ctx, 0);
    this.lfo.connect(this.lfoP); this.lfo.connect(this.lfoF); this.lfo.connect(this.lfoA);
    this.lfoA.connect(this.trem.gain);
    this.lfo.start();
    this.lastP = null;
    this.initShared();
  }
  initShared() {
    const P = this.v;
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.lfo.type = P.lw;
    this.lfo.frequency.value = P.lrate;
    this.lfoP.gain.value = P.lpitch * 100;
    this.lfoF.gain.value = P.lfilt * 2400;
    this.lfoA.gain.value = P.lamp * 0.5;
    this.trem.gain.value = 1 - P.lamp * 0.5;
  }
  cutoff(p) {
    const P = this.v;
    return clamp(P.cut * Math.pow(2, ((p - 60) / 12) * P.fkey), 20, 20000);
  }
  voice(p, vel, t) {
    const ctx = this.ctx, P = this.v;
    const f = mtof(p);
    let from = null;
    if (P.mono) {
      for (const vo of this.voices) {
        if (vo.end > t && vo.t0 < t + 1e-4) {
          if (vo.t1 > t - 1e-4 && P.glide > 0) from = vo.p;
          this.kill(vo, t);
        }
      }
      if (from == null && P.glide > 0 && this.lastP != null && this.lastT != null && t - this.lastT < 0.02) from = this.lastP;
    }
    this.lastP = p; this.lastT = t;
    const amp = gainNode(ctx, 0);
    const pre = gainNode(ctx, 1);
    const fl = ctx.createBiquadFilter();
    fl.type = biquadType(P.ft);
    fl.frequency.value = this.cutoff(p);
    fl.Q.value = filterQ(P.ft, P.res);
    let fl2 = null;
    pre.connect(fl);
    if (P.ft === 'lp24') {
      fl2 = ctx.createBiquadFilter();
      fl2.type = 'lowpass';
      fl2.frequency.value = fl.frequency.value;
      fl2.Q.value = -3;
      fl.connect(fl2); fl2.connect(amp);
    } else fl.connect(amp);
    amp.connect(this.vbus);
    const srcs = [], nodes = [amp, pre, fl];
    if (fl2) nodes.push(fl2);
    // 유니즌: 오실레이터마다 N겹을 ±uspr 센트로 고르게 벌리고 좌우로 펼친다. 겹친 만큼 커지지 않게 1/√N
    const N = clamp(Math.round(P.uni || 1), 1, 7);
    const pamt = P.pamt || 0;
    // 겹친 소리가 모두 같은 위상으로 출발하면 첫 수십 ms가 한 소리처럼 좁고 크게 뭉친다.
    // 그래서 첫 겹 말고는 한 주기 안에서 제각각 조금 늦게 출발시켜 위상을 흩는다 (같은 악기는 늘 같은 순서라 렌더가 매번 같다)
    if (N > 1 && !this.urnd) this.urnd = U.rng(4243);
    const f0 = (from != null ? mtof(from) : f) * Math.pow(2, pamt / 12);
    const mk = (wave, mul, det, lvl) => {
      if (lvl <= 0.001) return null;
      const all = [];
      for (let k = 0; k < N; k++) {
        const pos = N > 1 ? k / (N - 1) * 2 - 1 : 0;   // -1 … 1
        const off = pos * (P.uspr || 0);
        const o = ctx.createOscillator();
        o.type = wave;
        const target = f * mul;
        const lag = k ? this.urnd() * Math.min(1 / (f0 * mul), 0.02) : 0;
        if (from != null) {
          o.frequency.setValueAtTime(mtof(from) * mul, t);
          o.frequency.setTargetAtTime(target, t, Math.max(0.001, P.glide) / 3);
        } else o.frequency.setValueAtTime(target, t);
        // 피치 엔벌로프: pamt 반음 위(아래)에서 출발해 pdec 동안 제 음으로
        if (pamt) {
          o.detune.setValueAtTime(det + off + pamt * 100, t);
          o.detune.setTargetAtTime(det + off, t + 0.001, Math.max(0.002, P.pdec || 0.06) / 4);
        } else o.detune.value = det + off;
        const g = gainNode(ctx, lvl / Math.sqrt(N));
        o.connect(g);
        if (N > 1 && P.uwide > 0) {
          const pn = ctx.createStereoPanner();
          pn.pan.value = pos * P.uwide;
          g.connect(pn); pn.connect(pre);
          nodes.push(pn);
        } else g.connect(pre);
        this.lfoP.connect(o.detune);
        o.start(t + lag);
        srcs.push(o); nodes.push(o, g);
        all.push({ o, g, off });
      }
      return { o: all[0].o, g: all[0].g, all, n: N };
    };
    const o1 = mk(P.w1, Math.pow(2, P.o1), P.d1, P.l1);
    const o2 = mk(P.w2, Math.pow(2, P.o2 + P.s2 / 12), P.d2, P.l2);
    let nz = null;
    if (P.nz > 0.001) {
      const n = U.noiseSource(ctx, true);
      const g = gainNode(ctx, P.nz * 0.7);
      n.connect(g); g.connect(pre);
      n.start(t, Math.random() * 1.5);
      srcs.push(n); nodes.push(n, g);
      nz = { n, g };
    }
    this.lfoF.connect(fl.detune);
    if (fl2) this.lfoF.connect(fl2.detune);
    const peak = velGain(vel, P.vel);
    envOn(amp.gain, t, peak, P.a, P.d, P.s);
    const fenv = Math.abs(P.fenv) > 0.001;
    if (fenv) {
      envOn(fl.detune, t, P.fenv * 4800, P.fa, P.fd, P.fs);
      if (fl2) envOn(fl2.detune, t, P.fenv * 4800, P.fa, P.fd, P.fs);
    }
    return { amp, fl, fl2, o1, o2, nz, fenv, srcs, nodes };
  }
  release(vo, t) {
    const P = this.v;
    envOff(vo.amp.gain, t, P.r);
    if (vo.fenv) {
      envOff(vo.fl.detune, t, P.fr);
      if (vo.fl2) envOff(vo.fl2.detune, t, P.fr);
    }
    vo.end = envEnd(t, P.r);
    for (const s of vo.srcs) stopAt(s, vo.end);
  }
  free(vo) {
    try { this.lfoF.disconnect(vo.fl.detune); } catch (e) { /* 무시 */ }
    if (vo.fl2) { try { this.lfoF.disconnect(vo.fl2.detune); } catch (e) { /* 무시 */ } }
    for (const o of [vo.o1, vo.o2]) if (o) for (const x of o.all) { try { this.lfoP.disconnect(x.o.detune); } catch (e) { /* 무시 */ } }
    super.free(vo);
  }
  param(id, v, t) {
    const P = this.v;
    const live = this.activeVoices(t);
    switch (id) {
      case 'vol': if (this.on) smooth(this.out.gain, this.outLevel(), t); break;
      case 'lw': this.lfo.type = v; break;
      case 'lrate': smooth(this.lfo.frequency, v, t); break;
      case 'lpitch': smooth(this.lfoP.gain, v * 100, t); break;
      case 'lfilt': smooth(this.lfoF.gain, v * 2400, t); break;
      case 'lamp': smooth(this.lfoA.gain, v * 0.5, t); smooth(this.trem.gain, 1 - v * 0.5, t); break;
      case 'cut': case 'fkey':
        for (const vo of live) {
          smooth(vo.fl.frequency, this.cutoff(vo.p), t);
          if (vo.fl2) smooth(vo.fl2.frequency, this.cutoff(vo.p), t);
        }
        break;
      case 'res': for (const vo of live) smooth(vo.fl.Q, filterQ(P.ft, v), t); break;
      case 'l1': for (const vo of live) if (vo.o1) for (const x of vo.o1.all) smooth(x.g.gain, v / Math.sqrt(vo.o1.n), t); break;
      case 'l2': for (const vo of live) if (vo.o2) for (const x of vo.o2.all) smooth(x.g.gain, v / Math.sqrt(vo.o2.n), t); break;
      case 'nz': for (const vo of live) if (vo.nz) smooth(vo.nz.g.gain, v * 0.7, t); break;
      case 'w1': for (const vo of live) if (vo.o1) for (const x of vo.o1.all) x.o.type = v; break;
      case 'w2': for (const vo of live) if (vo.o2) for (const x of vo.o2.all) x.o.type = v; break;
      case 'd1': for (const vo of live) if (vo.o1) for (const x of vo.o1.all) smooth(x.o.detune, v + x.off, t); break;
      case 'd2': for (const vo of live) if (vo.o2) for (const x of vo.o2.all) smooth(x.o.detune, v + x.off, t); break;
      case 'uspr':
        // 울리는 음의 겹친 소리 벌림을 바로 바꾼다
        for (const vo of live) for (const [o, det] of [[vo.o1, P.d1], [vo.o2, P.d2]]) if (o) o.all.forEach((x, k) => { x.off = (o.n > 1 ? k / (o.n - 1) * 2 - 1 : 0) * v; smooth(x.o.detune, det + x.off, t); });
        break;
    }
  }
}

/* ================= FM Synth ================= */
class FMSynth extends Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.vbus = gainNode(ctx, 0.5);
    this.filt = ctx.createBiquadFilter();
    this.filt.type = 'lowpass';
    this.vbus.connect(this.filt);
    this.filt.connect(this.out);
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.filt.frequency.value = this.v.cut;
    this.filt.Q.value = filterQ('lp12', this.v.res);
  }
  voice(p, vel, t) {
    const ctx = this.ctx, P = this.v;
    const f = mtof(p);
    const vg = velGain(vel, P.vel);
    const bright = 0.45 + 0.55 * vg;
    const c = ctx.createOscillator(); c.type = P.cw; c.frequency.value = f * P.cr;
    const a = ctx.createOscillator(); a.frequency.value = f * P.ar;
    const b = ctx.createOscillator(); b.frequency.value = f * P.br;
    const ag = gainNode(ctx, 0), bg = gainNode(ctx, 0), amp = gainNode(ctx, 0);
    a.connect(ag); b.connect(bg);
    c.connect(amp); amp.connect(this.vbus);
    const nodes = [c, a, b, ag, bg, amp];
    const ia = P.al * 9 * f * P.ar * bright;
    const ib = P.bl * 9 * f * P.br * bright;
    let bAmp = null;
    if (P.algo === 'stack') { bg.connect(a.frequency); ag.connect(c.frequency); }
    else if (P.algo === 'dual') { ag.connect(c.frequency); bg.connect(this.vbus); bAmp = true; }
    else { ag.connect(c.frequency); bg.connect(c.frequency); }
    envOn(ag.gain, t, ia, P.aa, P.ad, P.as);
    envOn(bg.gain, t, bAmp ? vg * P.bl : ib, P.ba, P.bd, P.bs);
    envOn(amp.gain, t, vg, P.a, P.d, P.s);
    c.start(t); a.start(t); b.start(t);
    return { amp, ag, bg, srcs: [c, a, b], nodes };
  }
  release(vo, t) {
    const P = this.v;
    envOff(vo.amp.gain, t, P.r);
    envOff(vo.ag.gain, t, P.arl);
    envOff(vo.bg.gain, t, P.brl);
    vo.end = envEnd(t, Math.max(P.r, P.algo === 'dual' ? P.brl : 0));
    for (const s of vo.srcs) stopAt(s, vo.end);
  }
  silence(vo, t) {
    super.silence(vo, t);
    vo.bg.gain.cancelScheduledValues(t);
    vo.bg.gain.setTargetAtTime(0, t, 0.004);
  }
  param(id, v, t) {
    if (id === 'vol' && this.on) smooth(this.out.gain, this.outLevel(), t);
    else if (id === 'cut') smooth(this.filt.frequency, v, t);
    else if (id === 'res') smooth(this.filt.Q, filterQ('lp12', v), t);
  }
}

/* ================= Drum Machine ================= */
/* ================= 녹음 드럼 =================
   U.DRUM_SETS[키트] = { credit, pieces: [조각…], gains: [조각마다 dB], files: [[조각, 세기 칸, 라운드 로빈, 시작, 길이]] } (js/samples.js).
   패드가 src 'rec' · rec '키트:조각'이면 녹음으로 친다: 세기에 맞는 칸을 고르고, 같은 칸 안에서는 칠 때마다 다른 녹음(라운드 로빈).
   받기 전이나 받지 못하면(파일로 연 index.html 등) 패드의 type(합성 드럼)으로 친다 */
const DSETS = new Map();
function drumSet(name) {
  const S = U.DRUM_SETS && U.DRUM_SETS[name];
  if (!S || !U.acousticDSP || !U.acousticDSP.fetchPack) return null;
  let e = DSETS.get(name);
  if (e) return e;
  e = { ok: false, failed: false, name, pieces: {} };
  DSETS.set(name, e);
  e.promise = U.acousticDSP.fetchPack(name, S.files, 44100).then(list => {
    S.pieces.forEach((pc, pi) => {
      const mine = list.filter(x => x.row[0] === pi);
      if (!mine.length) return;
      const nl = Math.max(...mine.map(x => x.row[1])) + 1;
      const layers = Array.from({ length: nl }, (_, l) => mine.filter(x => x.row[1] === l).sort((a, b) => a.row[2] - b.row[2]).map(x => x.buf));
      // 세기 칸마다 크기를 '보통' 칸(세기 100이 고르는 칸)에 맞춘다: 크기는 합성 드럼과 같은 세기 곡선을 따르고, 칸은 소리 색만 바꾼다
      const med = layers.map(list => { const v = list.map(punch).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || 1e-9; });
      const ref = med[recLayer(100, nl)];
      e.pieces[pc] = { layers, gain: dbToGain((S.gains && S.gains[pi]) || 0), norm: med.map(m => Math.sqrt(ref / m)) };
    });
    e.ok = true;
    U.emit('samples', { name, ok: true });
  }).catch(err => { e.failed = true; console.warn('[울림] ' + name + ' 드럼 녹음을 받지 못해 합성 드럼으로 쳐요.', err); U.emit('samples', { name, ok: false }); });
  return e;
}
/* 세기 → 칸 (여리게 0~47 · 보통 48~107 · 세게 108~) */
function recLayer(vel, nl) {
  const th = nl >= 3 ? [0, 48, 108] : nl === 2 ? [0, 72] : [0];
  let l = 0;
  for (let k = 0; k < th.length && k < nl; k++) if (vel >= th[k]) l = k;
  return l;
}
/* 소리의 '때리는 크기': 100ms 창 평균 제곱의 최댓값 */
function punch(buf) {
  const x = buf.getChannelData(0), W = Math.max(1, Math.round(0.1 * buf.sampleRate)), H = Math.max(1, W >> 3);
  let best = 0;
  for (let s = 0; s < x.length; s += H) { let e = 0; for (let i = s, z = Math.min(x.length, s + W); i < z; i++) e += x[i] * x[i]; if (e > best) best = e; }
  return best / W;
}
/* 합성 어쿠스틱 드럼 종류 → 녹음 조각 (예전 프로젝트를 열 때 저절로 바꾼다). 탐은 이름과 음높이로 크기를 고른다 */
const AUTO_REC = { akick: 'drk_rock:kick', asnare: 'drk_rock:snare', arim: 'drk_rock:rim', astick: 'drk_rock:stick', ahat: 'drk_rock:hat', apedal: 'drk_rock:pedal',
  aohat: 'drk_rock:open', acrash: 'drk_rock:crash', aride: 'drk_rock:ride', abell: 'drk_rock:bell', brush: 'drk_brush:snare', swish: 'drk_brush:stir' };
function autoRec(pd) {
  if (!pd) return null;
  const n = pd.name || '', tn = pd.tune || 0;
  if (pd.type === 'atom') return /floor/i.test(n) || tn <= -4 ? 'drk_rock:tom_floor' : /low/i.test(n) || tn < 0 ? 'drk_rock:tom_low' : /mid/i.test(n) || tn < 3 ? 'drk_rock:tom_mid' : 'drk_rock:tom_hi';
  if (pd.type === 'acrash' && /2/.test(n)) return 'drk_rock:crash2';
  return AUTO_REC[pd.type] || null;
}
/* 녹음 조각마다 받기 전에 대신 칠 합성 드럼 종류 */
const REC_FALLBACK = { kick: 'akick', snare: 'asnare', rim: 'arim', stick: 'astick', tom_hi: 'atom', tom_mid: 'atom', tom_low: 'atom', tom_floor: 'atom',
  hat: 'ahat', pedal: 'apedal', open: 'aohat', crash: 'acrash', crash2: 'acrash', ride: 'aride', bell: 'abell', stir: 'swish' };
const REC_KITS = { drk_rock: '록 키트', drk_brush: '브러시', drk_70s: '70년대 키트', drk_lofi: '로파이 키트' };
const REC_PIECES = { kick: '킥', snare: '스네어', rim: '림샷', stick: '사이드 스틱', tom_hi: '하이 탐', tom_mid: '미드 탐', tom_low: '로우 탐', tom_floor: '플로어 탐',
  hat: '닫힌 하이햇', pedal: '페달 하이햇', open: '열린 하이햇', crash: '크래시', crash2: '크래시 2', ride: '라이드', bell: '라이드 벨', stir: '브러시 스윕' };
U.drumRec = {
  set: drumSet,
  auto: autoRec,
  has: (kit, piece) => !!(U.DRUM_SETS && U.DRUM_SETS[kit] && U.DRUM_SETS[kit].pieces.includes(piece)),
  fallback: rec => { const [k, pc] = String(rec || '').split(':'); return k === 'drk_brush' && pc === 'snare' ? 'brush' : REC_FALLBACK[pc] || 'akick'; },
  label: rec => { const [k, pc] = String(rec || '').split(':'); return (REC_KITS[k] || k) + ' · ' + (REC_PIECES[pc] || pc); },
  /* 패드 화면의 고르기 목록 [값, 이름] */
  options: () => Object.keys(U.DRUM_SETS || {}).flatMap(k => U.DRUM_SETS[k].pieces.map(pc => [k + ':' + pc, (REC_KITS[k] || k) + ' · ' + (REC_PIECES[pc] || pc)])),
  /* 예전 프로젝트: 합성 어쿠스틱 드럼 · 브러시 패드를 녹음으로 (한 번만, data.rec 표시).
     kit: 그 장치를 만든 킷(이름이 남아 있으면). 같은 자리 · 같은 패드면 그 킷의 녹음 배치를 그대로 쓴다 */
  upgrade(data, kit) {
    if (!data || data.rec || !Array.isArray(data.pads)) return data;
    data.pads.forEach((pd, i) => {
      if (!pd || pd.src !== 'synth') return;
      const kp = kit && kit.pads && kit.pads[i], sp = kit && kit.synthPads && kit.synthPads[i];
      if (kp && kp.src === 'rec' && kp.type === pd.type && kp.name === pd.name) {
        // 그 킷의 녹음 배치대로. 크기는 사용자가 바꾼 만큼은 그대로 두고 킷이 맞춘 차이만 더한다
        const dl = sp ? (kp.level || 0) - (sp.level || 0) : 0;
        Object.assign(pd, { src: 'rec', rec: kp.rec, tune: kp.tune, decay: kp.decay, tone: kp.tone, level: Math.max(-36, Math.min(6, (pd.level || 0) + dl)) });
        return;
      }
      const r = autoRec(pd);
      if (!r) return;
      pd.src = 'rec'; pd.rec = r;
      if (pd.type === 'atom') pd.tune = 0;   // 탐 크기는 녹음 조각이 정한다
    });
    data.rec = 1;
    return data;
  },
  loaded: name => !!(DSETS.get(name) && DSETS.get(name).ok)
};

class Drums extends Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.pads = [];
    this.maxVoices = 48;
    this.syncData(dev.data);
  }
  syncData(data) {
    const pads = (data && data.pads) || [];
    const jobs = [];
    for (let i = 0; i < 16; i++) {
      const pd = pads[i];
      let pn = this.pads[i];
      const fresh = !pn;
      if (fresh) {
        pn = this.pads[i] = { gain: gainNode(this.ctx, 1), pan: this.ctx.createStereoPanner(), key: null, buffer: null };
        pn.gain.connect(pn.pan); pn.pan.connect(this.out);
      }
      if (!pd) { pn.buffer = null; pn.key = null; pn.wait = null; continue; }
      const lvl = pd.mute ? 0 : dbToGain(pd.level || 0), pan = pd.pan || 0;
      if (fresh) { pn.gain.gain.value = lvl; pn.pan.pan.value = pan; }
      else { const t = this.ctx.currentTime; smooth(pn.gain.gain, lvl, t); smooth(pn.pan.pan, pan, t); }
      const rec = pd.src === 'rec' && pd.rec ? pd.rec : null;
      const key = pd.src === 'sample' ? 'S:' + (pd.sample || '') : [rec ? 'R:' + rec : 'D', pd.type, pd.tune, pd.decay, pd.tone].join(':');
      if (key !== pn.key) {
        pn.key = key;
        // 녹음 드럼: 키트를 받는 동안에는 아래의 합성 드럼(type)으로 친다
        pn.rec = null; pn.rr = -1;
        if (rec) {
          const [kit, piece] = rec.split(':'), e = drumSet(kit);
          if (e) { pn.rec = { e, piece }; jobs.push(e.promise); }
        }
        const job = pd.src === 'sample'
          ? (pd.sample ? U.media.get(pd.sample, this.ctx.sampleRate) : Promise.resolve(null))
          : U.renderDrum(pd.type, { tune: pd.tune || 0, decay: pd.decay != null ? pd.decay : 0.5, tone: pd.tone != null ? pd.tone : 0.5 }, this.ctx.sampleRate);
        const done = job.then(buf => { if (pn.key === key) pn.buffer = buf; }, err => { console.warn(err); });
        jobs.push(done);
        // 이 패드가 처음 소리를 낼 수 있게 되는 때: 합성 대체음이나 녹음 중 먼저 오는 쪽 (앞 소리가 남아 있으면 그것으로 친다)
        pn.wait = Promise.race([done].concat(pn.rec ? [pn.rec.e.promise.then(() => {}, () => {})] : []));
      }
    }
    this.ready = Promise.all(jobs);
    return this.ready;
  }
  voice(p, vel, t) {
    const i = p - 36;
    if (i < 0 || i >= 16) return null;
    const pd = this.dev.data && this.dev.data.pads[i];
    const pn = this.pads[i];
    const pc = pn && pn.rec && pn.rec.e.ok ? pn.rec.e.pieces[pn.rec.piece] : null;
    if (!pd || !pn || (!pn.buffer && !pc) || pd.mute) return null;
    if (pd.choke) {
      for (const vo of this.voices) if (vo.choke === pd.choke && vo.end > t && vo.t0 < t) this.kill(vo, t);
    }
    if (pc) return this.recVoice(pd, pn, pc, i, vel, t);
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = pn.buffer;
    let rate = 1;
    if (pd.src === 'sample') rate = Math.pow(2, (pd.tune || 0) / 12);
    src.playbackRate.value = rate;
    const amp = gainNode(ctx, 0);
    const g = velGain(vel, 0.75);
    amp.gain.setValueAtTime(g, t);
    let end = t + pn.buffer.duration / rate + 0.01;
    if (pd.src === 'sample' && pd.decay < 0.98) {
      const len = 0.03 + Math.pow(pd.decay, 2) * 3;
      amp.gain.setTargetAtTime(0, t + len * 0.3, len / 3);
      end = Math.min(end, t + len * 0.3 + len * 1.5);
    }
    src.connect(amp); amp.connect(pn.gain);
    src.start(t);
    stopAt(src, end);
    return { amp, srcs: [src], nodes: [src, amp], choke: pd.choke, end, pad: i };
  }
  /* 녹음 드럼 한 번: 세기 칸(여리게 · 보통 · 세게)을 고르고 칸 안에서는 칠 때마다 다음 녹음. 칸은 소리 색을, 세기 곡선은 크기를 정한다.
     Tune은 반음, Decay 0.5면 녹음 그대로(낮추면 짧게), Tone 0.5면 그대로(낮추면 어둡게, 올리면 밝게) */
  recVoice(pd, pn, pc, i, vel, t) {
    const ctx = this.ctx, nl = pc.layers.length, l = recLayer(vel, nl);
    const list = pc.layers[l];
    pn.rr = (pn.rr + 1) % list.length;
    const buf = list[pn.rr];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const rate = Math.pow(2, (pd.tune || 0) / 12);
    src.playbackRate.value = rate;
    const amp = gainNode(ctx, 0);
    // 크기는 합성 드럼과 같은 세기 곡선 (세기 100에서 맞춰 둔 크기 기준)
    const g = pc.gain * pc.norm[l] * velGain(vel, 0.75) / velGain(100, 0.75);
    amp.gain.setValueAtTime(g, t);
    const nodes = [src, amp];
    let head = src;
    const tone = pd.tone == null ? 0.5 : pd.tone;
    if (tone < 0.47 || tone > 0.53) {
      const f = ctx.createBiquadFilter();
      if (tone < 0.5) { f.type = 'lowpass'; f.frequency.value = clamp(20000 * Math.pow(2, -(0.5 - tone) * 10), 400, 20000); f.Q.value = 0.6; }
      else { f.type = 'highshelf'; f.frequency.value = 4000; f.gain.value = (tone - 0.5) * 20; }
      head.connect(f); head = f; nodes.push(f);
    }
    head.connect(amp); amp.connect(pn.gain);
    let end = t + buf.duration / rate + 0.01;
    const dec = pd.decay == null ? 0.5 : pd.decay;
    if (dec < 0.47) {
      const T = buf.duration / rate * (0.1 + 0.9 * Math.pow(dec / 0.5, 1.5));
      amp.gain.setTargetAtTime(0, t + T * 0.25, T / 4);
      end = Math.min(end, t + T * 1.5);
    }
    src.start(t);
    stopAt(src, end);
    return { amp, srcs: [src], nodes, choke: pd.choke, end, pad: i, rec: true, layer: l, take: pn.rr };
  }
  release() { /* 드럼은 끝까지 울린다 */ }
  /* 킷을 막 넣어서 이 패드가 아직 아무 소리도 못 내면(합성 대체음을 만드는 중 · 녹음을 받는 중) 그 음을 버리지 않고
     준비되는 대로 친다. 너무 늦으면(박에 맞춰 친 음 0.15초 · 손으로 친 음 0.6초) 박이 어긋나지 않게 버린다 */
  noteOn(p, v, t, live) {
    const vo = super.noteOn(p, v, t, live);
    if (vo || !this.on) return vo;
    const i = p - 36, pn = this.pads[i], pd = this.dev.data && this.dev.data.pads[i];
    if (!pd || pd.mute || !pn || !pn.wait || pn.buffer || (pn.rec && pn.rec.e.ok)) return null;
    const w = { p, v, t, live: !!live, dead: false };
    if (!this.waiting) this.waiting = new Set();
    this.waiting.add(w);
    pn.wait.then(() => {
      this.waiting.delete(w);
      if (w.dead || !this.on || this.gone) return;
      const now = this.ctx.currentTime;
      if (now - t > (w.live ? 0.6 : 0.15)) return;
      const late = super.noteOn(p, v, Math.max(t, now + 0.004), live);
      if (late) this.lateHits = (this.lateHits || 0) + 1;
    });
    return null;
  }
  /* 기다리던 음도 멈춘다: t 뒤의 음, 지금 멈추면 모두 */
  cut(t, withLive) {
    if (this.waiting) for (const w of this.waiting) if ((withLive || !w.live) && (w.t >= t - 1e-4 || t <= this.ctx.currentTime + 0.02)) w.dead = true;
    super.cut(t, withLive);
  }
  stopAll(t) { if (this.waiting) for (const w of this.waiting) w.dead = true; super.stopAll(t); }
  dispose() { this.gone = true; if (this.waiting) for (const w of this.waiting) w.dead = true; super.dispose(); }
  /* 소리를 아직 못 내는 패드가 있으면 그 준비를 기다리는 약속 (재생을 시작하기 전에 잠깐 기다린다), 없으면 null */
  pendingSilent() {
    const pads = (this.dev.data && this.dev.data.pads) || [];
    const ws = [];
    this.pads.forEach((pn, i) => { const pd = pads[i]; if (pd && !pd.mute && pn && pn.wait && !pn.buffer && !(pn.rec && pn.rec.e.ok)) ws.push(pn.wait); });
    return ws.length ? Promise.all(ws) : null;
  }
  param(id) { if (id === 'vol' && this.on) smooth(this.out.gain, this.outLevel(), this.ctx.currentTime); }
  get isPads() { return true; }
  /* 화면에서 패드를 눌렀을 때 */
  hits(t) { return this.voices.filter(v => v.t0 > t - 0.12 && v.t0 <= t + 0.01).map(v => v.pad); }
}

/* ================= Sampler ================= */
class Sampler extends Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.buffer = null;
    this.ref = undefined;
    this.syncData(dev.data);
  }
  syncData(data) {
    const ref = data && data.sample;
    if (ref === this.ref) return this.ready;
    this.ref = ref;
    if (!ref) { this.buffer = null; this.ready = Promise.resolve(); return this.ready; }
    this.ready = U.media.get(ref, this.ctx.sampleRate).then(buf => { if (this.ref === ref) this.buffer = buf; }, err => console.warn(err));
    return this.ready;
  }
  voice(p, vel, t) {
    if (!this.buffer) return null;
    const ctx = this.ctx, P = this.v, buf = this.buffer, dur = buf.duration;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const s0 = clamp(Math.min(P.start, P.end), 0, 1) * dur;
    const s1 = clamp(Math.max(P.start, P.end), 0, 1) * dur;
    if (s1 - s0 < 0.002) return null;
    let off = s0, len = s1 - s0, rate;
    const fine = (P.tune + P.fine / 100) / 12;
    let loop = false;
    if (P.mode === 'slice') {
      const n = Math.max(1, Math.round(P.slices));
      const i = (((p - 36) % n) + n) % n;
      len = (s1 - s0) / n;
      off = s0 + i * len;
      rate = Math.pow(2, fine);
    } else {
      rate = Math.pow(2, (p - P.root) / 12 + fine);
      if (P.mode === 'classic' && P.loop) {
        loop = true;
        src.loop = true;
        src.loopStart = Math.max(s0, Math.min(s1 - 0.005, P.lstart * dur));
        src.loopEnd = s1;
      }
    }
    src.playbackRate.value = rate;
    const amp = gainNode(ctx, 0);
    const nodes = [src, amp];
    let last = src;
    if (P.fon) {
      const fl = ctx.createBiquadFilter();
      fl.type = biquadType(P.ft);
      fl.frequency.value = P.cut;
      fl.Q.value = filterQ(P.ft, P.res);
      src.connect(fl); last = fl; nodes.push(fl);
    }
    last.connect(amp); amp.connect(this.out);
    const g = velGain(vel, P.vel);
    if (P.mode === 'oneshot') {
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(g, t + Math.max(0.001, P.a));
    } else envOn(amp.gain, t, g, P.a, P.d, P.s);
    if (loop) src.start(t, off);
    else src.start(t, off, len);
    const natEnd = loop ? Infinity : t + len / rate + 0.01;
    if (!loop) stopAt(src, natEnd);
    return { amp, srcs: [src], nodes, end: natEnd, natEnd };
  }
  release(vo, t) {
    const P = this.v;
    if (P.mode === 'oneshot') return;
    envOff(vo.amp.gain, t, P.r);
    vo.end = Math.min(vo.natEnd, envEnd(t, P.r));
    for (const s of vo.srcs) stopAt(s, vo.end);
  }
  param(id) { if (id === 'vol' && this.on) smooth(this.out.gain, this.outLevel(), this.ctx.currentTime); }
}

/* ================= Loop Pad =================
   패드 16개(C1~D#2). 패드마다 샘플의 한 구간(찹)을 원샷·누르는 동안·반복·켜고 끄기로 연주한다.
   같은 패드끼리, 같은 초크 그룹끼리는 서로 끊는다. 템포 맞춤을 켜면 구간을 16분음표 조각으로
   잘라 지금 템포에 맞춰 이어 붙인다 (음높이는 그대로) */
class LoopPad extends Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.pads = [];
    this.streams = [];
    this.maxVoices = 32;
    if (eng.pumps) eng.pumps.add(this);
    this.syncData(dev.data);
  }
  get isPads() { return true; }
  padData(i) { const d = this.dev.data; return d && d.pads ? d.pads[i] || null : null; }
  syncData(data) {
    const pads = (data && data.pads) || [];
    const sr = this.ctx.sampleRate, t = this.ctx.currentTime;
    const jobs = [];
    for (let i = 0; i < 16; i++) {
      const pd = pads[i];
      let pn = this.pads[i];
      const fresh = !pn;
      if (fresh) {
        pn = this.pads[i] = { gain: gainNode(this.ctx, 1), pan: this.ctx.createStereoPanner(), ref: null, buffer: null, job: null };
        pn.gain.connect(pn.pan); pn.pan.connect(this.out);
      }
      const lvl = pd ? dbToGain(pd.gain || 0) : 0, pan = pd ? clamp(pd.pan || 0, -1, 1) : 0;
      if (fresh) { pn.gain.gain.value = lvl; pn.pan.pan.value = pan; }
      else { smooth(pn.gain.gain, lvl, t); smooth(pn.pan.pan, pan, t); }
      const ref = pd ? pd.sample || (data && data.src) || null : null;
      if (ref !== pn.ref) {
        pn.ref = ref;
        pn.buffer = ref ? U.media.cached(ref, sr) : null;
        pn.job = ref && !pn.buffer ? U.media.get(ref, sr).then(buf => { if (pn.ref === ref) pn.buffer = buf; }, err => console.warn(err)) : null;
      }
      if (pn.job && !pn.buffer) jobs.push(pn.job);
    }
    this.ready = Promise.all(jobs);
    return this.ready;
  }
  /* 패드가 울릴 구간(초). 거꾸로 재생이면 뒤집은 버퍼의 거울 자리 */
  region(pd, buf) {
    const dur = buf.duration;
    let s = clamp(Math.min(pd.start, pd.end), 0, 1) * dur, e = clamp(Math.max(pd.start, pd.end), 0, 1) * dur;
    if (e - s < 0.005) return null;
    if (pd.rev) { const s2 = dur - e; e = dur - s; s = s2; buf = U.media.reversed(buf); }
    return { buf, s, e, len: e - s };
  }
  /* 손으로 친 반복·켜고 끄기 패드는 Launch 값만큼 박자 경계를 기다린다.
     멈춰 있을 때는 이미 돌고 있는 루프의 시작점을 기준으로 맞춘다 */
  launchTime(t) {
    const e = this.eng, q = this.v.q;
    if (!q || q === 'none' || !e.project) return t;
    const qb = U.quantBeats(q, e.project.sig);
    if (!qb) return t;
    if (e.playing) return Math.max(t, e.timeAt(Math.ceil(e.beatAt(t) / qb - 1e-6) * qb));
    let first = null;
    for (const vo of this.voices) if ((vo.mode === 'loop' || vo.mode === 'toggle') && vo.end > t && vo.t1 > t && (!first || vo.t0 < first.t0)) first = vo;
    if (!first) return t;
    const qs = qb * 60 / (e.bpm || 120);
    return Math.max(t, first.t0 + Math.ceil((t - first.t0) / qs - 1e-6) * qs);
  }
  noteOn(p, v, t, live) {
    const pd = this.padData(p - 36);
    if (live && pd && (pd.mode === 'loop' || pd.mode === 'toggle')) t = this.launchTime(t);
    const vo = super.noteOn(p, v, t, live);
    if (vo && vo.cutAt < Infinity) this.kill(vo, vo.cutAt);
    return vo;
  }
  noteOff(vo, t) {
    // 원샷과 켜고 끄기는 떼어도 멈추지 않는다
    if (vo && (vo.mode === 'oneshot' || vo.mode === 'toggle')) return;
    super.noteOff(vo, t);
  }
  cut(t, withLive) {
    for (const vo of this.voices) {
      if (vo.live && !withLive) continue;
      if (vo.t0 >= t - 1e-4) this.kill(vo, t);
      else if (vo.t1 > t && vo.mode !== 'oneshot' && vo.mode !== 'toggle') { vo.t1 = t; this.release(vo, t); }
    }
  }
  voice(p, vel, t) {
    const i = p - 36;
    if (i < 0 || i >= 16) return null;
    const pd = this.padData(i), pn = this.pads[i];
    if (!pd || !pn || !pn.buffer) return null;
    const rg = this.region(pd, pn.buffer);
    if (!rg) return null;
    const mode = this.forceMode || pd.mode;
    if (mode === 'toggle') {
      const cur = this.voices.find(vo => vo.pad === i && vo.mode === 'toggle' && vo.t0 <= t + 1e-4 && vo.t1 > t + 1e-4);
      if (cur) { cur.t1 = t; this.release(cur, t, true); return null; }
    }
    // 이미 울리는 같은 패드·초크 그룹은 끊고, 뒤에 시작할 소리가 있으면 그때 이 소리를 끊는다
    let cutAt = Infinity;
    for (const vo of this.voices) {
      if (vo.end <= t || (vo.pad !== i && !(pd.choke && vo.choke === pd.choke))) continue;
      if (vo.t0 <= t + 1e-4) this.kill(vo, t);
      else cutAt = Math.min(cutAt, vo.t0);
    }
    const ctx = this.ctx;
    const amp = gainNode(ctx, 0);
    amp.connect(pn.gain);
    const g = velGain(vel, this.v.vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(g, t + 0.003);
    const rate = Math.pow(2, (pd.tune || 0) / 12);
    const loop = mode === 'loop' || mode === 'toggle';
    const vo = { amp, srcs: [], nodes: [amp], pad: i, choke: pd.choke || 0, mode, end: Infinity, cutAt };
    if (pd.sync) {
      const n = U.clamp(Math.round((+pd.beats || 4) * 4), 1, 256);
      vo.stream = { buf: rg.buf, s: rg.s, slen: rg.len / n, n, rate, loop, next: t, k: 0, until: Infinity };
      if (!loop) vo.end = t + n * this.step() + 0.01;
      this.streams.push(vo);
      this.pumpStream(vo, t + 0.15);
      return vo;
    }
    const src = ctx.createBufferSource();
    src.buffer = rg.buf;
    src.playbackRate.value = rate;
    src.connect(amp);
    vo.srcs.push(src);
    vo.nodes.push(src);
    if (loop) {
      src.loop = true;
      src.loopStart = rg.s;
      src.loopEnd = rg.e;
      src.start(t, rg.s);
    } else {
      src.start(t, rg.s, rg.len);
      vo.end = t + rg.len / rate + 0.004;
      // 조각 끝에서 딸깍 소리가 나지 않게 살짝 줄인다
      const f = Math.min(0.004, rg.len / rate / 4);
      amp.gain.setValueAtTime(g, Math.max(t + 0.003, vo.end - 0.004 - f));
      amp.gain.linearRampToValueAtTime(0, vo.end - 0.004);
      stopAt(src, vo.end);
    }
    return vo;
  }
  step() { return 15 / (this.eng.bpm || 120); } // 16분음표 길이(초)
  /* 템포 맞춤 패드: tEnd까지 16분음표 조각을 예약한다. 엔진이 틱마다 부른다 */
  pump(tEnd) {
    if (!this.streams.length) return;
    for (const vo of this.streams) this.pumpStream(vo, tEnd);
    this.streams = this.streams.filter(vo => vo.stream.next < vo.stream.until - 1e-6);
  }
  pumpStream(vo, tEnd) {
    const st = vo.stream, step = this.step();
    let guard = 0;
    while (st.next < Math.min(tEnd, st.until) - 1e-6 && guard++ < 256) {
      if (!st.loop && st.k >= st.n) { st.until = st.next; break; }
      this.slice(vo, st.buf, st.s + (st.k % st.n) * st.slen, st.next, Math.min(step, st.slen / st.rate), st.rate);
      st.k++;
      st.next += step;
    }
  }
  slice(vo, buf, off, t, dur, rate) {
    const ctx = this.ctx;
    const late = Math.max(0, ctx.currentTime - t);
    const len = dur - late;
    if (len < 0.005) return;
    const t0 = t + late;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = gainNode(ctx, 0);
    src.connect(g); g.connect(vo.amp);
    const f = Math.min(0.003, len / 4);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + f);
    g.gain.setValueAtTime(1, t0 + len - f);
    g.gain.linearRampToValueAtTime(0, t0 + len);
    src.start(t0, off + late * rate, len * rate + 0.002);
    stopAt(src, t0 + len + 0.01);
    src.onended = () => { try { g.disconnect(); } catch (e) { /* 무시 */ } };
    vo.srcs.push(src);
    if (vo.srcs.length > 40) vo.srcs.splice(0, vo.srcs.length - 40);
  }
  release(vo, t, force) {
    if (!force && (vo.mode === 'oneshot' || vo.mode === 'toggle')) return;
    const r = Math.max(0.003, this.v.rel);
    envOff(vo.amp.gain, t, r);
    vo.end = Math.min(vo.end, envEnd(t, r));
    if (vo.stream) vo.stream.until = Math.min(vo.stream.until, vo.end);
    for (const s of vo.srcs) stopAt(s, vo.end);
  }
  silence(vo, t) {
    super.silence(vo, t);
    if (vo.stream) vo.stream.until = Math.min(vo.stream.until, t + 0.03);
  }
  /* 화면에서 구간을 고칠 때 방식과 상관없이 한 번만 (길면 2.5초까지) 들려준다 */
  preview(i, vel, t) {
    this.forceMode = 'oneshot';
    let vo = null;
    try { vo = this.playNote(36 + i, vel, t, 0.5); } finally { this.forceMode = null; }
    if (vo && vo.end > t + 2.5) this.kill(vo, t + 2.5);
  }
  /* 트랜스포트를 멈추면 되풀이하던 패드도 멈춘다 */
  stopped(t) { for (const vo of this.voices) if ((vo.mode === 'loop' || vo.mode === 'toggle') && vo.end > t) this.kill(vo, t); }
  param(id) { if (id === 'vol' && this.on) smooth(this.out.gain, this.outLevel(), this.ctx.currentTime); }
  hits(t) { return this.voices.filter(v => v.t0 > t - 0.12 && v.t0 <= t + 0.01).map(v => v.pad); }
  sounding(t) { return this.voices.filter(v => v.t0 <= t + 0.01 && v.end > t && v.t1 > t).map(v => v.pad); }
  dispose() {
    if (this.eng.pumps) this.eng.pumps.delete(this);
    super.dispose();
  }
}

/* ================= MIDI 이펙트 =================
   음표 {p: 음높이, v: 세기, b: 시작 박, d: 길이(박)} 를 받아 바꾼다 */
class MidiFx extends Device {
  map(n) { return [n]; }
}
class ChordFx extends MidiFx {
  map(n) {
    const P = this.v;
    const out = [n];
    const key = this.eng.keyOf();
    for (const k of ['s1', 's2', 's3', 's4']) {
      const s = Math.round(P[k] || 0);
      if (!s) continue;
      const p = P.sc
        ? U.degreeToPitch(U.pitchToDegree(n.p, key.root, key.scale, n.p) + s, key.root, key.scale, n.p)
        : n.p + s;
      if (p >= 0 && p <= 127 && !out.some(x => x.p === p)) out.push(Object.assign({}, n, { p }));
    }
    return out;
  }
}
class ScaleFx extends MidiFx {
  map(n) {
    const P = this.v;
    const key = P.cur ? this.eng.keyOf() : { root: Math.round(P.root), scale: P.scale };
    const p = U.snapToScale(n.p + Math.round(P.trans || 0), key.root, key.scale);
    return p >= 0 && p <= 127 ? [Object.assign({}, n, { p })] : [];
  }
}
class VelocityFx extends MidiFx {
  map(n) {
    const P = this.v;
    let v = P.lo + (P.hi - P.lo) * (U.clamp(n.v, 1, 127) - 1) / 126;
    if (P.rnd > 0) v += (Math.random() * 2 - 1) * P.rnd;
    return [Object.assign({}, n, { v: Math.round(U.clamp(v, 1, 127)) })];
  }
}
class ArpFx extends MidiFx {
  constructor(eng, dev) {
    super(eng, dev);
    this.held = [];        // 클립에서 온 음: {p, v, b0, b1, ord}
    this.live = new Map(); // 건반으로 누른 음: p -> {v, ord}
    this.seq = 0;
    this.idx = 0;
    this.dir = 1;
  }
  get isArp() { return true; }
  hold(n) { this.held.push({ p: n.p, v: n.v, b0: n.b, b1: n.b + n.d, ord: this.seq++ }); }
  liveOn(p, v) { this.live.set(p, { v, ord: this.seq++ }); }
  liveOff(p) { this.live.delete(p); }
  clear() { this.held = []; this.idx = 0; }
  heldAt(s) {
    const m = new Map();
    for (const h of this.held) if (h.b0 <= s + 1e-6 && s < h.b1 - 1e-6 && !m.has(h.p)) m.set(h.p, h);
    for (const [p, h] of this.live) if (!m.has(p)) m.set(p, { p, v: h.v, ord: h.ord });
    return [...m.values()];
  }
  pattern(notes) {
    const P = this.v;
    const base = P.style === 'played' ? notes.slice().sort((a, b) => a.ord - b.ord) : notes.slice().sort((a, b) => a.p - b.p);
    const seq = [];
    for (let o = 0; o < Math.max(1, Math.round(P.oct)); o++) for (const n of base) seq.push({ p: n.p + o * 12, v: n.v });
    switch (P.style) {
      case 'down': return seq.reverse();
      case 'updown': return seq.length > 2 ? seq.concat(seq.slice(1, -1).reverse()) : seq;
      case 'downup': { const r = seq.slice().reverse(); return r.length > 2 ? r.concat(r.slice(1, -1).reverse()) : r; }
      case 'converge': {
        const out = [];
        let i = 0, j = seq.length - 1;
        while (i <= j) { out.push(seq[i++]); if (i <= j) out.push(seq[j--]); }
        return out;
      }
      default: return seq;
    }
  }
  /* [b0, b1) 구간의 아르페지오 음 */
  steps(b0, b1) {
    const P = this.v;
    const rate = U.divBeats(P.rate);
    const out = [];
    let s = Math.ceil(b0 / rate - 1e-6) * rate;
    for (; s < b1 - 1e-9; s += rate) {
      const notes = this.heldAt(s);
      if (!notes.length) { this.idx = 0; continue; }
      const seq = this.pattern(notes);
      const d = rate * P.gate;
      const vel = n => (P.vfix ? P.vel : n.v);
      if (P.style === 'chord') { for (const n of seq) out.push({ p: n.p, v: vel(n), b: s, d }); continue; }
      let n;
      if (P.style === 'random') n = seq[Math.floor(Math.random() * seq.length)];
      else { n = seq[this.idx % seq.length]; this.idx = (this.idx + 1) % seq.length; }
      if (n.p <= 127) out.push({ p: n.p, v: vel(n), b: s, d });
    }
    if (this.held.length > 64) this.held = this.held.filter(h => h.b1 > b0 - 1);
    return out;
  }
}

const KINDS = {
  polysynth: PolySynth, fm: FMSynth, drums: Drums, sampler: Sampler, looppad: LoopPad,
  arp: ArpFx, chord: ChordFx, scale: ScaleFx, velocity: VelocityFx
};
U.Device = Device;
U.Instrument = Instrument;
U.MidiFx = MidiFx;
U.DEVICE_CLASSES = Object.assign(U.DEVICE_CLASSES || {}, KINDS);
})(window.U = window.U || {});
