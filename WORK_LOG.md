# Work Log

## 2026-02-25 (세션 2)

### 버그 수정 — B-4, D-1, F-3, F-4, P-3, D-4

#### B-4 — fileWatcher.ts 파일 축소 미처리 + fd 누수
- `stat.size < agent.fileOffset` 시 offset 0 리셋 (파일 교체/truncation 대응)
- `fs.readSync` 를 try/finally로 감싸 파일 락 실패 시에도 fd 항상 닫힘
- 파일: `src/fileWatcher.ts`

#### D-1 — 앉은 캐릭터 아웃라인 오정렬
- 이미 수정되어 있음 확인 (커밋 `47b2571`에서 `drawY`에 `sittingOffset` 포함됨)
- 추가 작업 없음

#### F-3 — App.tsx 미사용 editorTickForKeyboard 상태
- `editorTickForKeyboard` state + `void` 억제 제거
- `useEditorKeyboard`의 onEditorTick 콜백을 `editor.handleEditorSelectionChange`로 교체 (동일 역할, 이미 존재)
- 파일: `webview-ui/src/App.tsx`

#### F-4 — useExtensionMessages 의존성 배열
- `onLayoutLoaded`, `isEditDirty`를 ref로 캡처해 handler 내부에서 항상 최신값 참조
- effect 의존성 `[getOfficeState]` → `[]` (getOfficeState는 모듈 레벨 안정 함수)
- 파일: `webview-ui/src/hooks/useExtensionMessages.ts`

#### P-3 — Permission timer 오탐 (부분 완료)
- `PERMISSION_TIMER_DELAY_MS` 7000 → 10000 (TEXT_IDLE_DELAY_MS와 통일)
- 파일: `src/constants.ts`

#### D-4 — spriteData.ts 스프라이트 인덱스 주석 보강
- PNG 7프레임/row 레이아웃과 walk/type/read 인덱스 범위 명시 주석 추가
- `[0]=walk1 [1]=stand [2]=walk3 [3]=type1 [4]=type2 [5]=read1 [6]=read2`
- 파일: `webview-ui/src/office/sprites/spriteData.ts`

### UI 개선 — 텍스트·말풍선 크기 확대
- ToolOverlay 활동 텍스트: 22px → 28px (서브에이전트: 20px → 24px, × 버튼: 26px → 30px)
- 말풍선: `BUBBLE_ZOOM_BOOST = 2` 추가 → 스프라이트를 `zoom + 2`로 렌더링
- 파일: `webview-ui/src/constants.ts`, `renderer.ts`, `ToolOverlay.tsx`

### agent-dashboard — 로그 전체 삭제 기능
- `LiveAgentBridge.clearLogs()` — JSONL 파일 삭제 + 메모리 상태 전체 리셋
- `DELETE /api/v1/logs` 라우트 신설 (live 모드: 실제 삭제, mock 모드: no-op)
- Dashboard.tsx에 빨간 **로그 전체 삭제** 버튼 추가 (live 모드 컨트롤 영역)
- 확인 다이얼로그: "현재 실행 중인 Claude Code 세션에는 영향 없음" 안내
- 파일: `agent-dashboard/lib/liveBridge.ts`, `agent-dashboard/app/api/v1/logs/route.ts`, `agent-dashboard/components/Dashboard.tsx`

### 남은 내일_플랜 항목 현황

#### 🔴 긴급 — 미수정
| 항목 | 내용 |
|------|------|
| D-3 | Z-sort 불완전 — 런타임 확인 필요 |
| P-2 | JSONL 파싱 로직 중복 (대형 리팩토링) |

#### 🟡 중요 — 전부 미착수
B-6~B-11 (백엔드 6개), F-6~F-10 (프론트엔드 5개), D-5~D-9 (디자인 5개), P-4~P-7 (기획 4개)

### 커밋 이력 (이번 세션)
```
663d79b  D-4: add explicit PNG frame index mapping comment
f7c14c1  P-3: raise PERMISSION_TIMER_DELAY_MS 7s → 10s
81da001  F-4: fix useExtensionMessages effect dependency array
66f5da0  F-3: remove editorTickForKeyboard — reuse handleEditorSelectionChange
93e9eb9  Add 로그 전체 삭제 button to agent-dashboard
8fc4909  Increase activity label font size and speech bubble size
d213beb  B-4: fix file truncation handling and fd leak in readNewLines
```

---

## 2026-02-25

### 코드베이스 업그레이드 분석 (4-에이전트 병렬)
- 백엔드 / 프론트엔드 / 디자인 / 기획 에이전트를 병렬로 실행해 현재 코드베이스의 개선 필요 항목 수집.
- 분석 결과를 `내일_플랜.md`로 정리 (17개 이슈, 10단계 실행 순서).

### 내일_플랜 즉시 실행 (7개 항목)
| 항목 | 내용 | 파일 |
|------|------|------|
| F-1 | ToolOverlay rAF → 100ms setInterval (60fps 낭비 제거) | `webview-ui/src/office/components/ToolOverlay.tsx` |
| B-2 | 캐릭터 스프라이트 로드 실패 시 투명 플레이스홀더로 계속 진행 | `src/assetLoader.ts` |
| B-3 | agentToolDone setTimeout 내부 agent 존재 여부 재확인 | `src/transcriptParser.ts` |
| B-5 | fs.watch error 이벤트 핸들러 추가 (broken watcher 제거) | `src/fileWatcher.ts` |
| F-2 | useEditorKeyboard callback ref 패턴 (deps 9개 → 2개) | `webview-ui/src/hooks/useEditorKeyboard.ts` |
| P-3 | TEXT_IDLE_DELAY_MS 5s → 10s (false positive 대기 버블 감소) | `src/constants.ts` |
| 보너스 | tsconfig exclude에 `agent-dashboard`, `gpt-app-ui` 추가 (TS6059 해결) | `tsconfig.json` |

### agent-dashboard 픽셀 아트 Canvas 렌더러 포팅
기존: CSS 그라디언트 오피스 (PNG 없음, Canvas 없음).
변경: VS Code 웹뷰 자산을 활용한 실제 픽셀 아트 Canvas 렌더링.

**추가된 것:**
- `agent-dashboard/components/PixelOfficeCanvas.tsx` — rAF 기반 Canvas 컴포넌트
  - `char_0.png`~`char_5.png` 스프라이트 시트를 브라우저에서 `<img>` + `drawImage`로 로드
  - 에이전트 상태별 애니메이션: active → 타이핑 프레임(3↔4), waiting → 읽기 프레임(5↔6), idle → 기립 자세(1)
  - 가구: 웹뷰 팔레트와 동일한 색상 직사각형 + 드롭 섀도우
  - 이름 태그, 상태 점(green/amber/red), 말풍선(tool_status), PERM/WAIT 배지
- `agent-dashboard/public/assets/characters/char_*.png` (6개 PNG 복사)

**제거된 것:**
- `globals.css` 에서 `.officeGrid`, `.furniture-*`, `.agentSprite*`, `.bubble`, `.workSpeech`, `.workTooltip`, `@keyframes bob` 전체 삭제

### 커밋 이력 (이번 세션)
```
297d847  Replace CSS office with pixel art Canvas renderer in agent-dashboard
5dba380  Update agent-dashboard: desk labels, simulation speed, liveBridge tweaks
a5b6f78  Execute 내일_플랜: fix 6 urgent bugs across backend and frontend
19466ea  Add upgrade plan, gpt-app-ui prototype, and dashboard live bridge
```

---

## 2026-02-24

### Agent Dashboard 실로그 통합
- `agent-dashboard`에 `mock/live` 데이터소스 분기 추가.
- Claude Code JSONL 파일(`~/.claude/projects/<workspace-hash>/*.jsonl`)을 tail하는 라이브 브리지 구현.
- API 라우트(`/api/v1/state`, `/api/v1/events`, `/api/v1/layout`, `/api/v1/stream`)를 live 모드 대응으로 확장.
- 대시보드 UI에서 live 모드 시 SSE 구독으로 이벤트를 실시간 반영하도록 변경.

### 주요 파일
- `agent-dashboard/lib/liveBridge.ts`
- `agent-dashboard/lib/dataSource.ts`
- `agent-dashboard/app/page.tsx`
- `agent-dashboard/components/Dashboard.tsx`
- `agent-dashboard/app/api/v1/events/route.ts`
- `agent-dashboard/app/api/v1/state/route.ts`
- `agent-dashboard/app/api/v1/layout/route.ts`
- `agent-dashboard/app/api/v1/stream/route.ts`
- `agent-dashboard/README.md`
- `AGENTS.md` (패키지 매니저 정책: 기본 `npm`, 요청 시만 `pnpm`)

### 실행 방법 (live)
```bash
cd /Users/mhj/enkinokorea/2026/pixel-agents/agent-dashboard
AGENT_DASHBOARD_SOURCE=live npm run dev
```

### 검증
- `agent-dashboard`에서 `npm run typecheck` 통과.
- `npm run build` 성공. ESLint 의존성 경고(`ESLint must be installed ...`)는 무해.
