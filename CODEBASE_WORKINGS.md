# Pixel Agents 코드베이스 동작 분석

## 1) 전체 아키텍처
이 프로젝트는 크게 두 런타임으로 동작합니다.

- 확장(백엔드): `src/*`
  - VS Code API, 터미널 생성/복구, Claude JSONL 감시, 상태 이벤트 생성
- 웹뷰(프론트엔드): `webview-ui/src/*`
  - React UI + 캔버스 게임 루프, 캐릭터/오피스 렌더링, 편집기(레이아웃) 인터랙션

핵심 구조는 **“확장이 이벤트를 만들고(webview.postMessage), 웹뷰가 이를 시각 상태로 반영”** 입니다.

## 2) 빌드/산출물 경로

- 확장 엔트리: `src/extension.ts` → `dist/extension.js` (esbuild)
- 웹뷰 엔트리: `webview-ui/src/main.tsx` → `dist/webview/*` (Vite build 결과를 확장이 로딩)
- 에셋 복사: `esbuild.js`가 빌드 후 `webview-ui/public/assets`를 `dist/assets`로 복사

즉, 실행 시 확장은 `dist/webview/index.html`을 읽어 URI를 webview 전용 URI로 치환해 제공합니다.

## 3) 확장 활성화와 초기화 시퀀스

`activate()` (`src/extension.ts`)에서 `PixelAgentsViewProvider`를 등록하고 2개 명령을 노출합니다.

- `pixel-agents.showPanel`: 패널 포커스
- `pixel-agents.exportDefaultLayout`: 현재 저장 레이아웃을 기본 레이아웃 파일로 내보내기

웹뷰가 뜨면 `resolveWebviewView()` (`src/PixelAgentsViewProvider.ts`)가 실행됩니다.

1. 웹뷰 HTML 주입
2. 메시지 핸들러 등록(`onDidReceiveMessage`)
3. 웹뷰에서 `webviewReady` 수신 시 본격 초기화:
   - 에이전트 복구(`restoreAgents`)
   - 사운드 설정 전달(`settingsLoaded`)
   - 프로젝트 JSONL 스캔 시작(`ensureProjectScan`)
   - 캐릭터/바닥/벽/가구 에셋 로드 후 웹뷰 전송
   - 레이아웃 로드/전송(`sendLayout`) + 레이아웃 파일 watcher 시작
   - 기존 에이전트 목록 전송(`sendExistingAgents`)

## 4) 에이전트 생성/복구/삭제 흐름

### 생성
웹뷰의 `openClaude` 메시지 → `launchNewTerminal()` (`src/agentManager.ts`)

- 터미널 생성: `Claude Code #N`
- `claude --session-id <uuid>` 전송
- 예상 JSONL 경로를 먼저 계산(`~/.claude/projects/<workspace-key>/<session>.jsonl`)
- AgentState를 먼저 등록하고 `agentCreated` 전송
- JSONL 파일 생성 대기 폴링 후, 감시 시작(`startFileWatching`)

### 복구
`restoreAgents()`는 `workspaceState`에 저장된 에이전트를 현재 살아있는 VS Code terminal과 매칭하여 재연결합니다.

### 삭제
터미널 종료 이벤트(`onDidCloseTerminal`)에서 `removeAgent()` 호출:
- JSONL 폴링/파일 watcher/대기 타이머/권한 타이머 정리
- 맵에서 제거 + 상태 persist
- 웹뷰에 `agentClosed` 전송

## 5) JSONL 감시와 상태 판정 로직

핵심 파일은 `src/fileWatcher.ts`, `src/transcriptParser.ts`, `src/timerManager.ts`입니다.

### 감시 방식(이중화)
- 1차: `fs.watch`
- 2차: 주기 폴링(`FILE_WATCHER_POLL_INTERVAL_MS = 2000`)

신규 데이터가 들어오면 `readNewLines()`가 오프셋 기반 증분 읽기를 수행하고 라인 단위 JSON 파싱을 넘깁니다.

### 상태 판정
`processTranscriptLine()`은 레코드 타입별로 처리합니다.

- `assistant` + `tool_use`
  - `agentToolStart` 전송
  - 활성 상태 전환
  - 비면제 도구면 permission 타이머 시작(7초)
- `user` + `tool_result`
  - 해당 tool 완료 처리(`agentToolDone`)
- `system` + `turn_duration`
  - 턴 종료의 확정 신호로 간주
  - 남은 도구 상태 정리 + `waiting` 전환
- 텍스트 전용 턴(도구 없음)
  - `TEXT_IDLE_DELAY_MS=5000` 무음 타이머로 waiting 판정

### permission wait 감지
활성 비면제 툴이 일정 시간 진행 신호 없이 유지되면:
- `agentToolPermission` 전송
- Task 하위 서브에이전트도 `subagentToolPermission` 전송

## 6) /clear 및 외부 터미널 대응

`ensureProjectScan()`은 프로젝트 JSONL 디렉터리를 1초 간격으로 스캔합니다.

- 새 JSONL 발견 + active agent 존재: 해당 agent를 새 파일로 재할당(`reassignAgentToFile`)
- active agent 없음 + 현재 포커스 터미널이 미등록: 그 터미널을 새 agent로 채택(`adoptTerminalForFile`)

이 로직이 `/clear` 이후 세션 파일 전환이나 외부 생성 터미널 유입을 흡수합니다.

## 7) 웹뷰 상태 반영 경로

`useExtensionMessages()` (`webview-ui/src/hooks/useExtensionMessages.ts`)가 단일 메시지 허브입니다.

- `layoutLoaded`를 먼저 처리해 좌석/배치 상태를 만든 뒤, 버퍼링된 existing agents를 배치
- `agentToolStart/Done/ToolsClear`, `agentStatus`, `agentToolPermission` 등으로 React 상태 + `OfficeState` 동시 갱신
- Task 도구는 서브에이전트 캐릭터를 생성/소멸(`addSubagent`, `removeSubagent`)
- `furnitureAssetsLoaded` 수신 시 동적 카탈로그 구성 후 편집기에서 즉시 사용

## 8) 렌더링/시뮬레이션 루프

- `OfficeCanvas.tsx`에서 `startGameLoop()`(requestAnimationFrame) 구동
- 매 프레임:
  - `officeState.update(dt)`로 캐릭터 FSM/버블/스폰·디스폰 효과 업데이트
  - `renderFrame()`로 타일/벽/가구/캐릭터/버블/에디터 오버레이 렌더링

중요 포인트:
- 픽셀 아트 선명도 유지: `imageSmoothingEnabled = false`
- Z-sort: 가구/캐릭터를 `zY` 기준 정렬
- 선택/호버 윤곽선, 버블 페이드, 에디터 고스트 프리뷰, 삭제/회전 버튼 히트테스트 포함

## 9) 레이아웃/설정 영속화

### 레이아웃
`src/layoutPersistence.ts`

- 저장 파일: `~/.pixel-agents/layout.json`
- 저장은 temp 파일 후 rename(원자적 교체)
- 파일 우선 로드 → 없으면 기존 workspaceState 마이그레이션 → 없으면 기본 레이아웃
- 다중 VS Code 창 동기화를 위해 `watchLayoutFile()` 제공

### 기타 설정
- 사운드 on/off: `globalState` (`pixel-agents.soundEnabled`)
- 에이전트 좌석/팔레트: `workspaceState` (`pixel-agents.agentSeats`)

## 10) 디버깅할 때 먼저 볼 지점

- 에이전트 생성이 안 보일 때:
  - `launchNewTerminal()` 호출 여부
  - 예상 JSONL 경로 생성/감시 시작 여부
- 상태가 멈춘 것처럼 보일 때:
  - `readNewLines()` 오프셋 증가 여부
  - permission/waiting 타이머 취소·재시작 타이밍
- 레이아웃 동기화 이슈:
  - `watchLayoutFile()`의 `markOwnWrite()` 누락 여부
- UI 표시가 이상할 때:
  - `useExtensionMessages()`에서 메시지 타입별 `OfficeState` 반영 누락 여부

