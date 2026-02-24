# Work Log

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
