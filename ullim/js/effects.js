/* 울림 — 장치 실행부 2: 오디오 이펙트 */
(function (U) {
'use strict';
const { smooth, gainNode, dbToGain, clamp } = U;

/* 이펙트 바탕: input → (처리) → wetOut → output, 꺼지면 input → bypass → output */
class AudioFx extends U.Device {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.input = gainNode(ctx, 1);
    this.output = gainNode(ctx, 1);
    this.fxOut = gainNode(ctx, this.on ? 1 : 0);
    this.bypass = gainNode(ctx, this.on ? 0 : 1);
    this.fxOut.connect(this.output);
    this.input.connect(this.bypass);
    this.bypass.connect(this.output);
  }
  setOn(on) {
    const t = this.ctx.currentTime;
    smooth(this.fxOut.gain, on ? 1 : 0, t, 0.008);
    smooth(this.bypass.gain, on ? 0 : 1, t, 0.008);
  }
  /* 드라이/웻 (같은 크기로 들리게) */
  makeMix(src) {
    this.dry = gainNode(this.ctx, 0);
    this.wet = gainNode(this.ctx, 1);
    this.input.connect(this.dry);
    this.dry.connect(this.fxOut);
    if (src) src.connect(this.wet);
    this.wet.connect(this.fxOut);
    this.applyMix(this.v.mix, this.ctx.currentTime, true);
  }
  applyMix(m, t, now) {
    const d = Math.cos(m * Math.PI / 2), w = Math.sin(m * Math.PI / 2);
    if (now) { this.dry.gain.value = d < 1e-4 ? 0 : d; this.wet.gain.value = w; return; }
    smooth(this.dry.gain, d < 1e-4 ? 0 : d, t);
    smooth(this.wet.gain, w, t);
  }
  analyser() {
    if (!this.an) {
      this.an = this.ctx.createAnalyser();
      this.an.fftSize = 4096;
      this.an.smoothingTimeConstant = 0.78;
      this.output.connect(this.an);
    }
    return this.an;
  }
  dispose() {
    setTimeout(() => {
      for (const k in this) {
        const n = this[k];
        if (!(n instanceof AudioNode)) continue;
        if (n instanceof OscillatorNode) { try { n.stop(); } catch (e) { /* 무시 */ } }
        try { n.disconnect(); } catch (e) { /* 무시 */ }
      }
    }, 50);
  }
}

/* ---------- EQ Six ---------- */
class EQ extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    this.bands = [];
    let last = this.input;
    for (let i = 1; i <= 6; i++) {
      const f = this.ctx.createBiquadFilter();
      last.connect(f);
      last = f;
      this.bands.push(f);
    }
    this.gain = gainNode(this.ctx, dbToGain(this.v.gain));
    last.connect(this.gain);
    this.gain.connect(this.fxOut);
    for (let i = 1; i <= 6; i++) this.applyBand(i, this.ctx.currentTime, true);
  }
  applyBand(n, t, now) {
    const P = this.v, f = this.bands[n - 1];
    const on = P['b' + n + 'on'];
    const b = U.eqBiquad(P['b' + n + 't'], P['b' + n + 'q']);
    if (!on) { f.type = 'peaking'; f.gain.value = 0; return; }
    if (f.type !== b.type) f.type = b.type;
    const freq = P['b' + n + 'f'], g = P['b' + n + 'g'];
    if (now) { f.frequency.value = freq; f.gain.value = g; f.Q.value = b.Q; return; }
    smooth(f.frequency, freq, t); smooth(f.gain, g, t); smooth(f.Q, b.Q, t);
  }
  param(id, v, t) {
    if (id === 'gain') { smooth(this.gain.gain, dbToGain(v), t); return; }
    const m = /^b(\d)/.exec(id);
    if (m) this.applyBand(+m[1], t);
  }
  /* 화면 그래프용: 켜진 밴드를 모두 거친 크기(dB) */
  response(freqs) {
    const out = new Float32Array(freqs.length);
    const mag = new Float32Array(freqs.length), ph = new Float32Array(freqs.length);
    const P = this.v;
    for (let i = 0; i < 6; i++) {
      if (!P['b' + (i + 1) + 'on']) continue;
      this.bands[i].getFrequencyResponse(freqs, mag, ph);
      for (let k = 0; k < freqs.length; k++) out[k] += 20 * Math.log10(Math.max(1e-6, mag[k]));
    }
    for (let k = 0; k < freqs.length; k++) out[k] += P.gain;
    return out;
  }
  bandResponse(i, freqs) {
    const mag = new Float32Array(freqs.length), ph = new Float32Array(freqs.length);
    this.bands[i].getFrequencyResponse(freqs, mag, ph);
    return Array.from(mag, m => 20 * Math.log10(Math.max(1e-6, m)));
  }
}

/* ---------- Compressor ---------- */
class Compressor extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const P = this.v;
    this.comp = this.ctx.createDynamicsCompressor();
    this.makeup = gainNode(this.ctx, dbToGain(P.makeup));
    this.input.connect(this.comp);
    this.comp.connect(this.makeup);
    this.makeMix(this.makeup);
    for (const id of ['thr', 'ratio', 'att', 'rel', 'knee']) this.param(id, P[id], 0, true);
  }
  param(id, v, t, now) {
    const c = this.comp;
    const set = (p, x) => (now ? (p.value = x) : smooth(p, x, t));
    switch (id) {
      case 'thr': set(c.threshold, v); break;
      case 'ratio': set(c.ratio, v); break;
      case 'att': set(c.attack, v); break;
      case 'rel': set(c.release, v); break;
      case 'knee': set(c.knee, v); break;
      case 'makeup': set(this.makeup.gain, dbToGain(v)); break;
      case 'mix': this.applyMix(v, t); break;
    }
  }
  reduction() { return this.on ? this.comp.reduction : 0; }
}

/* ---------- Limiter ---------- */
class Limiter extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx, P = this.v;
    this.pre = gainNode(ctx, dbToGain(P.gain));
    this.comp = ctx.createDynamicsCompressor();
    this.comp.ratio.value = 20;
    this.comp.knee.value = 0;
    this.comp.attack.value = 0.001;
    this.comp.release.value = P.rel;
    this.comp.threshold.value = P.ceil - 1;
    this.scale = gainNode(ctx, 0.25);
    this.clip = ctx.createWaveShaper();
    this.clip.curve = U.clipCurve(dbToGain(P.ceil));
    this.clip.oversample = '2x';
    this.input.connect(this.pre); this.pre.connect(this.comp); this.comp.connect(this.scale);
    this.scale.connect(this.clip); this.clip.connect(this.fxOut);
  }
  param(id, v, t) {
    if (id === 'gain') smooth(this.pre.gain, dbToGain(v), t);
    else if (id === 'ceil') { smooth(this.comp.threshold, v - 1, t); this.clip.curve = U.clipCurve(dbToGain(v)); }
    else if (id === 'rel') smooth(this.comp.release, v, t);
  }
  reduction() { return this.on ? this.comp.reduction : 0; }
}

/* ---------- Reverb ---------- */
class Reverb extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx, P = this.v;
    this.pre = ctx.createDelay(0.5);
    this.pre.delayTime.value = P.pre;
    this.conv = ctx.createConvolver();
    this.lo = ctx.createBiquadFilter();
    this.lo.type = 'highpass';
    this.lo.frequency.value = P.lowcut;
    this.input.connect(this.pre); this.pre.connect(this.conv); this.conv.connect(this.lo);
    this.makeMix(this.lo);
    this.buildIR();
    this.rebuild = U.debounce(() => this.buildIR(), 120);
  }
  buildIR() {
    const P = this.v;
    this.conv.buffer = U.makeIR(this.ctx, P.decay, P.size, P.damp);
  }
  param(id, v, t) {
    switch (id) {
      case 'pre': smooth(this.pre.delayTime, v, t); break;
      case 'lowcut': smooth(this.lo.frequency, v, t); break;
      case 'mix': this.applyMix(v, t); break;
      case 'decay': case 'size': case 'damp':
        if (this.eng.offline) this.buildIR(); else this.rebuild();
        break;
    }
  }
}

/* ---------- Delay ---------- */
class Delay extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.split = ctx.createChannelSplitter(2);
    this.sum = gainNode(ctx, 0.5);
    this.dl = ctx.createDelay(4); this.dr = ctx.createDelay(4);
    this.fbl = gainNode(ctx, 0); this.fbr = gainNode(ctx, 0);
    this.lpl = ctx.createBiquadFilter(); this.lpr = ctx.createBiquadFilter();
    this.hpl = ctx.createBiquadFilter(); this.hpr = ctx.createBiquadFilter();
    for (const f of [this.lpl, this.lpr]) f.type = 'lowpass';
    for (const f of [this.hpl, this.hpr]) f.type = 'highpass';
    this.merge = ctx.createChannelMerger(2);
    this.makeMix(this.merge);
    this.wire();
    this.applyTimes(ctx.currentTime, true);
    this.applyFilters(ctx.currentTime, true);
  }
  wire() {
    for (const n of [this.split, this.sum, this.dl, this.dr, this.fbl, this.fbr, this.lpl, this.lpr, this.hpl, this.hpr]) { try { n.disconnect(); } catch (e) { /* 무시 */ } }
    try { this.input.disconnect(this.split); } catch (e) { /* 무시 */ }
    try { this.input.disconnect(this.sum); } catch (e) { /* 무시 */ }
    const ping = this.v.mode === 'ping';
    this.dl.connect(this.hpl); this.hpl.connect(this.lpl); this.lpl.connect(this.fbl);
    this.dr.connect(this.hpr); this.hpr.connect(this.lpr); this.lpr.connect(this.fbr);
    if (ping) {
      this.input.connect(this.sum);
      this.sum.connect(this.dl);
      this.fbl.connect(this.dr);
      this.fbr.connect(this.dl);
    } else {
      this.input.connect(this.split);
      this.split.connect(this.dl, 0);
      this.split.connect(this.dr, 1);
      this.fbl.connect(this.dl);
      this.fbr.connect(this.dr);
    }
    this.dl.connect(this.merge, 0, 0);
    this.dr.connect(this.merge, 0, 1);
    const fb = this.v.fb;
    this.fbl.gain.value = fb;
    this.fbr.gain.value = fb;
  }
  times() {
    const P = this.v, bpm = this.eng.bpm;
    const l = P.sync ? U.divBeats(P.divl) * 60 / bpm : P.tl;
    let r;
    if (P.mode === 'ping') r = l;
    else r = P.sync ? U.divBeats(P.divr) * 60 / bpm : P.tr;
    return [clamp(l, 0.001, 3.9), clamp(r, 0.001, 3.9)];
  }
  applyTimes(t, now) {
    const [l, r] = this.times();
    if (now) { this.dl.delayTime.value = l; this.dr.delayTime.value = r; return; }
    smooth(this.dl.delayTime, l, t, 0.05);
    smooth(this.dr.delayTime, r, t, 0.05);
  }
  applyFilters(t, now) {
    const P = this.v;
    for (const f of [this.lpl, this.lpr]) now ? (f.frequency.value = P.lp) : smooth(f.frequency, P.lp, t);
    for (const f of [this.hpl, this.hpr]) now ? (f.frequency.value = P.hp) : smooth(f.frequency, P.hp, t);
  }
  param(id, v, t) {
    switch (id) {
      case 'mode': this.wire(); this.applyTimes(t); break;
      case 'sync': case 'divl': case 'divr': case 'tl': case 'tr': this.applyTimes(t); break;
      case 'fb': smooth(this.fbl.gain, v, t); smooth(this.fbr.gain, v, t); break;
      case 'lp': case 'hp': this.applyFilters(t); break;
      case 'mix': this.applyMix(v, t); break;
    }
  }
  onTempo() { if (this.v.sync) this.applyTimes(this.ctx.currentTime); }
}

/* ---------- Auto Filter ---------- */
class AutoFilter extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx, P = this.v;
    this.drive = gainNode(ctx, 1);
    this.shape = ctx.createWaveShaper();
    this.post = gainNode(ctx, 1);
    this.f1 = ctx.createBiquadFilter();
    this.f2 = ctx.createBiquadFilter();
    this.lfo = ctx.createOscillator();
    this.lfoG = gainNode(ctx, 0);
    this.lfo.connect(this.lfoG);
    this.lfoG.connect(this.f1.detune);
    this.lfoG.connect(this.f2.detune);
    this.lfo.start();
    this.input.connect(this.drive); this.drive.connect(this.shape); this.shape.connect(this.post);
    this.post.connect(this.f1);
    this.applyType();
    this.applyDrive(ctx.currentTime);
    this.f1.frequency.value = P.cut; this.f2.frequency.value = P.cut;
    this.applyRes(ctx.currentTime);
    this.lfo.type = P.lw;
    this.applyRate(ctx.currentTime);
    this.lfoG.gain.value = P.lamt * 3600;
  }
  applyType() {
    const ft = this.v.ft;
    try { this.f1.disconnect(); } catch (e) { /* 무시 */ }
    try { this.f2.disconnect(); } catch (e) { /* 무시 */ }
    const type = ft === 'hp12' ? 'highpass' : ft === 'bp' ? 'bandpass' : ft === 'notch' ? 'notch' : 'lowpass';
    this.f1.type = type;
    this.f2.type = 'lowpass';
    if (ft === 'lp24') { this.f1.connect(this.f2); this.f2.connect(this.fxOut); }
    else this.f1.connect(this.fxOut);
    this.applyRes(this.ctx.currentTime);
  }
  applyRes(t) {
    const P = this.v;
    const bp = P.ft === 'bp' || P.ft === 'notch';
    smooth(this.f1.Q, bp ? 0.7 + P.res * 12 : -3 + P.res * 26, t);
    smooth(this.f2.Q, -3, t);
  }
  applyDrive(t) {
    const d = this.v.drive;
    if (d < 0.05) { this.shape.curve = null; smooth(this.post.gain, 1, t); return; }
    this.shape.curve = U.satCurve('soft', d, 8);
    smooth(this.post.gain, 1 / Math.sqrt(dbToGain(d)), t);
  }
  applyRate(t) {
    const P = this.v;
    const hz = P.lsync ? this.eng.bpm / 60 / U.divBeats(P.ldiv) : P.lrate;
    smooth(this.lfo.frequency, hz, t, 0.02);
  }
  param(id, v, t) {
    switch (id) {
      case 'ft': this.applyType(); break;
      case 'cut': smooth(this.f1.frequency, v, t); smooth(this.f2.frequency, v, t); break;
      case 'res': this.applyRes(t); break;
      case 'drive': this.applyDrive(t); break;
      case 'lamt': smooth(this.lfoG.gain, v * 3600, t); break;
      case 'lw': this.lfo.type = v; break;
      case 'lsync': case 'ldiv': case 'lrate': this.applyRate(t); break;
    }
  }
  onTempo() { this.applyRate(this.ctx.currentTime); }
  response(freqs) {
    const mag = new Float32Array(freqs.length), ph = new Float32Array(freqs.length);
    const out = new Float32Array(freqs.length);
    this.f1.getFrequencyResponse(freqs, mag, ph);
    for (let i = 0; i < freqs.length; i++) out[i] = 20 * Math.log10(Math.max(1e-6, mag[i]));
    if (this.v.ft === 'lp24') {
      this.f2.getFrequencyResponse(freqs, mag, ph);
      for (let i = 0; i < freqs.length; i++) out[i] += 20 * Math.log10(Math.max(1e-6, mag[i]));
    }
    return out;
  }
}

/* ---------- Saturator ---------- */
class Saturator extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.shape = ctx.createWaveShaper();
    this.shape.oversample = '4x';
    this.post = gainNode(ctx, dbToGain(this.v.out));
    this.input.connect(this.shape); this.shape.connect(this.post);
    this.makeMix(this.post);
    this.applyCurve();
  }
  applyCurve() { const P = this.v; this.shape.curve = U.satCurve(P.type, P.drive, P.bits); }
  param(id, v, t) {
    if (id === 'out') smooth(this.post.gain, dbToGain(v), t);
    else if (id === 'mix') this.applyMix(v, t);
    else this.applyCurve();
  }
}

/* ---------- Chorus / Flanger / Vibrato ---------- */
class Chorus extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.dl = ctx.createDelay(0.1); this.dr = ctx.createDelay(0.1);
    this.lfo = ctx.createOscillator();
    this.gl = gainNode(ctx, 0); this.gr = gainNode(ctx, 0);
    this.fbl = gainNode(ctx, 0); this.fbr = gainNode(ctx, 0);
    this.merge = ctx.createChannelMerger(2);
    this.split = ctx.createChannelSplitter(2);
    this.input.connect(this.split);
    this.split.connect(this.dl, 0); this.split.connect(this.dr, 1);
    this.lfo.connect(this.gl); this.lfo.connect(this.gr);
    this.gl.connect(this.dl.delayTime); this.gr.connect(this.dr.delayTime);
    this.dl.connect(this.fbl); this.fbl.connect(this.dl);
    this.dr.connect(this.fbr); this.fbr.connect(this.dr);
    this.dl.connect(this.merge, 0, 0); this.dr.connect(this.merge, 0, 1);
    this.lfo.start();
    this.makeMix(this.merge);
    this.apply(ctx.currentTime);
  }
  apply(t) {
    const P = this.v;
    const flang = P.mode === 'flanger', vib = P.mode === 'vibrato';
    const base = flang ? Math.min(P.delay, 0.006) + 0.0005 : Math.max(0.002, P.delay);
    const depth = base * 0.85 * P.depth;
    smooth(this.dl.delayTime, base, t); smooth(this.dr.delayTime, base, t);
    smooth(this.gl.gain, depth, t);
    smooth(this.gr.gain, -depth * P.width, t);
    smooth(this.lfo.frequency, P.rate, t);
    const fb = vib ? 0 : P.fb * (flang ? 1 : 0.6);
    smooth(this.fbl.gain, fb, t); smooth(this.fbr.gain, fb, t);
    this.applyMix(vib ? 1 : P.mix, t);
  }
  param(id, v, t) { this.apply(t); }
}

/* ---------- Phaser ---------- */
class Phaser extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.aps = [];
    this.fbDelay = ctx.createDelay(0.01);
    this.fbDelay.delayTime.value = 0.003;
    this.fb = gainNode(ctx, 0);
    this.head = gainNode(ctx, 1);
    this.input.connect(this.head);
    let last = this.head;
    for (let i = 0; i < 6; i++) {
      const f = ctx.createBiquadFilter();
      f.type = 'allpass';
      f.Q.value = 0.6;
      last.connect(f);
      last = f;
      this.aps.push(f);
    }
    last.connect(this.fbDelay); this.fbDelay.connect(this.fb); this.fb.connect(this.head);
    this.lfo = ctx.createOscillator();
    this.lfoG = gainNode(ctx, 0);
    this.lfo.connect(this.lfoG);
    for (const f of this.aps) this.lfoG.connect(f.detune);
    this.lfo.start();
    this.makeMix(last);
    this.apply(ctx.currentTime);
  }
  apply(t) {
    const P = this.v;
    this.aps.forEach((f, i) => smooth(f.frequency, P.freq * Math.pow(1.6, i - 2.5), t));
    smooth(this.lfoG.gain, P.depth * 2400, t);
    smooth(this.lfo.frequency, P.rate, t);
    smooth(this.fb.gain, P.fb * 0.85, t);
    this.applyMix(P.mix, t);
  }
  param(id, v, t) { this.apply(t); }
}

/* ---------- Utility ---------- */
class Utility extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.gain = gainNode(ctx, 1);
    this.split = ctx.createChannelSplitter(2);
    this.merge = ctx.createChannelMerger(2);
    this.ll = gainNode(ctx); this.rl = gainNode(ctx); this.rr = gainNode(ctx); this.lr = gainNode(ctx);
    this.pan = ctx.createStereoPanner();
    this.input.connect(this.gain); this.gain.connect(this.split);
    this.split.connect(this.ll, 0); this.ll.connect(this.merge, 0, 0);
    this.split.connect(this.rl, 1); this.rl.connect(this.merge, 0, 0);
    this.split.connect(this.rr, 1); this.rr.connect(this.merge, 0, 1);
    this.split.connect(this.lr, 0); this.lr.connect(this.merge, 0, 1);
    this.merge.connect(this.pan); this.pan.connect(this.fxOut);
    this.apply(ctx.currentTime, true);
  }
  apply(t, now) {
    const P = this.v;
    const w = P.mono ? 0 : P.width;
    const a = (1 + w) / 2, b = (1 - w) / 2;
    const sl = P.invl ? -1 : 1, sr = P.invr ? -1 : 1;
    const set = (p, v) => (now ? (p.value = v) : smooth(p, v, t));
    set(this.gain.gain, dbToGain(P.gain));
    set(this.ll.gain, a * sl); set(this.rl.gain, b * sl);
    set(this.rr.gain, a * sr); set(this.lr.gain, b * sr);
    set(this.pan.pan, P.pan);
  }
  param(id, v, t) { this.apply(t); }
}

/* ---------- Ducker (박자 맞춰 음량 누르기) ---------- */
class Ducker extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    this.g = gainNode(this.ctx, 1);
    this.input.connect(this.g);
    this.g.connect(this.fxOut);
  }
  schedule(b0, b1) {
    const P = this.v, e = this.eng;
    const step = U.divBeats(P.div);
    let b = Math.ceil(b0 / step - 1e-6) * step;
    for (; b < b1 - 1e-9; b += step) {
      const t = e.timeAt(b);
      const p = this.g.gain;
      p.setTargetAtTime(1 - P.depth, t, 0.0015);
      p.setTargetAtTime(1, t + 0.004 + P.hold, Math.max(0.01, P.rel) / 3);
    }
  }
  stopped(t) {
    this.g.gain.cancelScheduledValues(t);
    this.g.gain.setTargetAtTime(1, t, 0.03);
  }
}

/* ---------- Spectrum (소리는 그대로) ---------- */
class Spectrum extends AudioFx {
  constructor(eng, dev) {
    super(eng, dev);
    this.input.connect(this.fxOut);
    this.analyser();
  }
}

Object.assign(U.DEVICE_CLASSES, {
  eq: EQ, comp: Compressor, limiter: Limiter, reverb: Reverb, delay: Delay, autofilter: AutoFilter,
  sat: Saturator, chorus: Chorus, phaser: Phaser, utility: Utility, duck: Ducker, spectrum: Spectrum
});
U.AudioFx = AudioFx;
})(window.U = window.U || {});
