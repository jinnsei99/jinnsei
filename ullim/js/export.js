/* 울림 — 내보내기: 오프라인 렌더(믹스다운·스템), WAV, ZIP, MIDI 파일 */
(function (U) {
'use strict';

/* ================= WAV ================= */
function encodeWav(channels, sr, bits) {
  bits = bits || 16;
  const nch = channels.length, len = channels[0].length;
  const bps = bits / 8;
  const fmt = bits === 32 ? 3 : 1;
  const dataLen = len * nch * bps;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, fmt, true); v.setUint16(22, nch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nch * bps, true); v.setUint16(32, nch * bps, true); v.setUint16(34, bits, true);
  w(36, 'data'); v.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nch; c++) {
      let x = channels[c][i];
      if (bits === 32) { v.setFloat32(o, x, true); o += 4; continue; }
      if (bits === 16) {
        x = x * 32767 + (Math.random() - Math.random()); // TPDF 디더
        v.setInt16(o, U.clamp(Math.round(x), -32768, 32767), true); o += 2;
      } else {
        const y = U.clamp(Math.round(x * 8388607), -8388608, 8388607);
        v.setUint8(o, y & 255); v.setUint8(o + 1, (y >> 8) & 255); v.setUint8(o + 2, (y >> 16) & 255); o += 3;
      }
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/* ================= ZIP (압축 없이 묶기) ================= */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
async function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    let data = f.data;
    if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
    else if (typeof data === 'string') data = enc.encode(data);
    else if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, 0, true);
    head.setUint16(10, dtime, true); head.setUint16(12, ddate, true); head.setUint32(14, crc, true);
    head.setUint32(18, data.length, true); head.setUint32(22, data.length, true); head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
    parts.push(head.buffer, name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, dtime, true); cd.setUint16(14, ddate, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true);
    cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
    central.push(cd.buffer, name);
    offset += 30 + name.length + data.length;
  }
  let cdLen = 0;
  for (const c of central) cdLen += c.byteLength;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdLen, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

/* ================= MIDI 파일 ================= */
function vlq(n) {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}
function midiFile(tracks, bpm, sig) {
  const PPQ = 480;
  const chunk = (type, bytes) => {
    const h = [...type].map(c => c.charCodeAt(0));
    const n = bytes.length;
    return h.concat([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], bytes);
  };
  const tempo = Math.round(60000000 / bpm);
  const meta = [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
    0, 0xff, 0x58, 4, sig[0], Math.round(Math.log2(sig[1])), 24, 8, 0, 0xff, 0x2f, 0];
  const out = chunk('MThd', [0, 1, 0, tracks.length + 1, (PPQ >> 8) & 255, PPQ & 255]).concat(chunk('MTrk', meta));
  const enc = new TextEncoder();
  tracks.forEach((t, ti) => {
    const ch = t.drums ? 9 : ti % 16 === 9 ? 10 : ti % 16;
    const ev = [];
    for (const n of t.notes) {
      const a = Math.max(0, Math.round(n.s * PPQ)), b = Math.max(a + 1, Math.round((n.s + n.d) * PPQ));
      ev.push([a, 1, 0x90 | ch, n.p & 127, U.clamp(Math.round(n.v), 1, 127)]);
      ev.push([b, 0, 0x80 | ch, n.p & 127, 0]);
    }
    ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const name = Array.from(enc.encode(t.name || 'Track'));
    const bytes = [0, 0xff, 0x03].concat(vlq(name.length), name);
    let last = 0;
    for (const e of ev) { bytes.push(...vlq(e[0] - last), e[2], e[3], e[4]); last = e[0]; }
    bytes.push(0, 0xff, 0x2f, 0);
    out.push(...chunk('MTrk', bytes));
  });
  return new Uint8Array(out);
}
/* 어레인지먼트의 MIDI 트랙을 음표 목록으로 펼친다 */
function arrangementNotes(pr) {
  return pr.tracks.filter(t => t.type === 'midi').map(t => {
    const notes = [];
    for (const a of t.arr) {
      U.forEachNote(a.clip, a.off, a.off + a.dur, (n, el, dur) => {
        const s = a.pos + (el - a.off);
        if (s < a.pos + a.dur) notes.push({ p: n.p, s, d: Math.min(dur, a.pos + a.dur - s), v: n.v });
      });
    }
    const inst = U.instrumentOf(t);
    return { name: U.trackLabel(pr, t), notes, drums: inst && inst.kind === 'drums' };
  }).filter(t => t.notes.length);
}

/* ================= 오프라인 렌더 ================= */
/* opts: {from, to (박), scene (세션 씬 번호, 없으면 어레인지먼트), stems, sampleRate, tail(초)} */
async function render(project, opts, onProgress) {
  const pr = U.normalize(JSON.parse(JSON.stringify(project)));
  pr.loop.on = false;
  const sr = opts.sampleRate || 44100;
  const from = opts.from || 0, to = Math.max(from + 0.25, opts.to);
  const body = (to - from) * 60 / pr.bpm;
  const dur = body + (opts.tail != null ? opts.tail : 2);
  const stems = opts.stems ? pr.tracks.concat(pr.returns).slice(0, 15) : null;
  const nch = stems ? 2 * (stems.length + 1) : 2;
  const ctx = U.OfflineCtx(nch, Math.ceil(dur * sr), sr);
  const eng = new U.Engine(ctx, { offline: true, noOutput: !!stems });
  eng.sync(pr);
  if (stems) {
    ctx.destination.channelCount = nch;
    ctx.destination.channelCountMode = 'explicit';
    ctx.destination.channelInterpretation = 'discrete';
    const merger = ctx.createChannelMerger(nch);
    const tap = (node, i) => {
      const sp = ctx.createChannelSplitter(2);
      node.connect(sp);
      sp.connect(merger, 0, i * 2);
      sp.connect(merger, 1, i * 2 + 1);
    };
    tap(eng.out, 0);
    stems.forEach((t, i) => tap(eng.nodes.get(t.id).mute, i + 1));
    merger.connect(ctx.destination);
  }
  await eng.ready();
  eng.playing = true;
  eng.anchorT = 0; eng.anchorB = from; eng.schedB = from; eng.startB = from;
  if (opts.scene != null) {
    for (const t of pr.tracks) {
      const n = eng.nodes.get(t.id);
      n.override = true;
      if (t.slots[opts.scene]) n.queued = { slot: opts.scene, at: from };
    }
  }
  const until = t => Math.min(to, eng.beatAt(t));
  const step = 0.5;
  eng.scheduleUntil(until(step + 0.25));
  if (typeof ctx.suspend === 'function') {
    for (let t = step; t < body; t += step) {
      const tt = t;
      ctx.suspend(tt).then(() => {
        eng.scheduleUntil(until(tt + step + 0.25));
        if (onProgress) onProgress(tt / dur);
        ctx.resume();
      });
    }
  } else eng.scheduleUntil(to);
  const buf = await ctx.startRendering();
  if (onProgress) onProgress(1);
  const chans = [];
  for (let c = 0; c < nch; c++) chans.push(buf.getChannelData(c));
  const out = [{ name: pr.name || '믹스다운', ch: [chans[0], chans[1]] }];
  if (stems) stems.forEach((t, i) => out.push({ name: String(i + 1).padStart(2, '0') + ' ' + U.trackLabel(pr, t), ch: [chans[2 + i * 2], chans[3 + i * 2]] }));
  return { sr, files: out, duration: dur };
}
function peakOf(chs) {
  let m = 0;
  for (const c of chs) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > m) m = a; }
  return m;
}
function normalize(chs, target) {
  const p = peakOf(chs);
  if (p < 1e-6) return 0;
  const g = target / p;
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g;
  return 20 * Math.log10(g);
}
function safeName(s) { return String(s || '울림').replace(/[\\/:*?"<>|]+/g, '_').trim() || '울림'; }

Object.assign(U, { encodeWav, zip, crc32, midiFile, arrangementNotes, renderOffline: render, peakOf, normalizeAudio: normalize, safeName });
})(window.U = window.U || {});
