/* 울림 — MIDI 장치 창: 연결한 건반(M-VAVE SMK-25 mini 같은)을 그림으로 두고, 누르고 돌리는 대로 보여 준다.
   건반은 누른 세기(키압)만큼 차오르고, 패드는 드럼 트랙으로, 노브 8개는 소리 다듬기 손잡이로 움직인다.
   터치 감도 · 패드 채널 알아보기 · 노브 알아보기 · 피치 벤드 범위 · 누르는 힘(애프터터치)을 여기서 정한다 */
(function (U) {
'use strict';
const { h, btn, info, clamp } = U;
const pr = () => U.project;
const I = () => U.input;
const BLACK = [1, 3, 6, 8, 10];
let dlg = null, off = null, V = null;

function open() {
  if (dlg) return;
  const body = h('div', { class: 'mid' });
  dlg = U.dialog({ title: 'MIDI 장치', body, width: '780px', actions: [{ label: '닫기', primary: true }],
    onclose: () => { if (off) off(); off = null; dlg = null; V = null; if (I().learning()) I().stopLearn(); } });
  render(body);
  off = U.on('midi', onEvent);
}
const trackName = ids => (ids && ids.length ? ids.map(id => U.trackLabel(pr(), U.trackById(pr(), id))).join(', ') : '없음');

function render(body) {
  U.clear(body);
  V = { body, keys: new Map(), base: 48, pads: [], knobs: [] };
  if (!I().supported()) {
    body.append(h('div', { class: 'mid-none' },
      h('p', { text: U.isIOS ? '아이패드·아이폰의 브라우저(사파리·크롬 모두)는 MIDI 장치를 쓰지 못하게 되어 있어요.' : '이 브라우저는 MIDI 장치를 지원하지 않아요.' }),
      h('p', { text: 'SMK-25 mini 같은 MIDI 건반은 컴퓨터(맥·윈도우)의 크롬이나 엣지에서 이 웹사이트를 열고 USB-C 선으로 꽂으면 바로 돼요.' + (U.isIOS ? ' 아이패드에서 꼭 써야 하면 Web MIDI를 지원하는 브라우저 앱(예: Web MIDI Browser)으로 이 주소를 열어 보세요.' : '') })));
    return;
  }
  body.append(devRow());
  if (!I().connected()) return;
  body.append(controller(), nowLine(), settings(),
    h('p', { class: 'hint mid-foot', text: 'USB-C 선이 가장 확실해요. 블루투스로 쓰려면 컴퓨터의 블루투스·MIDI 설정(맥: Audio MIDI 설정 › 블루투스 구성)에서 먼저 연결한 뒤 다시 찾기를 눌러 주세요. 연주는 ● 녹음 준비한 트랙, 없으면 고른 트랙으로 가요.' }));
  showKnobs();
}

/* ---------- 연결된 장치 ---------- */
function devRow() {
  const row = h('div', { class: 'mid-devs' });
  if (!I().connected()) {
    row.append(h('span', { class: 'mid-dl', text: '아직 연결하지 않았어요.' }),
      btn({ text: 'MIDI 장치 연결', cls: 'sm primary', onclick: async () => { await I().connectMidi(true); if (V) render(V.body); } }));
    return row;
  }
  const list = I().devices();
  if (!list.some(d => d.on)) row.append(h('span', { class: 'mid-dl', text: '장치를 찾지 못했어요. USB-C 선으로 꽂은 뒤 다시 찾기를 눌러 주세요.' }));
  for (const d of list) {
    const chip = h('span', { class: 'mid-dev' + (d.on ? ' on' : '') }, h('i'), h('b', { text: d.name }), I().isSMK(d) ? h('em', { text: 'M-VAVE SMK-25 mini' }) : null);
    info(chip, d.name, d.on ? '연결돼 있어요' + (d.maker ? ' (' + d.maker + ')' : '') + '. 건반 · 패드 · 노브를 쓰면 아래 그림이 따라 움직여요.' : '꺼져 있거나 빠졌어요.');
    row.append(chip);
  }
  row.append(btn({ text: '다시 찾기', cls: 'sm', onclick: async () => { await I().connectMidi(true); if (V) render(V.body); } }));
  return row;
}

/* ---------- 건반 그림: 패드 8 · 노브 8 · 건반 25 ---------- */
function controller() {
  const pads = h('div', { class: 'mid-pads', role: 'group', 'aria-label': '패드' });
  for (let i = 0; i < 8; i++) {
    const p = h('div', { class: 'mid-pad' }, h('span', { text: String(i + 1) }));
    V.pads.push(p);
    pads.append(p);
  }
  info(pads, '패드', '패드를 치면 드럼 트랙(' + trackName(I().padTarget()) + ')으로 가요. ' + (I().cfg.padCh + 1) + '번 채널을 패드로 알아들어요.');
  const knobs = h('div', { class: 'mid-knobs', role: 'group', 'aria-label': '노브' });
  I().KNOBS.forEach(([id, name], i) => {
    const ring = h('div', { class: 'mid-kr' });
    const cc = h('span', { class: 'mid-kc' });
    const k = h('div', { class: 'mid-knob' }, ring, h('span', { class: 'mid-kn', text: name }), cc);
    V.knobs.push({ el: k, ring, cc, id });
    knobs.append(k);
  });
  const keys = h('div', { class: 'mid-keys', role: 'group', 'aria-label': '건반' });
  V.keysEl = keys;
  drawKeys();
  // 피치 벤드 · 모드 · 누르는 힘 · 서스테인
  const meter = (cls, label, tip) => { const bar = h('i'); const el = h('div', { class: 'mid-m ' + cls }, h('span', { text: label }), h('b', null, bar)); info(el, label, tip); return { el, bar }; };
  V.bend = meter('bend', '피치 벤드', '벤드 버튼(휠)으로 음높이를 올리고 내려요. 범위는 아래에서 정해요.');
  V.mod = meter('mod', '모드', '모드 버튼(휠)을 올리면 비브라토(떨림)가 깊어져요.');
  V.press = meter('press', '누르는 힘', '건반·패드를 누른 채 더 세게 누르는 힘(애프터터치)이에요. 장치가 보내면 여기 차오르고, 비브라토로 써요.');
  V.sus = h('div', { class: 'mid-sus' }, h('i'), h('span', { text: '서스테인' }));
  info(V.sus, '서스테인', '서스테인 버튼(페달)을 누르고 있는 동안 건반에서 손을 떼도 소리가 이어져요.');
  V.vel = h('div', { class: 'mid-vel' }, h('span', { text: '세기' }), h('b', { text: '—' }));
  info(V.vel, '세기 (키압)', '마지막으로 누른 건반의 세기예요. 들어온 세기 → 터치 감도를 거쳐 친 세기.');
  return h('div', { class: 'mid-ctl' },
    h('div', { class: 'mid-top' }, pads, knobs),
    keys,
    h('div', { class: 'mid-meters' }, V.vel, V.bend.el, V.mod.el, V.press.el, V.sus));
}
function drawKeys() {
  U.clear(V.keysEl);
  V.keys = new Map();
  const whites = [];
  for (let p = V.base; p <= V.base + 24; p++) if (!BLACK.includes(p % 12)) whites.push(p);
  const w = 100 / whites.length;
  whites.forEach((p, i) => {
    const k = h('div', { class: 'mid-w', dataset: { p }, style: { left: i * w + '%', width: w + '%' } }, p % 12 === 0 ? h('span', { text: U.noteName(p) }) : null);
    V.keys.set(p, k);
    V.keysEl.append(k);
    const b = p + 1;
    if (BLACK.includes(b % 12) && b <= V.base + 24) {
      const kb = h('div', { class: 'mid-b', dataset: { p: b }, style: { left: ((i + 1) * w - w * 0.3) + '%', width: w * 0.6 + '%' } });
      V.keys.set(b, kb);
      V.keysEl.append(kb);
    }
  });
}
function nowLine() {
  V.now = h('div', { class: 'mid-now', text: '건반을 눌러 보세요. 세게 누를수록 건반이 더 차올라요.' });
  return V.now;
}

/* ---------- 설정 ---------- */
function curveSvg() {
  const C = I().CURVES[I().cfg.curve] || I().CURVES.normal;
  const pts = [];
  for (let v = 0; v <= 127; v += 8) pts.push((v / 127 * 56 + 4).toFixed(1) + ',' + (60 - clamp(C(Math.max(1, v)), 0, 127) / 127 * 56).toFixed(1));
  pts.push('60,' + (60 - clamp(C(127), 0, 127) / 127 * 56).toFixed(1));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'mid-curve');
  svg.innerHTML = '<rect x="4" y="4" width="56" height="56" rx="4"></rect><polyline points="' + pts.join(' ') + '"></polyline>';
  return svg;
}
function settings() {
  const M = I().cfg;
  const row = (label, tip, ...kids) => { const l = h('span', { class: 'mid-sl', text: label }); info(l, label, tip); return h('div', { class: 'mid-row' }, l, ...kids); };
  // 터치 감도
  const curveBox = h('span', { class: 'mid-cv' }, curveSvg());
  const fixedBox = U.numBox({ cls: 'sm', label: '고정 세기', get: () => M.fixed, set: (v, f) => { M.fixed = v; if (f) I().saveCfg(); }, fmt: v => '세기 ' + Math.round(v), parse: s => parseInt(String(s).replace(/[^\d]/g, ''), 10), min: 1, max: 127, step: 1, def: 100, range: 300 });
  fixedBox.classList.toggle('off', M.curve !== 'fixed');
  const curve = U.seg([
    ['light', '가볍게', '살살 눌러도 크게 나요. 작은 건반이 너무 여리게 나올 때 좋아요.'],
    ['normal', '보통', '누른 세기 그대로예요.'],
    ['heavy', '무겁게', '세게 눌러야 크게 나요. 피아노처럼 강약을 크게 줄 때 좋아요.'],
    ['fixed', '고정', '얼마나 세게 누르든 늘 같은 세기로 쳐요.']], M.curve, v => {
    M.curve = v;
    I().saveCfg();
    U.clear(curveBox);
    curveBox.append(curveSvg());
    fixedBox.classList.toggle('off', v !== 'fixed');
  }, 'mid-curvesel');
  // 패드
  V.padLbl = h('span', { class: 'mid-val' });
  const padLearn = btn({ text: '패드 알아보기', cls: 'sm', info: ['패드 알아보기', '누른 뒤 장치의 패드를 아무거나 하나 치면 그 채널을 패드로 알아들어요. 그 채널의 음은 드럼 트랙으로 가요.'], onclick: () => { I().startLearn('pad'); showLearn(); } });
  // 노브
  V.learnLbl = h('span', { class: 'mid-val mid-learn' });
  const knobLearn = btn({ text: '노브 알아보기', cls: 'sm', info: ['노브 알아보기', '누른 뒤 장치의 노브를 1번부터 8번까지 차례로 오른쪽으로 조금씩 돌려 주세요. 노브마다 CC 번호와 방식(보통 노브 · 끝없이 도는 노브)을 배워요.'], onclick: () => { I().startLearn('knob'); showLearn(); showKnobs(); } });
  V.knobStop = btn({ text: '그만', cls: 'sm ghost', onclick: () => { I().stopLearn(); showLearn(); showKnobs(); } });
  const knobClear = btn({ text: '지우기', cls: 'sm ghost', onclick: () => { I().cfg.knobs = []; I().saveCfg(); showKnobs(); showLearn(); } });
  // 피치 벤드 · 누르는 힘
  const pb = U.seg([[2, '±2반음', '벤드를 끝까지 올리면 2반음(온음) 올라가요. 기타 초킹 정도예요.'], [12, '±1옥타브', '끝까지 올리면 한 옥타브 올라가요.']], M.pb, v => { M.pb = v; I().saveCfg(); });
  const at = U.seg([['vib', '비브라토', '건반을 누른 채 더 세게 누르면 떨림이 깊어져요.'], ['off', '쓰지 않기', '누르는 힘은 그림에만 보여요.']], M.at, v => { M.at = v; I().saveCfg(); });
  const box = h('div', { class: 'mid-set' },
    row('터치 감도', '건반을 누르는 세기(키압)가 소리 크기로 바뀌는 정도예요. 장치 쪽 감도와 함께 써요.', curve, curveBox, fixedBox),
    row('패드', '장치의 패드를 드럼 트랙으로 보내요.', V.padLbl, padLearn),
    row('노브 8개', '노브 1~8은 건반이 치는 트랙의 밝기 · 길이 · 두께 · 드라이브 · 공간 · 세기 반응 · 음량 · 트랙 볼륨이에요.', V.learnLbl, knobLearn, V.knobStop, knobClear),
    row('피치 벤드', '벤드 버튼(휠)의 범위예요.', pb),
    row('누르는 힘', '애프터터치를 보내는 장치에서, 누른 채 더 세게 누르는 힘으로 할 일이에요.', at));
  showLearn();
  return box;
}
function showLearn() {
  if (!V || !V.padLbl) return;
  const L = I().learning(), M = I().cfg;
  const pt = I().padTarget();
  V.padLbl.textContent = L && L.what === 'pad' ? '패드를 아무거나 하나 쳐 주세요…' : (M.padCh + 1) + '번 채널 → ' + (pt ? trackName(pt) : '드럼 트랙이 없어요 (패드도 건반 트랙으로 가요)');
  V.padLbl.classList.toggle('wait', !!(L && L.what === 'pad'));
  const n = M.knobs.filter(Boolean).length;
  V.learnLbl.textContent = L && L.what === 'knob' ? '노브 ' + (L.i + 1) + '(' + I().KNOBS[L.i][1] + ')을 오른쪽으로 조금 돌려 주세요…' : n ? n + '개 이었어요 → ' + trackName(I().liveTargets()) : '아직 몰라요. 알아보기를 눌러 주세요.';
  V.learnLbl.classList.toggle('wait', !!(L && L.what === 'knob'));
  V.knobStop.hidden = !(L && L.what === 'knob');
}
/* 노브마다 이은 CC와 지금 값 */
function showKnobs() {
  if (!V) return;
  const L = I().learning(), M = I().cfg, t = I().knobTrack();
  V.knobs.forEach((k, i) => {
    const kk = M.knobs[i];
    k.cc.textContent = kk ? 'CC ' + kk.cc + (kk.mode === 'abs' ? '' : ' ↻') : '—';
    const m = kk ? I().knobGet(t, k.id) : null;
    k.ring.style.setProperty('--m', m == null ? 0 : m);
    k.el.classList.toggle('none', m == null);
    k.el.classList.toggle('learn', !!(L && L.what === 'knob' && L.i === i));
    info(k.el, '노브 ' + (i + 1) + ' · ' + I().KNOBS[i][1], (kk ? 'CC ' + kk.cc + (kk.mode === 'abs' ? ' (보통 노브)' : ' (끝없이 도는 노브: 돌린 만큼 바뀌어요)') + '. ' : '아직 이어지지 않았어요. ') + (m == null && kk ? '이 소리에는 없는 손잡이예요.' : '건반이 치는 트랙의 ' + I().KNOBS[i][1] + '을(를) 바꿔요.'));
  });
}

/* ---------- 장치에서 온 것을 그림에 ---------- */
function keyEl(p) {
  if (p < V.base || p > V.base + 24) { V.base = clamp(12 * Math.floor(p / 12) - (p % 12 > 7 ? 0 : 12), 0, 103); drawKeys(); }
  return V.keys.get(p);
}
function onEvent(ev) {
  if (!V || !V.now) { if (ev.k === 'devices' && V) render(V.body); return; }
  switch (ev.k) {
    case 'devices': render(V.body); return;
    case 'note': {
      const k = keyEl(ev.p);
      if (k) { k.style.setProperty('--v', ev.vel / 127); k.classList.add('on'); }
      V.vel.querySelector('b').textContent = ev.v + (ev.vel !== ev.v ? ' → ' + ev.vel : '');
      V.vel.style.setProperty('--v', ev.vel / 127);
      V.now.textContent = U.noteName(ev.p) + ' · 세기 ' + ev.v + (ev.vel !== ev.v ? ' → ' + ev.vel : '') + ' · ' + trackName(ev.ids) + (ev.ch ? ' · ' + (ev.ch + 1) + '번 채널' : '');
      return;
    }
    case 'off': {
      if (ev.pad) { const pd = V.pads[((ev.p - 36) % 8 + 8) % 8]; if (pd) pd.classList.remove('on'); return; }
      const k = V.keys.get(ev.p);
      if (k) k.classList.remove('on');
      return;
    }
    case 'pad': {
      const pd = V.pads[((ev.p - 36) % 8 + 8) % 8];
      if (pd) { pd.style.setProperty('--v', ev.vel / 127); pd.classList.add('on'); }
      const t = ev.ids && U.trackById(pr(), ev.ids[0]), d = t && U.instrumentOf(t);
      const pad = d && d.data && d.data.pads && d.data.pads[ev.p - 36];
      V.now.textContent = '패드 ' + U.noteName(ev.p) + (pad ? ' (' + (pad.name || '') + ')' : '') + ' · 세기 ' + ev.v + (ev.vel !== ev.v ? ' → ' + ev.vel : '') + ' · ' + trackName(ev.ids);
      return;
    }
    case 'bend': V.bend.bar.style.setProperty('--x', ev.v); V.now.textContent = '피치 벤드 ' + (ev.v >= 0 ? '+' : '') + Math.round(ev.v * I().cfg.pb * 100) + ' 센트'; return;
    case 'mod': V.mod.bar.style.setProperty('--x', ev.v); V.now.textContent = '모드 ' + Math.round(ev.v * 127) + ' · 비브라토'; return;
    case 'press': V.press.bar.style.setProperty('--x', ev.v); V.now.textContent = '누르는 힘 ' + Math.round(ev.v * 127) + (ev.pad ? ' (패드)' : ''); return;
    case 'sus': V.sus.classList.toggle('on', ev.on); return;
    case 'pc': V.now.textContent = '프로그램 바꾸기 ' + (ev.v + 1); return;
    case 'cc': {
      if (ev.learning) { V.now.textContent = 'CC ' + ev.cc + ' = ' + ev.v; return; }
      if (ev.knob >= 0) {
        const k = V.knobs[ev.knob];
        if (k) { if (ev.m != null) k.ring.style.setProperty('--m', ev.m); k.el.classList.add('act'); setTimeout(() => k.el.classList.remove('act'), 150); }
        V.now.textContent = '노브 ' + (ev.knob + 1) + ' · ' + I().KNOBS[ev.knob][1] + (ev.m == null ? ' — 이 소리에는 없는 손잡이예요' : ' ' + Math.round(ev.m * 100) + '%');
      } else V.now.textContent = 'CC ' + ev.cc + ' = ' + ev.v + (ev.mapped ? ' (이은 손잡이)' : ' · 노브 알아보기를 하면 쓸 수 있어요');
      return;
    }
    case 'learn':
      showLearn(); showKnobs();
      if (ev.what === 'pad' && ev.done) V.now.textContent = ev.same ? '패드가 건반과 같은 ' + (ev.ch + 1) + '번 채널이에요. M-VAVE 편집 앱에서 패드 채널을 10번으로 바꿔 주세요.' : '패드는 ' + (ev.ch + 1) + '번 채널이에요.';
      return;
  }
}

U.midiPanel = open;
})(window.U = window.U || {});
