/* 울림 — 장치 실행부 1: 공통 바탕, 악기 4종, MIDI 이펙트 4종 */
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
    for (const n of vo.nodes || []) { try { n.disconnect(); } catch (e) { /* 무시 */ } }
  }
  activeVoices(t) { return this.voices.filter(vo => vo.end > t && vo.t0 <= t + 0.01); }
  dispose() {
    const t = this.ctx.currentTime;
    for (const vo of this.voices) this.kill(vo, t);
    setTimeout(() => { for (const vo of this.voices) this.free(vo); try { this.out.disconnect(); } catch (e) { /* 무시 */ } }, 100);
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
    const mk = (wave, mul, det, lvl) => {
      if (lvl <= 0.001) return null;
      const o = ctx.createOscillator();
      o.type = wave;
      const target = f * mul;
      if (from != null) {
        o.frequency.setValueAtTime(mtof(from) * mul, t);
        o.frequency.setTargetAtTime(target, t, Math.max(0.001, P.glide) / 3);
      } else o.frequency.setValueAtTime(target, t);
      o.detune.value = det;
      const g = gainNode(ctx, lvl);
      o.connect(g); g.connect(pre);
      this.lfoP.connect(o.detune);
      o.start(t);
      srcs.push(o); nodes.push(o, g);
      return { o, g };
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
    for (const o of [vo.o1, vo.o2]) if (o) { try { this.lfoP.disconnect(o.o.detune); } catch (e) { /* 무시 */ } }
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
      case 'l1': for (const vo of live) if (vo.o1) smooth(vo.o1.g.gain, v, t); break;
      case 'l2': for (const vo of live) if (vo.o2) smooth(vo.o2.g.gain, v, t); break;
      case 'nz': for (const vo of live) if (vo.nz) smooth(vo.nz.g.gain, v * 0.7, t); break;
      case 'w1': for (const vo of live) if (vo.o1) vo.o1.o.type = v; break;
      case 'w2': for (const vo of live) if (vo.o2) vo.o2.o.type = v; break;
      case 'd1': for (const vo of live) if (vo.o1) smooth(vo.o1.o.detune, v, t); break;
      case 'd2': for (const vo of live) if (vo.o2) smooth(vo.o2.o.detune, v, t); break;
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
      if (!pd) { pn.buffer = null; pn.key = null; continue; }
      const lvl = pd.mute ? 0 : dbToGain(pd.level || 0), pan = pd.pan || 0;
      if (fresh) { pn.gain.gain.value = lvl; pn.pan.pan.value = pan; }
      else { const t = this.ctx.currentTime; smooth(pn.gain.gain, lvl, t); smooth(pn.pan.pan, pan, t); }
      const key = pd.src === 'sample' ? 'S:' + (pd.sample || '') : ['D', pd.type, pd.tune, pd.decay, pd.tone].join(':');
      if (key !== pn.key) {
        pn.key = key;
        const job = pd.src === 'sample'
          ? (pd.sample ? U.media.get(pd.sample, this.ctx.sampleRate) : Promise.resolve(null))
          : U.renderDrum(pd.type, { tune: pd.tune || 0, decay: pd.decay != null ? pd.decay : 0.5, tone: pd.tone != null ? pd.tone : 0.5 }, this.ctx.sampleRate);
        jobs.push(job.then(buf => { if (pn.key === key) pn.buffer = buf; }, err => { console.warn(err); }));
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
    if (!pd || !pn || !pn.buffer || pd.mute) return null;
    if (pd.choke) {
      for (const vo of this.voices) if (vo.choke === pd.choke && vo.end > t && vo.t0 < t) this.kill(vo, t);
    }
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
  release() { /* 드럼은 끝까지 울린다 */ }
  param(id) { if (id === 'vol' && this.on) smooth(this.out.gain, this.outLevel(), this.ctx.currentTime); }
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
  polysynth: PolySynth, fm: FMSynth, drums: Drums, sampler: Sampler,
  arp: ArpFx, chord: ChordFx, scale: ScaleFx, velocity: VelocityFx
};
U.Device = Device;
U.Instrument = Instrument;
U.MidiFx = MidiFx;
U.DEVICE_CLASSES = Object.assign(U.DEVICE_CLASSES || {}, KINDS);
})(window.U = window.U || {});
