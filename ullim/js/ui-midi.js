/* 울림 — MIDI 장치 창: 연결한 건반(M-VAVE SMK-25 mini · Akai MPK mini MK3 같은)을 그림으로 두고, 누르고 돌리는 대로 보여 준다.
   건반은 누른 세기(키압)만큼 차오르고, 패드는 드럼 트랙으로, 노브 8개는 소리 다듬기 손잡이로 움직인다.
   터치 감도 · 패드 채널 알아보기 · 노브 알아보기 · 피치 벤드 범위 · 누르는 힘(애프터터치)을 여기서 정한다 */
(function (U) {
'use strict';
const { h, btn, info, clamp } = U;
const pr = () => U.project;
const I = () => U.input;
const BLACK = [1, 3, 6, 8, 10];
let dlg = null, off = null, V = null, devT = 0;
/* 건반 위에 적는 드럼 이름 (짧게) */
const DRUM_SHORT = { kick: '킥', akick: '킥', snare: '스네어', asnare: '스네어', clap: '클랩', snap: '스냅', arim: '림샷', rim: '림', astick: '스틱',
  chh: '햇', ahat: '햇', ohh: '오픈햇', aohat: '오픈햇', apedal: '페달햇', shaker: '셰이커', cow: '카우벨', abell: '벨', conga: '콩가', atamb: '탬버린',
  crash: '크래시', acrash: '크래시', ride: '라이드', aride: '라이드', sub: '808', zap: '잽', noise: '노이즈', brush: '브러시', swish: '스위시' };
function drumShort(pd) {
  if (!pd) return '';
  const n = pd.name || '';
  if (pd.type === 'tom' || pd.type === 'atom') return /floor/i.test(n) ? '플로어' : /low/i.test(n) ? '로우탐' : /mid/i.test(n) ? '미드탐' : /hi/i.test(n) ? '하이탐' : '탐';
  if (/crash 2/i.test(n)) return '크래시2';
  if (/cross stick/i.test(n)) return '스틱';
  if (pd.src === 'sample' && pd.sample) return n.slice(0, 5);
  return DRUM_SHORT[pd.type] || n.slice(0, 5);
}

function open() {
  if (dlg) return;
  const body = h('div', { class: 'mid' });
  dlg = U.dialog({ title: 'MIDI 장치', body, width: '780px', actions: [{ label: '닫기', primary: true }],
    onclose: () => { if (off) off(); off = null; dlg = null; V = null; if (I().learning()) I().stopLearn(); } });
  render(body);
  const offs = [U.on('midi', onEvent), U.on('select', relabel), U.on('change', relabel)];
  off = () => offs.forEach(f => f());
}
const trackName = ids => (ids && ids.length ? ids.map(id => U.trackLabel(pr(), U.trackById(pr(), id))).join(', ') : '없음');

function render(body) {
  U.clear(body);
  V = { body, keys: new Map(), base: 48, pads: [], knobs: [] };
  if (!I().supported()) {
    body.append(h('div', { class: 'mid-none' },
      h('p', { text: U.isIOS ? '아이패드·아이폰의 브라우저(사파리·크롬 모두)는 MIDI 장치를 쓰지 못하게 되어 있어요.' : '이 브라우저는 MIDI 장치를 지원하지 않아요.' }),
      h('p', { text: 'SMK-25 mini · MPK mini 같은 MIDI 건반은 컴퓨터(맥·윈도우)의 크롬이나 엣지에서 이 웹사이트를 열고 USB-C 선으로 꽂으면 바로 돼요.' + (U.isIOS ? ' 아이패드에서 꼭 써야 하면 Web MIDI를 지원하는 브라우저 앱(예: Web MIDI Browser)으로 이 주소를 열어 보세요.' : '') })));
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
    const pf = I().profileOf(d);
    const chip = h('span', { class: 'mid-dev' + (d.on ? ' on' : '') + (d.name === I().curDev() ? ' cur' : '') }, h('i'), h('b', { text: d.name }), pf ? h('em', { text: pf.name }) : null);
    info(chip, d.name, d.on ? '연결돼 있어요' + (d.maker ? ' (' + d.maker + ')' : '') + '. 건반 · 패드 · 노브를 쓰면 아래 그림이 따라 움직여요.' : '꺼져 있거나 빠졌어요.');
    row.append(chip);
  }
  row.append(btn({ text: '다시 찾기', cls: 'sm', onclick: async () => { await I().connectMidi(true); if (V) render(V.body); } }));
  // 아는 건반이면 무엇이 어디로 가는지 한 줄
  const cur = list.find(d => d.on && d.name === I().curDev()), pf = cur && I().profileOf(cur);
  V.hint = h('p', { class: 'hint mid-pf', text: pf ? pf.name + ': ' + pf.panel : '' });
  V.hint.hidden = !pf;
  return h('div', null, row, V.hint);
}

/* ---------- 건반 그림: 패드 8 · 노브 8 · 건반 25 ---------- */
function controller() {
  const pads = h('div', { class: 'mid-pads', role: 'group', 'aria-label': '패드' });
  for (let i = 0; i < 8; i++) V.pads.push(h('div', { class: 'mid-pad' }, h('span', { text: String(i + 1) })));
  // MPC처럼 패드 1~4가 아래 줄인 건반(MPK mini)은 그림도 그렇게
  const pf = I().profileOf({ name: I().curDev() });
  for (const i of pf && pf.pads === 'mpc' ? [4, 5, 6, 7, 0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7]) pads.append(V.pads[i]);
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
  labelKeys();
}
/* 건반이 드럼 · 루프 패드 트랙을 치면 건반마다 그 패드를 적는다 (킥 · 스네어 · 햇 … / 루프 패드는 번호) */
function labelKeys() {
  if (!V || !V.keysEl) return;
  const st = U.play.stripTarget(I().liveTargets());
  if (st) { labelChords(st); return; }
  const t = I().keysPad(), d = t && U.instrumentOf(t), pads = (d && d.data && d.data.pads) || [], drum = !!d && d.kind === 'drums';
  V.keysEl.classList.toggle('drum', !!t);
  for (const [p, k] of V.keys) {
    const old = k.querySelector('.mid-dk');
    if (old) old.remove();
    if (!t) continue;
    const i = I().keyPadNote(p) - 36, pd = pads[i];
    if (!pd) continue;
    k.prepend(h('em', { class: 'mid-dk', text: drum ? drumShort(pd) : String(i + 1) }));
  }
  const base = U.noteName(I().cfg.drumBase);
  info(V.keysEl, '건반', t ? '건반이 ' + (drum ? '드럼' : '루프 패드') + ' 트랙(' + U.trackLabel(pr(), t) + ')을 쳐요. 컴퓨터 키보드의 글자 키처럼 건반 하나가 패드 하나예요: ' + base + '부터 반음씩 패드 1~16' + (drum ? ' (킥 · 사이드 스틱 · 스네어 · 클랩 … 크래시 · 라이드)' : '') + ', 그 위 E~B는 패드 5~12를 한 번 더. 아래 \'드럼 건반\'에서 시작 C를 바꿔요.' : '누른 세기(키압)만큼 건반이 차올라요. 드럼 트랙을 고르면 건반으로 드럼을 쳐요.');
}
/* 연주 화면이 코드 줄이면 건반마다 그 코드 (위 옥타브는 ↑ 업 스트럼) */
function labelChords(st) {
  V.keysEl.classList.add('drum');
  for (const [p, k] of V.keys) {
    const old = k.querySelector('.mid-dk');
    if (old) old.remove();
    const ch = U.play.chordFor(((p % 12) + 12) % 12), up = I().isUpKey(p) && !st.bow;
    k.prepend(h('em', { class: 'mid-dk' + (ch.borrowed ? ' far' : ''), text: ch.name + (up ? '↑' : '') }));
  }
  const what = st.bow ? '누르고 있는 동안 현악 합주가 그 코드를 켜요' : st.fam === 'bass' ? '그 코드의 근음을 쳐요 (위 옥타브는 한 옥타브 위)' : '그 코드를 긁어요: 아래 옥타브는 다운, 위 옥타브(↑)는 업 스트럼';
  info(V.keysEl, '건반 → 코드 줄', '연주 화면의 코드 줄(' + U.trackLabel(pr(), st.t) + ')이 열려 있어서, 누른 건반의 음이 근음인 코드를 쳐요. ' + what + '. 흐린 이름은 키 밖의 빌린 화음이에요. 아래 \'드럼 · 코드 건반\'에서 시작 C를 바꿔요.');
}
const relabel = () => { if (V && V.keysEl) requestAnimationFrame(labelKeys); };
function nowLine() {
  const st = U.play.stripTarget(I().liveTargets());
  if (st) {
    V.now = h('div', { class: 'mid-now', text: '건반을 눌러 보세요. 코드 줄(' + U.trackLabel(pr(), st.t) + ')이 열려 있어서 누른 음이 근음인 코드를 ' + (st.bow ? '켜요.' : st.fam === 'bass' ? '근음으로 쳐요.' : '긁어요 (아래 옥타브 다운 · 위 옥타브 업).') });
    return V.now;
  }
  const t = I().keysPad();
  V.now = h('div', { class: 'mid-now', text: t ? '건반을 눌러 보세요. ' + U.trackLabel(pr(), t) + ' 트랙을 골라 두어서 건반 하나가 패드 하나예요 (' + U.noteName(I().cfg.drumBase) + ' = 패드 1).' : '건반을 눌러 보세요. 세게 누를수록 건반이 더 차올라요.' });
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
  const knobClear = btn({ text: '지우기', cls: 'sm ghost', info: ['지우기', '이 장치에서 알아본 노브를 지워요. 아는 건반(MPK mini MK3 등)이면 정해진 노브로 돌아가요.'], onclick: () => { I().clearKnobs(); showKnobs(); showLearn(); } });
  // 피치 벤드 · 누르는 힘
  const pb = U.seg([[2, '±2반음', '벤드를 끝까지 올리면 2반음(온음) 올라가요. 기타 초킹 정도예요.'], [12, '±1옥타브', '끝까지 올리면 한 옥타브 올라가요.']], M.pb, v => { M.pb = v; I().saveCfg(); });
  const at = U.seg([['vib', '비브라토', '건반을 누른 채 더 세게 누르면 떨림이 깊어져요.'], ['off', '쓰지 않기', '누르는 힘은 그림에만 보여요.']], M.at, v => { M.at = v; I().saveCfg(); });
  // 드럼 · 코드 건반: 패드 1(킥)과 다운 스트럼 옥타브가 시작하는 C
  const db = U.seg([
    [48, 'C2부터', '25건반(MPK mini · SMK-25)을 처음 옥타브 그대로 쓰면 맨 왼쪽 건반이 C2예요. 드럼은 거기서부터 킥 · 사이드 스틱 · 스네어 … 패드 1~16, 기타 코드 줄은 C2~B2가 다운 · C3~B3가 업 스트럼이에요.'],
    [36, 'C1부터 (GM)', '드럼 표준(GM) 자리예요. 49 · 61건반이나 옥타브를 한 칸 내린 25건반의 맨 왼쪽이 C1이에요. 코드 줄은 C1~B1이 다운 · C2~B2가 업.']], M.drumBase, v => { M.drumBase = v; I().saveCfg(); labelKeys(); });
  const box = h('div', { class: 'mid-set' },
    row('터치 감도', '건반을 누르는 세기(키압)가 소리 크기로 바뀌는 정도예요. 장치 쪽 감도와 함께 써요.', curve, curveBox, fixedBox),
    row('패드', '장치의 패드를 드럼 트랙으로 보내요.', V.padLbl, padLearn),
    row('노브 8개', '노브 1~8은 건반이 치는 트랙의 밝기 · 길이 · 두께 · 드라이브 · 공간 · 세기 반응 · 음량 · 트랙 볼륨이에요.', V.learnLbl, knobLearn, V.knobStop, knobClear),
    row('드럼 · 코드 건반', '드럼 · 루프 패드 트랙을 고르면 건반이 컴퓨터 키보드의 글자 키처럼 패드를 치고, 연주 화면에 기타 코드 줄을 열면 코드를 긁어요. 패드 1(킥)과 다운 스트럼 옥타브가 시작하는 C를 골라요.', db),
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
  const ks = I().knobs(), n = ks.filter(Boolean).length, pre = ks.some(k => k && k.src);
  V.learnLbl.textContent = L && L.what === 'knob' ? '노브 ' + (L.i + 1) + '(' + I().KNOBS[L.i][1] + ')을 오른쪽으로 조금 돌려 주세요…' : n ? n + '개 이었어요' + (pre ? ' (이 건반에 맞춰 두었어요)' : '') + ' → ' + trackName(I().liveTargets()) : '아직 몰라요. 알아보기를 눌러 주세요.';
  V.learnLbl.classList.toggle('wait', !!(L && L.what === 'knob'));
  V.knobStop.hidden = !(L && L.what === 'knob');
}
/* 노브마다 이은 CC와 지금 값 */
function showKnobs() {
  if (!V) return;
  const L = I().learning(), ks = I().knobs(), t = I().knobTrack();
  V.knobs.forEach((k, i) => {
    const kk = ks[i];
    k.cc.textContent = kk ? 'CC ' + kk.cc + (kk.mode === 'rel2' || kk.mode === 'rel64' ? ' ↻' : '') : '—';
    const m = kk ? I().knobGet(t, k.id) : null;
    k.ring.style.setProperty('--m', m == null ? 0 : m);
    k.el.classList.toggle('none', m == null);
    k.el.classList.toggle('learn', !!(L && L.what === 'knob' && L.i === i));
    const how = !kk ? '' : kk.mode === 'abs' ? ' (보통 노브)' : kk.mode === 'auto' ? ' (돌리면 방식을 알아내요)' : ' (끝없이 도는 노브: 돌린 만큼 바뀌어요)';
    info(k.el, '노브 ' + (i + 1) + ' · ' + I().KNOBS[i][1], (kk ? 'CC ' + kk.cc + how + '. ' : '아직 이어지지 않았어요. ') + (m == null && kk ? '이 소리에는 없는 손잡이예요.' : '건반이 치는 트랙의 ' + I().KNOBS[i][1] + '을(를) 바꿔요.'));
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
    case 'dev':   // 다른 건반을 쓰기 시작했다 (그 건반의 노브로). 두 건반을 함께 치면 번갈아 오므라 잠깐 뒤에 한 번
      clearTimeout(devT);
      devT = setTimeout(() => { if (V) render(V.body); }, 150);
      return;
    case 'note': {
      const k = keyEl(ev.p);
      if (k) { k.style.setProperty('--v', ev.vel / 127); k.classList.add('on'); }
      V.vel.querySelector('b').textContent = ev.v + (ev.vel !== ev.v ? ' → ' + ev.vel : '');
      V.vel.style.setProperty('--v', ev.vel / 127);
      V.now.textContent = U.noteName(ev.p) + (ev.chord ? ' → ' + ev.chord.name + ({ strum: ev.chord.up ? ' ↑ 업' : ' ↓ 다운', bass: ev.chord.up ? ' 옥타브' : ' 근음', bow: '' }[ev.chord.kind] || '') : ev.drum ? ' → ' + ev.drum.name : '') + ' · 세기 ' + ev.v + (ev.vel !== ev.v ? ' → ' + ev.vel : '') + ' · ' + trackName(ev.ids) + (ev.ch ? ' · ' + (ev.ch + 1) + '번 채널' : '');
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
      // B 뱅크(44~51)는 드럼 패드 9~16: 뱅크를 바꿔 치면 칸 번호도 모두 바꿔 보여 준다
      const bank = ev.p >= 44 && ev.p < 52 ? 1 : 0;
      if (bank !== (V.bank || 0)) { V.bank = bank; V.pads.forEach((c, i) => { c.firstChild.textContent = String(bank * 8 + i + 1); }); }
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
