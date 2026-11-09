# 울림 스튜디오 — 구조

개발용 문서다. 사용법은 [../README.md](../README.md), 작업 규칙은 [../CLAUDE.md](../CLAUDE.md).
2026-11-09에 README의 '데이터 저장 방식' · '파일' · '기술 메모'와 '웹사이트로 쓰기'의 개발 내용을 옮기고, 코드에서 확인한 내용으로 보강했다.
숫자(줄 수, 개수)는 2026-11-10 저장소 기준이다(PR #40 머지 뒤). PR #40(드럼 킷 준비 중 소리 누락 수정)에 맞춰 기술 메모와 서비스 워커 절을 고쳤다.

## 한눈에
- 빌드 없음. `index.html`이 `app.css`와 `js/`의 43개 파일을 정해진 순서로 읽는다. 라이브러리 없음, 바깥에서 받는 것은 Google Fonts뿐(Black Han Sans, IBM Plex Mono · Sans Condensed · Sans KR).
- JS는 모듈이 아니라 전역 코드다. 파일마다 `(function (U) { 'use strict'; … })(window.U = window.U || {})` 모양이고, 전역 객체 `window.U` 하나에 기능을 붙인다.
- 소리는 Web Audio. 대부분 앱 안에서 합성하고, 일부 실제 악기는 `samples/`의 MP3를 처음 쓸 때 받는다.
- 화면 상태는 `U.ui`, 프로젝트는 `U.project`, 오디오 엔진은 `U.engine`이다.
- 큰 파일(빈 줄 포함): `engine.js` 1,306줄, `ui-clip.js` 1,197줄, `instruments.js` 1,024줄, `ui-devices.js` 903줄, `acoustic.js` 903줄. `app.css`는 1,548줄.

## 시작 순서 (`js/main.js`의 `boot()`)
1. `applySkin()` 화면 밝기(`data-skin`) → `createAudio()` AudioContext와 `U.engine = new U.Engine(ctx)` → `buildLayout()` 화면 틀 → `wire()` 이벤트 연결
2. 데모 곡을 `U.normalize()`해 `U.project`에 넣고 되돌리기 기록을 시작
3. 컨트롤 바 · 브라우저 · 세션 · 어레인지먼트 · 패드 화면 `build()`, 정보 창, `U.input.init()`, 파일 끌어다 놓기
4. `checkNarrow()`(좁은 화면인지) → `U.shell.apply()`(디자인 적용) → 첫 그리기
5. `U.engine.start()`(스케줄러 시작) → `setupWebApp()`(서비스 워커 등록, https·localhost에서만) → `pickStartProject()`(마지막 프로젝트 또는 시작 창)

## 데이터 흐름
```
편집(actions.js, ui-*.js) ─ U.project를 바꾼다
   └ U.commit('편집 이름')                         (model.js)
       ├ 되돌리기 기록: 프로젝트 JSON 통째, 최대 150단계
       └ U.emit('change') → main.js wire()
            ├ U.engine.sync(project)              소리가 바뀐 내용을 따라온다
            ├ U.inval('transport','session',…)    다음 프레임에 한 번 다시 그린다
            └ 1.5초 뒤 autosave → U.store.saveProject()
끄는 도중: U.touch() → emit('change', {live:true}) → 엔진과 일부 그리기만 (기록·저장 없음)
```
- 다시 그리기: `U.renderer('이름', fn)`으로 등록하고 `U.inval('이름')`으로 부른다(`requestAnimationFrame`에서 한 번). `U.inval('all')`은 모두. 매 프레임 일(미터·재생 위치)은 `U.frame(fn)`.
- 이벤트: `U.on` · `U.off` · `U.emit`(`util.js`). 쓰이는 이벤트: `change`, `project`, `store`, `uimode`, `theme`, `tempo`, `select`, `detail`, `midi`, `livenote`, `samples`, `media`, `sounds`, `files`, `favs`, `engine:transport`, `engine:override`.

## 스크립트 순서와 `U`에 붙는 것
순서는 `index.html` = `sw.js`의 `CORE` 순서다. 뒤 파일은 앞 파일이 붙인 이름을 쓸 수 있고, 앞 파일은 뒤 파일 이름을 **읽는 순간에는** 쓸 수 없다(함수 안에서 나중에 부르는 것은 된다).

| # | 파일 | 붙이는 것 (대표) |
|---|---|---|
| 1 | `util.js` | `h` `$` `clamp` `mtof` `dbToGain` `uid` `clone` `debounce` `SCALES` `COLORS` `on/off/emit` `pref/setPref` `cssVar` 등 57개 |
| 2 | `gestures.js` | `isIOS` `isTouch` `uiMode` `setUIMode` `uiModeName` `gestures` |
| 3 | `devices.js` | `DEV`(장치 정의) `defaults` `makeDevice` `devName` `PAD_TYPES` `pad` `keyLabel` |
| 4 | `dsp.js` | `envOn` `envOff` `envEnd` `smooth` `stopAt` `gainNode` `velGain` `renderDrum` `makeIR` `OfflineCtx` |
| 5 | `instruments.js` | `Device` `Instrument` `MidiFx` `drumRec` `DEVICE_CLASSES`(합쳐 넣기) |
| 6 | `effects.js` | `AudioFx` `AMP_MODELS` |
| 7 | `samples.js` | `SAMPLE_SETS` `DRUM_SETS` |
| 8 | `acoustic.js` | `instMeta` `instDemo` `acousticDSP` `DEVICE_CLASSES`(합쳐 넣기) |
| 9 | `model.js` | `newProject` `newTrack` `newMidiClip` `normalize` `commit` `touch` `undo` `redo` `setProject` `allTracks` `trackById` 등 |
| 10 | `media.js` | `media` |
| 11 | `content.js` | `KITS` `DEFAULT_KIT` `SOUNDS` `sound` `demoProject` 등 |
| 12 | `templates.js` | `GENRES` `genreProject` `layoutSong` `guessSections` |
| 13 | `engine.js` | `Engine` `TrackNode` `posToDb` `dbToPos` `forEachNote` `autoValue` |
| 14 | `export.js` | `encodeWav` `zip` `midiFile` `renderOffline` `normalizeAudio` `safeName` |
| 15 | `store.js` | `store` |
| 16 | `files.js` | `files` |
| 17 | `mysounds.js` | `allSounds` `mySounds` |
| 18 | `recorder.js` | `audioRec` |
| 19 | `tools.js` | `TOOLS` `runTool` `toolDefaults` `clipKey` |
| 20 | `chords.js` | `chords` |
| 21 | `oldsample.js` | `oldSample` |
| 22 | `ui-core.js` | `ui` `renderer` `inval` `frame` `selectTrack` `showClip` `icon` `dialog` `toast` `bindInfo` 등 |
| 23 | `actions.js` | `act` |
| 24 | `quick.js` | `quick` `favs` |
| 25 | `ui-shell.js` | `shell` `design` `designs` `layout` `togglePads` |
| 26–40 | `ui-transport` · `ui-session` · `ui-mixer` · `ui-arrange` · `ui-clip` · `ui-steps` · `ui-devices` · `ui-shape` · `ui-audioedit` · `ui-browser` · `ui-keys` · `ui-play` · `ui-kit` · `ui-pads` · `ui-start` | 뷰마다 하나씩: `transportBar` `sessionView` `mixerView` `arrangeView` `clipView` `stepView` `deviceView` `shapePanel` `audioEditor` `browserView` `touchKeys` `play` `kitView` `padsView` `songDialog` |
| 41 | `input.js` | `input` `setKeyboard` `setDraw` `setAutoMode` `midiLearn` |
| 42 | `ui-midi.js` | `midiPanel` |
| 43 | `main.js` | `engine` `project` `setView` `openProject` `appMenu` 등. 맨 끝에서 `boot()` |

정확한 "누가 만들고 누가 쓰는지" 지도는 단계 0의 의존 지도 작업에서 자동으로 만든다.

## 화면 상태
- `U.ui`(`ui-core.js`): `view`(`session` | `arrange` | `pads`), `detail`(`clip` | `device`), `track` `slot` `clip` `scene`, `draw` `auto`(그리기·자동화 모드), `narrow` `pane`(좁은 화면에서 보이는 칸) 등.
- 문서에 붙는 표시:
  - `body`: `data-view` `data-pane` `data-design`(a | b | c) `data-step` `data-bmode` `data-tab`, 클래스 `narrow` `no-insp` `no-detail`
  - `html`: 클래스 `touch`(아이패드 버전) `ios`, `data-skin`(앱 안 밝기 설정) `data-theme`
- **디자인 A·B·C** (`ui-shell.js`): A 컨트롤 룸, B 스텝 가이드(단계 1~5), C 작업대(탭 1~5). 고른 값은 prefs `design`.
- **화면 버전** (`gestures.js`): prefs `uiMode` = `auto` | `desktop` | `touch` → `U.isTouch` → `html.touch`. 자동이면 `(any-pointer: coarse)`이거나 iOS일 때 아이패드 버전.
- **좁은 화면** (`main.js` `checkNarrow()`): 창 폭이 860px 미만(컴퓨터 버전을 직접 골랐으면 600px 미만)이면 `body.narrow`. 이때는 디자인과 상관없이 아래 탭으로 한 칸씩 본다.
- A의 오른쪽 '고른 트랙' 칸은 직접 정하기 전에는 컴퓨터 버전이면서 폭 1360px 이상일 때만 열린다(`ui-shell.js` `inspOn`).
- `app.css`에서 세 스위치가 겹치는 정도: `data-design` 선택자 약 117개(B가 가장 많음), `.touch` 99개, `.narrow` 107개.

## 디자인 토큰 현황 (`app.css`)
- 있는 토큰: 색(`--bg` `--panel` `--panel-2` `--panel-3` `--sunk` `--line` `--line-2` `--fg` `--fg-2` `--fg-3` `--accent` `--accent-fg` `--play` `--rec` `--cue` `--solo` `--auto` `--sel` `--grid` `--grid-strong` `--scale-row` `--key-white` `--key-black` `--meter-1~3`), `--shadow`, 글꼴(`--font-ui` `--font-kr` `--font-mono` `--font-logo`), 레이아웃 크기(`--ctrl-h` `--split-h` `--status-h` `--browser-w` `--detail-h` `--col` `--mcol` `--drop-col`), 모서리 `--r`(디자인마다 다름: A 2px, B 10px).
- 없는 토큰: 간격, 글자 크기.
- 색 토큰은 다섯 벌이 복사돼 있다: `:root`(어두움) · `@media (prefers-color-scheme: light)` · `:root[data-theme="light"]` · `html:root[data-skin="dark"]` · `html:root[data-skin="light"]`. 앱 안의 밝기 설정(`data-skin`)이 맨 마지막에 이긴다.
- 토큰 밖에 직접 쓴 값(토큰 정의 블록 제외): 색 `#…` 160개 + `rgb(a)(…)` 86개, `font-size` 숫자 136개, `border-radius` 숫자 148개. `ui-*.js` 안에도 `'#…'` 색 글자 22개.

## 데이터 저장 방식
(README에서 옮김)

| 여는 곳 | 프로젝트 | 가져온 오디오·녹음 |
|---|---|---|
| Claude 아티팩트 | 내 Claude 계정의 비공개 영역 (`data/users/<내 id>/`). 기기를 바꿔도 이어서 열려요. 큰 프로젝트는 여러 문서로 나눠 저장해요. | 이 브라우저 (IndexedDB) |
| 웹사이트, 그 밖의 브라우저 (파일로 열기 등) | 이 브라우저 (IndexedDB `ullim`) | 이 브라우저 |
| 컴퓨터의 파일 (`.ullim.json`) | 내가 고른 자리. 크롬·엣지는 Ctrl+S로 같은 파일에 덮어쓰고, 다른 브라우저는 내려받아요 | 파일 안에 함께 |

- 바꿀 때마다 1.5초 뒤 자동으로 저장해요. 크롬·엣지에서 Ctrl+S는 컴퓨터의 파일에 저장하고, 다른 브라우저에서는 이 브라우저에 바로 저장해요 (README '파일로 저장 · 열기').
- 프로젝트와 이어진 파일(파일 핸들)은 IndexedDB `ullim-files`에 기억해요. 파일 내용은 내 컴퓨터에만 있어요.
- 다른 기기에서 열었는데 가져온 오디오가 없으면, 같은 파일을 다시 가져오거나 프로젝트 파일로 옮겨 주세요.
- 화면 설정(보이는 칸, 아래 칸 높이, 화면 디자인과 단계·탭, 곡 지도 높이, 마지막 프로젝트 등)은 브라우저의 `localStorage`(`ullim:prefs:v1`)에 둬요.
- **내 사운드**는 `localStorage`(`ullim:sounds:v1`)에 두고, Claude 아티팩트로 열었으면 계정의 비공개 영역(`sounds` 문서)에도 저장해서 다른 기기에서도 나와요.
- 파형 편집으로 저장한 오디오는 가져온 오디오와 같이 이 브라우저(IndexedDB)에 저장돼요.

### 형식 (코드에서 확인)
- **프로젝트 객체** (`model.js` `newProject`): `v`(지금 1) `id` `name` `bpm` `sig` `key{root, scale}` `swing` `quant` `loop{on, start, end}` `metro` `pos` `tracks[]` `returns[]` `master` `scenes[]` `midimap[]` `created` `updated`
  - 트랙: `id` `type`(midi | audio | return | master) `name` `color` `on` `solo` `arm` `vol` `pan` `sends[]`(리턴 수만큼) `devices[]` `slots[]`(씬 수만큼) `arr[]`(어레인지먼트 클립) `auto{}`(자동화, 키 예: `dev:<장치 id>:<파라미터>`, `send:<리턴 id>`)
  - MIDI 클립: `notes` `start` `end` `loop` `launch` `quant` `legato` `follow` `scale` `groove`. 오디오 클립: `ref` `warp` `mode` `bpm` `gain` `trans` `rev` + 같은 재생 설정. 오디오 클립 위치 단위는 '샘플 박'(원래 BPM 기준)
  - 장치: `id` `kind` `on` `p{파라미터}` `data`(드럼 패드 등) `preset`
- **파일 `.ullim.json`** (`files.js`): `{ app: 'ullim', v: 1, project, media: { 'user:해시': { name, bpm, loop, duration, type, b64 } } }`. 예전 '프로젝트 파일 내보내기'와 같은 형식.
- **IndexedDB `ullim`** (버전 1, `store.js`): `projects`(키 `id`, 값 `{ id, name, updated, bpm, data: 프로젝트 JSON 글 }`), `audio`(키 `hash`)
- **IndexedDB `ullim-files`** (버전 1, `files.js`): `links`(키 `id`, 프로젝트마다 이어진 파일 핸들)
- **Claude 판** (`store.js`): `data/users/<uid>/index`(프로젝트 목록) + `p_<프로젝트 id>`(60,000자 조각, 나머지는 `parts` 하위 문서) + `sounds`. IndexedDB를 못 열면 메모리에만 둔다(`mode: 'memory'`).
- **localStorage**: `ullim:prefs:v1`(화면 설정, `last`, `design`, `uiMode`, `skin`, `welcomed` 등), `ullim:sounds:v1`(내 사운드)

### 예전 형식 바꾸기 (`model.js` `normalize()`)
불러오기(`setProject`) · 되돌리기 · 파일 열기 · 내보내기 렌더가 모두 이 함수를 지난다. 지금 하는 일:
- 빠진 필드를 새 프로젝트 기본값으로 채우고, `bpm`을 20~999로 자른다.
- 트랙마다 `slots` 길이를 씬 수에, `sends` 길이를 리턴 수에 맞춘다.
- 장치 파라미터에 기본값을 채운다. 예전 합성 드럼 킷은 녹음 드럼으로 한 번 바꾸고(`U.drumRec.upgrade`), 루프 패드는 `U.fixLoopPad`로 고친다.
- **모르는 장치 종류는 지운다.** 클립은 `fixClip()`으로 빠진 필드를 채운다.
- 형식을 바꿀 때 권장: 필드를 더하는 것은 여기서 기본값 채우기로 충분하다. 뜻이 바뀌는 변경은 `v`를 올리고 "`v`가 그보다 낮으면 바꾸기"를 여기에 넣는다. 예전 파일 몇 개로 열리는지 확인한다.

## 파일
(README에서 옮김, 묶여 있던 줄을 나눔)

| 파일 | 내용 |
|---|---|
| `index.html` | 화면 틀과 스크립트 순서 |
| `app.css` | 색 토큰(어두운·밝은 화면), 레이아웃, 모든 부품 스타일, 디자인 A·B·C, 아이패드 버전, 좁은 화면 |
| `manifest.webmanifest`, `sw.js`, `icons/` | 웹 앱 정보(이름·색·아이콘, 주소는 모두 상대 경로), 오프라인용 서비스 워커, 아이콘 |
| `js/util.js` | DOM·수학·음악 이론(스케일, 음 이름, 박자 표기)·이벤트·기기 설정 |
| `js/gestures.js` | 손가락 조작: 길게 누르기 → 메뉴, 두 번 탭 → 더블클릭, 두 손가락 밀기·벌리기, 사파리 소리 켜기·무음 모드. 화면 버전(컴퓨터·아이패드) 고르기 |
| `js/devices.js` | 장치 24종의 파라미터 범위·기본값·화면 배치·설명, 패드 키 배치, Acoustic·Ensemble의 악기 목록 |
| `js/dsp.js` | 엔벌로프, 노이즈, 일그러짐 곡선, 잔향 합성, 합성 드럼 18종, 한 샘플씩 계산하는 어쿠스틱 드럼 12종(밴드 킷) |
| `js/instruments.js`, `js/effects.js` | 악기·MIDI 이펙트, 오디오 이펙트 실행부 (Poly Synth 유니즌·피치 엔벌로프, 녹음 드럼: 키트 받기 · 세기 칸 · 라운드 로빈 · 예전 킷 바꾸기, Amp: 프리앰프 단·톤 스택·파워앰프·캐비닛, 모델별 크기 맞춤) |
| `js/acoustic.js` | Acoustic(음마다 계산해 두는 줄·타악기·피아노·일렉 피아노 합성, 일렉 기타 픽업·코일 공진, 미리 계산과 보관함, 크기 맞춤, 녹음 샘플 재생: 세기 칸 · 가까운 샘플 · 음역 고르기, 묶음 세트 풀기)과 Ensemble(현악·관악·색소폰·콰이어·오르간 실시간 합성, 루프한 녹음 샘플: 세트 겹치기 · 밝기 · 어택 · 비브라토 · 두 겹 넓히기) |
| `js/samples.js`, `samples/` | 녹음 샘플 목록(음 · 세기 칸 · 센트 보정, 묶음 세트는 위치와 루프 구간까지, 녹음 드럼 키트는 조각 · 세기 칸 · 라운드 로빈 · 크기 맞춤)과 MP3 (예전 세트는 음마다 한 파일, 새 세트와 드럼 키트는 하나에 한 파일), 출처는 `samples/CREDITS.txt`. `samples.js`는 도구로 만든 파일이라 손으로 고치지 않는다 |
| `js/model.js` | 프로젝트 데이터, 예전 형식 바꾸기(`normalize`), 복제, 되돌리기 |
| `js/media.js` | 샘플 해독·캐시·파형 요약, 내장 샘플 합성(로봇 보컬 · 노래 · 옛 가요 샘플 섞기 포함), 가져온 파일 |
| `js/content.js` | 사운드(레이지 · 트랩 포함)·키트(밴드 킷 · 레이지 킷 포함)·소리의 쓰임(미리 듣기용)·루프 패드 키트·클립 템플릿·기타 보이싱과 스트럼·데모 곡 |
| `js/templates.js` | 장르 템플릿 10종(패턴·베이스·코드·밴드 드럼·파워 코드 도우미, 트랙과 씬 구성), 씬을 어레인지먼트에 늘어놓는 곡 배치 |
| `js/engine.js` | 오디오 엔진: 트랙 그래프, 미리 예약하는 스케줄러, 클립 런치, 어레인지먼트·루프, 워프, 자동화, 메트로놈, 녹음 |
| `js/export.js` | 오프라인 렌더(믹스다운·스템), WAV, ZIP, MIDI 파일 |
| `js/store.js` | 저장: 프로젝트(Claude 계정 또는 이 브라우저), 오디오(이 브라우저), 파일 건네기(내려받기 · 아이패드 공유 화면) |
| `js/files.js` | 파일로 저장 · 열기: 크롬·엣지는 고른 파일에 덮어쓰기(프로젝트마다 이어진 파일을 IndexedDB `ullim-files`에 기억), 그 밖에는 내려받기 · 고르기, 저장 안 한 내용 표시, 가져온 오디오 담기 |
| `js/mysounds.js` | 내 사운드: 트랙의 악기와 이펙트를 사운드로 담기, 이름 정하기, 저장(이 브라우저·Claude 계정) |
| `js/recorder.js` | 마이크 녹음: 녹음 준비(●)한 오디오 트랙에 담기 |
| `js/tools.js` | MIDI 도구 14종: 만들기(리듬·씨앗·코드 쌓기·모양)와 바꾸기(아르페지오·스트럼·퀀타이즈·휴머나이즈 …) |
| `js/chords.js` | 키 안의 화음과 세컨더리 도미넌트, 코드 이름(키에 맞는 ♯·♭ 글자), 로마 숫자, 자리 잡기(부드럽게 잇기·베이스) |
| `js/oldsample.js` | 옛 가요 샘플 만들기: 진행 · 화음 · 건반 · 바탕 · 반주 · 노래 훅(시드로 멜로디 만들기) · 옛 음반 느낌으로 네 마디 루프 만들기, 미리 듣기, 내 오디오에 설정과 함께 저장 |
| `js/ui-core.js` | 화면 공통: 화면 상태(`U.ui`), 다시 그리기(`inval` · `frame`), 아이콘, 노브·페이더·숫자칸, 메뉴, 대화상자, 알림, 끌어다 놓기, 정보 창 |
| `js/actions.js` | 편집 동작(`U.act`): 트랙·장치·클립·씬·어레인지먼트·트랜스포트·프로젝트 |
| `js/quick.js` | 간편 기능: 빠른 실행(Ctrl+K, 초성 찾기), 즐겨찾기·최근 쓴 소리, 되돌리기 기록 메뉴, 카운트인 고르기·박 숫자 |
| `js/ui-shell.js` | 화면 디자인 A·B·C: 고르기 창·메뉴, 단계·탭, B의 단계 줄·트랙 목록·안내, C의 탭 줄, A의 고른 트랙 칸, 디자인에 맞춘 Tab·P 단축키 |
| `js/ui-transport.js` | 위 컨트롤 바: 템포, 박자, 메트로놈, 퀀타이즈, 재생·녹음, 위치, 루프, 키, 건반 |
| `js/ui-session.js` | 세션 뷰: 클립 슬롯 격자, 씬, 트랙 머리, 믹서 띠 |
| `js/ui-mixer.js` | 따로 띄우는 믹서 화면 (B 믹스 단계, C 믹스 탭) |
| `js/ui-arrange.js` | 어레인지먼트 뷰: 눈금자, 루프 막대, 트랙 레인, 클립 옮기기·자르기·늘이기, 자동화 |
| `js/ui-clip.js` | 클립 뷰: 클립 설정, 피아노 롤(음표·벨로시티), 오디오 파형, MIDI 도구 |
| `js/ui-steps.js` | 드럼·패드 클립의 스텝 시퀀서 |
| `js/ui-devices.js` | 장치 뷰: 장치 체인, 노브, 그래프(엔벌로프·필터·EQ·압축·스펙트럼), 드럼 패드, 루프 패드, 샘플러 파형, 소리 고르기 |
| `js/ui-shape.js` | 소리 다듬기 칸: 쉬운 손잡이 6개, 내 사운드로 저장, 이름 바꾸기·지우기 메뉴 |
| `js/ui-audioedit.js` | 파형 편집 창: 구간 고르기, 잘라내기·붙여넣기·페이드·노멀라이즈, 되돌리기, 새 오디오로 저장 |
| `js/ui-browser.js` | 브라우저: 사운드·드럼·루프 패드·악기·이펙트·클립·샘플·내 오디오·프로젝트 |
| `js/ui-keys.js` | 터치 건반: 피아노·스케일 칸·코드 패드, 코드, 옥타브, 여러 손가락, 미끄러뜨리기 |
| `js/ui-play.js` | 악기별 연주 화면: 기타·베이스·현악의 코드 줄과 지판(기타 코드 모양, 스트럼, 활), 하프·가야금 줄, 마림바·종·칼림바·스틸 드럼 |
| `js/ui-kit.js` | 드럼 킷 화면: 패드 종류로 드럼 자리 찾기, 스네어 테 · 하이햇 가장자리 · 라이드 벨, 퍼커션 단추 |
| `js/ui-pads.js` | 패드 화면: 악기에 맞는 화면 고르기, 큰 패드 16개, 글자 키 지정, 노트 리피트, 구간 편집, 자동 자르기 |
| `js/ui-start.js` | 시작 창(장르 고르기), 씬으로 곡 만들기 창 |
| `js/input.js` | 단축키, 컴퓨터 건반, MIDI 장치(아는 건반 이름으로 알아보기 · 터치 감도 · 패드 → 드럼 · 서스테인 · 벤드 · 모드 · 누르는 힘 · 장치별 노브), MIDI 매핑 |
| `js/ui-midi.js` | MIDI 장치 창: 연결한 건반 그림(건반 25 · 패드 8 · 노브 8, 세기 · 벤드 · 모드 · 누르는 힘 · 서스테인), 아는 건반 이름표와 쓰는 법, 터치 감도, 패드 · 노브 알아보기 |
| `js/main.js` | 시작: 화면 틀, 오디오, 프로젝트 불러오기·자동 저장, 메뉴, 대화상자, 좁은 화면, 앱 설치·서비스 워커 등록 |

## 기술 메모
(README에서 옮김. 엔벌로프 줄은 코드에 맞게 고치고, 값이 있는 자리를 붙임)

- 스케줄러는 Web Worker 타이머로 25ms마다 깨어나 120ms 앞까지 음을 예약해요(`engine.js`의 `TICK_MS` · `LOOKAHEAD`. Worker를 못 만들면 `setInterval`). 이미 예약한 구간 안에서 클립을 바꾸면 그 뒤를 지우고 다시 예약해서 늦지 않게 바꿔요.
- 음을 켜고 끄는 엔벌로프는 `setTargetAtTime`을 써서(`dsp.js`의 `envOn` · `envOff` · `smooth`) 중간에 음을 끊어도 틱 소리가 나지 않아요. 미리 렌더하는 합성 드럼 한 방, 클립 페이드, 메트로놈 같은 곳에는 `linearRamp` · `exponentialRamp`도 써요. (README에는 "`setTargetAtTime`만" 쓴다고 적혀 있었지만 실제와 달라 고침.)
- 편집 화면의 두 손가락 조작은 첫 손가락의 pointerdown을 90ms 붙잡아 두었다가 그대로 다시 보내는 방식이에요. 그사이 두 번째 손가락이 닿으면 한 손가락 조작(음 옮기기 등)은 시작하지 않고 밀기·벌리기만 해서, 기존 마우스 코드를 고치지 않고 손가락을 지원해요.
- 내보내기는 같은 엔진을 `OfflineAudioContext`에서 돌려요. 스템은 채널을 트랙 수만큼 늘린 렌더 한 번으로 만들어요.
- 템포 맞춤 패드는 엔진이 틱마다 앞을 채우는 조각 흐름이에요. 같은 시각에 예약되는 음은 시간 순서로 쳐서 초크와 같은 패드 끊기가 어긋나지 않아요.
- 드럼 킷을 막 넣으면 패드는 소리를 낼 수 있을 때까지(합성 대체음을 만들거나 녹음을 받는 동안, 처음 쓰는 킷은 0.1~0.6초) 비어 있어요. 그사이 친 음은 버리지 않고 준비되는 대로 쳐요. 박에 맞춰 예약한 음은 0.15초, 손으로 친 음은 0.6초보다 늦어지면 박이 어긋나지 않게 버리고, 멈추면 기다리던 음도 지워요 (`instruments.js` `Drums.noteOn` · `pendingSilent`, PR #40).
- 재생을 누르면 아직 소리를 못 내는 패드가 있을 때 최대 1.5초 기다렸다가 시작해요. 기다리는 동안 다시 누르면 시작하지 않아요 (`actions.js` `startPlay`, `engine.js` `waitPlayable`). 딸린 이펙트가 없는 드럼 머신에 킷을 불러오면 장치를 새로 만들지 않고 그 장치에 새 킷을 담아서, 새 소리가 준비되는 동안 앞 킷 소리가 이어서 나요. 되돌리기로 앞 킷이 돌아와요 (`actions.js` `loadKit`).
- Acoustic은 음마다 소리를 한 번 계산해 두고 재생해요. 기타·하프·가야금은 카플러스-스트롱(줄 길이의 소수점까지 올패스 필터로 맞춰 음정 오차 0.1센트 안), 피아노는 배음이 조금씩 높아지는 비조화성과 줄 두세 가닥의 맥놀이, 말렛·종은 배음마다 길이가 다른 감쇠 사인파의 합이에요. 세기는 세 칸(여리게·보통·세게)으로 나눠 밝기가 달라져요.
- 일렉 피아노는 해머로 때린 쇠막대의 떨림(감쇠 사인파의 합)을 픽업 곡선에 통과시켜요. 로즈는 자석 픽업처럼 막대가 가운데를 지날 때 꺾이는 종 모양, 우리처는 한쪽으로 기운 부드러운 클리핑이라, 세게 칠수록 배음이 늘어 으르렁거려요. 픽업을 지난 뒤에는 처음 0.25초의 힘을 지나기 전과 같게 맞춰서, 크기는 세기가 정하고 픽업은 음색만 바꿔요.
- 업라이트 베이스와 재즈 기타는 노이즈 대신 뜯은 자리가 꼭짓점인 삼각형 줄 모양을 섞어 넣어서 기본음이 둥글고 또렷해요. 업라이트 베이스는 손가락이 지판에 부딪는 낮은 노이즈와, 세게 뜯을 때 처음 60ms쯤 살짝 높았다 내려앉는 음을 더했어요.
- 계산은 제너레이터로 배음·조각마다 쉬어 갈 수 있어서, 트랙 클립에 쓰인 음과 가운데 음역을 한 번에 6ms씩만 미리 계산해요. 화면과 재생 예약이 밀리지 않아요. 계산해 둔 소리는 최근에 쓴 것부터 1,200만 샘플까지 기억해요.
- 악기마다 크기는 대표 음의 400ms 창 RMS로 맞추고(세기 100에서 -25dB), 뜯는 소리처럼 첫 봉우리가 뾰족하면 봉우리가 -10dB를 넘지 않는 데까지만 키워요. Ensemble은 실제로 렌더해서 잰 값으로 맞췄어요.
  - 값: `acoustic.js`의 `LOUD_RMS = 0.196` · `LOUD_PEAK = 1.1`, 악기별 보정 `lvl`(dB) · 샘플 세트 보정 `slvl`. 녹음 샘플은 세기 칸 안에서 음마다 ±6dB 안으로 고르게 맞춘다(`evenOut`). 녹음 드럼은 `samples.js` `DRUM_SETS`의 `gains`, Amp는 `effects.js` 모델별 `comp`.
- 녹음 샘플 세트는 처음 쓸 때 `samples/`에서 받아 32 kHz로 풀어 둬요(메모리를 아끼려고). 받는 동안이나 받지 못하면 같은 악기를 계산한 소리로 쳐요.
- 자동 자르기는 512샘플 단위 소리 세기로 어택 후보를 찾고, 120ms 안의 후보(자음+모음, 어택의 여러 프레임)를 한 덩어리로 묶은 뒤 샘플 단위로 어택 2ms 앞에서 잘라요.

## 서비스 워커 · 배포
- `sw.js`: `CACHE = 'ullim-v32'`. 설치할 때 `CORE` 목록(앱 파일 + 아이콘)을 받아 둔다. 지금까지는 파일을 더하거나 빼지 않고 내용만 고쳐도 숫자를 올려 왔다(PR #40: 31 → 32).
  - 앱 파일: 인터넷이 되면 언제나 새 파일을 먼저 받고(그래서 고친 내용이 바로 보인다), 안 되면 저장본을 쓴다. 받은 것은 같은 캐시에 쌓인다. 녹음 샘플 MP3는 `CORE`에 없고, 처음 쓸 때 받은 것이 이렇게 쌓인다.
  - 글꼴: 저장본을 먼저 쓰고 뒤에서 새로 받아 둔다.
  - 이 앱 폴더 밖의 요청(같은 사이트의 다른 앱 포함)은 건드리지 않는다.
  - 새 버전이 켜지면 `ullim-`로 시작하는 옛 캐시를 지운다.
- 등록은 `main.js` `setupWebApp()`이 한다(https나 localhost에서만).
- 직접 띄우기: 이 폴더에서 `python -m http.server` → `http://localhost:8000/`. `index.html`을 파일로 열면 설치·오프라인 없이 그냥 돈다.
- 앱 파일을 더하거나 빼면 `sw.js`의 `CORE` 목록을 고치고 `CACHE` 숫자를 올린다.
- 배포(지금): 저장소의 `.github/workflows/campus-gagyebu-pages.yml`이 `main`에 `ullim/`이나 `campus-gagyebu/`가 바뀔 때마다 `_site/`(가계부) + `_site/ullim/`(울림)으로 묶어 GitHub Pages에 올린다. Pages의 Source가 "GitHub Actions"가 아니면 배포를 건너뛰고 안내만 남긴다. `ullim/` 폴더 전체가 올라가므로 `docs/`와 `CLAUDE.md`도 사이트에서 보인다.
- Claude 아티팩트 판: `window.claude`가 있으면 계정 db에 저장하고, 파일 받기는 Claude의 downloads 기능(zip·json 등만, 나머지는 zip으로 묶음)을 쓰고, 마이크 녹음은 막힌다. 이 판을 올리는 방법은 저장소에 적혀 있지 않다(확인 필요).

### 저장소 분리 영향 (2026-11-09 분리하기로 결정)
- 사이트 주소는 README에만 적혀 있다. 코드와 `manifest.webmanifest`는 모두 상대 주소라 새 주소에서도 그대로 돈다.
- 주소가 바뀌면(예: `jinnsei99.github.io/jinnsei/ullim/` → `jinnsei99.github.io/<새 저장소>/`):
  - 홈 화면에 추가한 앱은 새 주소로 다시 추가해야 한다.
  - 아이패드 홈 화면 앱은 사파리와 저장 공간이 따로일 수 있어서, 그 안의 프로젝트는 옮기기 전에 `.ullim.json`으로 받아 두고 새 앱에서 연다.
  - 브라우저 탭에서는 같은 사이트(`jinnsei99.github.io`)라 IndexedDB · localStorage가 이어질 것으로 예상한다(확인 필요).
  - 옛 주소의 서비스 워커는 남는다. 인터넷이 되면 새 파일을 먼저 받으므로, 옛 주소에 안내 페이지를 두면 그게 보인다.
- 할 일 목록은 [ROADMAP.md](ROADMAP.md) 단계 0.
