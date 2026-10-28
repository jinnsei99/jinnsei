/* 울림 — 장치 실행부 3: 어쿠스틱 악기와 앙상블
   Acoustic: 줄을 뜯거나 건반·채로 때리는 악기. 음마다 소리를 자바스크립트로 한 번 계산해 두고(줄은 카플러스-스트롱,
             피아노·말렛·종은 배음마다 줄어드는 사인파를 더해서) 그 소리를 재생해요. 계산한 소리는 기억해 두고 다시 써요.
   Ensemble: 현악·관악·콰이어·오르간처럼 누르는 동안 이어지는 악기. 오실레이터 여러 개와 포먼트 필터, 비브라토로 실시간 합성해요 */
(function (U) {
'use strict';
const { gainNode, mtof, clamp, smooth, envOn, envOff, envEnd, stopAt, velGain } = U;

/* ================= 소리 계산 도구 ================= */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 진폭 a, 주파수 f, -60 dB까지 T초 걸려 줄어드는 사인파를 out에 더한다 (-80 dB 아래로 내려가면 멈춘다) */
function resonate(out, sr, f, a, T) {
  if (a < 1e-5 || f <= 0 || f >= sr * 0.48) return;
  const w = 2 * Math.PI * f / sr, r = Math.exp(-6.907755 / (Math.max(0.005, T) * sr));
  const c2 = 2 * r * Math.cos(w), r2 = r * r;
  const n = Math.min(out.length, Math.ceil(Math.log(1e-4 / a) / Math.log(r)) + 2);
  let y2 = 0, y1 = a * r * Math.sin(w);
  if (n > 1) out[1] += y1;
  for (let i = 2; i < n; i++) { const y = c2 * y1 - r2 * y2; out[i] += y; y2 = y1; y1 = y; }
}
/* 공명 몸통: 대역 통과 필터(가운데 0 dB) 여러 개를 g만큼 섞는다 */
function addBody(x, sr, modes, amt) {
  if (!modes || amt <= 0) return x;
  const acc = Float32Array.from(x);
  for (const [f0, Q, g] of modes) {
    const w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * Q), a0 = 1 + al;
    const b0 = al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0, k = g * amt * 2;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * (x[i] - x2) - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
      acc[i] += k * v;
    }
  }
  return acc;
}
function dcBlock(x) {
  let x1 = 0, y1 = 0;
  for (let i = 0; i < x.length; i++) { const y = x[i] - x1 + 0.995 * y1; x1 = x[i]; y1 = y; x[i] = y; }
  return x;
}
/* 끝을 살짝 줄여서 버퍼가 끝날 때 딸깍 소리가 나지 않게 */
function fadeTail(x, sr) {
  const m = Math.min(x.length, Math.round(sr * 0.04));
  for (let i = 0; i < m; i++) x[x.length - 1 - i] *= i / m;
  return x;
}
/* 음높이 흔들기(가야금 농현 등): 읽는 자리를 시간에 따라 앞뒤로 옮겨 다시 뽑는다 */
function warp(x, sr, centsAt) {
  const y = new Float32Array(x.length);
  const STEP = 64;   // 빠르기는 64샘플마다 계산하고 그 사이는 그대로 쓴다
  let pos = 0, rate = 1;
  for (let i = 0; i < x.length; i++) {
    if (i % STEP === 0) rate = Math.pow(2, centsAt(i / sr) / 1200);
    const j = pos | 0, fr = pos - j;
    if (j + 1 >= x.length) break;
    y[i] = x[j] + (x[j + 1] - x[j]) * fr;
    pos += rate;
  }
  return y;
}
function noiseBurst(out, sr, amp, dur, lp, rnd) {
  const n = Math.min(out.length, Math.round(sr * dur));
  let z = 0;
  for (let i = 0; i < n; i++) {
    z = (1 - lp) * (rnd() * 2 - 1) + lp * z;
    out[i] += amp * z * Math.exp(-5 * i / n);
  }
}

/* ---------- 줄 뜯기 (확장 카플러스-스트롱) ----------
   한 주기 길이의 노이즈를 줄(지연선)에 넣고, 평균 필터와 손실을 거치며 돌린다.
   올패스 필터로 소수점 지연까지 맞춰서 높은 음도 음정이 정확하다.
   소리 계산 함수들은 제너레이터라서 중간중간 쉬어 갈 수 있다 (미리 계산할 때 화면이 멈추지 않게) */
const CHUNK = 65536;
function* pluck(c, f, vel, tone, dmul, body, sr, rnd) {
  const T = clamp(c.t60 * Math.pow(130.81 / f, c.ts) * dmul, 0.05, 16);
  const n = Math.max(256, Math.ceil(sr * Math.min(c.max || 7, T + 0.08)));
  const out = new Float32Array(n);
  const P = sr / f;
  const br = clamp(0.55 * tone + 0.45 * vel, 0, 1);
  const S = clamp(c.S + (0.5 - br) * (c.Sv || 0.2), 0.06, 0.5);
  const w0 = 2 * Math.PI * f / sr;
  const H = Math.sqrt((1 - S) * (1 - S) + S * S + 2 * S * (1 - S) * Math.cos(w0));
  // loop: 고리 안의 1차 저역 통과(Hz). 낮은 음도 높은 배음이 진짜 줄처럼 빨리 사라진다 (베이스·팜 뮤트).
  // 그 필터가 늦추는 만큼 지연을 줄이고, 줄이는 만큼 손실을 덜어 음정과 길이는 그대로 둔다
  const lpA = c.loop ? Math.exp(-2 * Math.PI * c.loop / sr) : 0;
  const Hl = lpA ? (1 - lpA) / Math.sqrt(1 - 2 * lpA * Math.cos(w0) + lpA * lpA) : 1;
  const Dl = lpA ? Math.atan2(lpA * Math.sin(w0), 1 - lpA * Math.cos(w0)) / w0 : 0;
  const rho = Math.min(0.99998, Math.pow(10, -3 / (T * f)) / (H * Hl));
  let N = Math.floor(P - S - Dl);
  let d = P - S - Dl - N;
  if (d < 0.15) { N -= 1; d += 1; }
  N = Math.max(2, N);
  const C = (1 - d) / (1 + d);
  // 들뜸: 밝기만큼 거른 노이즈 한 주기, 뜯는 자리만큼 빗살로 깎기
  const buf = new Float32Array(N);
  const lp = clamp(c.exc - 0.6 * br, 0, 0.97);
  let z = 0;
  for (let i = 0; i < N; i++) { z = (1 - lp) * (rnd() * 2 - 1) + lp * z; buf[i] = z; }
  const m = Math.max(1, Math.round(c.pick * N));
  for (let i = N - 1; i >= m; i--) buf[i] -= buf[i - m];
  if (c.tri) { // 손가락으로 뜯은 줄의 처음 모양(뜯은 자리가 꼭짓점인 삼각형)을 섞으면 기본음이 둥글고 또렷해진다
    let e = 0;
    for (let i = 0; i < N; i++) e += buf[i] * buf[i];
    const k = Math.sqrt(e / N) / 0.29;   // 노이즈와 같은 크기로 (삼각형의 RMS는 높이의 0.29배)
    for (let i = 0; i < N; i++) buf[i] = (1 - c.tri) * buf[i] + c.tri * k * (i < m ? i / m : (N - i) / (N - m));
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += buf[i];
  mean /= N;
  for (let i = 0; i < N; i++) buf[i] -= mean;
  let ptr = 0, prev = 0, apx = 0, apy = 0, lz = 0;
  for (let i = 0; i < n; i++) {
    const y = buf[ptr];
    out[i] = y;
    let l = (1 - S) * y + S * prev;
    prev = y;
    if (lpA) { lz = (1 - lpA) * l + lpA * lz; l = lz; }
    const a = C * l + apx - C * apy;
    apx = l; apy = a;
    buf[ptr] = rho * a;
    if (++ptr >= N) ptr = 0;
    if (i % CHUNK === CHUNK - 1) yield;
  }
  yield;
  let x = dcBlock(out);
  if (c.diff) { // 자석 픽업은 줄의 자리가 아니라 움직이는 빠르기를 듣는다 (높은 배음일수록 조금씩 크게)
    for (let i = x.length - 1; i > 0; i--) x[i] -= x[i - 1];
    x[0] = 0;
  }
  if (c.pickup) { // 일렉 기타 픽업: 줄의 한 점에서 듣는 빗살 필터
    const k = Math.max(1, Math.round(c.pickup * P));
    if (c.coil2) { // 험버커: 나란한 코일 두 개가 조금 다른 두 점에서 듣는다 (빗살이 무뎌져 소리가 굵고 둥글다)
      const k2 = Math.max(1, Math.round(c.coil2 * P));
      for (let i = x.length - 1; i >= Math.max(k, k2); i--) x[i] -= 0.425 * (x[i - k] + x[i - k2]);
    } else for (let i = x.length - 1; i >= k; i--) x[i] -= 0.85 * x[i - k];
  }
  if (c.pu) { // 픽업 코일과 기타 줄(케이블)이 만드는 공진: 그 위는 급히 줄고 공진 자리가 살짝 솟는다. Tone을 올리면 공진이 올라간다
    const f0 = Math.min(sr * 0.45, c.pu[0] * (0.75 + 0.5 * tone)), w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * c.pu[1]);
    const a0 = 1 + al, b0 = (1 - Math.cos(w)) / 2 / a0, b1 = (1 - Math.cos(w)) / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const y = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
      x[i] = y;
    }
  }
  if (c.thump) noiseBurst(x, sr, c.thump[0] * (0.4 + 0.6 * vel), c.thump[1], c.thump[2], rnd); // 손가락이 줄을 지판에 부딪는 '퉁'
  x = addBody(x, sr, c.body, body);
  yield;
  if (c.drop) x = warp(x, sr, s => c.drop * vel * Math.exp(-s / 0.06)); // 업라이트 베이스: 세게 뜯으면 처음에 살짝 높았다가 내려앉는다
  if (c.vibr) { // 농현: 뜯고 조금 뒤부터 음을 흔든다
    const [at, rate, depth, bend] = c.vibr;
    x = warp(x, sr, s => {
      const k = clamp((s - at) / 0.35, 0, 1);
      return k * (depth * Math.sin(2 * Math.PI * rate * (s - at)) + bend * k);
    });
  }
  return fadeTail(x, sr);
}

/* ---------- 때리기 (모드 합성): 배음마다 길이가 다른 사인파를 더한다 ---------- */
function* strike(c, f, vel, tone, dmul, body, sr, rnd) {
  const T1 = clamp(c.t60 * Math.pow(261.63 / f, c.ts) * dmul, 0.05, 20);
  const n = Math.max(256, Math.ceil(sr * Math.min(c.max || 8, T1 + 0.06)));
  const out = new Float32Array(n);
  const hard = clamp(0.15 + 0.45 * tone + 0.5 * vel, 0.05, 1.1);
  for (let k = 0; k < c.modes.length; k++) {
    const [ratio, amp, tk] = c.modes[k];
    resonate(out, sr, f * ratio, amp * (k ? Math.pow(hard, c.hx || 1.4) : 1), T1 * tk);
    yield;
  }
  if (c.click) noiseBurst(out, sr, c.click[0] * hard, c.click[1], clamp(c.click[2] - 0.3 * hard, 0, 0.95), rnd);
  if (c.trem) { // 비브라폰 모터: 음량을 천천히 흔든다
    const [rate, depth] = c.trem;
    for (let i = 0; i < n; i++) out[i] *= 1 - depth * (0.5 - 0.5 * Math.cos(2 * Math.PI * rate * i / sr));
  }
  let x = addBody(out, sr, c.body, body);
  yield;
  if (c.drop) x = warp(x, sr, s => c.drop * Math.exp(-s / 0.05)); // 스틸 드럼: 처음에 살짝 높았다가 내려앉는다
  return fadeTail(x, sr);
}

/* ---------- 일렉 피아노 (로즈·우리처): 해머로 때린 쇠막대의 떨림을 픽업이 듣는다 ----------
   막대의 떨림은 때리기처럼 사인파를 더해 만들고, 픽업은 막대가 지나는 자리에 따라 다르게 듣는 비선형이라
   세게 칠수록 배음이 늘어 소리가 으르렁거린다(바크). bias: 막대가 픽업 가운데서 비켜난 정도, drive: 세게 칠 때 떨림 폭.
   로즈(자석 픽업)는 가운데를 지날 때 꺾이는 종 모양이라 짝수 배음이 먼저, 우리처(정전 픽업)는 한쪽으로 기운 부드러운 클리핑 */
function* epiano(c, f, vel, tone, dmul, body, sr, rnd) {
  const T1 = clamp(c.t60 * Math.pow(261.63 / f, c.ts) * dmul, 0.2, 16);
  const n = Math.max(256, Math.ceil(sr * Math.min(c.max || 6, T1 + 0.06)));
  const x = new Float32Array(n);
  const hard = clamp(0.15 + 0.45 * tone + 0.5 * vel, 0.05, 1.1);
  for (let k = 0; k < c.modes.length; k++) {
    const [ratio, amp, tk] = c.modes[k];
    resonate(x, sr, f * ratio, amp * (k ? Math.pow(hard, c.hx || 1.4) : 1), T1 * tk);
    yield;
  }
  const A = c.drive * Math.pow(vel, 1.5) * (0.6 + 0.8 * tone), b = c.bias;
  const m = Math.min(n, Math.round(sr * 0.25));
  let ein = 0;
  for (let i = 0; i < m; i++) ein += x[i] * x[i];
  if (c.pickup === 'cap') {
    const t0 = Math.tanh(b);
    for (let i = 0; i < n; i++) x[i] = Math.tanh(A * x[i] + b) - t0;
  } else {
    const f0 = 1 / (1 + b * b);
    for (let i = 0; i < n; i++) { const u = A * x[i] + b; x[i] = f0 - 1 / (1 + u * u); }
  }
  // 픽업을 지나기 전과 같은 힘(처음 0.25초)으로 맞춘다: 크기는 세기(Vel)가 정하고, 픽업은 배음만 바꾼다
  let mean = 0, eout = 0;
  for (let i = 0; i < m; i++) mean += x[i];
  mean /= m;
  for (let i = 0; i < m; i++) eout += (x[i] - mean) * (x[i] - mean);
  const g = Math.sqrt(ein / Math.max(1e-12, eout));
  for (let i = 0; i < n; i++) x[i] *= g;
  yield;
  if (c.click) noiseBurst(x, sr, c.click[0] * hard, c.click[1], clamp(c.click[2] - 0.3 * hard, 0, 0.95), rnd);
  let y = dcBlock(x);
  if (c.lp) { // 픽업과 앰프가 높은 소리를 깎는다 (Tone을 올리면 덜 깎는다)
    const a = Math.exp(-2 * Math.PI * Math.min(sr * 0.45, c.lp * (0.5 + tone)) / sr);
    let z = 0;
    for (let i = 0; i < n; i++) { z = (1 - a) * y[i] + a * z; y[i] = z; }
  }
  y = addBody(y, sr, c.body, body);
  yield;
  return fadeTail(y, sr);
}

/* ---------- 피아노: 줄이 살짝 굵어서 배음이 조금씩 높아지고(비조화성), 줄 두세 가닥이 맥놀이한다 ---------- */
function* piano(c, f, vel, tone, dmul, body, sr, rnd, p) {
  const T1 = clamp(c.t60 * Math.pow(130.81 / f, 0.55) * dmul, 0.3, 16);
  const n = Math.max(256, Math.ceil(sr * Math.min(c.max, T1 + 0.1)));
  const out = new Float32Array(n);
  const hard = clamp(0.2 + 0.4 * tone + 0.55 * vel, 0.1, 1.15);
  const hi = Math.max(0, (p - 72) / 24), lo = Math.max(0, (48 - p) / 24);
  const B = c.B * (1 + 2.5 * hi * hi + 0.6 * lo * lo);
  const K = Math.min(c.partials, Math.floor(sr * 0.42 / f));
  const fc = 700 + 5600 * hard * c.bright;
  const alpha = 1.5 - 0.65 * hard;
  const ref = Math.sqrt(1 + B * 9);   // 귀가 음높이를 듣는 2~4번째 배음 근처에 음정을 맞춘다
  for (let k = 1; k <= K; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k) / ref;
    if (fk > sr * 0.45) break;
    const a = Math.pow(k, -alpha) * (0.25 + 0.75 * Math.abs(Math.sin(Math.PI * k * c.strike))) * Math.exp(-fk / fc);
    const T = T1 / (1 + c.hdecay * (k - 1) + fk / 7000);
    if (k <= c.beat) {
      const dc = c.detune * (k === 1 ? 1 : 0.7);
      resonate(out, sr, fk * Math.pow(2, dc / 1200), a * 0.5, T);
      resonate(out, sr, fk * Math.pow(2, -dc / 1200), a * 0.5, T * 0.6);
    } else resonate(out, sr, fk, a, T);
    yield;
  }
  noiseBurst(out, sr, 0.05 * hard * c.thump, 0.014, 0.6, rnd); // 해머가 줄을 치는 소리
  const x = addBody(out, sr, c.body, body);
  yield;
  return fadeTail(dcBlock(x), sr);
}

/* ================= 어쿠스틱 악기 종류 =================
   damp: 건반을 떼면 멈추는 악기(피아노·기타)인지. rel: 그때 멈추는 시간. spread: 음높이에 따라 좌우로 퍼지는 정도.
   demo: 고를 때 들려줄 음. range: 미리 계산해 둘 음역 */
const GTR_BODY = [[98, 2.2, 0.55], [204, 3.5, 0.45], [410, 4, 0.25], [2600, 1.5, 0.12]];
const AC = {
  grand:    { fn: piano, t60: 7.5, max: 6, B: 0.9e-4, partials: 22, strike: 1 / 8.3, hdecay: 0.06, beat: 3, detune: 0.7, bright: 1, thump: 1, body: [[110, 1.4, 0.18], [700, 1.2, 0.08]], damp: true, rel: 0.18, spread: 0.45, demo: 60, range: [48, 72] },
  upright:  { fn: piano, t60: 4.8, max: 5, B: 1.2e-4, partials: 18, strike: 1 / 7.5, hdecay: 0.09, beat: 3, detune: 2.4, bright: 0.72, thump: 1.4, body: [[160, 1.5, 0.3], [520, 1.6, 0.18]], damp: true, rel: 0.14, spread: 0.3, demo: 60, range: [48, 72] },
  nylon:    { fn: pluck, t60: 2.6, ts: 0.45, max: 5, S: 0.42, Sv: 0.25, exc: 0.62, pick: 0.2, body: GTR_BODY, damp: true, rel: 0.12, spread: 0.15, demo: 55, range: [40, 69] },
  steel:    { fn: pluck, t60: 3.2, ts: 0.45, max: 6, S: 0.28, Sv: 0.25, exc: 0.38, pick: 0.13, body: GTR_BODY, damp: true, rel: 0.12, spread: 0.15, demo: 55, range: [40, 69] },
  electric: { fn: pluck, t60: 4.2, ts: 0.4, max: 4, S: 0.24, Sv: 0.25, exc: 0.42, pick: 0.15, tri: 0.9, diff: true, pickup: 0.23, pu: [3200, 1.4], damp: true, rel: 0.1, spread: 0, demo: 57, range: [40, 72] },
  mute:     { fn: pluck, t60: 0.22, ts: 0.25, max: 1, S: 0.48, Sv: 0.1, exc: 0.55, pick: 0.13, body: GTR_BODY, damp: true, rel: 0.05, spread: 0, demo: 52, range: [40, 64] },
  bass:     { fn: pluck, low: true, lvl: 6, t60: 3.6, ts: 0.3, max: 5, S: 0.4, Sv: 0.2, exc: 0.7, pick: 0.17, tri: 0.9, diff: true, pu: [1800, 0.8], loop: 2500, body: [[60, 1.5, 0.3]], damp: true, rel: 0.09, spread: 0, demo: 40, range: [28, 52] },
  harp:     { fn: pluck, t60: 5, ts: 0.5, max: 7, S: 0.4, Sv: 0.2, exc: 0.8, pick: 0.5, body: [[180, 1.6, 0.35], [520, 2, 0.15]], damp: false, rel: 0.5, spread: 0.5, demo: 60, range: [43, 79] },
  gayageum: { fn: pluck, lvl: 2, t60: 2.4, ts: 0.4, max: 5, S: 0.32, Sv: 0.25, exc: 0.5, pick: 0.24, body: [[150, 1.5, 0.4], [390, 2.2, 0.25], [1200, 2, 0.1]], vibr: [0.32, 5.2, 18, 6], damp: false, rel: 0.4, spread: 0.3, demo: 62, range: [50, 74] },
  pizz:     { fn: pluck, t60: 0.55, ts: 0.35, max: 1.6, S: 0.47, Sv: 0.1, exc: 0.7, pick: 0.28, body: [[280, 3, 0.5], [460, 3, 0.3], [1100, 2.5, 0.25], [2900, 2, 0.12]], damp: false, rel: 0.2, spread: 0.3, demo: 60, range: [43, 76] },
  marimba:  { fn: strike, t60: 1.15, ts: 0.75, max: 3, modes: [[1, 1, 1], [3.99, 0.26, 0.28], [9.85, 0.09, 0.1]], hx: 1.6, click: [0.06, 0.006, 0.75], damp: false, rel: 0.25, spread: 0.45, demo: 60, range: [48, 84] },
  vibes:    { fn: strike, t60: 4.2, ts: 0.4, max: 6, modes: [[1, 1, 1], [4.0, 0.32, 0.38], [10.0, 0.11, 0.18]], hx: 1.5, click: [0.04, 0.004, 0.6], trem: [4.8, 0.36], damp: false, rel: 0.3, spread: 0.45, demo: 65, range: [53, 89] },
  glock:    { fn: strike, t60: 3, ts: 0.3, max: 4, modes: [[1, 1, 1], [2.76, 0.42, 0.55], [5.4, 0.22, 0.32], [8.93, 0.1, 0.2]], hx: 1.2, click: [0.05, 0.003, 0.3], damp: false, rel: 0.3, spread: 0.3, demo: 79, range: [72, 96] },
  musicbox: { fn: strike, t60: 2.1, ts: 0.4, max: 3.5, modes: [[1, 1, 1], [6.27, 0.24, 0.22], [17.55, 0.08, 0.08]], hx: 1, click: [0.08, 0.002, 0.2], damp: false, rel: 0.3, spread: 0.2, demo: 79, range: [67, 91] },
  kalimba:  { fn: strike, t60: 1.7, ts: 0.45, max: 3, modes: [[1, 1, 1], [5.92, 0.2, 0.22], [12.7, 0.06, 0.1]], hx: 1.3, click: [0.07, 0.008, 0.7], body: [[320, 2, 0.35]], damp: false, rel: 0.3, spread: 0.25, demo: 67, range: [60, 84] },
  steeldrum:{ fn: strike, t60: 1.3, ts: 0.5, max: 2.5, modes: [[1, 1, 1], [2, 0.6, 0.8], [3, 0.3, 0.55], [4.03, 0.13, 0.32], [5.1, 0.05, 0.2]], hx: 1.2, click: [0.05, 0.005, 0.5], drop: 25, damp: false, rel: 0.3, spread: 0.3, demo: 64, range: [55, 84] },
  bell:     { fn: strike, t60: 6, ts: 0.3, max: 8, modes: [[0.5, 0.55, 1.6], [1, 1, 1], [1.19, 0.55, 0.8], [1.5, 0.38, 0.7], [2.0, 0.5, 0.6], [2.5, 0.22, 0.45], [2.66, 0.2, 0.4], [3.01, 0.14, 0.35], [4.07, 0.09, 0.25]], hx: 1.1, click: [0.04, 0.004, 0.3], damp: false, rel: 0.6, spread: 0.2, demo: 60, range: [48, 79] },
  /* 재즈 힙합에 자주 쓰는 악기 */
  felt:     { fn: piano, t60: 3.6, max: 4.5, B: 1.1e-4, partials: 14, strike: 1 / 7, hdecay: 0.16, beat: 3, detune: 1.6, bright: 0.42, thump: 2.6, body: [[150, 1.4, 0.32], [480, 1.6, 0.16]], damp: true, rel: 0.16, spread: 0.3, demo: 60, range: [48, 72] },
  rhodes:   { fn: epiano, t60: 6, ts: 0.6, max: 6, modes: [[1, 1, 1], [7.1, 0.17, 0.035], [20.2, 0.05, 0.012]], hx: 1.5, drive: 1.3, bias: 0.55, click: [0.025, 0.005, 0.85], lp: 6500, body: [[190, 1, 0.18]], damp: true, rel: 0.2, spread: 0.35, demo: 60, range: [41, 77] },
  wurli:    { fn: epiano, pickup: 'cap', t60: 3.4, ts: 0.6, max: 4.5, modes: [[1, 1, 1], [6.5, 0.11, 0.05]], hx: 1.4, drive: 2.4, bias: 0.35, click: [0.03, 0.004, 0.75], lp: 5200, body: [[340, 1, 0.2]], damp: true, rel: 0.12, spread: 0.3, demo: 60, range: [41, 77] },
  dbass:    { fn: pluck, low: true, lvl: 6, t60: 1.9, ts: 0.3, max: 4, S: 0.45, Sv: 0.15, exc: 0.95, pick: 0.22, tri: 0.8, thump: [0.5, 0.03, 0.93], body: [[62, 1.6, 0.45], [118, 2.2, 0.35], [240, 2.5, 0.18]], drop: 14, damp: true, rel: 0.12, spread: 0, demo: 40, range: [28, 55] },
  jazzgtr:  { fn: pluck, t60: 2.4, ts: 0.4, max: 5, S: 0.46, Sv: 0.15, exc: 0.9, pick: 0.2, tri: 0.6, pickup: 0.26, body: [[105, 2, 0.25], [210, 2.5, 0.2], [420, 3, 0.1]], damp: true, rel: 0.12, spread: 0, demo: 55, range: [40, 72] },
  /* 일렉 기타 (앰프에 넣어 쓰는 소리): 통이 없어 울림이 길고, 픽업 자리와 코일 공진이 소리 색을 정한다.
     tri: 피크로 튕긴 줄 모양(삼각형) · diff: 자석 픽업은 줄의 빠르기를 듣는다 · coil2: 험버커의 둘째 코일 자리 ·
     pu: 픽업 공진 [Hz, Q] (싱글은 높고 뾰족, 험버커는 낮고 둥글게) · loop: 높은 배음이 빨리 사라지게 (베이스·팜 뮤트) */
  strat:    { fn: pluck, t60: 4.4, ts: 0.4, max: 4, S: 0.22, Sv: 0.22, exc: 0.42, pick: 0.12, tri: 0.95, diff: true, pickup: 0.14, pu: [4200, 1.8], damp: true, rel: 0.1, spread: 0, demo: 57, range: [40, 71] },
  humbucker:{ fn: pluck, t60: 4.6, ts: 0.4, max: 4, S: 0.26, Sv: 0.22, exc: 0.42, pick: 0.13, tri: 0.95, diff: true, pickup: 0.15, coil2: 0.18, pu: [3000, 1.5], riff: 'power', damp: true, rel: 0.1, spread: 0, demo: 52, range: [40, 71] },
  /* 팜 뮤트: 손날로 줄 끝을 눌러 짧고 둔하게 끊기는 소리 (메탈·펑크 리프의 '징징') */
  palm:     { fn: pluck, t60: 0.34, ts: 0.15, max: 1.2, S: 0.45, Sv: 0.1, exc: 0.5, pick: 0.12, tri: 0.85, diff: true, loop: 1200, pickup: 0.15, coil2: 0.18, pu: [2600, 1.2], thump: [0.25, 0.012, 0.85], riff: 'palm', damp: true, rel: 0.05, spread: 0, demo: 40, range: [38, 64] },
  /* 리드 기타: 넥 쪽 험버커에 길게 끌면 손가락 비브라토가 들어간다 */
  egtr_lead:{ fn: pluck, t60: 5, ts: 0.35, max: 4.5, S: 0.24, Sv: 0.22, exc: 0.4, pick: 0.14, tri: 0.95, diff: true, pickup: 0.2, coil2: 0.23, pu: [2800, 1.5], vibr: [0.32, 5.6, 22, 0], solo: true, damp: true, rel: 0.12, spread: 0, demo: 69, range: [52, 84] },
  /* 피크 베이스: 피크로 쳐서 어택이 또렷하고 가운데가 그르렁거린다 */
  pickbass: { fn: pluck, low: true, lvl: 6, t60: 3.2, ts: 0.3, max: 4, S: 0.32, Sv: 0.2, exc: 0.55, pick: 0.13, tri: 0.8, diff: true, loop: 3500, pickup: 0.2, coil2: 0.24, pu: [2400, 1], damp: true, rel: 0.08, spread: 0, demo: 40, range: [28, 52] }
};

/* 계산한 소리 보관: 오래 안 쓴 것부터 버린다 */
const CACHE = new Map();
let cacheSamples = 0, evicted = 0;
const pwBusy = new Set();   // 미리 계산하고 있는 악기들
const missed = [];
let missCount = 0;
const CACHE_CAP = 12e6;   // 약 48 MB
const REF = new Map();    // 종류별 크기 맞춤 배율
const qz = v => Math.round(v * 20) / 20;
function cacheGet(key) {
  const e = CACHE.get(key);
  if (!e) return null;
  CACHE.delete(key);
  CACHE.set(key, e);
  return e;
}
function cachePut(key, buf) {
  CACHE.set(key, buf);
  cacheSamples += buf.length;
  for (const [k, b] of CACHE) {
    if (cacheSamples <= CACHE_CAP) break;
    if (k === key) continue;
    CACHE.delete(k);
    cacheSamples -= b.length;
    evicted++;
  }
}
const VB = [0.4, 0.7, 0.95];  // 세기 칸: 여리게 · 보통 · 세게
const vbOf = vel => (vel < 58 ? 0 : vel < 100 ? 1 : 2);
/* 한 음을 계산하는 제너레이터. 끝까지 돌리면 소리(Float32Array)를 돌려준다 */
function noteGen(inst, p, b, tone, decay, body, sr) {
  const c = AC[inst] || AC.grand;
  const rnd = rng((p * 7919 + b * 104729 + inst.length * 31) | 0);
  return c.fn(c, mtof(p), VB[b], tone, decay, body, sr, rnd, p);
}
function runAll(gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}
const renderNote = (...a) => runAll(noteGen(...a));
/* 종류마다 크기를 맞추는 배율. 대표 음을 세게 친 소리의 '들리는 크기'(400ms 창 RMS의 최댓값)를 맞추되
   줄을 뜯는 악기처럼 첫 봉우리가 뾰족한 소리는 봉우리가 넘치지 않는 데까지만 키운다.
   세기 100 · Volume -6dB · 가운데 자리에서 RMS -25dB, 봉우리 -10dB가 되는 값이다. lvl은 종류별 덧셈(dB) */
const LOUD_RMS = 0.196, LOUD_PEAK = 1.1;
function* refGen(inst, sr) {
  const c = AC[inst] || AC.grand;
  const x = yield* noteGen(inst, c.demo, 2, 0.5, 1, 0.5, sr);
  let pk = 1e-6, rms = 1e-6;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; }
  const W = Math.round(0.4 * sr), hop = Math.round(W / 4);
  for (let s = 0; s < x.length; s += hop) {
    let e = 0;
    for (let i = s, end = Math.min(x.length, s + W); i < end; i++) e += x[i] * x[i];
    rms = Math.max(rms, Math.sqrt(e / W));
  }
  REF.set(inst + '|' + sr, Math.pow(10, (c.lvl || 0) / 20) * Math.min(LOUD_RMS / rms, LOUD_PEAK / pk));
}
function refGain(inst, sr) {
  const k = inst + '|' + sr;
  if (!REF.has(k)) runAll(refGen(inst, sr));
  return REF.get(k);
}

class Acoustic extends U.Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.maxVoices = 32;
    this.pw = { list: [], warm: [], timer: 0, job: null };
    this.prewarmSoon();
  }
  cfg() { return AC[this.v.inst] || AC.grand; }
  /* 지금 값으로 이 음을 계산할 때의 이름표와 재료 */
  noteSpec(p, b) {
    const P = this.v, inst = AC[P.inst] ? P.inst : 'grand', sr = this.ctx.sampleRate;
    const a = [inst, p, b, qz(P.tone), qz(P.decay), qz(P.body), sr];
    return { key: a.join('|'), a, inst, sr };
  }
  /* 이 음의 소리 (없으면 지금 계산. 미리 계산하던 음이면 그것을 마저 끝낸다) */
  buffer(p, b) {
    const sp = this.noteSpec(p, b);
    const ab = cacheGet(sp.key);
    if (ab) return ab;
    const job = this.pw.job;
    if (job && job.key === sp.key) { this.pw.job = null; return this.store(sp, runAll(job.gen)); }
    missed.push(sp.key);   // 미리 계산하지 못해 칠 때 계산한 음 (테스트에서 본다)
    if (missed.length > 50) missed.shift();
    missCount++;
    return this.store(sp, renderNote(...sp.a));
  }
  store(sp, x) {
    const g = refGain(sp.inst, sp.sr);
    for (let i = 0; i < x.length; i++) x[i] *= g;
    const ab = this.ctx.createBuffer(1, x.length, sp.sr);
    ab.getChannelData(0).set(x);
    cachePut(sp.key, ab);
    return ab;
  }
  voice(p, vel, t) {
    const P = this.v, c = this.cfg(), ctx = this.ctx;
    if (p < 12 || p > 115) return null;
    const buf = this.buffer(p, vbOf(vel));
    // 같은 줄·같은 건반을 다시 치면 앞소리는 짧게 멈춘다
    for (const vo of this.voices) if (vo.p === p && vo.end > t && vo.t0 < t) { vo.amp.gain.setTargetAtTime(0, t, 0.015); vo.end = Math.min(vo.end, t + 0.08); stopAt(vo.srcs[0], vo.end); }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const rate = Math.pow(2, (P.tune || 0) / 1200);
    src.playbackRate.value = rate;
    const amp = gainNode(ctx, velGain(vel, P.vel));
    src.connect(amp);
    const nodes = [src, amp];
    // 음높이에 따라 좌우로 조금 벌린다. 가운데에 두는 악기도 패너를 거쳐야 크기가 다른 악기와 같다
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp((p - 60) / 42, -1, 1) * (c.spread || 0);
      amp.connect(pan); pan.connect(this.out); nodes.push(pan);
    } else amp.connect(this.out);
    src.start(t);
    const natEnd = t + buf.duration / rate + 0.01;
    stopAt(src, natEnd);
    return { amp, srcs: [src], nodes, end: natEnd, natEnd };
  }
  release(vo, t) {
    const c = this.cfg();
    if (!c.damp) return;   // 하프·말렛·종은 손을 떼도 끝까지 울린다
    const r = c.rel * (this.v.rel || 1);
    vo.amp.gain.setTargetAtTime(0, t, r / 4);
    vo.end = Math.min(vo.natEnd, t + r * 1.6 + 0.02);
    stopAt(vo.srcs[0], vo.end);
  }
  /* 미리 듣기처럼 곧 칠 음들을 먼저 계산해 둔다 (계산하느라 첫 음들이 밀리지 않게) */
  prepare(notes) { for (const n of notes) if (n.p >= 12 && n.p <= 115) this.buffer(n.p, vbOf(n.v || 100)); }
  /* 연주 화면이 곧 칠 음 (기타 코드 줄 …): 쉬는 틈에 다른 미리 계산보다 먼저. 보관함이 꽉 차 가면 하지 않는다 */
  warm(notes) {
    if (this.eng.offline) return;
    const pw = this.pw;
    pw.warm = [...new Set(notes.filter(n => n.p >= 12 && n.p <= 115).map(n => n.p + '|' + vbOf(n.v || 100)).concat(pw.warm))];
    if (!pwBusy.has(this) && pw.warm.length) { pwBusy.add(this); pw.timer = setTimeout(() => this.pwStep(), 0); }
  }
  param(id, v, t) {
    if (id === 'vol') { if (this.on) smooth(this.out.gain, this.outLevel(), t); return; }
    if (id === 'inst' || id === 'tone' || id === 'decay' || id === 'body') this.prewarmSoon();
  }
  /* 쉬는 틈에 이 트랙 클립에 쓰인 음과 가운데 음역을 미리 계산해 둔다 (재생 중에 계산하느라 늦지 않게) */
  prewarmSoon() {
    if (this.eng.offline) return;
    clearTimeout(this.pw.timer);
    pwBusy.add(this);
    this.pw.timer = setTimeout(() => this.prewarm(), 300);
  }
  prewarm() {
    const want = new Set();
    const pr = this.eng.project;
    const tr = pr && pr.tracks.find(t => t.devices.some(d => d.id === this.dev.id));
    const add = n => want.add(n.p + '|' + vbOf(n.v || 100));
    if (tr) {
      for (const cl of tr.slots) if (cl && cl.notes) cl.notes.forEach(add);
      for (const a of tr.arr) if (a.clip && a.clip.notes) a.clip.notes.forEach(add);
    }
    // 가운데 음역은 클립에 쓰인 음 다음에, 보관함이 넉넉할 때만 (여러 트랙이 함께 쓰므로 클립 음을 밀어내지 않게)
    const [lo, hi] = this.cfg().range || [48, 72];
    const list = [...want];
    for (let p = lo; p <= hi && list.length < 120; p++) if (!want.has(p + '|2')) list.push(p + '|2|r');
    this.pw.list = list;
    this.pwStep();
  }
  /* 한 번에 6ms쯤만 계산하고 쉰다. 긴 음도 배음·조각 단위로 나눠 계산해서 화면과 재생 예약이 밀리지 않는다 */
  pwStep() {
    const pw = this.pw, t0 = performance.now(), sr = this.ctx.sampleRate;
    while (performance.now() - t0 < 6) {
      if (!pw.job) {
        const inst = AC[this.v.inst] ? this.v.inst : 'grand';
        if (!REF.has(inst + '|' + sr)) pw.job = { gen: refGen(inst, sr) };   // 크기 맞춤 배율부터
        else {
          if (!pw.warm.length && !pw.list.length) break;
          const warm = pw.warm.length > 0;
          const it = (warm ? pw.warm : pw.list).shift().split('|'), p = +it[0], b = +it[1];
          if (p < 12 || p > 115 || (it[2] && cacheSamples > CACHE_CAP * 0.6) || (warm && cacheSamples > CACHE_CAP * 0.8)) continue;
          const sp = this.noteSpec(p, b);
          if (cacheGet(sp.key)) continue;   // 이미 있으면 방금 쓴 것으로 표시만 (다른 음을 계산하는 동안 밀려나지 않게)
          pw.job = { key: sp.key, sp, gen: noteGen(...sp.a) };
        }
      }
      const r = pw.job.gen.next();
      if (r.done) { const job = pw.job; pw.job = null; if (job.sp) this.store(job.sp, r.value); }
    }
    if (pw.warm.length || pw.list.length || pw.job) { pwBusy.add(this); pw.timer = setTimeout(() => this.pwStep(), 20); }
    else pwBusy.delete(this);
  }
  dispose() { clearTimeout(this.pw.timer); this.pw.list = []; this.pw.warm = []; this.pw.job = null; pwBusy.delete(this); super.dispose(); }
}

/* ================= 앙상블 (실시간) =================
   osc: [파형, 디튠(센트), 크기] · pw: 배음 크기(직접 만든 파형) · drawbars: 해먼드 드로바 9개(0~8)
   lp: 로우패스 컷오프 = 음 주파수 × [어두울 때, 밝을 때] · form: 포먼트 [주파수, Q, 크기] · dry: 포먼트를 안 거친 소리
   env: [어택, 디케이, 서스테인, 릴리스] · fenv: 브라스 [시작 배율, 열리는 시간, 머무는 배율]
   vib: [빠르기, 깊이(센트), 늦게 시작] · noise: [숨소리 크기, 주파수 배율, Q] · leslie: [음량 흔들기, 음높이 흔들기(센트)]
   perc: 오르간 퍼커션 [배음, 크기, 길이] · drive: 오버드라이브 · gain: 크기 맞춤 · trim: 드라이브 뒤 크기(dB) */
const EN = {
  strings:   { osc: [['sawtooth', 0, 0.55], ['sawtooth', -12, 0.5], ['sawtooth', 11, 0.5]], lp: [2.2, 8], q: 0.5, form: [[300, 1.2, 0.6], [1100, 1.4, 0.35], [3000, 2, 0.2]], dry: 0.7, env: [0.3, 0.4, 0.9, 0.5], vib: [5.4, 10, 0.35], gain: 0.32, demo: 60 },
  violin:    { solo: true, osc: [['sawtooth', 0, 1]], lp: [3, 12], q: 0.7, form: [[290, 3, 0.9], [540, 3, 0.5], [2900, 2.5, 0.7]], dry: 0.45, env: [0.09, 0.3, 0.9, 0.25], vib: [6, 22, 0.25], gain: 0.41, demo: 72 },
  cello:     { solo: true, osc: [['sawtooth', 0, 1]], lp: [2.5, 9], q: 0.7, form: [[200, 2.5, 0.9], [420, 3, 0.45], [1500, 2, 0.4]], dry: 0.5, env: [0.14, 0.4, 0.9, 0.35], vib: [5.2, 18, 0.3], gain: 0.45, demo: 48 },
  brass:     { osc: [['sawtooth', 0, 0.7], ['sawtooth', 7, 0.6]], lp: [3, 10], q: 1.2, fenv: [1.2, 0.06, 0.65], env: [0.05, 0.3, 0.85, 0.2], vib: [5.5, 8, 0.4], gain: 0.4, demo: 55 },
  trumpet:   { solo: true, osc: [['sawtooth', 0, 1]], lp: [4, 13], q: 1.6, fenv: [1.1, 0.045, 0.7], env: [0.035, 0.2, 0.85, 0.15], vib: [5.8, 14, 0.35], gain: 0.38, demo: 67 },
  flute:     { solo: true, pw: [1, 0.14, 0.05, 0.02], lp: [4, 10], q: 0.5, env: [0.07, 0.2, 0.9, 0.15], vib: [5, 14, 0.3], noise: [0.16, 2, 1.4], gain: 0.25, demo: 79 },
  clarinet:  { solo: true, pw: [1, 0.03, 0.62, 0.03, 0.36, 0.02, 0.22, 0.02, 0.12, 0.01, 0.06], lp: [3, 9], q: 0.6, env: [0.05, 0.2, 0.9, 0.12], vib: [5, 6, 0.4], gain: 0.28, demo: 62 },
  choir_a:   { osc: [['sawtooth', 0, 0.6], ['sawtooth', -9, 0.5], ['sawtooth', 8, 0.5]], form: [[800, 6, 1], [1150, 7, 0.65], [2900, 9, 0.32], [3900, 10, 0.16]], dry: 0, lp: [8, 16], q: 0.5, env: [0.28, 0.4, 0.9, 0.45], vib: [5, 9, 0.3], noise: [0.04, 3, 0.8], gain: 1.2, demo: 60 },
  choir_u:   { osc: [['sawtooth', 0, 0.6], ['sawtooth', -9, 0.5], ['sawtooth', 8, 0.5]], form: [[325, 6, 1], [700, 7, 0.45], [2530, 9, 0.14]], dry: 0, lp: [8, 16], q: 0.5, env: [0.3, 0.4, 0.9, 0.5], vib: [5, 9, 0.3], noise: [0.03, 2, 0.8], gain: 1, demo: 60 },
  organ_jazz:  { drawbars: '888000000', lp: [10, 24], q: 0.4, perc: [3, 0.42, 0.24], env: [0.004, 0.05, 1, 0.04], leslie: [0.16, 5], gain: 0.37, demo: 60 },
  organ_rock:  { drawbars: '888800008', lp: [12, 30], q: 0.4, env: [0.004, 0.05, 1, 0.05], leslie: [0.22, 7], drive: 2.6, gain: 0.34, trim: -4.5, demo: 55 },
  organ_church:{ drawbars: '806808046', lp: [8, 22], q: 0.4, env: [0.07, 0.1, 1, 0.3], gain: 0.36, demo: 60 },
  accordion: { osc: [['square', -8, 0.5], ['square', 8, 0.5], ['sawtooth', 0, 0.25]], lp: [3, 9], q: 0.8, form: [[1100, 2, 0.4]], dry: 0.8, env: [0.03, 0.1, 0.95, 0.08], vib: [5.5, 3, 0.3], gain: 0.32, demo: 62 },
  harmonica: { solo: true, osc: [['square', 0, 1]], lp: [3, 8], q: 0.9, form: [[1300, 2.2, 0.7]], dry: 0.6, env: [0.03, 0.1, 0.9, 0.1], vib: [5.5, 24, 0.4], noise: [0.05, 2, 1], gain: 0.3, demo: 67 },
  /* 재즈 힙합에 자주 쓰는 관악기: 색소폰은 리드가 떨리는 원뿔 관이라 배음이 고루 있고 숨소리가 섞인다.
     뮤트 트럼펫(하몬 뮤트)은 낮은 소리가 빠지고 1.5 kHz 근처만 가늘게 울리고, 플루겔혼은 어둡고 둥글다 */
  sax_tenor:   { solo: true, osc: [['sawtooth', 0, 1]], lp: [2.4, 7], q: 1, form: [[520, 2.2, 0.85], [1350, 2.8, 0.5], [2700, 3.5, 0.22]], dry: 0.4, fenv: [1.5, 0.05, 0.85], env: [0.045, 0.25, 0.85, 0.12], vib: [5.2, 12, 0.45], noise: [0.08, 7, 0.8], gain: 0.58, demo: 55 },
  sax_alto:    { solo: true, osc: [['sawtooth', 0, 1]], lp: [2.6, 8], q: 1, form: [[650, 2.2, 0.85], [1750, 2.8, 0.5], [3100, 3.5, 0.22]], dry: 0.4, fenv: [1.5, 0.05, 0.85], env: [0.04, 0.25, 0.85, 0.12], vib: [5.4, 12, 0.4], noise: [0.08, 6, 0.8], gain: 0.535, demo: 67 },
  trumpet_mute:{ solo: true, osc: [['sawtooth', 0, 1]], lp: [6, 16], q: 0.8, form: [[1500, 3, 1], [2700, 4, 0.5], [700, 2, 0.2]], dry: 0.06, fenv: [1.2, 0.04, 0.85], env: [0.03, 0.2, 0.85, 0.12], vib: [5.5, 8, 0.5], noise: [0.03, 6, 1], gain: 1.02, demo: 67 },
  flugel:      { solo: true, osc: [['sawtooth', 0, 0.7], ['triangle', 0, 0.6]], lp: [1.8, 5], q: 0.9, fenv: [0.9, 0.06, 0.85], env: [0.06, 0.3, 0.88, 0.2], vib: [5.2, 10, 0.4], noise: [0.025, 5, 0.8], gain: 0.28, demo: 62 }
};
/* 드로바 9개(16′ 5⅓′ 8′ 4′ 2⅔′ 2′ 1⅗′ 1⅓′ 1′)는 한 옥타브 아래 음의 1·3·2·4·6·8·10·12·16번째 배음이에요 */
const DRAW_H = [1, 3, 2, 4, 6, 8, 10, 12, 16];
function waveFor(ctx, c) {
  const real = new Float32Array(17), imag = new Float32Array(17);
  if (c.drawbars) {
    [...c.drawbars].forEach((ch, i) => { const lv = +ch; if (lv) imag[DRAW_H[i]] += Math.pow(10, (lv - 8) * 3 / 20); });
  } else c.pw.forEach((a, i) => { if (i + 1 < 17) imag[i + 1] = a; });
  return ctx.createPeriodicWave(real, imag);
}
function driveCurve(k) {
  const n = 1024, cur = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cur[i] = Math.tanh(k * x) / norm; }
  return cur;
}

class Ensemble extends U.Instrument {
  constructor(eng, dev) {
    super(eng, dev);
    const ctx = this.ctx;
    this.vbus = gainNode(ctx, 1);
    this.shaper = ctx.createWaveShaper();
    this.trem = gainNode(ctx, 1);
    this.vbus.connect(this.shaper); this.shaper.connect(this.trem); this.trem.connect(this.out);
    this.lfo = ctx.createOscillator();
    this.lfoA = gainNode(ctx, 0);
    this.lfo.connect(this.lfoA); this.lfoA.connect(this.trem.gain);
    this.lfo.start();
    this.waves = new Map();
    this.out.gain.value = this.on ? this.outLevel() : 0;
    this.applyType(ctx.currentTime);
  }
  cfg() { return EN[this.v.inst] || EN.strings; }
  /* 종류가 바뀌면 함께 쓰는 흔들기(비브라토·회전 스피커)와 드라이브를 맞춘다 */
  applyType(t) {
    const c = this.cfg(), P = this.v;
    const rate = c.leslie ? 0.8 + 6 * P.vib : c.vib ? c.vib[0] : 5;
    smooth(this.lfo.frequency, rate, t);
    const ta = c.leslie ? c.leslie[0] * (0.2 + P.vib) : 0, trim = Math.pow(10, (c.trim || 0) / 20);
    smooth(this.lfoA.gain, ta * trim, t);
    smooth(this.trem.gain, (1 - ta) * trim, t);
    this.shaper.curve = c.drive ? driveCurve(c.drive) : null;
  }
  wave(c) {
    const k = this.v.inst;
    if (!this.waves.has(k)) this.waves.set(k, waveFor(this.ctx, c));
    return this.waves.get(k);
  }
  cutoff(c, f, vel) {
    const b = clamp(this.v.bright, 0, 1), [lo, hi] = c.lp || [6, 16];
    return clamp(f * (lo + (hi - lo) * b) * (0.75 + 0.5 * vel / 127), 120, 18000);
  }
  voice(p, vel, t) {
    const ctx = this.ctx, P = this.v, c = this.cfg();
    const f = mtof(p);
    const mix = gainNode(ctx, 1), post = gainNode(ctx, 1), amp = gainNode(ctx, 0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = c.q != null ? c.q : 0.7;
    const cut = this.cutoff(c, f, vel);
    lp.frequency.value = cut;
    const vg = gainNode(ctx, 0);   // 이 음의 비브라토 깊이(센트)
    this.lfo.connect(vg);
    const nodes = [mix, post, amp, lp, vg], srcs = [];
    const spread = 0.3 + 1.4 * clamp(P.width, 0, 1);
    const addOsc = (type, det, lvl, mul) => {
      const o = ctx.createOscillator();
      if (type === 'wave') o.setPeriodicWave(this.wave(c));
      else o.type = type;
      o.frequency.value = f * (mul || 1);
      o.detune.value = det * spread;
      const g = gainNode(ctx, lvl);
      o.connect(g); g.connect(mix);
      vg.connect(o.detune);
      o.start(t);
      srcs.push(o); nodes.push(o, g);
    };
    if (c.osc) for (const [w, det, lvl] of c.osc) addOsc(w, det, lvl);
    if (c.pw) addOsc('wave', 0, 1);
    if (c.drawbars) addOsc('wave', 0, 1, 0.5);
    if (c.noise) {
      const nz = U.noiseSource(ctx, true), bp = ctx.createBiquadFilter(), g = gainNode(ctx, c.noise[0]);
      bp.type = 'bandpass'; bp.frequency.value = clamp(f * c.noise[1], 200, 12000); bp.Q.value = c.noise[2];
      nz.connect(bp); bp.connect(g); g.connect(mix);
      nz.start(t, Math.random() * 1.5);
      srcs.push(nz); nodes.push(nz, bp, g);
    }
    if (c.perc) { // 오르간 퍼커션: 누를 때 한 번 '똑' 하는 높은 배음
      const o = ctx.createOscillator(), g = gainNode(ctx, 0);
      o.frequency.value = f * c.perc[0];
      g.gain.setValueAtTime(c.perc[1], t);
      g.gain.setTargetAtTime(0, t, c.perc[2] / 3);
      o.connect(g); g.connect(mix);
      o.start(t);
      srcs.push(o); nodes.push(o, g);
    }
    if (c.form) {
      if (c.dry) { const d = gainNode(ctx, c.dry); mix.connect(d); d.connect(post); nodes.push(d); }
      for (const [fq, q, g] of c.form) {
        const bp = ctx.createBiquadFilter(), gg = gainNode(ctx, g);
        bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
        mix.connect(bp); bp.connect(gg); gg.connect(post);
        nodes.push(bp, gg);
      }
    } else mix.connect(post);
    post.connect(lp); lp.connect(amp); amp.connect(this.vbus);
    if (c.fenv) { // 브라스: 소리가 날 때 필터가 확 열렸다 조금 닫힌다
      lp.frequency.setValueAtTime(clamp(f * c.fenv[0], 80, 18000), t);
      lp.frequency.setTargetAtTime(cut, t, c.fenv[1]);
      lp.frequency.setTargetAtTime(cut * c.fenv[2], t + c.fenv[1] * 4, 0.4);
    }
    if (c.leslie) vg.gain.value = c.leslie[1];
    else if (c.vib) {
      vg.gain.setValueAtTime(0, t);
      vg.gain.setTargetAtTime(c.vib[1] * 2 * clamp(P.vib, 0, 1), t + c.vib[2], 0.25);
    }
    const [a, d, s] = c.env;
    envOn(amp.gain, t, velGain(vel, P.vel) * c.gain, a * P.atk, d, s);
    return { amp, lp, vg, srcs, nodes };
  }
  release(vo, t) {
    const r = this.cfg().env[3] * (this.v.rel || 1);
    envOff(vo.amp.gain, t, r);
    vo.end = envEnd(t, r);
    for (const s of vo.srcs) stopAt(s, vo.end);
  }
  free(vo) {
    try { this.lfo.disconnect(vo.vg); } catch (e) { /* 이미 끊김 */ }
    super.free(vo);
  }
  param(id, v, t) {
    if (id === 'vol') { if (this.on) smooth(this.out.gain, this.outLevel(), t); return; }
    if (id === 'inst' || id === 'vib') this.applyType(t);
    if (id === 'bright') { const c = this.cfg(); for (const vo of this.activeVoices(t)) smooth(vo.lp.frequency, this.cutoff(c, mtof(vo.p), 100), t); }
  }
  dispose() {
    super.dispose();
    setTimeout(() => { try { this.lfo.stop(); this.lfo.disconnect(); } catch (e) { /* 무시 */ } }, 120);
  }
}

/* 고를 때 들려줄 음 (악기마다 잘 들리는 음역) */
/* 악기 종류의 설정 (미리 듣기 음역 등): demo 대표 음 · low 베이스 줄 · solo 혼자 부는 악기 */
U.instMeta = (kind, inst) => kind === 'acoustic' ? AC[inst] || AC.grand : kind === 'ensemble' ? EN[inst] || EN.strings : null;
U.instDemo = (kind, inst) => (U.instMeta(kind, inst) || {}).demo || 60;
U.acousticDSP = { render: renderNote, AC, EN, cacheSize: () => cacheSamples, evictions: () => evicted, cacheCap: CACHE_CAP, busy: () => pwBusy.size, missed: () => missed.slice(), misses: () => missCount };
U.DEVICE_CLASSES = Object.assign(U.DEVICE_CLASSES || {}, { acoustic: Acoustic, ensemble: Ensemble });
})(window.U = window.U || {});
