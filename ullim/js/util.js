/* 울림 — 공용 도구: DOM, 수학, 음악 이론, 이벤트, 설정 */
(function (U) {
'use strict';

/* ================= DOM ================= */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const sk in v) {
          if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]);
          else el.style[sk] = v[sk];
        }
      }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function svg(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  return el;
}
/* 레티나 화면에서도 또렷하게: 캔버스 크기를 요소 크기 × 화면 배율로 맞춘다 */
function fitCanvas(cv, w, hgt) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(hgt * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  cv.style.width = w + 'px';
  cv.style.height = hgt + 'px';
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}
function cssVar(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/* ================= 수학 ================= */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dbToGain = db => (db <= -70 ? 0 : Math.pow(10, db / 20));
const gainToDb = g => (g <= 0.000316 ? -Infinity : 20 * Math.log10(g));
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const round = (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };
const EPS = 1e-6;

let idSeq = 0;
function uid(prefix = 'x') {
  idSeq = (idSeq + 1) % 1296;
  return prefix + Date.now().toString(36).slice(-5) + idSeq.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 5);
}
/* 같은 씨앗이면 같은 수열 (생성기 재현용) */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function debounce(fn, ms) {
  let t = 0;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}
function clone(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

/* ================= 음악 이론 ================= */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROOT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/* 가운데 도(60)가 C3 — 에이블턴 계열 DAW와 같은 표기 */
function noteName(n) { return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 2); }

const SCALES = [
  { id: 'major', name: '메이저', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: '마이너', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'dorian', name: '도리안', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', name: '프리지안', steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', name: '리디안', steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', name: '믹솔리디안', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'locrian', name: '로크리안', steps: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'harmonic', name: '하모닉 마이너', steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodic', name: '멜로딕 마이너', steps: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'majpent', name: '메이저 펜타토닉', steps: [0, 2, 4, 7, 9] },
  { id: 'minpent', name: '마이너 펜타토닉', steps: [0, 3, 5, 7, 10] },
  { id: 'blues', name: '블루스', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'whole', name: '홀톤', steps: [0, 2, 4, 6, 8, 10] },
  { id: 'chromatic', name: '크로매틱', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
];
const SCALE_BY_ID = Object.fromEntries(SCALES.map(s => [s.id, s]));
function scaleOf(id) { return SCALE_BY_ID[id] || SCALE_BY_ID.minor; }
function inScale(p, root, scaleId) {
  const pc = (((p - root) % 12) + 12) % 12;
  return scaleOf(scaleId).steps.includes(pc);
}
/* 스케일 밖의 음을 가장 가까운 스케일 음으로 (같으면 아래로) */
function snapToScale(p, root, scaleId) {
  if (inScale(p, root, scaleId)) return p;
  for (let d = 1; d < 12; d++) {
    if (inScale(p - d, root, scaleId)) return p - d;
    if (inScale(p + d, root, scaleId)) return p + d;
  }
  return p;
}
/* 스케일 단계(도수) → 음높이. degree 0 = 근음, 음수와 옥타브 넘김 지원 */
function degreeToPitch(deg, root, scaleId, base = 60) {
  const st = scaleOf(scaleId).steps;
  const n = st.length;
  const oct = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  const rootPitch = base - (((base - root) % 12) + 12) % 12; // base 이하의 가장 가까운 근음
  return rootPitch + oct * 12 + st[i];
}
function pitchToDegree(p, root, scaleId, base = 60) {
  const st = scaleOf(scaleId).steps;
  const rootPitch = base - (((base - root) % 12) + 12) % 12;
  const q = snapToScale(p, root, scaleId) - rootPitch;
  const oct = Math.floor(q / 12);
  const pc = ((q % 12) + 12) % 12;
  return oct * st.length + Math.max(0, st.indexOf(pc));
}
function scaleLabel(root, scaleId) { return ROOT_NAMES[root] + ' ' + scaleOf(scaleId).name; }

/* ================= 박자 · 시간 ================= */
/* 박(beat)은 언제나 4분음표 하나. 마디 길이는 박자표에서 계산 */
function barLen(sig) { return sig[0] * 4 / sig[1]; }
function beatUnit(sig) { return 4 / sig[1]; }
/* 재생 위치 표기: 마디. 박. 16분 (모두 1부터) */
function fmtPos(b, sig) {
  const unit = beatUnit(sig), bl = barLen(sig);
  const neg = b < -EPS;
  b = Math.max(0, b) + EPS;
  const bar = Math.floor(b / bl);
  const rem = b - bar * bl;
  const bt = Math.floor(rem / unit);
  const six = Math.floor((rem - bt * unit) / 0.25);
  return (neg ? '-' : '') + (bar + 1) + '. ' + (bt + 1) + '. ' + (six + 1);
}
/* 길이 표기: 마디. 박. 16분 (0부터) */
function fmtLen(len, sig) {
  const unit = beatUnit(sig), bl = barLen(sig);
  len = Math.max(0, len) + EPS;
  const bar = Math.floor(len / bl);
  const rem = len - bar * bl;
  const bt = Math.floor(rem / unit);
  const six = Math.floor((rem - bt * unit) / 0.25);
  return bar + '. ' + bt + '. ' + six;
}
/* "2.1.3" 같은 입력을 박 단위로 (pos=true면 1부터 세는 위치) */
function parsePos(str, sig, pos) {
  const parts = String(str).trim().split(/[.\s:]+/).filter(Boolean).map(Number);
  if (!parts.length || parts.some(n => !isFinite(n))) return null;
  const off = pos ? 1 : 0;
  const [bar = off, bt = off, six = off] = parts;
  return (bar - off) * barLen(sig) + (bt - off) * beatUnit(sig) + (six - off) * 0.25;
}
function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return m + ':' + s.toFixed(1).padStart(4, '0');
}
const GRID_STEPS = [
  { id: '1/1', beats: 4, name: '1마디' },
  { id: '1/2', beats: 2, name: '1/2' },
  { id: '1/4', beats: 1, name: '1/4' },
  { id: '1/8', beats: 0.5, name: '1/8' },
  { id: '1/16', beats: 0.25, name: '1/16' },
  { id: '1/32', beats: 0.125, name: '1/32' }
];
/* 런치 퀀타이즈: 클립이 시작될 다음 경계 */
const QUANTS = [
  { id: 'none', name: '없음', beats: 0 },
  { id: '8bar', name: '8마디', bars: 8 },
  { id: '4bar', name: '4마디', bars: 4 },
  { id: '2bar', name: '2마디', bars: 2 },
  { id: '1bar', name: '1마디', bars: 1 },
  { id: '1/2', name: '1/2', beats: 2 },
  { id: '1/4', name: '1/4', beats: 1 },
  { id: '1/8', name: '1/8', beats: 0.5 },
  { id: '1/16', name: '1/16', beats: 0.25 }
];
function quantBeats(id, sig) {
  const q = QUANTS.find(x => x.id === id) || QUANTS[4];
  return q.bars ? q.bars * barLen(sig) : q.beats;
}
/* 박자 분할(템포 동기) */
const SYNC_DIVS = [
  { id: '1/1', beats: 4 }, { id: '1/2', beats: 2 }, { id: '1/2D', beats: 3 }, { id: '1/4', beats: 1 },
  { id: '1/4D', beats: 1.5 }, { id: '1/4T', beats: 2 / 3 }, { id: '1/8', beats: 0.5 }, { id: '1/8D', beats: 0.75 },
  { id: '1/8T', beats: 1 / 3 }, { id: '1/16', beats: 0.25 }, { id: '1/16D', beats: 0.375 }, { id: '1/16T', beats: 1 / 6 },
  { id: '1/32', beats: 0.125 }
];
function divBeats(id) { const d = SYNC_DIVS.find(x => x.id === id); return d ? d.beats : 0.5; }

/* ================= 색 ================= */
/* 클립·트랙 색 팔레트. 진한 글씨가 올라가도 읽히는 밝기로 맞췄다 */
const COLORS = [
  '#ff7a6b', '#ff9e57', '#ffc95c', '#e6e163', '#a6db6b', '#62d39a', '#4fd1c5', '#5bbcf5',
  '#7c9dff', '#a48dff', '#d48af5', '#f47fb6', '#e3a497', '#d8b48a', '#c2c48a', '#97c4a6',
  '#8fbccc', '#a3acd9', '#c3a3cf', '#b9b9b9'
];
function colorOf(i) { return COLORS[((i % COLORS.length) + COLORS.length) % COLORS.length]; }
/* 색 밝기 조절 (-1~1) */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ================= 이벤트 ================= */
const listeners = Object.create(null);
function on(evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); return () => off(evt, fn); }
function off(evt, fn) { const l = listeners[evt]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
function emit(evt, data) {
  const l = listeners[evt];
  if (!l) return;
  for (const fn of l.slice()) {
    try { fn(data); } catch (e) { console.error(e); }
  }
}

/* ================= 기기별 설정 (브라우저 저장소) ================= */
const PREF_KEY = 'ullim:prefs:v1';
let prefCache = null;
function prefs() {
  if (prefCache) return prefCache;
  try { prefCache = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch (e) { prefCache = {}; }
  return prefCache;
}
function pref(key, def) { const p = prefs(); return key in p ? p[key] : def; }
const savePrefs = debounce(() => {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefCache || {})); } catch (e) { /* 저장 안 돼도 앱은 돈다 */ }
}, 400);
function setPref(key, val) { prefs()[key] = val; savePrefs(); }

/* ================= 기타 ================= */
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';
function modKey(e) { return isMac ? e.metaKey : e.ctrlKey; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
function hashString(s) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619); }
  return (h1 >>> 0).toString(36);
}
/* 파일 내용으로 만든 짧은 해시 (같은 파일을 두 번 넣어도 한 번만 저장) */
async function hashBytes(buf) {
  try {
    const d = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(d).slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    const v = new Uint8Array(buf);
    let h1 = 0x811c9dc5;
    for (let i = 0; i < v.length; i += 7) { h1 ^= v[i]; h1 = Math.imul(h1, 16777619); }
    return (h1 >>> 0).toString(16) + v.length.toString(16);
  }
}

Object.assign(U, {
  h, add, $, $$, clear, svg, fitCanvas, cssVar,
  clamp, lerp, dbToGain, gainToDb, mtof, round, EPS, uid, rng, debounce, clone,
  NOTE_NAMES, ROOT_NAMES, noteName, SCALES, scaleOf, inScale, snapToScale, degreeToPitch, pitchToDegree, scaleLabel,
  barLen, beatUnit, fmtPos, fmtLen, parsePos, fmtTime, GRID_STEPS, QUANTS, quantBeats, SYNC_DIVS, divBeats,
  COLORS, colorOf, shade, alpha,
  on, off, emit,
  prefs, pref, setPref,
  isMac, MOD, modKey, sleep, nextFrame, hashString, hashBytes
});
})(window.U = window.U || {});
