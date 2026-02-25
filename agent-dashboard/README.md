# Agent Dashboard (Next.js)

독립 웹뷰/대시보드 아키텍처를 검증하기 위한 샘플 앱입니다.  
`mock`, `claude`, `generic` 소스를 지원합니다.

## 포함 항목

- OpenAPI: `data/openapi/openapi.yaml`
- JSON Schema:
  - `data/schemas/event-envelope.schema.json`
  - `data/schemas/state-snapshot.schema.json`
- Mock 데이터:
  - `data/mocks/state.snapshot.json`
  - `data/mocks/events.json`
- Next.js 데모 UI + Mock API 라우트
- Live 브리지:
  - `lib/liveBridge.ts` (`~/.claude/projects/<workspace-hash>/*.jsonl` tail)

## 실행

```bash
cd agent-dashboard
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

기본 소스 선택:

```bash
AGENT_SOURCE_MODE=claude npm run dev
```

루트에서 실행:

```bash
cd ..
npm run dashboard:dev
```

## Live 모드 실행

1. 다른 터미널에서 Claude Code를 실행해서 JSONL 로그를 생성
2. `agent-dashboard`를 live 모드로 실행

```bash
cd agent-dashboard
AGENT_DASHBOARD_SOURCE=live npm run dev
```

필요하면 경로를 명시:

```bash
CLAUDE_PROJECT_DIR=~/.claude/projects/-Users-mhj-enkinokorea-2026-pixel-agents AGENT_DASHBOARD_SOURCE=live npm run dev
```

추가로 workspace 루트를 직접 지정하려면:

```bash
PIXEL_WORKSPACE_ROOT=/Users/mhj/enkinokorea/2026/pixel-agents AGENT_DASHBOARD_SOURCE=live npm run dev
```

## API 엔드포인트

- `GET /api/v1/state?source=mock|claude|generic`
- `GET /api/v1/layout?source=mock|claude|generic`
- `GET /api/v1/events?source=mock|claude|generic&after_seq=3`
- `GET /api/v1/stream?source=mock|claude|generic&after_seq=3`
- `POST /api/v1/ingest` (generic 이벤트 주입)

## 동작 방식

1. 초기 스냅샷을 로드
2. 이벤트 배열을 순차 적용(`lib/reducer.ts`)
3. mock: Step/Play All/Reset 재생, live: SSE 실시간 반영

## Generic Ingest 예시

```bash
curl -X POST http://localhost:3000/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type":"agent.created",
    "agent_id":"g-agent-1",
    "payload":{"name":"Generic Agent","col":10,"row":12}
  }'
```

## Docker 실행

이미지 빌드:

```bash
cd agent-dashboard
docker build -t pixel-agents-dashboard .
```

컨테이너 실행:

```bash
docker run --rm -p 3000:3000 \
  -e AGENT_SOURCE_MODE=claude \
  -e CLAUDE_PROJECT_DIR=/root/.claude/projects/-Users-mhj-enkinokorea-2026-pixel-agents \
  pixel-agents-dashboard
```

호스트 Claude 로그를 컨테이너에 마운트하려면 `-v <host_claude_projects>:/root/.claude/projects:ro`를 추가하세요.

## 데모 포인트

- 4개 역할 에이전트(프론트엔드/백엔드/기획/디자인) 기본 탑재
- 300개+ 이벤트 목업으로 실제 작업/이동/권한대기 시나리오 재현
- 오피스 프리뷰에서 에이전트 hover 시 최근 작업 5개 툴팁 확인 가능
