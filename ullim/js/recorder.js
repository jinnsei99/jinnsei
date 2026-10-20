/* 울림 — 오디오 녹음: 녹음 준비(●)한 오디오 트랙에 마이크 소리를 담는다 */
(function (U) {
'use strict';
const pr = () => U.project;
let stream = null;
let cur = null; // {rec, chunks, startT, mode, tracks, slots}

function supported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
function armedAudio() { return pr().tracks.filter(t => t.type === 'audio' && t.arm); }

async function getStream() {
  if (stream && stream.active) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  return stream;
}
/* mode: 'arr' (어레인지먼트) 또는 'sess' (세션 슬롯) */
async function start(mode, slot) {
  const tracks = armedAudio();
  if (!tracks.length || cur) return false;
  if (!supported()) { U.toast('이 브라우저에서는 오디오를 녹음할 수 없어요.', 'error'); return false; }
  let s;
  U.audioSession('play-and-record');   // 사파리: 녹음하는 동안만 마이크를 함께 쓰는 방식으로
  try { s = await getStream(); }
  catch (e) {
    U.audioSession('playback');
    U.toast(window.claude ? 'Claude 안에서는 마이크를 쓸 수 없어요. 녹음한 파일을 끌어다 놓아 주세요.' : '마이크를 쓸 수 없어요. 브라우저의 마이크 권한을 확인해 주세요.', 'error');
    return false;
  }
  const rec = new MediaRecorder(s);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const e = U.engine;
  cur = { rec, chunks, mode, slot, tracks: tracks.map(t => t.id), startT: null };
  rec.onstart = () => { cur.startT = e.ctx.currentTime; };
  rec.start();
  U.inval('session');
  return true;
}
async function stop() {
  if (!cur) return;
  const c = cur;
  cur = null;
  const e = U.engine;
  const endT = e.ctx.currentTime;
  await new Promise(res => { c.rec.onstop = res; c.rec.stop(); });
  U.audioSession('playback');
  if (!c.chunks.length || c.startT == null) return;
  let buf;
  try {
    const bytes = await new Blob(c.chunks, { type: c.chunks[0].type }).arrayBuffer();
    buf = await U.media.decode(bytes, e.ctx.sampleRate);
  } catch (err) { U.toast('녹음한 소리를 읽지 못했어요.', 'error'); return; }
  // 입력·출력 지연만큼 앞을 잘라 박자에 맞춘다
  const lat = e.latency() + 0.01;
  const skip = Math.min(buf.length - 1, Math.floor(lat * buf.sampleRate));
  const trimmed = new AudioBuffer({ length: Math.max(1, buf.length - skip), numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) trimmed.copyToChannel(buf.getChannelData(ch).subarray(skip), ch);
  const bpm = pr().bpm;
  const name = '녹음 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const ref = await U.media.addBuffer(trimmed, name, bpm);
  const startB = e.beatAt(c.startT);
  const bar = U.barLen(pr().sig);
  for (const id of c.tracks) {
    const t = U.trackById(pr(), id);
    if (!t) continue;
    const clip = U.newAudioClip(ref, { name, duration: trimmed.duration, bpm, loop: false }, { color: t.color });
    clip.warp = true;
    clip.mode = 'tones';
    if (c.mode === 'sess') {
      const len = Math.max(bar, Math.round((endT - c.startT) * bpm / 60 / bar) * bar);
      clip.end = len;
      clip.loop = { on: true, start: 0, end: len };
      let slot = c.slot != null ? c.slot : t.slots.findIndex(x => !x);
      if (slot < 0 || t.slots[slot]) slot = t.slots.findIndex(x => !x);
      if (slot < 0) { pr().scenes.push(U.newScene()); for (const tr of pr().tracks) tr.slots.push(null); slot = t.slots.length - 1; }
      t.slots[slot] = clip;
    } else {
      const pos = Math.max(0, startB);
      t.arr.push({ id: U.uid('a'), pos, dur: trimmed.duration * bpm / 60, off: 0, clip });
    }
  }
  U.commit('오디오 녹음');
  U.toast('오디오를 녹음했어요.');
}
function active() { return !!cur; }

U.audioRec = { start, stop, active, supported, armedAudio };
})(window.U = window.U || {});
