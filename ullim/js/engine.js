/* 울림 — 오디오 엔진: 트랙 그래프, 트랜스포트, 미리 보고 예약하는 스케줄러,
   세션 클립 런치, 어레인지먼트 재생, 워프, 자동화, 메트로놈, 녹음 */
(function (U) {
'use strict';
const { gainNode, smooth, dbToGain, clamp } = U;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

/* 페이더 위치(0~1) ↔ dB : 0.71 근처가 0 dB, 끝이 +6 dB */
function posToDb(n) { return n <= 0.0005 ? U.OFF_DB : Math.max(U.OFF_DB, 40 * Math.log10(n) + 6); }
function dbToPos(db) { return db <= U.OFF_DB + 0.01 ? 0 : Math.min(1, Math.pow(10, (db - 6) / 40)); }

/* ================= 트랙 노드 ================= */
class TrackNode {
  constructor(eng, track) {
    const ctx = eng.ctx;
    this.e = eng;
    this.id = track.id;
    this.track = track;
    this.input = gainNode(ctx, 1);
    this.fader = gainNode(ctx, 1);
    this.panner = ctx.createStereoPanner();
    this.mute = gainNode(ctx, 1);
    this.fader.connect(this.panner);
    this.panner.connect(this.mute);
    this.sends = [];
    this.devs = new Map();
    this.chainIds = null;
    this.inst = null;
    this.midifx = [];
    this.audiofx = [];
    // 세션 재생 상태
    this.play = null;     // {slot, clipId, start, off, end?, follow?}
    this.queued = null;   // {slot(-1=멈춤), at, legato}
    this.override = false; // 세션 클립이 어레인지먼트를 가리는 중
    this.sources = [];    // 오디오 클립에서 예약한 소스
    this.passes = new Set();
    this.live = new Map(); // 건반으로 누른 음 → 보이스
    this.autoKeys = new Set();
    this.rec = null;
    if (!eng.offline) {
      this.split = ctx.createChannelSplitter(2);
      this.anL = ctx.createAnalyser();
      this.anR = ctx.createAnalyser();
      this.anL.fftSize = this.anR.fftSize = 1024;
      this.mute.connect(this.split);
      this.split.connect(this.anL, 0);
      this.split.connect(this.anR, 1);
      this.buf = new Float32Array(1024);
      this.peak = [0, 0];
      this.hold = [0, 0];
    }
  }
  get kind() { return this.track.type; }
  /* 프로젝트의 트랙 상태와 맞춘다 */
  sync(track) {
    this.track = track;
    const e = this.e;
    // 장치 만들기/지우기
    const seen = new Set();
    for (const dev of track.devices) {
      seen.add(dev.id);
      let inst = this.devs.get(dev.id);
      if (inst && inst.kind !== dev.kind) { inst.dispose(); inst = null; }
      if (!inst) {
        const C = U.DEVICE_CLASSES[dev.kind];
        if (!C) continue;
        inst = new C(e, dev);
        this.devs.set(dev.id, inst);
      } else inst.sync(dev);
    }
    for (const [id, inst] of this.devs) if (!seen.has(id)) { inst.dispose(); this.devs.delete(id); }
    const ids = track.devices.map(d => d.id).join(',');
    if (ids !== this.chainIds) { this.chainIds = ids; this.rewire(); }
    // 믹서
    if (!this.autoKeys.has('vol')) e.sp(this.fader.gain, dbToGain(track.vol));
    if (!this.autoKeys.has('pan')) e.sp(this.panner.pan, clamp(track.pan, -1, 1));
    this.syncSends();
  }
  rewire() {
    const devs = this.track.devices.map(d => this.devs.get(d.id)).filter(Boolean);
    const insts = devs.filter(d => d.spec.type === 'instrument');
    if (this.inst && !insts.includes(this.inst)) { this.inst.cut(this.e.ctx.currentTime, true); }
    this.inst = insts[0] || null;
    this.midifx = devs.filter(d => d.spec.type === 'midi');
    this.audiofx = devs.filter(d => d.spec.type === 'audio');
    try { this.input.disconnect(); } catch (e) { /* 무시 */ }
    for (const d of devs) {
      const outNode = d.spec.type === 'instrument' ? d.out : d.output;
      if (outNode) { try { outNode.disconnect(); } catch (e) { /* 무시 */ } }
      if (d.an && d.output) d.output.connect(d.an);
    }
    if (this.inst) this.inst.out.connect(this.input);
    let last = this.input;
    for (const fx of this.audiofx) { last.connect(fx.input); last = fx.output; }
    last.connect(this.fader);
  }
  syncSends() {
    const e = this.e, pr = e.project;
    const want = this.kind === 'master' ? [] : pr.returns.filter(r => r.id !== this.id);
    for (const s of this.sends) if (!want.find(r => r.id === s.rid)) { try { s.g.disconnect(); } catch (err) { /* 무시 */ } s.dead = true; }
    this.sends = this.sends.filter(s => !s.dead);
    for (const r of want) {
      let s = this.sends.find(x => x.rid === r.id);
      const rn = e.nodes.get(r.id);
      if (!rn) continue;
      if (!s) {
        s = { rid: r.id, g: gainNode(e.ctx, 0) };
        this.mute.connect(s.g);
        s.g.connect(rn.input);
        this.sends.push(s);
      }
      const i = pr.returns.indexOf(r);
      if (!this.autoKeys.has('send:' + r.id)) e.sp(s.g.gain, dbToGain(this.track.sends[i] != null ? this.track.sends[i] : U.OFF_DB));
    }
  }
  connectOut(dest) {
    try { this.mute.disconnect(); } catch (e) { /* 무시 */ }
    this.mute.connect(dest);
    if (this.split) this.mute.connect(this.split);
    for (const s of this.sends) this.mute.connect(s.g);
  }
  meter() {
    if (!this.anL) return [0, 0];
    const out = [0, 0];
    [this.anL, this.anR].forEach((an, i) => {
      an.getFloatTimeDomainData(this.buf);
      let m = 0;
      for (let k = 0; k < this.buf.length; k++) { const a = Math.abs(this.buf[k]); if (a > m) m = a; }
      this.peak[i] = Math.max(m, this.peak[i] * 0.86);
      out[i] = this.peak[i];
    });
    return out;
  }
  /* 시각 t부터 예약된 소리를 지운다 (클립 바꿈·멈춤) */
  cutFrom(t, owner) {
    if (this.inst) this.inst.cut(t);
    for (const fx of this.midifx) if (fx.isArp) fx.held = fx.held.filter(h => h.b0 < this.e.beatAt(t) - 1e-6).map(h => Object.assign(h, { b1: Math.min(h.b1, this.e.beatAt(t)) }));
    const keep = [];
    for (const s of this.sources) {
      if (owner && s.owner !== owner) { keep.push(s); continue; }
      if (s.t0 >= t - 1e-4) { U.stopAt(s.src, t); try { s.g.gain.setValueAtTime(0, t); } catch (e) { /* 무시 */ } }
      else if (s.t1 > t) {
        s.g.gain.cancelScheduledValues(t);
        s.g.gain.setTargetAtTime(0, t, 0.004);
        U.stopAt(s.src, t + 0.03);
        s.t1 = t + 0.03;
        keep.push(s);
      } else keep.push(s);
    }
    this.sources = keep;
    if (!owner) this.passes.clear();
    else for (const k of [...this.passes]) if (k.startsWith(owner)) this.passes.delete(k);
  }
  dispose() {
    const t = this.e.ctx.currentTime;
    this.cutFrom(t);
    for (const inst of this.devs.values()) inst.dispose();
    setTimeout(() => {
      for (const n of [this.input, this.fader, this.panner, this.mute, this.split]) if (n) { try { n.disconnect(); } catch (e) { /* 무시 */ } }
      for (const s of this.sends) { try { s.g.disconnect(); } catch (e) { /* 무시 */ } }
    }, 60);
  }
}

/* ================= 엔진 ================= */
class Engine {
  constructor(ctx, opts) {
    opts = opts || {};
    this.ctx = ctx;
    this.offline = !!opts.offline;
    this.nodes = new Map();
    this.project = null;
    this.out = gainNode(ctx, 1);
    if (!opts.noOutput) this.out.connect(ctx.destination);
    this.metroOut = gainNode(ctx, 0.6);
    if (!this.offline) this.metroOut.connect(ctx.destination);
    this.playing = false;
    this.bpm = 120;
    this.anchorT = 0;
    this.anchorB = 0;
    this.schedB = 0;
    this.startB = 0;
    this.arrMap = { b0: 0, a0: 0 };
    this.loopCfg = null;
    this.freeAnchor = null;
    this.recording = false;
    this.sessionRec = false;
    this.lastLateness = 0;
    this.listeners = [];
    this.pumps = new Set();   // 틱마다 앞을 채워야 하는 장치 (템포 맞춤 루프 패드)
    this.repeat = { on: false, div: '1/16' }; // 노트 리피트
    this.repeats = new Map(); // 누르고 있는 패드 → 되풀이 상태
    if (!this.offline) {
      this.mAn = ctx.createAnalyser();
      this.mAn.fftSize = 2048;
    }
  }

  /* ---------- 시간 ---------- */
  beatAt(t) { return this.anchorB + (t - this.anchorT) * this.bpm / 60; }
  timeAt(b) { return this.anchorT + (b - this.anchorB) * 60 / this.bpm; }
  latency() { return this.offline ? 0 : (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0); }
  /* 지금 들리는 위치 (출력 지연만큼 늦춰서) */
  heardBeat() {
    if (!this.playing) return this.project ? this.project.pos : 0;
    return this.beatAt(this.ctx.currentTime - this.latency());
  }
  barLen() { return U.barLen(this.project.sig); }
  keyOf() { return this.project ? this.project.key : { root: 0, scale: 'major' }; }

  /* 어레인지먼트 위치: 박 m.b0에서 위치 m.a0로 출발해(재생 시작·루프 바꿈),
     루프가 켜져 있으면 루프 끝에서 처음으로 돌아간다 */
  loopActive(L, a0) { return !!(L && L.on && L.end - L.start >= 0.25 && a0 < L.end); }
  arrPos(b) {
    const m = this.arrMap, L = this.loopCfg || this.project.loop;
    const x = m.a0 + (b - m.b0);
    if (!this.loopActive(L, m.a0) || x < L.end) return x;
    const len = L.end - L.start;
    return L.start + ((x - L.end) % len + len) % len;
  }
  /* [b0,b1) 를 어레인지먼트 위치가 끊기지 않는 조각으로 나눈다 */
  arrSegs(b0, b1) {
    const m = this.arrMap, L = this.loopCfg || this.project.loop;
    if (!this.loopActive(L, m.a0)) return [{ b0, b1, a0: this.arrPos(b0) }];
    const len = L.end - L.start;
    const segs = [];
    let b = b0;
    while (b < b1 - 1e-9 && segs.length < 64) {
      const a = this.arrPos(b);
      const x = m.a0 + (b - m.b0);
      let next = b1;
      if (x >= L.end - 1e-9 || a < L.end) {
        const toEnd = L.end - a;
        next = Math.min(b1, b + (toEnd > 1e-9 ? toEnd : len));
      }
      segs.push({ b0: b, b1: next, a0: a, wrapEnd: next < b1 || this.arrPos(next) < a + (next - b) - 1e-6 });
      b = next;
    }
    return segs;
  }

  /* ---------- 프로젝트와 맞추기 ---------- */
  sync(pr) {
    this.project = pr;
    if (Math.abs(pr.bpm - this.bpm) > 1e-9) this.setTempo(pr.bpm);
    // 재생 중에 루프를 바꾸면 지금 위치에서 이어지게 다시 잡는다
    const L = pr.loop, C = this.loopCfg;
    if (!C || C.on !== L.on || C.start !== L.start || C.end !== L.end) {
      if (this.playing && C) this.arrMap = { b0: this.schedB, a0: this.arrPos(this.schedB) };
      this.loopCfg = Object.assign({}, L);
    }
    const all = U.allTracks(pr);
    const ids = new Set(all.map(t => t.id));
    for (const [id, n] of this.nodes) if (!ids.has(id)) { n.dispose(); this.nodes.delete(id); }
    for (const t of all) if (!this.nodes.has(t.id)) this.nodes.set(t.id, new TrackNode(this, t));
    // 리턴부터 맞춰야 센드가 연결된다
    for (const t of pr.returns.concat([pr.master], pr.tracks)) this.nodes.get(t.id).sync(t);
    const master = this.nodes.get(pr.master.id);
    if (this.masterNode !== master) {
      this.masterNode = master;
      master.connectOut(this.out);
      if (this.mAn) master.mute.connect(this.mAn);
    }
    for (const t of pr.tracks.concat(pr.returns)) {
      const n = this.nodes.get(t.id);
      if (n.dest !== master.input) { n.dest = master.input; n.connectOut(master.input); }
    }
    this.applySolo();
    this.metroOut.gain.value = pr.metro ? 0.6 : 0;
    // 지워진 클립을 재생 중이면 멈춘다
    for (const t of pr.tracks) {
      const n = this.nodes.get(t.id);
      if (n.play && !t.slots[n.play.slot]) this.stopNode(n, this.playing ? this.beatAt(this.ctx.currentTime) : 0);
    }
  }
  applySolo() {
    const pr = this.project;
    const soloT = pr.tracks.some(x => x.solo), soloR = pr.returns.some(x => x.solo);
    for (const tr of pr.tracks) {
      const on = tr.on && (!(soloT || soloR) || tr.solo);
      this.sp(this.nodes.get(tr.id).mute.gain, on ? 1 : 0, 0.006);
    }
    for (const tr of pr.returns) {
      const on = tr.on && (!soloR || tr.solo);
      this.sp(this.nodes.get(tr.id).mute.gain, on ? 1 : 0, 0.006);
    }
    this.sp(this.nodes.get(pr.master.id).mute.gain, 1, 0.006);
  }
  /* 값 바꾸기: 실시간이면 부드럽게, 렌더 시작 전이면 바로 */
  sp(param, v, tc) {
    if (this.offline && this.ctx.currentTime === 0) { param.cancelScheduledValues(0); param.value = v; return; }
    smooth(param, v, this.ctx.currentTime, tc || 0.012);
  }
  ready() {
    const jobs = [];
    for (const n of this.nodes.values()) for (const d of n.devs.values()) jobs.push(d.ready);
    for (const t of this.project.tracks) {
      for (const c of t.slots) if (c && c.type === 'audio') jobs.push(U.media.get(c.ref, this.ctx.sampleRate).catch(() => null));
      for (const a of t.arr) if (a.clip.type === 'audio') jobs.push(U.media.get(a.clip.ref, this.ctx.sampleRate).catch(() => null));
    }
    return Promise.all(jobs);
  }
  setTempo(bpm) {
    bpm = clamp(bpm, 20, 999);
    if (this.playing) {
      // 이미 예약한 곳까지는 옛 템포로 두고, 그 뒤부터 새 템포
      const t = this.timeAt(this.schedB);
      this.anchorT = t;
      this.anchorB = this.schedB;
    }
    this.bpm = bpm;
    for (const n of this.nodes.values()) for (const d of n.devs.values()) d.onTempo(bpm);
    // 리피치 오디오는 재생 속도를 다시 맞춘다
    for (const n of this.nodes.values()) for (const s of n.sources) if (s.repitch) {
      try { s.src.playbackRate.setTargetAtTime(this.bpm / s.repitch.bpm * s.repitch.mul, this.ctx.currentTime, 0.02); } catch (e) { /* 무시 */ }
    }
  }

  /* ---------- 트랜스포트 ---------- */
  play(from) {
    const pr = this.project;
    if (this.playing) this.stop(true);
    if (from == null) from = pr.pos || 0;
    const t = this.ctx.currentTime + 0.06;
    this.anchorT = t;
    this.anchorB = from;
    this.schedB = from;
    this.startB = from;
    this.arrMap = { b0: from, a0: from };
    this.loopCfg = Object.assign({}, pr.loop);
    this.playing = true;
    this.freeAnchor = null;
    for (const n of this.nodes.values()) {
      if (n.queued && n.queued.waiting) n.queued.at = from;
    }
    this.emit('transport');
    this.tick();
  }
  stop(keepQueue) {
    const t = this.ctx.currentTime;
    if (this.playing) this.lastStopB = Math.max(0, this.arrPos(this.heardBeat()));
    if (this.recording || this.sessionRec) this.finishRecording();
    this.recording = false;
    this.sessionRec = false;
    this.playing = false;
    for (const n of this.nodes.values()) {
      n.cutFrom(t);
      if (!keepQueue) n.queued = null;
      n.play = null;
      if (n.autoKeys.size) { n.autoKeys.clear(); for (const d of n.devs.values()) d.releaseAuto(); n.sync(n.track); }
      for (const d of n.devs.values()) if (d.stopped) d.stopped(t);
      for (const fx of n.midifx) if (fx.clear) fx.clear();
    }
    this.emit('transport');
    this.emit('clips');
  }
  /* 지금 박 + 퀀타이즈 경계 */
  nextBoundary(q, b) {
    if (b == null) b = this.beatAt(this.ctx.currentTime + 0.005);
    if (!q) return b;
    return Math.ceil(b / q - 1e-6) * q;
  }
  clipQuant(clip) {
    const id = clip && clip.quant && clip.quant !== 'global' ? clip.quant : this.project.quant;
    return U.quantBeats(id, this.project.sig);
  }

  /* ---------- 세션 ---------- */
  launch(trackId, slot, opts) {
    opts = opts || {};
    const n = this.nodes.get(trackId);
    if (!n) return;
    const clip = n.track.slots[slot];
    if (!clip) return this.stopTrack(trackId);
    if (clip.launch === 'toggle' && n.play && n.play.slot === slot && !opts.force) return this.stopTrack(trackId);
    if (!this.playing) {
      const start = Math.floor((this.project.pos || 0) / this.barLen()) * this.barLen();
      n.queued = { slot, at: start, legato: clip.legato, waiting: true };
      this.play(start);
      return;
    }
    const at = opts.at != null ? opts.at : this.nextBoundary(this.clipQuant(clip));
    n.queued = { slot, at, legato: clip.legato };
    this.catchUp(n, at);
    this.emit('clips');
  }
  overrideTrack(n) {
    if (!n.override) { n.override = true; this.emit('override'); }
  }
  stopTrack(trackId, at) {
    const n = this.nodes.get(trackId);
    if (!n) return;
    if (!this.playing) { n.queued = null; this.emit('clips'); return; }
    if (!n.play && !n.queued) { this.overrideTrack(n); this.catchUp(n, this.beatAt(this.ctx.currentTime)); return; }
    const when = at != null ? at : this.nextBoundary(this.clipQuant(n.play && n.track.slots[n.play.slot]));
    n.queued = { slot: -1, at: when };
    this.catchUp(n, when);
    this.emit('clips');
  }
  launchScene(i) {
    const pr = this.project;
    const sc = pr.scenes[i];
    if (sc && sc.tempo) { pr.bpm = sc.tempo; this.setTempo(sc.tempo); U.emit('tempo'); }
    const wasPlaying = this.playing;
    let at = null;
    if (wasPlaying) at = this.nextBoundary(U.quantBeats(pr.quant, pr.sig));
    else at = Math.floor((pr.pos || 0) / this.barLen()) * this.barLen();
    for (const t of pr.tracks) {
      const n = this.nodes.get(t.id);
      if (t.slots[i]) {
        n.queued = { slot: i, at, legato: t.slots[i].legato, waiting: !wasPlaying };
      } else if (n.play || n.queued) {
        n.queued = { slot: -1, at, waiting: !wasPlaying };
      }
    }
    if (!wasPlaying) this.play(at);
    else for (const t of pr.tracks) this.catchUp(this.nodes.get(t.id), at);
    this.emit('clips');
  }
  stopAll() {
    if (!this.playing) return;
    const at = this.nextBoundary(U.quantBeats(this.project.quant, this.project.sig));
    for (const t of this.project.tracks) {
      const n = this.nodes.get(t.id);
      if (n.play || n.queued) { n.queued = { slot: -1, at }; this.catchUp(n, at); }
    }
    this.emit('clips');
  }
  backToArrangement() {
    const b = this.playing ? this.beatAt(this.ctx.currentTime + 0.02) : 0;
    for (const t of this.project.tracks) {
      const n = this.nodes.get(t.id);
      if (!n.override) continue;
      if (this.playing) {
        n.cutFrom(this.timeAt(b));
        n.play = null;
        n.queued = null;
        n.override = false;
        if (b < this.schedB) this.scheduleTrack(n, b, this.schedB);
      } else { n.override = false; n.queued = null; }
    }
    this.emit('override');
    this.emit('clips');
  }
  anyOverride() { for (const n of this.nodes.values()) if (n.override) return true; return false; }
  /* 이미 예약해 둔 구간 안에서 바뀐 경우: 그 뒤를 지우고 다시 예약 */
  catchUp(n, at) {
    if (!this.playing || at >= this.schedB) return;
    const b = Math.max(at, this.beatAt(this.ctx.currentTime));
    n.cutFrom(this.timeAt(b));
    this.scheduleTrack(n, b, this.schedB);
  }
  stopNode(n, b) {
    if (this.playing) n.cutFrom(this.timeAt(b));
    n.play = null;
    this.emit('clips');
  }
  /* 화면 표시용 */
  clipState(trackId) {
    const n = this.nodes.get(trackId);
    if (!n) return null;
    const heard = this.heardBeat();
    const st = { playing: -1, queued: -1, progress: 0, recording: !!(n.rec && n.rec.session) };
    if (n.play && heard >= n.play.start - 1e-6) {
      st.playing = n.play.slot;
      const clip = n.track.slots[n.play.slot];
      if (clip) {
        const scale = U.clipScale(clip, this.bpm);
        const el = (heard - n.play.start) / scale + n.play.off;
        st.pos = this.clipPos(clip, el);
        st.progress = clip.loop.on ? (st.pos - clip.loop.start) / Math.max(0.001, clip.loop.end - clip.loop.start) : (st.pos - clip.start) / Math.max(0.001, clip.end - clip.start);
      }
    } else if (n.play) st.queued = n.play.slot;
    if (n.queued) st.queued = n.queued.slot;
    if (st.queued === -1 && n.queued && n.queued.slot === -1) st.stopping = true;
    return st;
  }
  /* 경과(클립 박) → 클립 안 위치 */
  clipPos(c, el) {
    if (!c.loop.on) return c.start + el;
    const ls = c.loop.start, le = c.loop.end, L = Math.max(0.001, le - ls);
    const first = le - Math.min(c.start, le - 0.001);
    if (el < first) return c.start + el;
    return ls + ((el - first) % L);
  }

  /* ---------- 건반 연주 ---------- */
  /* repeat: true면 노트 리피트를 켠 것처럼, 없으면 노트 리피트 설정을 따른다 */
  liveOn(trackId, p, v, audition, repeat) {
    const n = this.nodes.get(trackId);
    if (!n || n.track.type !== 'midi') return;
    if (this.ctx.state !== 'running') this.ctx.resume();
    const rep = repeat != null ? repeat : this.repeat.on;
    if (!audition && rep && n.inst && n.inst.isPads) { this.startRepeat(n, p, v); return; }
    const t = this.ctx.currentTime;
    let notes = [{ p, v, b: 0, d: 0 }];
    const voices = [];
    let arp = null, arpIn = null;
    for (const fx of n.midifx) {
      if (!fx.on) continue;
      if (fx.isArp) { arp = fx; arpIn = notes.map(x => x.p); for (const x of notes) fx.liveOn(x.p, x.v); notes = []; break; }
      notes = notes.flatMap(x => fx.map(x));
    }
    if (arp) { n.live.set(p, { arp, pitches: arpIn }); this.ensureFree(); }
    else if (n.inst) {
      for (const x of notes) { const vo = n.inst.noteOn(x.p, x.v, t, true); if (vo) voices.push(vo); }
      const prev = n.live.get(p);
      if (prev && prev.voices) for (const vo of prev.voices) n.inst.noteOff(vo, t);
      n.live.set(p, { voices });
    }
    if (audition) { n.auditions = (n.auditions || new Set()).add(p); return; }
    this.recordNote(n, p, v, true);
    if (!n.liveLog) n.liveLog = [];
    n.liveLog.push({ p, v, t0: t, t1: null });
    if (n.liveLog.length > 600) n.liveLog.splice(0, 100);
  }
  liveOff(trackId, p) {
    const n = this.nodes.get(trackId);
    if (!n) return;
    if (this.repeats.delete(n.id + ':' + p)) return;
    const t = this.ctx.currentTime;
    const h = n.live.get(p);
    if (h) {
      if (h.arp) for (const x of h.pitches) h.arp.liveOff(x);
      if (h.voices && n.inst) for (const vo of h.voices) n.inst.noteOff(vo, t);
      n.live.delete(p);
    }
    if (n.auditions && n.auditions.delete(p)) return;
    this.recordNote(n, p, 0, false);
    if (n.liveLog) for (let i = n.liveLog.length - 1; i >= 0; i--) if (n.liveLog[i].p === p && n.liveLog[i].t1 == null) { n.liveLog[i].t1 = t; break; }
  }
  allLiveOff() {
    this.repeats.clear();
    for (const n of this.nodes.values()) for (const p of [...n.live.keys()]) this.liveOff(n.id, p);
  }
  /* ---------- 노트 리피트 ----------
     패드를 누르고 있는 동안 정한 박자마다 다시 친다. 재생 중이면 박자선에 맞추고,
     박자선을 막 지나서 눌렀으면 바로 한 번 친다 */
  startRepeat(n, p, v) {
    const key = n.id + ':' + p;
    if (this.repeats.has(key)) return;
    const t = this.ctx.currentTime;
    let next = t;
    if (this.playing) {
      const step = U.divBeats(this.repeat.div);
      const g = this.beatAt(t) / step;
      if (g - Math.floor(g) >= 0.3) next = this.timeAt(Math.ceil(g) * step);
    }
    this.repeats.set(key, { n, p, v, next });
    this.pumpRepeats(t + LOOKAHEAD);
  }
  pumpRepeats(horizon) {
    for (const rp of this.repeats.values()) {
      let guard = 0;
      while (rp.next < horizon && guard++ < 64) {
        const t = rp.next;
        const step = U.divBeats(this.repeat.div);
        const stepSec = step * 60 / this.bpm;
        this.repeatHit(rp, t, Math.max(0.02, stepSec * 0.5));
        rp.next = this.playing ? this.timeAt((Math.round(this.beatAt(t) / step) + 1) * step) : t + stepSec;
        if (rp.next <= t + 0.005) rp.next = t + stepSec;
      }
    }
  }
  repeatHit(rp, t, gate) {
    const n = rp.n;
    if (!n.inst) return;
    let notes = [{ p: rp.p, v: rp.v, b: 0, d: 0 }];
    for (const fx of n.midifx) if (fx.on && !fx.isArp) notes = notes.flatMap(x => fx.map(x));
    for (const x of notes) n.inst.playNote(x.p, x.v, t, gate);
    if (this.playing && n.track.arm && n.rec) {
      const b = this.beatAt(t);
      this.commitRecNote(n, { p: rp.p, v: rp.v, b }, b + gate * this.bpm / 60);
    }
    if (!n.liveLog) n.liveLog = [];
    const lat = this.latency();
    n.liveLog.push({ p: rp.p, v: rp.v, t0: t + lat, t1: t + lat + gate });
    if (n.liveLog.length > 600) n.liveLog.splice(0, 100);
  }
  /* 멈춘 상태에서도 아르페지에이터가 돌도록 */
  ensureFree() {
    if (this.playing || this.freeAnchor) return;
    this.freeAnchor = { t: this.ctx.currentTime, b: 0, sched: 0 };
  }

  /* ---------- 스케줄러 ---------- */
  start() {
    if (this.offline || this.timer) return;
    const tick = () => { try { this.tick(); } catch (e) { console.error(e); } };
    try {
      const src = 'let id=0;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.worker.onmessage = tick;
      this.worker.postMessage(TICK_MS);
      this.timer = true;
    } catch (e) {
      this.timer = setInterval(tick, TICK_MS);
    }
  }
  tick() {
    const ctx = this.ctx;
    if (!this.project || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.playing) {
      if (this.timeAt(this.schedB) < now) this.lastLateness = now - this.timeAt(this.schedB);
      const b1 = this.beatAt(now + LOOKAHEAD);
      if (b1 > this.schedB) {
        const b0 = this.schedB;
        this.schedB = b1;
        this.scheduleWindow(b0, b1);
      }
    } else if (this.freeAnchor) {
      // 멈춘 상태의 아르페지에이터
      const f = this.freeAnchor;
      const bAt = t => f.b + (t - f.t) * this.bpm / 60;
      const b1 = bAt(now + LOOKAHEAD);
      let any = false;
      for (const t of this.project.tracks) {
        const n = this.nodes.get(t.id);
        if (!n.live.size) continue;
        any = true;
        this.runChainFrom(n, [], f.sched, b1, b => f.t + (b - f.b) * 60 / this.bpm);
      }
      f.sched = b1;
      if (!any) this.freeAnchor = null;
    }
    for (const d of this.pumps) d.pump(now + LOOKAHEAD);
    if (this.repeats.size) this.pumpRepeats(now + LOOKAHEAD);
  }
  /* 실시간 대신 한 번에: 오프라인 렌더용 */
  scheduleUntil(b1) {
    if (b1 > this.schedB) { const b0 = this.schedB; this.schedB = b1; this.scheduleWindow(b0, b1); }
  }
  scheduleWindow(b0, b1) {
    const pr = this.project;
    for (const t of pr.tracks) this.scheduleTrack(this.nodes.get(t.id), b0, b1);
    for (const t of pr.returns.concat([pr.master])) this.applyAutomation(this.nodes.get(t.id), b0, b1);
    for (const n of this.nodes.values()) for (const d of n.devs.values()) if (d.schedule && d.on) d.schedule(b0, b1);
    for (const d of this.pumps) d.pump(this.timeAt(b1));
    if (pr.metro) this.scheduleMetronome(b0, b1);
    this.emitIfStateChanged();
  }
  emitIfStateChanged() {
    if (this.stateDirty) { this.stateDirty = false; this.emit('clips'); }
    if (this.overrideDirty) { this.overrideDirty = false; this.emit('override'); }
  }
  scheduleTrack(n, b0, b1) {
    let b = b0, guard = 0;
    while (b < b1 - 1e-9 && guard++ < 32) {
      let next = b1, act = null;
      const q = n.queued;
      if (q && q.at < next - 1e-9) { next = Math.max(b, q.at); act = 'queued'; }
      const p = n.play;
      if (p && p.end != null && p.end < next - 1e-9) { next = Math.max(b, p.end); act = 'end'; }
      if (p && p.follow != null && p.follow < next - 1e-9) { next = Math.max(b, p.follow); act = 'follow'; }
      if (next > b + 1e-9) this.scheduleSource(n, b, next);
      if (!act) break;
      if (act === 'queued') this.applyQueued(n, next);
      else if (act === 'end') { this.endRecording(n, next); if (this.recording) this.closeSeg(n, next); n.play = null; this.stateDirty = true; }
      else this.followAction(n, next);
      b = next;
    }
    this.applyAutomation(n, b0, b1);
  }
  applyQueued(n, at) {
    const q = n.queued;
    n.queued = null;
    const prev = n.play;
    if (prev && n.rec) this.endRecording(n, at);
    if (this.recording) this.closeSeg(n, at);
    // 세션 클립이 시작되거나 멈추는 순간부터 이 트랙의 어레인지먼트는 쉰다
    n.cutFrom(this.timeAt(at), prev ? 'sess' : null);
    if (n.inst) n.inst.cut(this.timeAt(at));
    if (!n.override) { n.override = true; this.overrideDirty = true; }
    n.play = null;
    this.stateDirty = true;
    if (q.slot < 0) return;
    const clip = n.track.slots[q.slot];
    if (!clip) return;
    let off = 0;
    if (q.legato && prev) {
      const pc = n.track.slots[prev.slot];
      if (pc) off = this.clipPos(pc, (at - prev.start) / U.clipScale(pc, this.bpm) + prev.off) - clip.start;
      off = Math.max(0, off);
    }
    const scale = U.clipScale(clip, this.bpm);
    const st = { slot: q.slot, clipId: clip.id, start: at, off };
    if (!clip.loop.on) st.end = at + Math.max(0.01, (clip.end - clip.start - off)) * scale;
    if (clip.follow && clip.follow.on && clip.follow.time > 0) st.follow = at + clip.follow.time * scale;
    if (st.end != null && st.follow != null && st.follow >= st.end - 1e-6) st.follow = st.end - 1e-6;
    n.play = st;
    if (n.rec && n.rec.pending === q.slot) n.rec.start = at;
    if (this.recording) n.seg = { clip: U.cloneClip(clip), start: at, off: st.off };
  }
  /* 어레인지먼트 녹음 중 세션 클립이 재생된 구간을 기록 */
  closeSeg(n, b) {
    if (!n.seg) return;
    if (b - n.seg.start > 0.02) (this.segs || (this.segs = [])).push(Object.assign({ track: n.id, end: b }, n.seg));
    n.seg = null;
  }
  followAction(n, at) {
    const p = n.play;
    if (!p) return;
    p.follow = null;
    const clip = n.track.slots[p.slot];
    if (!clip) return;
    const f = clip.follow;
    const act = Math.random() < (f.chance != null ? f.chance : 1) ? f.a : f.b;
    const slots = n.track.slots;
    const filled = slots.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
    let target = null;
    switch (act) {
      case 'stop': n.queued = { slot: -1, at }; break;
      case 'again': target = p.slot; break;
      case 'next': { const i = filled.find(x => x > p.slot); target = i != null ? i : filled[0]; break; }
      case 'prev': { const r = filled.filter(x => x < p.slot); target = r.length ? r[r.length - 1] : filled[filled.length - 1]; break; }
      case 'first': target = filled[0]; break;
      case 'last': target = filled[filled.length - 1]; break;
      case 'any': target = filled[Math.floor(Math.random() * filled.length)]; break;
      case 'other': { const o = filled.filter(x => x !== p.slot); target = o.length ? o[Math.floor(Math.random() * o.length)] : p.slot; break; }
      default: return;
    }
    if (target != null) n.queued = { slot: target, at, legato: false };
    if (n.queued) this.applyQueued(n, at);
  }
  /* 한 구간 안에서 트랙이 낼 소리: 세션 클립 또는 어레인지먼트 */
  scheduleSource(n, b0, b1) {
    const notes = [];
    if (n.play) {
      const clip = n.track.slots[n.play.slot];
      if (!clip) { n.play = null; return; }
      const scale = U.clipScale(clip, this.bpm);
      const e0 = (b0 - n.play.start) / scale + n.play.off, e1 = (b1 - n.play.start) / scale + n.play.off;
      const b0At = n.play.start - n.play.off * scale;
      this.scheduleClip(n, clip, e0, e1, el => b0At + el * scale, 'sess', null, n.play.start, notes);
      if (n.rec && n.rec.session) this.trackRecording(n, b1);
    } else if (!n.override && this.playing) {
      for (const sg of this.arrSegs(b0, b1)) {
        const a0 = sg.a0, a1 = sg.a0 + (sg.b1 - sg.b0);
        const bOf = a => sg.b0 + (a - a0);
        for (const ac of n.track.arr) {
          const cs = Math.max(a0, ac.pos), ce = Math.min(a1, ac.pos + ac.dur);
          if (ce <= cs + 1e-9) continue;
          const clip = ac.clip;
          const scale = U.clipScale(clip, this.bpm);
          const e0 = (cs - ac.pos) / scale + ac.off, e1 = (ce - ac.pos) / scale + ac.off;
          const elToB = el => bOf(ac.pos + (el - ac.off) * scale);
          // 클립 끝 또는 루프 끝에서 음을 자른다
          const cutB = Math.min(bOf(ac.pos + ac.dur), sg.wrapEnd ? sg.b1 : Infinity);
          this.scheduleClip(n, clip, e0, e1, elToB, 'arr:' + ac.id, cutB, bOf(ac.pos), notes);
        }
      }
    }
    if (n.track.type === 'midi') this.runChain(n, notes, b0, b1);
  }
  /* 클립 내용 예약: e0~e1은 클립 시작부터 지난 '클립 박'. MIDI 음은 notes에 모은다 */
  scheduleClip(n, clip, e0, e1, elToB, owner, cutB, startB, notes) {
    if (clip.type !== 'midi') { this.scheduleAudio(n, clip, e0, e1, elToB, owner, cutB, startB); return; }
    const swing = clip.groove !== false ? this.project.swing || 0 : 0;
    forEachNote(clip, e0, e1, (note, el, dur) => {
      let b = elToB(el);
      // 스윙: 16분 엇박을 최대 1/32만큼 늦춘다 (50% → 75%)
      if (swing > 0 && Math.abs((note.s % 0.5) - 0.25) < 0.02) b += swing * 0.125;
      let d = dur;
      if (cutB != null && b + d > cutB) d = Math.max(0.01, cutB - b);
      notes.push({ p: note.p, v: note.v, b, d });
    });
  }
  /* MIDI 이펙트를 거쳐 악기로 */
  runChain(n, notes, b0, b1) { this.runChainFrom(n, notes, b0, b1, b => this.timeAt(b)); }
  runChainFrom(n, notes, b0, b1, tOf) {
    let evs = notes;
    for (const fx of n.midifx) {
      if (!fx.on) continue;
      if (fx.isArp) { for (const x of evs) fx.hold(x); evs = fx.steps(b0, b1); continue; }
      evs = evs.flatMap(x => fx.map(x));
    }
    if (!n.inst) return;
    // 시간 순서대로 쳐야 초크·같은 패드 끊기가 맞게 된다
    evs.sort((a, b) => a.b - b.b);
    for (const x of evs) {
      const t = tOf(x.b);
      if (t < this.ctx.currentTime - 0.05 && !this.offline) continue;
      n.inst.playNote(x.p, x.v, Math.max(t, 0), x.d * 60 / this.bpm);
    }
  }
  /* 오디오 클립: 워프 모드에 따라 잘게 썰거나(Beats), 알갱이로(Texture) 또는 통째로(Re-Pitch) */
  scheduleAudio(n, clip, e0, e1, elToB, owner, cutB, startB) {
    const buf = U.media.cached(clip.ref, this.ctx.sampleRate);
    if (!buf) { U.media.get(clip.ref, this.ctx.sampleRate).catch(() => {}); return; }
    const spb = 60 / clip.bpm; // 샘플 박 → 초
    const mul = Math.pow(2, (clip.trans || 0) / 12);
    const gain = dbToGain(clip.gain || 0);
    const mode = clip.warp ? clip.mode : 'off';
    const passes = clipPasses(clip, e0, e1);
    const now = this.ctx.currentTime;
    for (const ps of passes) {
      if (mode === 'repitch' || mode === 'off') {
        // 한 바퀴를 소스 하나로
        const key = owner + ':' + clip.id + ':' + ps.k + ':' + U.round(startB, 4);
        if (this.passKeys(n).has(key)) continue;
        const el = Math.max(e0, ps.e0);
        const pos = ps.p0 + (el - ps.e0);
        const b = elToB(el);
        const t = Math.max(this.timeAt(b), now);
        const rate = mode === 'repitch' ? this.bpm / clip.bpm : 1;
        const lenSec = (ps.e1 - el) * spb;
        const tEnd = cutB != null ? Math.min(this.timeAt(cutB), t + lenSec / rate) : t + lenSec / rate;
        this.passKeys(n).add(key);
        this.playSlice(n, buf, clip, t, pos * spb, tEnd - t, rate, gain, owner, mode === 'repitch' ? { bpm: clip.bpm, mul: 1 } : null);
        continue;
      }
      if (mode === 'beats') {
        const step = 0.25;
        let g = Math.ceil((Math.max(e0, ps.e0) - ps.e0 + ps.p0) / step - 1e-6) * step;
        for (; ; g += step) {
          const el = ps.e0 + (g - ps.p0);
          if (el >= Math.min(e1, ps.e1) - 1e-9) break;
          const b = elToB(el);
          const t = this.timeAt(b);
          if (t < now - 0.01 && !this.offline) continue;
          const slot = Math.min(step, ps.p1 - g) * 60 / this.bpm;
          let dur = Math.min(slot, step * spb / mul) + 0.004;
          if (cutB != null) dur = Math.min(dur, this.timeAt(cutB) - t);
          if (dur <= 0.002) continue;
          this.playSlice(n, buf, clip, Math.max(t, now), g * spb, dur, mul, gain, owner, null, 0.003);
        }
      } else {
        // texture / tones : 알갱이 합성
        const grain = mode === 'tones' ? 0.06 : 0.11;
        const hopSec = grain / 2;
        const hop = hopSec * this.bpm / 60; // 프로젝트 박
        let el = Math.ceil(Math.max(e0, ps.e0) / hop - 1e-6) * hop;
        for (; el < Math.min(e1, ps.e1) - 1e-9; el += hop) {
          const b = elToB(el);
          const t = this.timeAt(b);
          if (t < now - 0.01 && !this.offline) continue;
          let dur = grain;
          if (cutB != null) dur = Math.min(dur, this.timeAt(cutB) - t);
          if (dur <= 0.005) continue;
          const pos = (ps.p0 + (el - ps.e0)) * spb;
          const jitter = mode === 'texture' ? (Math.random() - 0.5) * 0.02 : 0;
          this.playSlice(n, buf, clip, Math.max(t, now), Math.max(0, pos + jitter), dur, mul, gain * 0.75, owner, null, dur / 2, true);
        }
      }
    }
  }
  passKeys(n) {
    if (n.passes.size > 400) n.passes.clear();
    return n.passes;
  }
  playSlice(n, buf, clip, t, offset, dur, rate, gain, owner, repitch, fade, hann) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    let b = buf;
    if (clip.rev) b = U.media.reversed(buf);
    src.buffer = b;
    src.playbackRate.value = rate;
    const g = gainNode(ctx, 0);
    src.connect(g);
    g.connect(n.input);
    const off = clip.rev ? Math.max(0, b.duration - offset - dur * rate) : offset;
    if (off >= b.duration) return;
    fade = fade || 0.003;
    if (hann) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + fade);
      g.gain.linearRampToValueAtTime(0, t + dur);
    } else {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + Math.min(fade, dur / 4));
      g.gain.setValueAtTime(gain, Math.max(t + Math.min(fade, dur / 4), t + dur - fade));
      g.gain.linearRampToValueAtTime(0, t + dur);
    }
    src.start(t, off, Math.min(b.duration - off, dur * rate + 0.01));
    U.stopAt(src, t + dur + 0.01);
    const rec = { src, g, t0: t, t1: t + dur, owner: owner.startsWith('arr') ? 'arr' : 'sess', repitch };
    n.sources.push(rec);
    src.onended = () => {
      const i = n.sources.indexOf(rec);
      if (i >= 0) n.sources.splice(i, 1);
      try { g.disconnect(); } catch (e) { /* 무시 */ }
    };
  }

  /* ---------- 자동화 ---------- */
  applyAutomation(n, b0, b1) {
    const auto = n.track.auto;
    if (!auto) return;
    const active = this.playing && !n.override;
    if (!active) return;
    const t = this.timeAt(b1);
    const a = this.arrPos(b1);
    for (const key in auto) {
      const pts = auto[key];
      if (!pts || !pts.length) continue;
      const v = autoValue(pts, a);
      this.applyAuto(n, key, v, t);
    }
  }
  applyAuto(n, key, v, t) {
    n.autoKeys.add(key);
    if (key === 'vol') smooth(n.fader.gain, dbToGain(posToDb(v)), t, 0.01);
    else if (key === 'pan') smooth(n.panner.pan, v * 2 - 1, t, 0.01);
    else if (key.startsWith('send:')) {
      const s = n.sends.find(x => 'send:' + x.rid === key);
      if (s) smooth(s.g.gain, dbToGain(posToDb(v)), t, 0.01);
    } else if (key.startsWith('dev:')) {
      const [, id, pid] = key.split(':');
      const d = n.devs.get(id);
      if (!d) return;
      const spec = d.spec.byId[pid];
      if (!spec) return;
      const val = U.fromNorm(spec, v);
      if (spec.type === 'enum' || spec.type === 'bool') { if (d.v[pid] !== val) d.setAuto(pid, val, t); }
      else d.setAuto(pid, val, t);
    }
  }
  /* 화면에 보일 자동화 값 (재생 중일 때만) */
  autoNow(trackId, key) {
    const n = this.nodes.get(trackId);
    if (!n || !this.playing || n.override) return null;
    const pts = n.track.auto && n.track.auto[key];
    if (!pts || !pts.length) return null;
    return autoValue(pts, this.arrPos(this.heardBeat()));
  }

  /* ---------- 메트로놈 ---------- */
  scheduleMetronome(b0, b1) {
    const sig = this.project.sig;
    const unit = U.beatUnit(sig), bar = U.barLen(sig);
    let b = Math.ceil(b0 / unit - 1e-6) * unit;
    for (; b < b1 - 1e-9; b += unit) {
      const t = this.timeAt(b);
      if (t < this.ctx.currentTime) continue;
      const accent = Math.abs(b / bar - Math.round(b / bar)) < 1e-6;
      this.click(t, accent);
    }
  }
  click(t, accent) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = gainNode(ctx, 0);
    o.frequency.value = accent ? 1760 : 1180;
    o.connect(g); g.connect(this.metroOut);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.55, t + 0.001);
    g.gain.setTargetAtTime(0, t + 0.002, 0.012);
    o.start(t); o.stop(t + 0.08);
  }

  /* ---------- 녹음 ---------- */
  armedMidi() { return this.project.tracks.filter(t => t.type === 'midi' && t.arm); }
  recordNote(n, p, v, on) {
    if (!this.playing) return;
    const b = this.beatAt(this.ctx.currentTime - this.latency());
    if (!n.track.arm) return;
    const r = n.rec;
    if (!r) return;
    if (on) r.open.set(p, { p, v, b });
    else {
      const o = r.open.get(p);
      if (!o) return;
      r.open.delete(p);
      this.commitRecNote(n, o, b);
    }
  }
  commitRecNote(n, o, bEnd) {
    const r = n.rec;
    let d = Math.max(0.0625, bEnd - o.b);
    if (r.arr) { r.notes.push({ p: o.p, s: o.b - r.from, d, v: o.v }); return; }
    // 세션: 재생 중인 클립에 겹쳐 넣는다
    const play = n.play;
    if (!play || o.b < play.start - 0.25) return;
    const clip = n.track.slots[play.slot];
    if (!clip) return;
    const el = Math.max(0, o.b - play.start) + play.off;
    let s = r.fresh ? el : this.clipPos(clip, el);
    if (r.quant) s = Math.round(s / r.quant) * r.quant;
    if (!r.fresh && clip.loop.on) {
      const L = clip.loop.end - clip.loop.start;
      if (s >= clip.loop.end - 1e-6) s = clip.loop.start + ((s - clip.loop.start) % L);
      d = Math.min(d, L);
    }
    clip.notes.push({ p: o.p, s: U.round(s, 4), d: U.round(d, 4), v: o.v });
    if (r.fresh) {
      const need = Math.ceil((s + d) / this.barLen() - 1e-6) * this.barLen();
      if (need > clip.end) { clip.end = need; clip.loop.end = need; }
    }
    U.touch({ rec: true, clip: clip.id });
  }
  setRecording(on) {
    if (on === this.recording) return;
    if (!on) { this.finishRecording('arr'); this.recording = false; this.emit('transport'); return; }
    this.recording = true;
    // 멈춘 상태에서 시작하면 재생이 조금 뒤(앞당겨 예약)에 시작하니, 지금 시각이 아니라 시작 위치부터 녹음한다
    const was = this.playing;
    if (!was) this.play(this.project.pos);
    const from = Math.max(0, was ? this.beatAt(this.ctx.currentTime) : this.anchorB);
    for (const t of this.armedMidi()) {
      const n = this.nodes.get(t.id);
      n.rec = { arr: true, from: Math.floor(from / this.barLen()) * this.barLen(), notes: [], open: new Map() };
    }
    this.segs = [];
    for (const t of this.project.tracks) {
      const n = this.nodes.get(t.id);
      const clip = n.play && t.slots[n.play.slot];
      if (!clip || from < n.play.start) continue;
      n.seg = { clip: U.cloneClip(clip), start: from, off: (from - n.play.start) / U.clipScale(clip, this.bpm) + n.play.off };
    }
    this.emit('transport');
  }
  /* 세션 녹음: 암된 트랙의 선택된 빈 슬롯에 새 클립을 만들어 녹음하거나, 재생 중인 클립에 겹쳐 녹음 */
  setSessionRec(on, sceneIdx) {
    if (on === this.sessionRec) return;
    if (!on) { this.finishRecording('sess'); this.sessionRec = false; this.emit('transport'); return; }
    this.sessionRec = true;
    const pr = this.project;
    const quant = U.pref('recQuant', 0);
    for (const t of this.armedMidi()) {
      const n = this.nodes.get(t.id);
      if (n.play) { n.rec = { session: true, fresh: false, open: new Map(), quant }; continue; }
      let slot = -1;
      for (let i = Math.max(0, sceneIdx || 0); i < t.slots.length; i++) if (!t.slots[i]) { slot = i; break; }
      if (slot < 0) { pr.scenes.push(U.newScene()); for (const tr of pr.tracks) tr.slots.push(null); slot = t.slots.length - 1; }
      const clip = U.newMidiClip(this.barLen(), { color: t.color });
      clip.loop.on = false;
      clip.end = this.barLen();
      t.slots[slot] = clip;
      n.rec = { session: true, fresh: true, open: new Map(), pending: slot, clipId: clip.id, quant };
      U.touch({ rec: true });
      this.launch(t.id, slot, { force: true });
    }
    this.emit('transport');
  }
  trackRecording(n, b) {
    const r = n.rec;
    if (!r || !r.fresh || !n.play) return;
    const clip = n.track.slots[n.play.slot];
    if (!clip || clip.id !== r.clipId) return;
    const el = b - n.play.start;
    const bar = this.barLen();
    const need = Math.ceil((el + 0.001) / bar) * bar;
    if (need > clip.end) {
      clip.end = need;
      clip.loop.end = need;
      n.play.end = n.play.start + need + bar;
      U.touch({ rec: true, clip: clip.id });
    } else if (n.play.end != null && n.play.end < n.play.start + clip.end + bar) n.play.end = n.play.start + clip.end + bar;
  }
  endRecording(n, b) {
    const r = n.rec;
    if (!r || !r.session) return;
    for (const o of r.open.values()) this.commitRecNote(n, o, b);
    r.open.clear();
    if (r.fresh && n.play) {
      const clip = n.track.slots[n.play.slot];
      if (clip && clip.id === r.clipId) {
        const bar = this.barLen();
        const len = Math.max(bar, Math.ceil((b - n.play.start - 0.01) / bar) * bar);
        clip.end = len;
        clip.loop = { on: true, start: 0, end: len };
        clip.follow.time = len;
        n.play.end = null;
      }
    }
    n.rec = null;
    U.commit('녹음');
  }
  finishRecording(which) {
    const b = this.playing ? this.beatAt(this.ctx.currentTime) : 0;
    let changed = false;
    for (const t of this.project.tracks) {
      const n = this.nodes.get(t.id);
      const r = n.rec;
      if (!r) continue;
      if (r.arr && which !== 'sess') {
        for (const o of r.open.values()) r.notes.push({ p: o.p, s: o.b - r.from, d: Math.max(0.0625, b - o.b), v: o.v });
        if (r.notes.length) {
          const bar = this.barLen();
          const len = Math.max(bar, Math.ceil((b - r.from) / bar) * bar);
          const clip = U.newMidiClip(len, { color: t.color, notes: r.notes.map(x => ({ p: x.p, s: U.round(x.s, 4), d: U.round(x.d, 4), v: x.v })) });
          clip.loop.on = false;
          t.arr.push({ id: U.uid('a'), pos: r.from, dur: len, off: 0, clip });
          changed = true;
        }
        n.rec = null;
      } else if (r.session && which !== 'arr') {
        if (n.play && r.fresh) {
          const clip = n.track.slots[n.play.slot];
          if (clip && clip.id === r.clipId) {
            for (const o of r.open.values()) this.commitRecNote(n, o, b);
            const bar = this.barLen();
            const len = Math.max(bar, Math.ceil((b - n.play.start - 0.01) / bar) * bar);
            clip.end = len;
            clip.loop = { on: true, start: 0, end: len };
            clip.follow.time = len;
            n.play.end = null;
          }
        } else for (const o of r.open.values()) this.commitRecNote(n, o, b);
        n.rec = null;
        changed = true;
      }
    }
    if (which !== 'sess') {
      for (const n of this.nodes.values()) this.closeSeg(n, b);
      for (const sg of this.segs || []) {
        const t = U.trackById(this.project, sg.track);
        if (!t) continue;
        carve(t, sg.start, sg.end, this.bpm);
        t.arr.push({ id: U.uid('a'), pos: U.round(sg.start, 4), dur: U.round(sg.end - sg.start, 4), off: U.round(sg.off, 4), clip: sg.clip });
        changed = true;
      }
      this.segs = [];
    }
    if (changed) U.commit('녹음');
  }

  /* ---------- 미리듣기 (브라우저) ---------- */
  previewTrack() {
    if (!this.pv) {
      this.pv = { out: gainNode(this.ctx, 0.8), inst: null, key: null, src: null };
      this.pv.out.connect(this.out);
    }
    return this.pv;
  }
  previewDevice(dev, notes) {
    const pv = this.previewTrack();
    this.stopPreview();
    const C = U.DEVICE_CLASSES[dev.kind];
    if (!C) return;
    const inst = new C(this, dev);
    inst.out.connect(pv.out);
    pv.inst = inst;
    const t0 = this.ctx.currentTime + 0.05;
    return inst.ready.then(() => {
      if (pv.inst !== inst) return;
      if (inst.prepare) inst.prepare(notes);
      const t = Math.max(t0, this.ctx.currentTime + 0.02);
      for (const n of notes) inst.playNote(n.p, n.v || 100, t + n.s * 60 / this.bpm, n.d * 60 / this.bpm);
    });
  }
  previewBuffer(buf, rate) {
    const pv = this.previewTrack();
    this.stopPreview();
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate || 1;
    s.connect(pv.out);
    s.start();
    pv.src = s;
  }
  stopPreview() {
    const pv = this.pv;
    if (!pv) return;
    const t = this.ctx.currentTime;
    if (pv.inst) { const i = pv.inst; i.cut(t, true); setTimeout(() => i.dispose(), 400); pv.inst = null; }
    if (pv.src) { U.stopAt(pv.src, t); pv.src = null; }
  }

  /* ---------- 이벤트 ---------- */
  on(fn) { this.listeners.push(fn); }
  emit(type) { if (this.offline) return; U.emit('engine:' + type); }
}

/* ================= 클립 계산 ================= */
/* 클립 경과 구간 [e0,e1)을 '한 바퀴' 단위로: {k, e0, e1, p0, p1} (p는 클립 안 위치) */
function clipPasses(c, e0, e1) {
  const out = [];
  if (!c.loop.on) {
    const len = c.end - c.start;
    if (e0 < len && e1 > 0) out.push({ k: 0, e0: 0, e1: len, p0: c.start, p1: c.end });
    return out;
  }
  const ls = c.loop.start, le = c.loop.end, L = le - ls;
  if (L <= 1e-6) return out;
  const s = Math.min(c.start, le - 1e-6);
  const first = le - s;
  if (e0 < first) out.push({ k: 0, e0: 0, e1: first, p0: s, p1: le });
  let k = Math.max(1, Math.floor((e0 - first) / L) + 1);
  for (; ; k++) {
    const ps = first + (k - 1) * L;
    if (ps >= e1) break;
    if (ps + L > e0) out.push({ k, e0: ps, e1: ps + L, p0: ls, p1: le });
    if (out.length > 512) break;
  }
  return out;
}
function forEachNote(c, e0, e1, fn) {
  for (const ps of clipPasses(c, e0, e1)) {
    const lo = ps.p0 + Math.max(0, e0 - ps.e0), hi = ps.p0 + Math.min(ps.e1, e1) - ps.e0;
    for (const n of c.notes) {
      if (n.m) continue;
      if (n.s < lo - 1e-9 || n.s >= hi - 1e-9) continue;
      if (n.c != null && n.c < 1 && Math.random() > n.c) continue;
      const el = ps.e0 + (n.s - ps.p0);
      const dur = Math.min(n.d, ps.p1 - n.s);
      fn(n, el, dur);
    }
  }
}
/* 어레인지먼트의 [a,b) 자리를 비운다 (덮어쓰기 녹음) */
function carve(t, a, b, bpm) {
  const out = [];
  for (const x of t.arr) {
    const s = x.pos, e = x.pos + x.dur;
    if (e <= a + 1e-6 || s >= b - 1e-6) { out.push(x); continue; }
    const scale = U.clipScale(x.clip, bpm);
    if (s < a - 1e-6) out.push(Object.assign({}, x, { dur: a - s }));
    if (e > b + 1e-6) out.push({ id: U.uid('a'), pos: b, dur: e - b, off: x.off + (b - s) / scale, clip: s < a - 1e-6 ? U.cloneClip(x.clip) : x.clip });
  }
  t.arr = out;
}
function autoValue(pts, a) {
  if (a <= pts[0].t) return pts[0].v;
  const last = pts[pts.length - 1];
  if (a >= last.t) return last.v;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= a) lo = m; else hi = m; }
  const p = pts[lo], q = pts[hi];
  if (q.t - p.t < 1e-9) return q.v;
  return p.v + (q.v - p.v) * (a - p.t) / (q.t - p.t);
}

Object.assign(U, { Engine, TrackNode, posToDb, dbToPos, clipPasses, forEachNote, autoValue, carve });
})(window.U = window.U || {});
