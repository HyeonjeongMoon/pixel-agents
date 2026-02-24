# Agent Dashboard (Next.js Mock)

독립 웹뷰/대시보드 아키텍처를 검증하기 위한 샘플 앱입니다.

## 포함 항목

- OpenAPI: `data/openapi/openapi.yaml`
- JSON Schema:
  - `data/schemas/event-envelope.schema.json`
  - `data/schemas/state-snapshot.schema.json`
- Mock 데이터:
  - `data/mocks/state.snapshot.json`
  - `data/mocks/events.json`
- Next.js 데모 UI + Mock API 라우트

## 실행

```bash
cd agent-dashboard
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## API 엔드포인트

- `GET /api/v1/state`
- `GET /api/v1/layout`
- `GET /api/v1/events?after_seq=3`
- `GET /api/v1/stream` (SSE 데모)

## 동작 방식

1. 초기 스냅샷을 로드
2. 이벤트 배열을 순차 적용(`lib/reducer.ts`)
3. UI에서 Step/Play All/Reset으로 상태 전이 확인

## 데모 포인트

- 4개 역할 에이전트(프론트엔드/백엔드/기획/디자인) 기본 탑재
- 300개+ 이벤트 목업으로 실제 작업/이동/권한대기 시나리오 재현
- 오피스 프리뷰에서 에이전트 hover 시 최근 작업 5개 툴팁 확인 가능
