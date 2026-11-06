/* 울림 — 옛 가요 샘플 만들기: 화음 진행 · 키 · 화음 색 · 건반 · 바탕 · 반주 리듬 · 노래 훅 · 옛 음반 느낌을 골라
   2000년대 가요 음반에서 딴 듯한 네 마디(16박) 루프를 만든다. 미리 듣고, 내 오디오에 저장해 트랙이나 찹 패드에 넣는다.
   만든 설정(레시피)을 오디오와 함께 저장해서, 브라우저의 내 오디오에서 다시 열어 고칠 수 있다 */
(function (U) {
'use strict';
const { h } = U;
const pr = () => U.project;

/* 진행: 메이저 키의 도수(0 = Ⅰ), per = 한 마디의 화음 수 */
const PROGS = [
  { id: 'royal', name: '왕도 진행', hint: 'Ⅳ – Ⅴ – ⅲ – ⅵ · 아련하고 애틋해요. 2000년대 가요와 애니 주제가에 많이 나와요.', degs: [3, 4, 2, 5], per: 1 },
  { id: 'ballad', name: '발라드', hint: 'Ⅰ – Ⅴ – ⅵ – Ⅳ · 가장 흔한 팝 발라드 진행이에요.', degs: [0, 4, 5, 3], per: 1 },
  { id: 'canon', name: '캐논', hint: 'Ⅰ – Ⅴ – ⅵ – ⅲ – Ⅳ – Ⅰ – Ⅳ – Ⅴ · 한 마디에 두 화음씩, 계단처럼 내려와요.', degs: [0, 4, 5, 2, 3, 0, 3, 4], per: 2 },
  { id: 'rnb', name: '알앤비', hint: 'ⅱ – Ⅴ – Ⅰ – ⅵ · 부드럽게 도는 2000년대 알앤비 진행이에요.', degs: [1, 4, 0, 5], per: 1 },
  { id: 'sad', name: '슬픈 마이너', hint: 'ⅵ – Ⅳ – Ⅰ – Ⅴ · 단조 화음으로 시작해 애절해요.', degs: [5, 3, 0, 4], per: 1 }
];
const COLORS = [['triad', '3화음'], ['seventh', '7화음'], ['ninth', '9화음']];
const KEYS = [
  { id: 'ep', name: '전자 피아노', kind: 'fm', p: () => U.sound('전자 피아노').p },
  { id: 'rhodes', name: '로즈', kind: 'acoustic', p: () => ({ inst: 'rhodes', tone: 0.5 }) },
  { id: 'grand', name: '그랜드 피아노', kind: 'acoustic', p: () => ({ inst: 'grand' }) },
  { id: 'nylon', name: '나일론 기타', kind: 'acoustic', p: () => ({ inst: 'nylon' }) },
  { id: 'vibes', name: '비브라폰', kind: 'acoustic', p: () => ({ inst: 'vibes' }) }
];
const PADS = [
  { id: 'none', name: '없음' },
  { id: 'warm', name: '패드', kind: 'polysynth', p: () => U.sound('따뜻한 패드').p },
  { id: 'strings', name: '현악', kind: 'ensemble', p: () => ({ inst: 'strings' }) },
  { id: 'choir', name: '콰이어', kind: 'ensemble', p: () => ({ inst: 'choir_u' }) }
];
/* 반주 리듬: 화음 하나(한 마디면 4박) 안의 [박, 길이, 세기]. 두 화음 마디는 반으로 줄여 쓴다 */
const RHYTHMS = [
  { id: 'bounce', name: '통통 튀게', steps: [[0, 1.4, 100], [1.5, 0.9, 84], [2.5, 0.9, 92], [3.5, 0.45, 78]] },
  { id: 'half', name: '두 번씩', steps: [[0, 1.9, 98], [2, 1.9, 86]] },
  { id: 'hold', name: '길게', steps: [[0, 3.9, 94]] },
  { id: 'arp', name: '아르페지오', arp: true }
];
const HOOKS = [['none', '없음'], ['mix', '오·아'], ['o', '오~'], ['a', '아~'], ['u', '우~']];
const VOICES = [['bright', '맑게', 1.28, 0], ['mid', '보통', 1.15, 0], ['low', '낮게', 1.0, -12]];
const BEATS = 16;

/* 프로젝트 키에 맞춘 기본값: 단조 키면 같은 음을 쓰는 나란한조(메이저)로 */
function defaults() {
  const k = pr().key, st = U.scaleOf(k.scale).steps;
  const minorish = st.includes(3) && !st.includes(4);
  return { v: 1, prog: 'royal', root: minorish ? (k.root + 3) % 12 : k.root, color: 'seventh', keys: 'ep', pad: 'warm', rhythm: 'bounce', hook: 'mix', voice: 'mid', seed: 1, age: 0.6, bpm: Math.round(pr().bpm) };
}
const byId = (list, id) => list.find(x => x.id === id) || list[0];
const autoName = R => byId(PROGS, R.prog).name + ' · ' + U.ROOT_NAMES[R.root] + ' ' + R.bpm;

/* ================= 소리 만들기 ================= */
/* 화음마다 실제 음: 가운데(E4) 근처에서 앞 화음과 덜 움직이게 짚고, 근음은 3옥타브에 따로 */
function harmony(R) {
  const prog = byId(PROGS, R.prog);
  const dia = U.chords.diatonic({ root: R.root, scale: 'major' }, R.color);
  const span = 4 / prog.per;
  let prev = null;
  const chords = prog.degs.map((d, i) => {
    const ch = dia[d], v = U.chords.voice(ch, 64, prev);
    prev = v.top;
    return { ch, top: v.top, root: 48 + ch.pc, at: i * span, span, pcs: ch.iv.map(x => (ch.pc + x) % 12) };
  });
  return { prog, span, chords };
}
function comping(R, H) {
  const rh = byId(RHYTHMS, R.rhythm), keys = [], pad = [];
  for (const c of H.chords) {
    if (rh.arp) {
      const tones = c.top.concat(c.top.slice(1, -1).reverse());   // 올라갔다 내려오기
      for (let k = 0; k < c.span * 2; k++) keys.push({ p: tones[k % tones.length], s: c.at + k * 0.5, d: 0.55, v: k % 2 ? 78 : 92 });
    } else for (const [s, d, v] of rh.steps) for (const p of c.top) keys.push({ p, s: c.at + s * c.span / 4, d: d * c.span / 4, v });
    keys.push({ p: c.root, s: c.at, d: c.span * 0.48, v: 96 });
    if (c.span >= 4) keys.push({ p: c.root, s: c.at + 2.5, d: 1.4, v: 84 });
    for (const p of c.top) pad.push({ p, s: c.at, d: c.span - 0.1, v: 70 });
  }
  return { keys, pad };
}
/* 노래 훅: 마디마다 리듬 틀 하나를 고르고, 센 박은 화음 음, 여린 박은 스케일 음에서 앞 음과 가까운 음을 고른다.
   셋째 마디에서 올라가고 마지막 마디는 길게 끌며 으뜸음 쪽으로 내려온다. seed가 같으면 같은 멜로디 */
const RH = [
  [[0.5, 0.5], [1, 0.5], [1.5, 1], [3, 0.5], [3.5, 0.5]],
  [[0, 1.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]],
  [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
  [[0.5, 0.5], [1, 1], [2, 0.5], [2.5, 1.5]],
  [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]]
];
const LAST = [[0, 2.5], [2.5, 0.5], [3, 1]];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
function melody(R, H) {
  const rnd = U.rng(1000 + (R.seed || 1) * 7919);
  const T = 60 + R.root, lo = T - 4, hi = T + 9;
  const scale = MAJOR.map(x => (R.root + x) % 12);
  let cur = T + 4;
  const out = [];
  for (let bar = 0; bar < 4; bar++) {
    const rh = bar === 3 ? LAST : RH[Math.floor(rnd() * RH.length)];
    rh.forEach(([s, d], k) => {
      const t = bar * 4 + s;
      const c = H.chords[Math.min(H.chords.length - 1, Math.floor(t / H.span + 1e-9))];
      const strong = s % 1 === 0 || d >= 1;
      const pool = [];
      for (let p = lo; p <= hi; p++) if (c.pcs.includes(p % 12) || (!strong && scale.includes(p % 12))) pool.push(p);
      const end = bar === 3 && k === rh.length - 1;
      const target = end ? T : bar === 2 ? hi - 2 : bar === 3 ? T + 2 : T + 2 + (rnd() - 0.5) * 6;
      let best = null, cost = Infinity;
      for (const p of pool) {
        const jump = Math.abs(p - cur);
        if (jump > 7) continue;
        const cs = jump * 0.8 + Math.abs(p - target) * (end ? 2 : 0.5) + rnd() * 2 + (p === cur ? 1.5 : 0);
        if (cs < cost) { cost = cs; best = p; }
      }
      if (best == null) best = pool.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a), pool[0]);
      const v = R.hook === 'mix' ? (d >= 1 ? 'o' : 'a') : R.hook;
      const n = { p: best, s: t, d, v };
      if (out.length && d >= 1.5 && Math.abs(best - cur) >= 1 && Math.abs(best - cur) <= 3) n.from = cur;
      out.push(n);
      cur = best;
    });
  }
  return out;
}
/* 크기 맞추기: 두 채널 RMS를 db에, 그다음 봉우리가 peak를 넘지 않게 */
function level(buf, db, peak) {
  let e = 0, pk = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); n += d.length; for (let i = 0; i < d.length; i++) { e += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); } }
  if (!e) return buf;
  let g = Math.pow(10, db / 20) / Math.sqrt(e / n);
  if (peak != null && pk * g > Math.pow(10, peak / 20)) g = Math.pow(10, peak / 20) / pk;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return buf;
}
/* 옛 음반 느낌 t(0~1) → 섞기 단계: 낮은 소리·높은 소리를 깎는 자리, 일그러짐, 테이프 흔들림 (LP 잡음 양은 render에서) */
const chain = t => ({ hp: 40 + 185 * t, lp: 16000 * Math.pow(7000 / 16000, t / 0.6), sat: 'tube', drive: 6.7 * t, wow: t, out: 1 });
async function render(R, sr) {
  const H = harmony(R), C = comping(R, H);
  const K = byId(KEYS, R.keys), P = byId(PADS, R.pad), vo = VOICES.find(x => x[0] === R.voice) || VOICES[1];
  const hook = R.hook === 'none' ? [] : melody(R, H).map(n => Object.assign(n, { p: n.p + vo[3] }));
  const secs = BEATS * 60 / R.bpm, t = U.clamp(R.age, 0, 1);
  const [keys, pad, voice, dust] = await Promise.all([
    U.media.renderInstrument(sr, R.bpm, BEATS, K.kind, K.p(), C.keys, 2),
    P.kind ? U.media.renderInstrument(sr, R.bpm, BEATS, P.kind, P.p(), C.pad, 2) : null,
    hook.length ? U.media.renderSung(sr, R.bpm, BEATS, hook, { shift: vo[2] }) : null,
    t > 0.02 ? U.media.renderTexture(sr, 'vinyl', secs) : null
  ]);
  // 악기마다 크기가 달라서, 층마다 크기를 먼저 맞추고 섞는다
  const layers = [{ buf: level(keys, -20) }];
  if (pad) layers.push({ buf: level(pad, -30) });
  if (voice) layers.push({ buf: level(voice, -22) });
  if (dust) layers.push({ buf: dust, gain: t * 0.8 });
  const mixed = await U.media.renderMix(sr, secs, layers, chain(t));
  return finish(mixed);
}
/* 마지막 크기: RMS를 −15 dBFS로 맞추고, 줄 뜯는 소리처럼 순간 봉우리가 큰 소리는 −3 dB 위만 부드럽게 눌러 −1 dB를 넘지 않게
   (어떤 악기를 골라도 같은 크기로 들리게) */
function finish(buf) {
  level(buf, -15);
  const k = Math.pow(10, -3 / 20), c = Math.pow(10, -1 / 20);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > k) d[i] = Math.sign(d[i]) * (k + (c - k) * Math.tanh((a - k) / (c - k)));
    }
  }
  return buf;
}
const cache = new Map();   // 레시피 → 만든 소리 (최근 4개)
async function bufferFor(R) {
  const k = JSON.stringify(R);
  if (!cache.has(k)) {
    cache.set(k, render(R, U.engine.ctx.sampleRate));
    while (cache.size > 4) cache.delete(cache.keys().next().value);
  }
  return cache.get(k);
}
/* 내 오디오에 저장하고 ref를 돌려준다 */
async function save(R, name) {
  const buf = await bufferFor(R);
  const ref = await U.media.addBuffer(buf, name || autoName(R), R.bpm, { loop: true, recipe: Object.assign({}, R) });
  U.inval('browser');
  return ref;
}

/* ================= 창 ================= */
let playing = null;
function stopPreview() {
  if (!playing) return;
  try { playing.src.stop(); } catch (e) { /* 이미 멈춤 */ }
  playing = null;
}
function startPreview(buf) {
  stopPreview();
  const ctx = U.engine.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.loop = true;
  g.gain.value = 0.9;
  src.connect(g); g.connect(ctx.destination);
  src.start();
  playing = { src, g };
}
/* o.recipe: 고칠 설정, o.name: 이름, o.onMade(ref, name): 만든 뒤 할 일 (없으면 새 오디오 트랙에 넣을지 고른다) */
function open(o) {
  o = o || {};
  const R = Object.assign(defaults(), o.recipe || {});
  let name = o.name || autoName(R), named = !!o.name;
  let toTrack = true, gen = 0;
  const body = h('div', { class: 'os' });
  const hint = h('p', { class: 'os-hint' });
  const foot = h('p', { class: 'os-foot' });
  const nameInp = h('input', { class: 'inp', value: name, 'aria-label': '이름' });
  nameInp.addEventListener('input', () => { name = nameInp.value.trim(); named = true; });
  const row = (label, ...kids) => h('div', { class: 'os-row' }, h('span', { class: 'os-l', text: label }), h('div', { class: 'os-ctl' }, ...kids));
  const seg = (list, k) => U.seg(list.map(x => Array.isArray(x) ? [x[0], x[1]] : [x.id, x.name, x.hint]), R[k], v => { R[k] = v; changed(); }, 'os-seg');
  const keySel = U.select(U.ROOT_NAMES.map((n, i) => [String(i), n + ' 메이저']), String(R.root), v => { R.root = +v; changed(); }, { cls: 'sm', label: '키' });
  const seedTxt = h('span', { class: 'os-seed' });
  const reroll = U.btn({ text: '멜로디 바꾸기', cls: 'sm', title: '같은 설정으로 다른 노래 훅을 만들어요', onclick: () => { R.seed = (R.seed || 1) + 1; changed(); } });
  const age = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(R.age * 100)), 'aria-label': '옛 음반 느낌', id: 'os-age' });
  const ageTxt = h('span', { class: 'os-pct' });
  age.addEventListener('input', () => { R.age = +age.value / 100; changed(); });
  const tt = h('input', { type: 'checkbox', id: 'os-track' });
  tt.checked = toTrack;
  tt.addEventListener('change', () => { toTrack = tt.checked; });
  body.append(
    row('화음 진행', seg(PROGS, 'prog')), hint,
    row('키 · 화음', keySel, seg(COLORS, 'color')),
    row('건반', seg(KEYS, 'keys')),
    row('바탕', seg(PADS, 'pad')),
    row('반주 리듬', seg(RHYTHMS, 'rhythm')),
    row('노래 훅', seg(HOOKS, 'hook'), seg(VOICES, 'voice'), reroll, seedTxt),
    row('옛 음반 느낌', h('div', { class: 'os-age' }, h('span', { class: 'os-end', text: '깨끗하게' }), age, h('span', { class: 'os-end', text: '낡은 판처럼' }), ageTxt)),
    row('이름', nameInp),
    o.onMade ? null : h('label', { class: 'chk', for: 'os-track' }, tt, h('span', { text: '만들면 새 오디오 트랙에 넣기 (고른 씬 줄에)' })),
    foot);
  const refresh = () => {
    hint.textContent = byId(PROGS, R.prog).hint;
    seedTxt.textContent = R.hook === 'none' ? '' : '멜로디 ' + R.seed;
    reroll.disabled = R.hook === 'none';
    ageTxt.textContent = Math.round(R.age * 100) + '%';
    if (!named) { name = autoName(R); nameInp.value = name; }
    foot.textContent = '네 마디 · ' + R.bpm + ' BPM · 한 박씩 자르면 찹 패드 16조각이 돼요. 다른 템포의 곡에 넣으면 템포에 맞춰 늘고 줄어요.';
  };
  let previewBtn = null, timer = 0;
  const playNow = async b => {
    const my = ++gen;
    b.disabled = true; b.textContent = '만드는 중…';
    try {
      U.ensureAudio();
      const buf = await bufferFor(Object.assign({}, R));
      if (my !== gen) return;
      startPreview(buf);
      b.textContent = '■ 멈추기';
    } catch (e) { console.error(e); U.toast('샘플을 만들지 못했어요.', 'error'); b.textContent = '▶ 미리 듣기'; }
    finally { if (my === gen) b.disabled = false; }
  };
  // 듣는 중에 바꾸면 조금 뒤 새 소리로 다시 튼다
  function changed() {
    refresh();
    if (!playing || !previewBtn) return;
    clearTimeout(timer);
    timer = setTimeout(() => playNow(previewBtn), 250);
  }
  refresh();
  U.dialog({
    title: '옛 가요 샘플 만들기', body, width: '640px',
    onclose: () => { gen++; clearTimeout(timer); stopPreview(); },
    actions: [
      { label: '닫기' },
      { label: '▶ 미리 듣기', action: b => {
        previewBtn = b;
        if (playing) { gen++; stopPreview(); b.textContent = '▶ 미리 듣기'; } else playNow(b);
        return false;
      } },
      { label: '만들기', primary: true, action: async b => {
        b.disabled = true; b.textContent = '만드는 중…';
        try {
          const R2 = Object.assign({}, R), nm = name || autoName(R2);
          const ref = await save(R2, nm);
          if (o.onMade) await o.onMade(ref, nm);
          else if (toTrack) {
            const t = U.act.addTrack('audio');
            await U.act.insertAudio(t.id, Math.max(0, (U.ui && U.ui.scene) || 0), ref);
            const tr = U.trackById(pr(), t.id);
            if (tr) { tr.name = nm; U.commit('옛 가요 샘플 넣기'); }
          }
          U.toast('"' + nm + '"을(를) 만들어 내 오디오에 넣었어요.' + (o.onMade || !toTrack ? '' : ' 새 오디오 트랙에도 넣었어요.'));
          return true;
        } catch (e) {
          console.error(e);
          U.toast('샘플을 만들지 못했어요.', 'error');
          b.disabled = false; b.textContent = '만들기';
          return false;
        }
      } }
    ]
  });
}

U.oldSample = { open, render, save, defaults, chain, melody: R => melody(R, harmony(R)), harmony, PROGS, KEYS, PADS, RHYTHMS };
})(window.U = window.U || {});
