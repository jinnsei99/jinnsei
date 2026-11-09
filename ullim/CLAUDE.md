# 울림 스튜디오 — 작업 규칙

브라우저에서 바로 돌아가는 음악 작업 앱(PWA)이다. 빌드 없는 바닐라 JS이고, 화면 글은 한국어다.
이 파일의 경로는 모두 이 폴더(`ullim/`) 기준이다. 자세한 구조는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 실행 · 배포
- 실행: 이 폴더에서 `python -m http.server` → http://localhost:8000/
  서비스 워커는 localhost·https에서만 켜진다. `index.html`을 파일로 열면 오프라인·설치 없이, 녹음 샘플 대신 계산한 소리로 돈다.
- 배포: `main`에 푸시 → GitHub Actions → GitHub Pages. 빌드 단계는 없다.
  지금은 저장소 맨 위의 `.github/workflows/campus-gagyebu-pages.yml`이 캠퍼스 가계부(사이트 맨 위)와 울림(`/ullim/`)을 한 사이트로 묶어 올린다.
  주소: https://jinnsei99.github.io/jinnsei/ullim/
- 별도 저장소로 옮기기로 했다(2026-11-09 결정, [docs/ROADMAP.md](docs/ROADMAP.md) 단계 0). 옮기면 이 절의 워크플로·주소를 고친다.
- 자동 점검: 아직 없다(단계 0에서 만든다). 생기면 실행 방법을 여기에 적는다.

## 문서
| 파일 | 쓰임 |
|---|---|
| `README.md` | 사용설명서. 사용자에게 보이는 기능만 적는다 |
| `docs/ARCHITECTURE.md` | 구조, 스크립트 순서, 데이터 형식, 기술 메모 |
| `docs/ROADMAP.md` | 단계별 할 일과 상태(⬜ 🔄 ✅) |
| `docs/PROGRESS.md` | 현재 상태 · 다음 할 일 · 알려진 문제 · 날짜별 기록. 작업이 끝날 때마다 고친다 |
| `docs/IDEAS.md` | 나중에 할 아이디어를 한 줄씩 |
| `docs/DESIGN.md` | (단계 1에서 만든다) 디자인 규칙. 생기면 아래 디자인 규칙보다 우선한다 |

## 함정 — 고치기 전에 확인
1. **파일을 더하거나 빼면** `sw.js`의 `CORE` 목록을 고치고 `CACHE` 숫자를 올린다(지금 값은 `sw.js` 맨 위에 있다). JS 파일이면 `index.html`의 `<script>` 줄도 함께 고친다.
2. **JS는 모듈이 아니다.** `index.html`의 `<script>` 순서대로 읽히는 전역 코드다. 모든 파일이 `(function (U) { … })(window.U = window.U || {})` 안에서 전역 객체 `window.U` 하나에 기능을 붙인다.
   - 뒤 파일이 앞 파일이 붙인 `U.이름`을 쓴다. 파일 맨 위의 `const { h, ui } = U;`처럼 읽는 순간 꺼내는 이름은, 그 이름을 붙이는 파일이 반드시 앞에 있어야 한다. script 순서는 이유 없이 바꾸지 않는다.
   - `U`에 새 이름을 붙이거나 이름을 바꾸면 `js/` 전체에서 `U.이름`과 `{ 이름 }` 꺼내기를 모두 검색한다. 같은 이름을 두 파일이 붙이면 뒤 파일이 조용히 덮어쓴다.
3. **프로젝트 데이터 형식을 바꾸면** 예전 프로젝트·파일도 열리도록 변환 코드를 함께 넣는다.
   - 형식: 프로젝트 객체(`v: 1`), 파일 `.ullim.json` = `{ app: 'ullim', v: 1, project, media }`, IndexedDB `ullim`(projects · audio)과 `ullim-files`(파일 핸들), localStorage `ullim:prefs:v1` · `ullim:sounds:v1`, Claude 판은 계정 db `data/users/<id>/`.
   - 변환 자리는 `js/model.js`의 `normalize()` 하나다. 불러오기(`U.setProject`) · 되돌리기 · 파일 열기 · 내보내기 렌더가 모두 여기를 지난다.
   - `normalize()`는 모르는 장치 종류(`kind`)를 지운다. 장치 종류 이름을 바꾸면 예전 프로젝트에서 그 장치가 조용히 사라진다.
   - DB 이름 · 저장 키 · 필드 이름은 바꾸지 않는다. 꼭 바꿔야 하면 옛 이름을 읽는 코드를 남긴다.
4. **스케줄러와 엔벌로프 방식은 이유 없이 바꾸지 않는다.**
   - 스케줄러(`js/engine.js`): Web Worker 타이머로 `TICK_MS = 25`ms마다 깨어나 `LOOKAHEAD = 0.12`초 앞까지 음을 예약한다.
   - 엔벌로프(`js/dsp.js`의 `envOn` · `envOff` · `smooth`): `setTargetAtTime`을 써서 음을 중간에 끊어도 틱 소리가 나지 않는다. 새 악기도 음을 켜고 끌 때 이 함수를 쓴다.
5. **소리를 바꾸거나 더하면 크기 맞춤을 다시 확인한다.** 기준은 대표 음을 세게 친 소리의 400ms 창 RMS 최댓값이다(세기 100 · Volume -6dB · 가운데 자리에서 -25dB, 봉우리는 -10dB를 넘지 않게).
   값이 있는 곳: `js/acoustic.js`의 `LOUD_RMS` · `LOUD_PEAK`와 악기별 `lvl` · `slvl`, 녹음 드럼은 `js/samples.js`의 `gains`, Amp는 `js/effects.js`의 `comp`.
   바꾼 뒤에는 같은 프레이즈를 옆 악기와 번갈아 들어 크기가 비슷한지 확인한다.
6. **녹음 샘플을 더하면** `samples/CREDITS.txt`와 README의 '소리 출처'를 고친다. 라이선스는 CC0나 CC BY만 쓴다(CC BY는 출처 표기 문장까지 적는다).
   `js/samples.js`는 도구로 만든 목록이라 손으로 고치지 않는다(만드는 도구는 이 폴더에 없다. 위치 확인 필요).
7. **색 토큰은 `app.css`에 다섯 벌이 복사돼 있다**: `:root`(어두움), `@media (prefers-color-scheme: light)`, `:root[data-theme="light"]`, `html:root[data-skin="dark"]`, `html:root[data-skin="light"]`. 색 토큰을 고치거나 더하면 해당하는 벌을 모두 고친다.
8. **화면은 스위치 세 개가 겹친다**: `body[data-design="a|b|c"]`(디자인), `html.touch`(아이패드 버전), `body.narrow`(폭 860px 미만, 컴퓨터 버전은 600px 미만. 이때는 디자인과 상관없이 한 칸씩 보는 화면). CSS 한 줄이 여러 조합에 걸릴 수 있다.
9. **편집은 `U.commit('이름')`으로 확정한다.** 여기서 되돌리기 기록 · 엔진 `sync` · 화면 다시 그리기 · 1.5초 뒤 자동 저장이 이어진다. 끄는 도중처럼 아직 확정 전이면 `U.touch()`를 쓴다. 화면만 바꿀 때는 `U.inval('칸 이름')`(같은 프레임에 한 번만 그린다).
10. **이 폴더의 파일은 모두 사이트에 그대로 공개된다.** 배포가 폴더 전체를 복사하므로 `docs/`와 `CLAUDE.md`도 주소만 알면 누구나 읽는다. 문서에 비밀번호·개인 정보·공개하면 안 되는 계획을 쓰지 않는다.

## 영역 → 파일 지도
| 영역 | 파일 |
|---|---|
| 엔진·타이밍 | `js/engine.js`(트랙 그래프·스케줄러·클립 런치·어레인지먼트·워프·자동화·메트로놈), `js/export.js`(오프라인 렌더·WAV·스템·MIDI 파일), `js/recorder.js`(마이크 녹음) |
| 소리·악기 | `js/dsp.js`(엔벌로프·노이즈·합성 드럼), `js/devices.js`(장치 정의·파라미터), `js/instruments.js`, `js/effects.js`, `js/acoustic.js`, `js/samples.js` + `samples/`, `js/media.js`(샘플 해독·내장 샘플 합성), `js/content.js`(사운드·킷·이펙트 프리셋) |
| 편집기 | `js/actions.js`(편집 동작), `js/ui-session.js`, `js/ui-arrange.js`, `js/ui-clip.js`(피아노 롤), `js/ui-steps.js`(스텝 시퀀서), `js/ui-devices.js`, `js/ui-shape.js`(소리 다듬기), `js/ui-audioedit.js`(파형 편집), `js/ui-mixer.js`, `js/ui-browser.js`, `js/tools.js`(MIDI 도구) |
| 연주 화면 | `js/ui-pads.js`(패드 화면), `js/ui-keys.js`(터치 건반), `js/ui-play.js`(악기별 연주 화면), `js/ui-kit.js`(드럼 킷 화면) |
| MIDI·입력 | `js/input.js`(단축키·컴퓨터 건반·MIDI), `js/ui-midi.js`(MIDI 장치 창), `js/gestures.js`(손가락 조작·화면 버전) |
| 저장·파일 | `js/model.js`(프로젝트 데이터·되돌리기·`normalize`), `js/store.js`(IndexedDB·Claude 계정), `js/files.js`(`.ullim.json`), `js/mysounds.js`(내 사운드), `sw.js`, `manifest.webmanifest` |
| 화면 틀·디자인 | `index.html`, `app.css`, `js/ui-core.js`(화면 상태·다시 그리기·공통 부품), `js/ui-shell.js`(디자인 A·B·C), `js/ui-transport.js`(컨트롤 바), `js/main.js`(시작·레이아웃·메뉴·좁은 화면), `js/quick.js`(빠른 실행), `js/util.js`(공용 도구·기기 설정) |
| 작곡 도우미 | `js/templates.js`(장르 템플릿), `js/chords.js`(화음), `js/tools.js`, `js/oldsample.js`(옛 가요 샘플), `js/content.js`(클립 템플릿·데모 곡), `js/ui-start.js`(시작 창·씬으로 곡 만들기) |

## 디자인 규칙 (토큰이 생기는 만큼 단계적으로 엄격해진다)
- 이미 토큰이 있는 것은 토큰만 쓴다: 색(`--bg`, `--panel*`, `--fg*`, `--line*`, `--accent` 등), 글꼴 종류(`--font-*`), 모서리(`--r`), 그림자(`--shadow`), 레이아웃 크기(`--ctrl-h` 등).
  새 색 값을 직접 쓰지 않는다. 필요한 색이 없으면 토큰을 먼저 추가하자고 제안한다.
- 아직 토큰이 없는 것(간격, 글자 크기)은 숫자를 직접 써도 된다.
  단, 새 값을 만들지 말고 같은 화면 근처에서 이미 쓰는 값을 재사용한다.
- 간격·글자 크기 토큰은 단계 1에서 만든다. 만들어지면 이 규칙을 "간격·글자 크기도 토큰만 쓴다"로 고친다.
- `docs/DESIGN.md`가 생기면 그 규칙이 우선한다.
- 디자인이 하나로 합쳐지기 전까지 화면을 고치면 A · B · C × 컴퓨터 · 아이패드 버전, 그리고 좁은 화면(폭 860px 미만)에서 모두 확인한다.
  디자인은 상태 줄의 '디자인' 단추, 버전은 상태 줄 오른쪽의 버전 단추에서 바꾼다.

## 작업 규칙
- 요청받은 범위만 구현한다. 떠오른 아이디어는 `docs/IDEAS.md`에 한 줄로만 적는다.
- 코드를 쓰기 전에 계획(바꿀 파일, 접근법, 영향 범위, 검증 방법)을 보여 주고 승인을 받는다.
- 한 번의 변경이 약 300줄을 넘거나 위 영역 두 개 이상에 걸치면, 더 작게 나누자고 먼저 제안한다.
- 기존 기능을 지우거나 크게 바꿔야 하면 먼저 묻는다.
- "완료"라고 말하기 전에 앱을 실제로 열어 확인한다(브라우저 콘솔 오류 포함). 자동 점검이 생기면 그것도 통과시킨다.
  확인하지 못한 것은 확인하지 못했다고 쓴다.
- 작업 단위마다 커밋한다. 메시지는 지금처럼 `feat: …` / `fix: …` / `docs: …` + 무엇이 되었는지(지금까지는 영어로 썼다).
- 사용자에게 보이는 기능을 바꾸면 README의 해당 절만 고친다. 구조가 바뀌면 `docs/ARCHITECTURE.md`를, 작업이 끝나면 `docs/PROGRESS.md`와 `docs/ROADMAP.md`의 상태를 고친다.
- 이 폴더 밖(같은 저장소의 다른 앱)은 요청 없이 읽지도 고치지도 않는다.

## 소통
- 한국어로, 쉬운 말로 쓴다. 코드 용어를 쓰면 한 번 풀어 쓴다.
- 선택지를 줄 때는 추천 1개를 먼저 두고 이유를 한 줄 붙인다.
- 작업 끝에 "내가 귀와 눈으로 확인할 체크리스트"를 3~5줄 준다(어느 화면에서 무엇을 누르면 무엇이 들리고 보여야 하는지).
