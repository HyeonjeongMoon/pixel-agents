# Pixel Agents 5분 온보딩

이 문서는 신규 기여자가 **5분 안에 로컬 실행과 코드 흐름**을 파악하도록 돕는 빠른 가이드입니다.

## 1) 먼저 실행해보기

```bash
npm install
cd webview-ui && npm install && cd ..
npm run build
```

그다음 VS Code에서 `F5`를 눌러 Extension Development Host를 실행합니다.

## 2) 핵심 폴더만 기억하기

- `src/`: VS Code 확장 백엔드 (터미널/JSONL 감시/메시지 전송)
- `webview-ui/src/`: 웹뷰 프론트엔드 (React + Canvas 렌더링)
- `scripts/`: 타일셋/에셋 처리 스크립트
- `dist/`: 빌드 산출물

## 3) 런타임 흐름 한 줄 요약

1. 웹뷰가 `webviewReady` 전송  
2. 확장이 에이전트 복구 + 에셋/레이아웃 로드  
3. 확장이 JSONL을 읽어 `agentToolStart`, `agentStatus` 같은 이벤트 전송  
4. 웹뷰가 `OfficeState`를 갱신하고 캐릭터/버블/툴 상태를 렌더링

## 4) 가장 먼저 읽을 파일

- 진입점: `src/extension.ts`
- 웹뷰 브리지: `src/PixelAgentsViewProvider.ts`
- 에이전트 수명주기: `src/agentManager.ts`
- JSONL 파싱: `src/transcriptParser.ts`
- 메시지 허브: `webview-ui/src/hooks/useExtensionMessages.ts`
- 렌더링: `webview-ui/src/office/components/OfficeCanvas.tsx`

## 5) 자주 쓰는 개발 명령

- `npm run watch`: 확장 측 watch(esbuild + tsc)
- `npm run build:webview`: 웹뷰만 다시 빌드
- `npm run lint`: 백엔드 lint
- `cd webview-ui && npm run lint`: 프론트 lint

## 6) 첫 기여 추천 작업

- `agentStatus` 전이 로그 개선(디버깅 가독성)
- 레이아웃 import/export 에러 메시지 개선
- UI 변경 시 GIF/스크린샷 포함 PR 작성

자세한 내부 동작은 [CODEBASE_WORKINGS.md](/Users/mhj/enkinokorea/2026/pixel-agents/CODEBASE_WORKINGS.md)를 참고하세요.
