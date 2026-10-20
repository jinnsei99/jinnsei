/* 울림 — 손가락 조작 (아이패드·휴대폰)
   - 길게 누르기 → 오른쪽 클릭 메뉴 (contextmenu)
   - 두 번 탭 → 더블클릭 (dblclick)
   - 두 손가락으로 밀기·벌리기 → 편집 화면 스크롤·확대 (U.gestures.pan)
   - 사파리: 손을 대면 소리 켜기, 무음 모드에서도 소리 내기, 화면 전체 확대 막기
   마우스로 쓸 때는 아무것도 바꾸지 않는다 */
(function (U) {
'use strict';

const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const coarse = !!(window.matchMedia && matchMedia('(any-pointer: coarse)').matches);
U.isIOS = ios;
U.isTouch = coarse || ios;
document.documentElement.classList.toggle('touch', U.isTouch);
document.documentElement.classList.toggle('ios', ios);

const now = () => performance.now();
const LONG_MS = 500;   // 이만큼 가만히 누르면 메뉴
const MOVE = 10;       // 이보다 움직이면 누르기가 아니라 끌기
const TAP_MS = 350;    // 탭 한 번의 최대 길이
const DBL_MS = 340;    // 두 탭 사이 최대 간격
const DBL_DIST = 30;

/* 우리가 다시 보내거나 만들어 낸 이벤트 (진짜 손가락 이벤트와 구별한다) */
const made = new WeakSet();
function fireMouse(target, type, x, y, init) {
  const ev = new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y }, init));
  made.add(ev);
  target.dispatchEvent(ev);
  return ev;
}
function clonePointer(e, type, at) {
  const ev = new PointerEvent(type || e.type, {
    bubbles: true, cancelable: true, composed: true, view: window,
    pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
    clientX: at ? at.x : e.clientX, clientY: at ? at.y : e.clientY, screenX: e.screenX, screenY: e.screenY,
    button: type === 'pointerup' ? 0 : e.button, buttons: type === 'pointerup' ? 0 : e.buttons,
    pressure: type === 'pointerup' ? 0 : e.pressure, width: e.width, height: e.height,
    ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey
  });
  made.add(ev);
  return ev;
}
const real = e => e.isTrusted && !made.has(e);
const alive = (el, x, y) => (el && el.isConnected ? el : document.elementFromPoint(x, y));

/* 손가락을 뗀 뒤라 포인터 캡처가 실패해도 조작이 멈추지 않게 */
for (const name of ['setPointerCapture', 'releasePointerCapture']) {
  const orig = Element.prototype[name];
  if (orig) Element.prototype[name] = function (id) { try { return orig.call(this, id); } catch (e) { return undefined; } };
}

/* ================= 길게 누르기 · 두 번 탭 ================= */
const fingers = new Map();   // pointerId → {x, y, t, target, moved, multi, long}
let press = null;            // 메뉴를 기다리는 손가락
let quietClick = 0;          // 메뉴를 연 손가락을 뗄 때 따라오는 click을 버리는 때까지
let quietMenu = 0;           // 우리가 연 메뉴 뒤에 브라우저가 또 보내는 contextmenu를 버리는 때까지
let lastType = 'mouse', lastT = 0;
let prevTap = null, pendingDbl = null, dblTimer = 0;

function clearPress() { if (press) { clearTimeout(press.timer); press = null; } }
function longPress() {
  const p = press;
  press = null;
  if (!p) return;
  const f = fingers.get(p.id);
  if (f) f.long = true;
  const target = alive(p.target, p.x, p.y);
  if (!target) return;
  quietMenu = now() + 700;
  fireMouse(target, 'contextmenu', p.x, p.y, { button: 2, buttons: 2 });
}
function flushDbl() {
  clearTimeout(dblTimer);
  const d = pendingDbl;
  pendingDbl = null;
  if (!d) return;
  const target = alive(d.target, d.x, d.y);
  if (target) fireMouse(target, 'dblclick', d.x, d.y, { detail: 2, button: 0, buttons: 0 });
}

window.addEventListener('pointerdown', e => {
  if (!real(e)) return;
  lastType = U.lastPointer = e.pointerType;
  lastT = now();
  if (e.pointerType === 'mouse') return;
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now(), target: e.target, moved: false, multi: false, long: false });
  clearPress();
  if (fingers.size > 1) { for (const f of fingers.values()) f.multi = true; prevTap = null; return; }
  // 패드·건반처럼 누르고 있는 것이 연주인 곳은 메뉴를 띄우지 않는다
  if (e.target.closest && e.target.closest('[data-nolongpress]')) return;
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target, timer: setTimeout(longPress, LONG_MS) };
}, true);
window.addEventListener('pointermove', e => {
  if (!real(e)) return;
  const f = fingers.get(e.pointerId);
  if (!f || f.moved) return;
  if (Math.hypot(e.clientX - f.x, e.clientY - f.y) > MOVE) {
    f.moved = true;
    if (press && press.id === e.pointerId) clearPress();
  }
}, true);
window.addEventListener('pointerup', e => {
  if (!real(e) || e.pointerType === 'mouse') return;
  const f = fingers.get(e.pointerId);
  fingers.delete(e.pointerId);
  if (press && press.id === e.pointerId) clearPress();
  if (!f) return;
  if (f.long) { quietClick = now() + 150; prevTap = null; return; }
  if (f.moved || f.multi || now() - f.t > TAP_MS) { prevTap = null; return; }
  const tap = { t: now(), x: e.clientX, y: e.clientY, target: f.target };
  if (prevTap && tap.t - prevTap.t < DBL_MS && Math.hypot(tap.x - prevTap.x, tap.y - prevTap.y) < DBL_DIST) {
    prevTap = null;
    pendingDbl = tap;
    clearTimeout(dblTimer);
    dblTimer = setTimeout(flushDbl, 90);   // click이 오지 않으면 그냥 보낸다
  } else prevTap = tap;
}, true);
window.addEventListener('pointercancel', e => {
  if (!real(e)) return;
  fingers.delete(e.pointerId);
  if (press && press.id === e.pointerId) clearPress();
  prevTap = null;
}, true);
// 두 번째 탭의 click이 다 처리된 뒤에 더블클릭을 보낸다 (마우스와 같은 순서)
window.addEventListener('click', () => { if (pendingDbl) { clearTimeout(dblTimer); dblTimer = setTimeout(flushDbl, 0); } });
window.addEventListener('click', e => {
  if (made.has(e) || lastType === 'mouse') return;
  if (now() < quietClick) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
// 브라우저가 스스로 보내는 더블클릭·메뉴와 겹치지 않게 한다 (마우스·트랙패드는 그대로)
window.addEventListener('dblclick', e => {
  if (made.has(e) || lastType === 'mouse') return;
  if (now() - lastT < 1500) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
window.addEventListener('contextmenu', e => {
  if (made.has(e) || lastType === 'mouse') return;
  // 패드·건반은 누르고 있는 것이 연주라 브라우저가 보낸 메뉴도 막는다
  if (e.target.closest && e.target.closest('[data-nolongpress]')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (press) {
    // 안드로이드 크롬처럼 브라우저가 먼저 보냈으면 그것을 쓴다
    const f = fingers.get(press.id);
    if (f) f.long = true;
    clearPress();
    quietMenu = now() + 700;
    return;
  }
  if (now() < quietMenu) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

/* ================= 두 손가락으로 밀기·벌리기 =================
   o.pan(dx, dy): 손가락이 움직인 만큼 (화면 px)
   o.zoom({ f, fx, fy, x, y }): 벌린 비율(전체·가로·세로)과 el 기준 가운데 좌표
   한 손가락 조작은 HOLD ms 붙잡아 두었다가 그대로 다시 보낸다. 그사이 두 번째 손가락이 닿으면
   음 옮기기 같은 한 손가락 조작은 시작하지 않고 밀기·벌리기만 한다 */
const HOLD = 90;
function pan(el, o) {
  const pts = new Map();       // pointerId → 마지막 이벤트
  const dead = new Set();      // 두 손가락으로 바뀌며 끝낸 한 손가락 조작
  let mode = null;             // null | 'wait' | 'pass' | 'pan'
  let pend = null;             // 붙잡아 둔 pointerdown과 move
  let pass = null;             // 지나가게 둔 한 손가락 {id, target}
  let last = null;
  let arm = () => {};          // 아래에서 정리 리스너를 거는 함수로 바뀐다
  const replay = (ev, target) => { (alive(target, ev.clientX, ev.clientY) || el).dispatchEvent(clonePointer(ev)); };
  const flush = () => {
    if (!pend) return;
    clearTimeout(pend.timer);
    const p = pend;
    pend = null;
    mode = 'pass';
    pass = { id: p.down.pointerId, target: p.down.target };
    replay(p.down, p.down.target);
    for (const m of p.moves) replay(m, p.down.target);
  };
  const shape = () => {
    const list = [...pts.values()];
    const n = list.length;
    let cx = 0, cy = 0;
    for (const e of list) { cx += e.clientX; cy += e.clientY; }
    cx /= n; cy /= n;
    let d = 0, sx = 0, sy = 0;
    if (n >= 2) {
      const a = list[0], b = list[1];
      sx = Math.abs(a.clientX - b.clientX); sy = Math.abs(a.clientY - b.clientY);
      d = Math.hypot(sx, sy);
    }
    return { n, cx, cy, d, sx, sy };
  };
  el.addEventListener('pointerdown', e => {
    if (!real(e) || e.pointerType !== 'touch') return;
    pts.set(e.pointerId, e);
    arm();
    e.stopImmediatePropagation();
    if (pts.size === 1) {
      mode = 'wait';
      pend = { down: e, moves: [], timer: setTimeout(flush, HOLD) };
      return;
    }
    if (mode === 'wait' && pend) { clearTimeout(pend.timer); pend = null; }
    else if (mode === 'pass' && pass && !dead.has(pass.id)) {
      // 벌써 시작한 한 손가락 조작은 지금 자리에서 끝낸다
      const lastEv = pts.get(pass.id);
      if (lastEv) (alive(pass.target, lastEv.clientX, lastEv.clientY) || el).dispatchEvent(clonePointer(lastEv, 'pointerup'));
      dead.add(pass.id);
    }
    pass = null;
    mode = 'pan';
    last = shape();
    if (o.start) o.start();
  }, true);
  el.addEventListener('pointermove', e => {
    if (!real(e) || e.pointerType !== 'touch') return;
    if (dead.has(e.pointerId)) e.stopImmediatePropagation();
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (mode === 'wait' && pend) {
      e.stopImmediatePropagation();
      pend.moves.push(e);
      if (Math.hypot(e.clientX - pend.down.clientX, e.clientY - pend.down.clientY) > 12) flush();
      return;
    }
    if (mode !== 'pan') return;
    e.stopImmediatePropagation();
    const g = shape();
    if (last && g.n === last.n) {
      if (o.pan && (g.cx !== last.cx || g.cy !== last.cy)) o.pan(g.cx - last.cx, g.cy - last.cy);
      if (o.zoom && g.n >= 2 && last.d > 0 && g.d > 0) {
        const r = el.getBoundingClientRect();
        const z = { f: g.d / last.d, fx: last.sx > 30 && g.sx > 30 ? g.sx / last.sx : 1, fy: last.sy > 30 && g.sy > 30 ? g.sy / last.sy : 1, x: g.cx - r.left, y: g.cy - r.top };
        if (Math.abs(z.f - 1) > 0.002) o.zoom(z);
      }
    }
    last = g;
  }, true);
  const up = e => {
    if (!real(e) || e.pointerType !== 'touch') return;
    const had = pts.delete(e.pointerId);
    if (dead.delete(e.pointerId)) e.stopImmediatePropagation();
    if (!had) return;
    if (mode === 'wait' && pend && pend.down.pointerId === e.pointerId) {
      if (e.type === 'pointercancel') { clearTimeout(pend.timer); pend = null; mode = null; return; }
      // 빠른 탭: 붙잡아 둔 것을 먼저 보내고, 이 pointerup은 그대로 지나가게 둔다
      flush();
      if (!pts.size) { mode = null; pass = null; }
      return;
    }
    if (mode === 'pan') {
      e.stopImmediatePropagation();
      last = pts.size ? shape() : null;
      if (!pts.size) { mode = null; if (o.end) o.end(); }
      return;
    }
    if (!pts.size) { mode = null; pass = null; }
  };
  el.addEventListener('pointerup', up, true);
  el.addEventListener('pointercancel', up, true);
  // 손가락을 떼는 사이에 캔버스가 새로 그려져 el이 pointerup을 못 받았으면 여기서 정리한다.
  // 손가락이 닿아 있는 동안만 창에 걸어 두어서, 편집 화면을 여러 번 열어도 쌓이지 않는다
  let armed = false;
  const sweep = e => {
    if (!pts.has(e.pointerId)) return;
    setTimeout(() => {
      if (pts.delete(e.pointerId)) {
        dead.delete(e.pointerId);
        if (pend && pend.down.pointerId === e.pointerId) { clearTimeout(pend.timer); pend = null; }
        if (!pts.size) { if (mode === 'pan' && o.end) o.end(); mode = null; pass = null; last = null; }
        else last = shape();
      }
      if (!pts.size && armed) {
        armed = false;
        window.removeEventListener('pointerup', sweep, true);
        window.removeEventListener('pointercancel', sweep, true);
      }
    }, 0);
  };
  arm = () => {
    if (armed) return;
    armed = true;
    window.addEventListener('pointerup', sweep, true);
    window.addEventListener('pointercancel', sweep, true);
  };
  return el;
}

/* ================= 사파리 ================= */
// 손을 댈 때마다 꺼져 있던 소리를 켠다 (아이폰·아이패드는 pointerdown에서는 소리를 켜 주지 않는다)
function unlockAudio() {
  const eng = U.engine, ctx = eng && eng.ctx;
  if (!ctx || ctx.state === 'running') return;
  try { ctx.resume(); } catch (e) { /* 다음 손길에 다시 */ }
  try {
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    s.connect(ctx.destination);
    s.start(0);
  } catch (e) { /* 소리 없는 한 샘플이라 실패해도 그만 */ }
  if (eng.start) eng.start();
}
for (const t of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(t, unlockAudio, { capture: true, passive: true });
// 무음 모드에서도 소리가 나게 (사파리 16.4+). 마이크로 녹음할 때는 recorder가 잠깐 바꾼다
U.audioSession = function (type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* 지원하지 않는 브라우저 */ } };
U.audioSession('playback');
if (ios) {
  // 두 손가락 확대는 편집 화면이 쓰고, 앱 화면 전체는 커지지 않게
  for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, e => e.preventDefault(), { passive: false });
  // :active 눌림 표시가 보이게 하는 사파리 관례
  document.addEventListener('touchstart', () => {}, { passive: true });
  // 홈 화면 앱이 아니어도 저장한 프로젝트를 오래 지키도록 부탁한다
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* 없음 */ }
}

U.gestures = { pan, clonePointer };
})(window.U = window.U || {});
