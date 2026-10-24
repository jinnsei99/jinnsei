/* 울림 — 장치 뷰: 트랙의 장치 체인, 노브, 그래프(엔벌로프·필터·EQ·압축·스펙트럼), 드럼 패드, 루프 패드, 샘플러 파형 */
(function (U) {
'use strict';
const { h, ui, info, clamp, icon, btn } = U;
const A = U.act;
const pr = () => U.project;
let root = null, chainEl = null, panels = [];
const visuals = new Set();

/* ================= 트랙 소리 고르기 =================
   모든 사운드 프리셋 중에서 이 트랙의 악기 소리를 바꾼다. ◀ ▶로 하나씩 넘기며 들어 본다 */
const NOT_PICKABLE = new Set(['빈 샘플러']);
/* 소리 고르기 창과 ◀ ▶가 쓰는 순서: 묶음 순서대로 펼친 목록 */
const pickGroups = () => U.soundGroups(U.allSounds().filter(s => !NOT_PICKABLE.has(s.name)));
const isCurSound = (d, s) => !!d && d.kind === s.kind && d.preset === s.name;
function demoPitch(s) {
  if (s.kind === 'acoustic' || s.kind === 'ensemble') return U.instDemo(s.kind, s.p && s.p.inst);
  return s.tags.includes('베이스') ? 40 : 60;
}
/* 고른 소리를 바로 한 음 들려준다 (미리 듣기라 녹음에는 남지 않는다) */
function audition(t, p) {
  U.ensureAudio();
  const e = U.engine;
  e.liveOn(t.id, p, 100, true);
  setTimeout(() => e.liveOff(t.id, p), 650);
}
function chooseSound(t, s) {
  A.loadSound(t.id, s);
  audition(t, demoPitch(s));
}
/* 묶음별 버튼 창. 누르면 바로 바꾸고 한 음 들려준다. 닫을 때까지 열려 있어 여러 소리를 이어서 들어 볼 수 있다 */
function soundPanel(t) {
  const body = h('div', { class: 'snd-panel' });
  let btns = [];
  const mark = () => {
    const tr = U.trackById(pr(), t.id), d = tr && U.instrumentOf(tr);
    for (const [b, s] of btns) b.setAttribute('aria-pressed', isCurSound(d, s) ? 'true' : 'false');
  };
  // 내 사운드를 저장하거나 이름을 바꾸면 다시 채운다.
  // 묶음은 이름을 눌러 열고 닫는다: 처음엔 지금 소리가 든 묶음과 내 사운드만 펼치고, 누른 대로 기억한다
  const fill = () => {
    U.clear(body);
    btns = [];
    const tr = U.trackById(pr(), t.id), cur = tr && U.instrumentOf(tr);
    const SF = Object.assign({}, U.pref('sndFold', {}));
    const rows = [];
    const setShut = (r, shut, save) => {
      r.row.classList.toggle('shut', shut);
      r.lab.setAttribute('aria-expanded', String(!shut));
      if (save) { SF[r.g] = shut; U.setPref('sndFold', Object.assign({}, SF)); }
    };
    const save = btn({ icon: 'plus', text: '지금 소리를 내 사운드로 저장', cls: 'sm', onclick: () => U.saveMySound(U.trackById(pr(), t.id) || t) });
    const openAll = btn({ text: '모두 펴기', cls: 'ghost sm', info: ['모두 펴기', '모든 묶음을 펼쳐요.'], onclick: () => rows.forEach(r => setShut(r, false, true)) });
    const shutAll = btn({ text: '모두 접기', cls: 'ghost sm', info: ['모두 접기', '모든 묶음을 접어서 묶음 이름만 보여요.'], onclick: () => rows.forEach(r => setShut(r, true, true)) });
    body.append(h('div', { class: 'snd-top' }, save, openAll, shutAll, h('span', { class: 'hint', text: U.mySounds.list().length ? '내 사운드는 길게 누르거나 오른쪽 클릭으로 이름을 바꾸고 지워요.' : '악기를 다듬은 뒤 저장하면 맨 위 \'내 사운드\'에 모여요.' })));
    for (const [g, list] of pickGroups()) {
      const bs = h('div', { class: 'insts-bs' });
      for (const s of list) {
        const b = h('button', { type: 'button', class: 'inst-b' + (s.user ? ' mine' : ''), text: s.name, title: U.DEV[s.kind].name });
        b.addEventListener('click', () => { chooseSound(t, s); mark(); });
        if (s.user) b.addEventListener('contextmenu', e => { e.preventDefault(); U.mySoundMenu(s, { x: e.clientX, y: e.clientY }); });
        btns.push([b, s]);
        bs.append(b);
      }
      const lab = h('button', { type: 'button', class: 'insts-g fold', dataset: { n: list.length }, text: g });
      const r = { g, lab, row: h('div', { class: 'insts-row' }, lab, bs) };
      info(lab, g + ' · ' + list.length + '개', '눌러서 열고 닫아요. Alt를 누른 채 누르면 모든 묶음을 한꺼번에 열고 닫아요.');
      lab.addEventListener('click', e => { const shut = !r.row.classList.contains('shut'); for (const x of e.altKey ? rows : [r]) setShut(x, shut, true); });
      setShut(r, list.some(s => isCurSound(cur, s)) ? false : SF[g] != null ? SF[g] : g !== '내 사운드', false);
      rows.push(r);
      body.append(r.row);
    }
    mark();
  };
  fill();
  const off = U.on('sounds', fill);
  const dlg = U.dialog({ title: '소리 고르기 · ' + U.trackLabel(pr(), t), body, width: '760px', onclose: off });
  const on = btns.find(([b]) => b.getAttribute('aria-pressed') === 'true');
  if (on) on[0].scrollIntoView({ block: 'nearest' });
  return dlg;
}
function soundPicker(t) {
  const d = U.instrumentOf(t);
  const b = btn({ text: (d ? d.preset || U.devName(d) : '악기 없음') + ' ▾', cls: 'sm snd-pick', title: '소리 고르기', info: ['소리 고르기', '이 트랙의 악기 소리를 바꿔요. 창에서 누를 때마다 바뀌고 한 음 들려줘요. ◀ ▶로 하나씩 넘길 수도 있어요. 되돌리기로 돌아가요.'], onclick: () => soundPanel(t) });
  const step = k => {
    const list = pickGroups().flatMap(([, l]) => l);
    const tr = U.trackById(pr(), t.id), cur = tr && U.instrumentOf(tr);
    let i = list.findIndex(s => isCurSound(cur, s));
    if (i < 0 && cur) i = list.findIndex(s => s.name === cur.preset);
    chooseSound(t, list[i < 0 ? (k > 0 ? 0 : list.length - 1) : (i + k + list.length) % list.length]);
  };
  const prev = btn({ text: '◀', cls: 'sm snd-step', title: '앞 소리', onclick: () => step(-1) });
  const next = btn({ text: '▶', cls: 'sm snd-step', title: '다음 소리', onclick: () => step(1) });
  return [b, prev, next];
}
U.soundPicker = soundPicker;
U.soundPanel = soundPanel;

function render(el) {
  root = el;
  U.clear(root);
  panels = [];
  visuals.clear();
  const t = U.selTrack();
  if (!t) return;
  chainEl = h('div', { class: 'chain' });
  const head = h('div', { class: 'chain-title' }, h('span', { class: 'ct-sw', style: { background: U.colorOf(t.color) } }), h('span', { text: U.trackLabel(pr(), t) }));
  root.append(head, chainEl);
  root.addEventListener('pointerdown', () => { ui.focus = 'devices'; });
  // 악기가 있는 트랙은 맨 앞에 '소리 다듬기' 칸
  // (A에서 오른쪽 '고른 트랙' 칸이 열려 있으면 그 칸에 있으니 여기서는 뺀다)
  if (t.type === 'midi' && U.instrumentOf(t) && !U.inspShown()) chainEl.append(U.shapePanel(t));
  t.devices.forEach((d, i) => {
    chainEl.append(dropGap(t, i));
    chainEl.append(panel(t, d));
  });
  chainEl.append(dropGap(t, t.devices.length, true));
  if (!t.devices.length || (t.type === 'midi' && !U.instrumentOf(t))) {
    chainEl.append(h('div', { class: 'chain-hint' },
      h('p', { text: t.type === 'midi' ? '악기가 없어서 소리가 나지 않아요.' : '장치가 없어요.' }),
      h('p', { class: 'muted', text: '브라우저에서 악기·사운드·이펙트를 끌어다 여기에 놓거나 두 번 누르세요.' })));
  }
}
function dropGap(t, i, last) {
  const el = h('div', { class: 'drop-gap' + (last ? ' last' : '') });
  U.dropTarget(el, {
    accept: d => ['device', 'sound', 'kit', 'loopkit', 'devmove'].includes(d.type),
    drop: d => {
      if (d.type === 'devmove') A.moveDevice(d.track, d.id, i, t.id);
      else if (d.type === 'sound') A.loadSound(t.id, d.item);
      else if (d.type === 'kit') A.loadKit(t.id, d.item);
      else if (d.type === 'loopkit') A.loadLoopKit(t.id, d.item);
      else A.addDevice(t.id, d.kind, { at: i, preset: d.preset, presetName: d.presetName });
    }
  });
  return el;
}

/* ================= 장치 패널 ================= */
function panel(t, d) {
  const spec = U.DEV[d.kind];
  const el = h('div', { class: 'dev dev-' + d.kind + (d.on ? '' : ' off') + ' t-' + spec.type });
  const act = h('button', { class: 'dev-act', type: 'button', 'aria-pressed': d.on ? 'true' : 'false', 'aria-label': '장치 켜기/끄기' });
  info(act, '장치 켜기/끄기', '끄면 이 장치를 건너뛰어요.');
  act.addEventListener('click', () => A.toggleDevice(d.id));
  const title = h('div', { class: 'dev-name' }, h('span', { class: 'dn', text: U.devName(d) }), d.preset ? h('span', { class: 'dp', text: d.preset }) : null);
  info(title, U.devName(d), spec.info + ' 제목을 끌어 순서를 바꿔요.');
  title.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    U.dragStart(e, { type: 'devmove', track: t.id, id: d.id, kind: d.kind }, U.devName(d));
  });
  const presets = U.FX_PRESETS[d.kind] || (spec.type === 'instrument' ? U.allSounds().filter(s => s.kind === d.kind).map(s => [s.name, s.p]) : []);
  const menuB = btn({ icon: 'chevron', cls: 'ghost sm', title: '프리셋과 메뉴', onclick: () => {
    const items = [];
    if (presets.length) items.push({ header: '프리셋' }, ...presets.map(([name, p]) => ({ label: name, checked: d.preset === name, action: () => A.applyPreset(d.id, name, p) })), { sep: true });
    items.push({ label: '기본값으로', action: () => A.applyPreset(d.id, null, {}) });
    if (spec.type === 'instrument') items.push({ label: '내 사운드로 저장…', action: () => U.saveMySound(t) });
    items.push({ label: '복제', action: () => { const n = U.cloneDevice(d); const i = t.devices.indexOf(d); t.devices.splice(i + 1, 0, n); U.commit('장치 복제'); }, disabled: spec.type === 'instrument' });
    items.push({ sep: true }, { label: '지우기', danger: true, key: 'Del', action: () => A.removeDevice(t.id, d.id) });
    U.menu(items, menuB);
  } });
  const close = btn({ icon: 'close', cls: 'ghost sm', title: '장치 지우기', onclick: () => A.removeDevice(t.id, d.id) });
  const head = h('div', { class: 'dev-head' }, act, title, menuB, close);
  const body = h('div', { class: 'dev-body' });
  el.append(head, body);
  el.addEventListener('pointerdown', () => { ui.selDevice = d.id; });
  const ctls = [];
  const get = id => {
    const a = U.engine && U.engine.autoNow(t.id, 'dev:' + d.id + ':' + id);
    return a != null ? U.fromNorm(spec.byId[id], a) : d.p[id];
  };
  const mk = id => {
    const s = spec.byId[id];
    if (!s) return null;
    const c = U.control({ spec: s, get: () => get(id), set: (v, f) => { A.setParam(d.id, id, v, f); if (f) refreshVis(); else liveVis(); }, auto: () => !!t.auto['dev:' + d.id + ':' + id], prefix: U.devName(d), map: { k: 'dev', d: d.id, p: id } });
    c.dataset.pid = id;
    ctls.push(c);
    return c;
  };
  for (const sec of spec.layout) {
    const box = h('div', { class: 'dev-sec' + (sec.visual ? ' vis-' + sec.visual.split(':')[0] : '') });
    if (sec.title) box.append(h('div', { class: 'ds-title', text: sec.title }));
    if (sec.visual) {
      const v = visual(sec.visual, t, d, () => ctls);
      if (v) box.append(v.el);
    }
    if (sec.params) {
      const grid = h('div', { class: 'ds-grid' });
      for (const id of sec.params) {
        const s = spec.byId[id];
        if (!s || !U.visible(s, d.p)) continue;
        const c = mk(id);
        if (c) grid.append(c);
      }
      if (grid.childNodes.length) box.append(grid);
    }
    body.append(box);
  }
  function liveVis() { for (const v of visuals) if (v.dev === d && v.draw) v.draw(); }
  function refreshVis() {
    // 보이는 파라미터가 바뀔 수 있다 (Sync 켜기 등)
    const need = spec.params.some(s => s.show);
    if (need) U.inval('detail');
    liveVis();
  }
  el.update = () => { for (const c of ctls) c.update(); };
  panels.push({ el, t, d, ctls });
  return el;
}

/* ================= 그래프 ================= */
function visual(kind, t, d, getCtls) {
  const [name, arg] = kind.split(':');
  const fn = VIS[name];
  if (!fn) return null;
  const v = fn(t, d, arg, getCtls);
  v.dev = d;
  visuals.add(v);
  return v;
}
function canvasBox(w, hh, cls) {
  const cv = h('canvas', { class: 'vis ' + (cls || ''), style: { width: w + 'px', height: hh + 'px' } });
  return cv;
}
const VIS = {
  /* 악기 안에서 종류 고르기 (Acoustic · Ensemble): 누르면 바꾸고 한 음 들려준다 */
  insts(t, d) {
    const spec = U.DEV[d.kind];
    const el = h('div', { class: 'insts', role: 'group', 'aria-label': '악기 종류' });
    const btns = [];
    let grp = null, row = null;
    for (const [id, label, g] of spec.types) {
      if (g !== grp) { grp = g; row = h('div', { class: 'insts-bs' }); el.append(h('div', { class: 'insts-row' }, h('span', { class: 'insts-g', text: g }), row)); }
      const b = h('button', { type: 'button', class: 'inst-b', text: label, 'aria-pressed': d.p.inst === id ? 'true' : 'false' });
      info(b, label, '눌러서 이 악기로 바꾸고 한 음 들어 봐요.');
      b.addEventListener('click', () => {
        if (d.p.inst !== id) { d.preset = label; A.setParam(d.id, 'inst', id, true); }
        audition(t, U.instDemo(d.kind, id));
      });
      btns.push([b, id]);
      row.append(b);
    }
    return { el, draw: () => { for (const [b, id] of btns) b.setAttribute('aria-pressed', d.p.inst === id ? 'true' : 'false'); } };
  },
  adsr(t, d, pre) {
    pre = pre || '';
    const cv = canvasBox(150, 58);
    info(cv, '엔벌로프', '어택·디케이·서스테인·릴리스로 소리가 시간에 따라 어떻게 커지고 줄어드는지 보여 줘요. 점을 끌어 바꿀 수 있어요.');
    const ids = pre === 'f' ? ['fa', 'fd', 'fs', 'fr'] : ['a', 'd', 's', 'r'];
    const P = () => d.p;
    const geom = () => {
      const W = 150, H = 58, pad = 5;
      const a = P()[ids[0]], dc = P()[ids[1]], s = P()[ids[2]], r = P()[ids[3]];
      const tot = Math.max(0.3, a + dc + r + 0.25 * (a + dc + r) + 0.2);
      const sx = (W - pad * 2) / tot;
      const x1 = pad + a * sx, x2 = x1 + dc * sx, x3 = x2 + Math.max(0.15 * tot, 0.15) * sx, x4 = Math.min(W - pad, x3 + r * sx);
      const yT = pad, yB = H - pad, yS = yB - (yB - yT) * s;
      return { W, H, pad, x1, x2, x3, x4, yT, yB, yS, sx };
    };
    const draw = () => {
      const c = U.colors();
      const g = U.fitCanvas(cv, 150, 58);
      const q = geom();
      g.fillStyle = c.sunk; g.fillRect(0, 0, q.W, q.H);
      g.strokeStyle = c.accent; g.fillStyle = U.alpha('#ffb547', 0.12);
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(q.pad, q.yB); g.lineTo(q.x1, q.yT); g.lineTo(q.x2, q.yS); g.lineTo(q.x3, q.yS); g.lineTo(q.x4, q.yB); g.stroke();
      g.fillStyle = c.fg;
      for (const [x, y] of [[q.x1, q.yT], [q.x2, q.yS], [q.x4, q.yB]]) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); }
    };
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect();
      const q = geom();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const pts = [['a', q.x1, q.yT], ['d', q.x2, q.yS], ['r', q.x4, q.yB]];
      let best = null, bd = 14;
      for (const p of pts) { const dd = Math.hypot(p[1] - x, p[2] - y); if (dd < bd) { bd = dd; best = p[0]; } }
      if (!best) return;
      cv.setPointerCapture(e.pointerId);
      const spec = U.DEV[d.kind];
      const x0 = e.clientX, y0 = e.clientY;
      const st = { a: d.p[ids[0]], d: d.p[ids[1]], s: d.p[ids[2]], r: d.p[ids[3]] };
      const move = ev => {
        const dx = (ev.clientX - x0) / q.sx, dy = (ev.clientY - y0) / (q.yB - q.yT);
        if (best === 'a') A.setParam(d.id, ids[0], clamp(st.a + dx, spec.byId[ids[0]].min, 10), false);
        if (best === 'd') { A.setParam(d.id, ids[1], clamp(st.d + dx, 0.001, 10), false); A.setParam(d.id, ids[2], clamp(st.s - dy, 0, 1), false); }
        if (best === 'r') A.setParam(d.id, ids[3], clamp(st.r + dx, 0.001, 10), false);
        draw();
        for (const p of panels) if (p.d === d) p.el.update();
      };
      const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); U.commit('엔벌로프'); };
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up);
    });
    draw();
    return { el: cv, draw };
  },
  filter(t, d) {
    const cv = canvasBox(150, 58);
    info(cv, '필터 모양', '어떤 주파수가 남고 깎이는지 보여 줘요.');
    const draw = () => {
      const c = U.colors();
      const g = U.fitCanvas(cv, 150, 58);
      g.fillStyle = c.sunk; g.fillRect(0, 0, 150, 58);
      const node = U.engine && U.engine.nodes.get(t.id);
      const inst = node && node.devs.get(d.id);
      const n = 150;
      const freqs = new Float32Array(n);
      for (let i = 0; i < n; i++) freqs[i] = 20 * Math.pow(1000, i / (n - 1));
      let resp = null;
      if (inst && inst.response) resp = inst.response(freqs);
      else resp = analogResp(d, freqs);
      if (d.kind === 'sampler' && !d.p.fon) resp = freqs.map(() => 0);
      g.strokeStyle = c.accent; g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const y = 29 - clamp(resp[i], -30, 24) * 0.9;
        if (i === 0) g.moveTo(i, y); else g.lineTo(i, y);
      }
      g.stroke();
      g.fillStyle = c.grid2; g.fillRect(0, 29, 150, 1);
    };
    draw();
    return { el: cv, draw };
  },
  eq(t, d) { return eqVisual(t, d); },
  comp(t, d) {
    const wrap = h('div', { class: 'comp-vis' });
    const cv = canvasBox(90, 90);
    const gr = h('div', { class: 'gr' }, h('div', { class: 'gr-bar' }));
    info(wrap, '압축 그래프', '가로는 들어온 크기, 세로는 나가는 크기예요. 오른쪽 막대는 지금 눌리는 양(게인 리덕션)이에요.');
    wrap.append(cv, gr);
    const draw = () => {
      const c = U.colors();
      const g = U.fitCanvas(cv, 90, 90);
      g.fillStyle = c.sunk; g.fillRect(0, 0, 90, 90);
      g.strokeStyle = c.grid2; g.beginPath(); g.moveTo(0, 90); g.lineTo(90, 0); g.stroke();
      const thr = d.kind === 'limiter' ? d.p.ceil : d.p.thr, ratio = d.kind === 'limiter' ? 20 : d.p.ratio, knee = d.kind === 'limiter' ? 0 : d.p.knee;
      g.strokeStyle = c.accent; g.lineWidth = 1.6; g.beginPath();
      for (let i = 0; i <= 90; i++) {
        const inDb = -60 + i / 90 * 60;
        let out;
        if (inDb < thr - knee / 2) out = inDb;
        else if (inDb > thr + knee / 2) out = thr + (inDb - thr) / ratio;
        else { const x = inDb - thr + knee / 2; out = inDb + (1 / ratio - 1) * x * x / (2 * Math.max(0.01, knee)); }
        const y = 90 - (out + 60) / 60 * 90;
        if (i === 0) g.moveTo(i, y); else g.lineTo(i, y);
      }
      g.stroke();
    };
    const frame = () => {
      const node = U.engine && U.engine.nodes.get(t.id);
      const inst = node && node.devs.get(d.id);
      const red = inst && inst.reduction ? -inst.reduction() : 0;
      gr.firstChild.style.height = clamp(red / 24 * 100, 0, 100) + '%';
    };
    draw();
    return { el: wrap, draw, frame };
  },
  curve(t, d) {
    const cv = canvasBox(90, 70);
    info(cv, '일그러짐 곡선', '들어온 소리(가로)가 어떤 모양으로 나가는지(세로) 보여 줘요.');
    const draw = () => {
      const c = U.colors();
      const g = U.fitCanvas(cv, 90, 70);
      g.fillStyle = c.sunk; g.fillRect(0, 0, 90, 70);
      const cur = U.satCurve(d.p.type, d.p.drive, d.p.bits);
      g.strokeStyle = c.accent; g.lineWidth = 1.5; g.beginPath();
      for (let i = 0; i < 90; i++) { const v = cur[Math.floor(i / 89 * (cur.length - 1))]; const y = 35 - v * 31; if (i === 0) g.moveTo(i, y); else g.lineTo(i, y); }
      g.stroke();
    };
    draw();
    return { el: cv, draw };
  },
  duck(t, d) {
    const cv = canvasBox(120, 58);
    info(cv, '덕킹 모양', '한 박 안에서 음량이 눌렸다가 돌아오는 모양이에요.');
    const draw = () => {
      const c = U.colors();
      const g = U.fitCanvas(cv, 120, 58);
      g.fillStyle = c.sunk; g.fillRect(0, 0, 120, 58);
      const P = d.p, bpm = pr().bpm;
      const step = U.divBeats(P.div) * 60 / bpm;
      g.strokeStyle = c.accent; g.lineWidth = 1.5; g.beginPath();
      for (let x = 0; x < 120; x++) {
        const tt = (x / 120 * step * 2) % step;
        const v = tt < 0.004 + P.hold ? 1 - P.depth : 1 - P.depth * Math.exp(-(tt - 0.004 - P.hold) / (P.rel / 3));
        const y = 54 - v * 48;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    };
    draw();
    return { el: cv, draw };
  },
  algo(t, d) {
    const el = h('div', { class: 'algo-vis' });
    const draw = () => {
      el.textContent = '';
      el.append(h('span', { class: 'algo-t', text: d.p.algo === 'stack' ? 'B → A → C' : d.p.algo === 'dual' ? 'A → C  +  B' : 'A + B → C' }));
    };
    draw();
    info(el, '연결 방식', 'C(캐리어)가 실제로 들리는 소리이고, A·B가 C의 음색을 바꿔요.');
    return { el, draw };
  },
  spectrum(t, d) {
    const cv = canvasBox(300, 120);
    info(cv, '스펙트럼', '가로는 주파수(20 Hz ~ 20 kHz), 세로는 크기예요.');
    const buf = new Float32Array(2048);
    const frame = () => {
      const node = U.engine && U.engine.nodes.get(t.id);
      const inst = node && node.devs.get(d.id);
      if (!inst || !inst.an) return;
      const c = U.colors();
      const g = U.fitCanvas(cv, 300, 120);
      g.fillStyle = c.sunk; g.fillRect(0, 0, 300, 120);
      drawSpectrum(g, inst.an, buf, 300, 120, c);
    };
    return { el: cv, frame, draw: frame };
  },
  pads(t, d) { return padsVisual(t, d); },
  looppads(t, d) { return U.padsUI.compact(t, d); },
  sample(t, d) { return sampleVisual(t, d); }
};
function analogResp(d, freqs) {
  const fc = d.p.cut || 1000, res = d.p.res || 0, type = d.p.ft || 'lp12';
  return Array.from(freqs, f => {
    const x = f / fc;
    const q = 0.7 + res * 6;
    let m;
    if (type === 'hp12') m = (x * x) / Math.sqrt((1 - x * x) ** 2 + (x / q) ** 2);
    else if (type === 'bp') m = (x / q) / Math.sqrt((1 - x * x) ** 2 + (x / q) ** 2);
    else m = 1 / Math.sqrt((1 - x * x) ** 2 + (x / q) ** 2);
    if (type === 'lp24') m = m / Math.sqrt(1 + x ** 4);
    return 20 * Math.log10(Math.max(1e-5, m));
  });
}
function drawSpectrum(g, an, buf, W, H, c) {
  if (buf.length !== an.frequencyBinCount) buf = new Float32Array(an.frequencyBinCount);
  an.getFloatFrequencyData(buf);
  const sr = an.context.sampleRate, n = buf.length;
  g.fillStyle = U.alpha('#ffb547', 0.18);
  g.strokeStyle = c.accent;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x < W; x++) {
    const f = 20 * Math.pow(1000, x / W);
    const i = Math.min(n - 1, Math.round(f / (sr / 2) * n));
    const db = buf[i];
    const y = H - clamp((db + 100) / 90, 0, 1) * H;
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  g.stroke();
}

/* ---------- EQ ---------- */
function eqVisual(t, d) {
  const W = 330, H = 140;
  const wrap = h('div', { class: 'eq-wrap' });
  const cv = canvasBox(W, H, 'eq-cv');
  info(cv, 'EQ 그래프', '점을 끌어 주파수(가로)와 크기(세로)를 바꾸고, 휠로 폭(Q)을 바꿔요. 점을 두 번 누르면 그 밴드를 켜고 꺼요.');
  const ctlRow = h('div', { class: 'eq-ctl' });
  wrap.append(cv, ctlRow);
  const spec = U.DEV.eq;
  if (!d.data) d.data = { sel: 3 };
  const fx = f => Math.log(f / 20) / Math.log(1000) * W;
  const fOf = x => 20 * Math.pow(1000, x / W);
  const yOf = db => H / 2 - db / 20 * (H / 2 - 8);
  const dbOf = y => (H / 2 - y) / (H / 2 - 8) * 20;
  const buf = new Float32Array(4096);
  const node = () => { const n = U.engine && U.engine.nodes.get(t.id); return n && n.devs.get(d.id); };
  const freqs = new Float32Array(W);
  for (let i = 0; i < W; i++) freqs[i] = fOf(i);
  const draw = () => {
    const c = U.colors();
    const g = U.fitCanvas(cv, W, H);
    g.fillStyle = c.sunk; g.fillRect(0, 0, W, H);
    g.fillStyle = c.grid;
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) g.fillRect(Math.round(fx(f)), 0, 1, H);
    for (const db of [-12, -6, 6, 12]) g.fillRect(0, Math.round(yOf(db)), W, 1);
    g.fillStyle = c.grid2; g.fillRect(0, Math.round(yOf(0)), W, 1);
    g.fillStyle = c.fg3; g.font = '9px ' + c.mono;
    for (const [f, l] of [[100, '100'], [1000, '1k'], [10000, '10k']]) g.fillText(l, fx(f) + 2, H - 3);
    const inst = node();
    if (inst && inst.an && U.engine.playing) drawSpectrum(g, inst.an, buf, W, H, Object.assign({}, c, { accent: c.fg3 }));
    if (!inst) return;
    const resp = inst.response(freqs);
    g.strokeStyle = c.accent; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < W; i++) { const y = yOf(clamp(resp[i], -24, 24)); if (i === 0) g.moveTo(i, y); else g.lineTo(i, y); }
    g.stroke();
    for (let b = 1; b <= 6; b++) {
      const on = d.p['b' + b + 'on'];
      const type = d.p['b' + b + 't'];
      const x = fx(d.p['b' + b + 'f']);
      const y = type === 'hp' || type === 'lp' || type === 'notch' ? yOf(0) : yOf(d.p['b' + b + 'g']);
      const sel = d.data.sel === b;
      g.beginPath(); g.arc(x, y, sel ? 7 : 6, 0, Math.PI * 2);
      g.fillStyle = on ? (sel ? c.accent : c.fg2) : c.panel3;
      g.fill();
      g.fillStyle = on ? '#16171a' : c.fg3;
      g.font = '600 9px ' + c.mono;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(b), x, y + 0.5);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }
  };
  const ctls = () => {
    U.clear(ctlRow);
    const b = d.data.sel;
    const bands = h('div', { class: 'eq-bands' });
    for (let i = 1; i <= 6; i++) {
      const bb = h('button', { type: 'button', class: 'eq-b' + (i === b ? ' sel' : '') + (d.p['b' + i + 'on'] ? ' on' : ''), text: String(i) });
      bb.addEventListener('click', () => { d.data.sel = i; ctls(); draw(); });
      bands.append(bb);
    }
    ctlRow.append(bands);
    for (const k of ['on', 't', 'f', 'g', 'q']) {
      const id = 'b' + b + k;
      const s = spec.byId[id];
      const c = U.control({ spec: s, label: { on: 'On', t: 'Type', f: 'Freq', g: 'Gain', q: 'Q' }[k], get: () => d.p[id], set: (v, f) => { A.setParam(d.id, id, v, f); draw(); if (k === 't' || k === 'on') ctls(); } });
      ctlRow.append(c);
    }
    ctlRow.append(U.control({ spec: spec.byId.gain, label: 'Output', get: () => d.p.gain, set: (v, f) => { A.setParam(d.id, 'gain', v, f); draw(); } }));
  };
  const hitBand = (x, y) => {
    let best = null, bd = 12;
    for (let b = 1; b <= 6; b++) {
      const type = d.p['b' + b + 't'];
      const bx = fx(d.p['b' + b + 'f']);
      const by = type === 'hp' || type === 'lp' || type === 'notch' ? yOf(0) : yOf(d.p['b' + b + 'g']);
      const dd = Math.hypot(bx - x, by - y);
      if (dd < bd) { bd = dd; best = b; }
    }
    return best;
  };
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const b = hitBand(e.clientX - r.left, e.clientY - r.top);
    if (!b) return;
    d.data.sel = b;
    if (e.detail === 2) { A.setParam(d.id, 'b' + b + 'on', !d.p['b' + b + 'on'], true); ctls(); draw(); return; }
    if (!d.p['b' + b + 'on']) A.setParam(d.id, 'b' + b + 'on', true, false);
    ctls();
    cv.setPointerCapture(e.pointerId);
    const move = ev => {
      const x = clamp(ev.clientX - r.left, 0, W), y = clamp(ev.clientY - r.top, 0, H);
      A.setParam(d.id, 'b' + b + 'f', U.round(clamp(fOf(x), 20, 20000), 1), false);
      const type = d.p['b' + b + 't'];
      if (type !== 'hp' && type !== 'lp' && type !== 'notch') A.setParam(d.id, 'b' + b + 'g', U.round(clamp(dbOf(y), -18, 18), 1), false);
      draw();
      for (const c of ctlRow.querySelectorAll('.knob')) c.update && c.update();
    };
    const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); U.commit('EQ'); };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
  });
  cv.addEventListener('wheel', e => {
    const r = cv.getBoundingClientRect();
    const b = hitBand(e.clientX - r.left, e.clientY - r.top) || d.data.sel;
    if (!b) return;
    e.preventDefault();
    const id = 'b' + b + 'q';
    A.setParam(d.id, id, U.round(clamp(d.p[id] * Math.exp(-e.deltaY * 0.002), 0.1, 12), 2), false);
    commitSoon();
    draw();
  }, { passive: false });
  const commitSoon = U.debounce(() => U.commit('EQ Q'), 500);
  ctls();
  draw();
  const node0 = node();
  if (node0) node0.analyser();
  return { el: wrap, draw, frame: () => { if (U.engine.playing) draw(); } };
}

/* ---------- 드럼 패드 ---------- */
function padsVisual(t, d) {
  const wrap = h('div', { class: 'pads-wrap' });
  const grid = h('div', { class: 'pads' });
  const ed = h('div', { class: 'pad-ed' });
  wrap.append(grid, ed);
  if (!d.data) d.data = { pads: U.clone(U.DEFAULT_KIT), sel: 0 };
  const padEls = [];
  const drawGrid = () => {
    U.clear(grid);
    padEls.length = 0;
    for (let row = 3; row >= 0; row--) {
      for (let col = 0; col < 4; col++) {
        const i = row * 4 + col;
        const pd = d.data.pads[i];
        const k = U.padsUI.keyOf(d, i);
        const b = h('button', { type: 'button', class: 'pad' + (d.data.sel === i ? ' sel' : '') + (pd && pd.mute ? ' muted' : '') },
          h('span', { class: 'pad-n', text: pd ? pd.name : '' }), h('span', { class: 'pad-k', text: (k ? U.keyLabel(k) + ' · ' : '') + U.noteName(36 + i) }));
        info(b, (pd ? pd.name : '빈 패드') + ' · ' + U.noteName(36 + i), '누르면 소리를 들어 보고 아래에서 설정을 바꿔요. 샘플을 끌어다 놓으면 이 패드 소리가 돼요.');
        b.addEventListener('pointerdown', e => {
          e.preventDefault();
          d.data.sel = i;
          U.ensureAudio();
          U.engine.liveOn(t.id, 36 + i, 110);
          const up = () => { U.engine.liveOff(t.id, 36 + i); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointerup', up);
          drawGrid(); drawEd();
        });
        U.dropTarget(b, {
          accept: x => x.type === 'sample',
          drop: x => A.setDeviceData(d.id, data => { const p = data.pads[i]; p.src = 'sample'; p.sample = x.ref; p.name = (U.media.info(x.ref).name || '샘플').slice(0, 14); p.tune = 0; p.decay = 1; }, '패드 샘플')
        });
        padEls[i] = b;
        grid.append(b);
      }
    }
  };
  const drawEd = () => {
    U.clear(ed);
    const i = d.data.sel || 0;
    const pd = d.data.pads[i];
    if (!pd) return;
    const name = h('input', { class: 'inp sm', value: pd.name, 'aria-label': '패드 이름' });
    name.addEventListener('keydown', e => e.stopPropagation());
    name.addEventListener('change', () => A.setDeviceData(d.id, data => { data.pads[i].name = name.value.trim() || pd.name; }, '패드 이름'));
    ed.append(h('div', { class: 'pad-ed-head' }, h('span', { class: 'pe-k', text: U.noteName(36 + i) }), name));
    const src = U.select([['synth', '합성 드럼'], ['sample', '샘플']], pd.src, v => A.setDeviceData(d.id, data => { data.pads[i].src = v; }, '패드 소리'), { cls: 'sm' });
    const row = h('div', { class: 'pe-row' }, src);
    if (pd.src === 'synth') row.append(U.select(U.PAD_TYPES.map(([v, l]) => [v, l]), pd.type, v => A.setDeviceData(d.id, data => { data.pads[i].type = v; data.pads[i].name = U.PAD_TYPES.find(x => x[0] === v)[1]; }, '패드 종류'), { cls: 'sm' }));
    else {
      row.append(h('span', { class: 'pe-sample', text: pd.sample ? (U.media.info(pd.sample).name || pd.sample) : '샘플을 끌어다 놓으세요' }));
      if (pd.sample) row.append(btn({ text: '편집', cls: 'sm', title: '이 패드 샘플 파형 편집', onclick: () => U.audioEditor.open({ ref: pd.sample, title: pd.name, name: U.media.info(pd.sample).name, save: nref => A.setDeviceData(d.id, data => { data.pads[i].sample = nref; }, '패드 샘플 편집') }) }));
    }
    ed.append(row);
    const knobs = h('div', { class: 'ds-grid' });
    const pspec = {
      tune: { label: 'Tune', min: -24, max: 24, def: 0, step: 1, unit: 'st', info: '음높이 (반음)' },
      decay: { label: 'Decay', min: 0, max: 1, def: 0.5, unit: '%', info: '소리가 사라지는 길이' },
      tone: { label: 'Tone', min: 0, max: 1, def: 0.5, unit: '%', info: '음색 (종류마다 달라요: 킥은 클릭, 스네어는 스내피, 햇은 밝기)' },
      level: { label: 'Level', min: -36, max: 6, def: 0, unit: 'dB', info: '패드 음량' },
      pan: { label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan', info: '패드 좌우 위치' }
    };
    for (const k of ['tune', 'decay', 'tone', 'level', 'pan']) {
      if (k === 'tone' && pd.src === 'sample') continue;
      const s = Object.assign({ id: k, curve: 'lin' }, pspec[k]);
      knobs.append(U.knob({ spec: s, size: 'sm', get: () => d.data.pads[i][k], set: (v, f) => A.setDeviceData(d.id, data => { data.pads[i][k] = v; }, '패드 ' + s.label, !f) }));
    }
    const choke = U.select([['0', '초크 없음'], ['1', '초크 1'], ['2', '초크 2'], ['3', '초크 3']], String(pd.choke || 0), v => A.setDeviceData(d.id, data => { data.pads[i].choke = +v; }, '초크'), { cls: 'sm', info: ['초크 그룹', '같은 그룹의 패드는 서로를 끊어요. 열린 하이햇을 닫힌 하이햇이 끊을 때 써요.'] });
    const mute = btn({ text: '뮤트', cls: 'tg sm', toggle: true, on: !!pd.mute, onclick: () => A.setDeviceData(d.id, data => { data.pads[i].mute = !data.pads[i].mute; }, '패드 뮤트') });
    ed.append(knobs, h('div', { class: 'pe-row' }, choke, mute));
  };
  drawGrid();
  drawEd();
  const frame = () => {
    const node = U.engine && U.engine.nodes.get(t.id);
    const inst = node && node.inst;
    if (!inst || !inst.hits) return;
    const hit = new Set(inst.hits(U.engine.ctx.currentTime));
    padEls.forEach((b, i) => b && b.classList.toggle('hit', hit.has(i)));
  };
  return { el: wrap, frame, draw: () => { drawGrid(); drawEd(); } };
}

/* ---------- 샘플러 ---------- */
function sampleVisual(t, d) {
  const W = 260, H = 84;
  const wrap = h('div', { class: 'smp-wrap' });
  const cv = canvasBox(W, H, 'smp-cv');
  const name = h('div', { class: 'smp-name' });
  const load = btn({ icon: 'upload', text: '파일', cls: 'sm', title: '오디오 파일 불러오기', onclick: async () => {
    const files = await U.store.pickFile('audio/*', false);
    if (!files.length) return;
    try {
      const ref = await U.media.importFile(files[0], U.engine.ctx.sampleRate);
      A.setDeviceData(d.id, data => { data.sample = ref; }, '샘플 불러오기');
      U.inval('browser');
    } catch (e) { U.toast('이 파일을 읽지 못했어요. WAV, MP3, OGG 같은 오디오 파일을 골라 주세요.', 'error'); }
  } });
  const editB = btn({ text: '편집', cls: 'sm', title: '파형 편집', info: ['파형 편집', '이 샘플을 자르고 붙이고, 페이드·볼륨·노멀라이즈·거꾸로를 해요. 저장하면 새 샘플이 되고 되돌리기로 원래 샘플에 돌아와요.'], onclick: () => {
    const ref = d.data && d.data.sample;
    if (!ref) { U.toast('먼저 샘플을 넣어 주세요.'); return; }
    const nm = U.media.info(ref).name;
    U.audioEditor.open({ ref, title: nm, name: nm, save: nref => A.setDeviceData(d.id, data => { data.sample = nref; }, '샘플 편집') });
  } });
  wrap.append(cv, h('div', { class: 'smp-bar' }, name, editB, load));
  info(cv, '샘플', '브라우저의 샘플이나 오디오 파일을 여기에 끌어다 놓으세요. 위쪽의 노란 표시를 끌어 시작·끝·루프 위치를 바꿔요.');
  U.dropTarget(wrap, { accept: x => x.type === 'sample', drop: x => A.setDeviceData(d.id, data => { data.sample = x.ref; }, '샘플 넣기') });
  const draw = () => {
    const c = U.colors();
    const g = U.fitCanvas(cv, W, H);
    g.fillStyle = c.sunk; g.fillRect(0, 0, W, H);
    const ref = d.data && d.data.sample;
    name.textContent = ref ? (U.media.info(ref).name || ref) : '샘플 없음';
    if (!ref) { g.fillStyle = c.fg3; g.font = '11px ' + c.font; g.fillText('여기에 샘플을 끌어다 놓으세요', 12, H / 2); return; }
    const buf = U.media.cached(ref, U.engine.ctx.sampleRate);
    if (!buf) { U.media.get(ref, U.engine.ctx.sampleRate).then(draw, () => {}); return; }
    const pk = U.media.peaks(ref, buf, W);
    const P = d.p;
    g.fillStyle = U.colorOf(t.color);
    for (let x = 0; x < W; x++) {
      const lo = pk[x * 2], hi = pk[x * 2 + 1];
      const inside = x / W >= Math.min(P.start, P.end) && x / W <= Math.max(P.start, P.end);
      g.globalAlpha = inside ? 1 : 0.3;
      g.fillRect(x, H / 2 - hi * (H / 2 - 6), 1, Math.max(1, (hi - lo) * (H / 2 - 6)));
    }
    g.globalAlpha = 1;
    const mark = (f, col, lbl) => { const x = Math.round(f * W); g.fillStyle = col; g.fillRect(x, 0, 1.5, H); g.fillRect(x, 0, 8, 8); g.fillStyle = '#16171a'; g.font = '600 7px ' + c.mono; g.fillText(lbl, x + 1.5, 6.5); };
    if (P.mode === 'slice') {
      const n = Math.round(P.slices);
      g.fillStyle = c.fg2;
      for (let k = 1; k < n; k++) g.fillRect(Math.round((P.start + (P.end - P.start) * k / n) * W), 10, 1, H - 10);
    }
    mark(P.start, c.accent, 'S');
    mark(P.end, c.accent, 'E');
    if (P.loop && P.mode === 'classic') mark(P.lstart, c.cue, 'L');
  };
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const f = (e.clientX - r.left) / W;
    const P = d.p;
    const cands = [['start', P.start], ['end', P.end]].concat(P.loop && P.mode === 'classic' ? [['lstart', P.lstart]] : []);
    let best = null, bd = 0.04;
    for (const [k, v] of cands) { const dd = Math.abs(v - f); if (dd < bd) { bd = dd; best = k; } }
    if (!best) return;
    cv.setPointerCapture(e.pointerId);
    const move = ev => { A.setParam(d.id, best, U.round(clamp((ev.clientX - r.left) / W, 0, 1), 4), false); draw(); for (const p of panels) if (p.d === d) p.el.update(); };
    const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); U.commit('샘플 구간'); };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
  });
  draw();
  return { el: wrap, draw };
}

/* ================= 매 프레임 ================= */
U.frame(() => {
  if (!root || root.offsetParent === null) return;
  for (const v of visuals) if (v.frame) v.frame();
  if (U.engine && U.engine.playing) {
    const t = U.selTrack();
    if (t && Object.keys(t.auto).length) for (const p of panels) p.el.update();
  }
});
U.on('media', () => { for (const v of visuals) if (v.draw && (v.dev.kind === 'sampler')) v.draw(); });

U.deviceView = { render, get panels() { return panels; } };
})(window.U = window.U || {});
