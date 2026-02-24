# Work Log

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
- `npm run build` 시 Next.js 빌드는 성공했고, ESLint 의존성 경고(`ESLint must be installed ...`)가 출력됨.
