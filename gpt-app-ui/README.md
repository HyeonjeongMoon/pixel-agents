# GPT App UI Demo (MCP Apps Bridge)

`gpt-app.md` 내용을 바탕으로 만든 데모입니다.

## 구성

- `web/`: React 컴포넌트(iframe 안에서 동작)
  - `ui/notifications/tool-result` 수신 렌더링
  - `tools/call` JSON-RPC 요청
  - `ui/message` 알림 전송
  - `ui/update-model-context` 요청
  - `openai:set_globals` 이벤트 구독(`useOpenAiGlobal`)
- `host-simulator/`: ChatGPT/MCP Apps 호스트를 흉내 내는 페이지

## 실행 방법

1. 의존성 설치 및 번들

```bash
cd gpt-app-ui/web
npm install
npm run build
```

2. 정적 서버로 `gpt-app-ui` 폴더를 서빙

예:

```bash
cd gpt-app-ui
python3 -m http.server 4173
```

3. 브라우저 열기

- `http://localhost:4173/host-simulator/`

## 확인 포인트

- **Send tool-result** 버튼: `ui/notifications/tool-result` 수신 후 Task UI 갱신
- 위젯의 **Call tools/call** 버튼: `tools/call` 요청/응답 round-trip
- **Send ui/message**: 호스트 로그에 전달 내용 표시
- **Update model context**: `ui/update-model-context` 요청/응답 확인
- **Dispatch openai:set_globals**: `window.openai.toolOutput` 기반 렌더링 확인
