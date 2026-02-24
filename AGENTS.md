# Repository Guidelines

## Project Structure & Module Organization
- `src/`: VS Code extension backend (agent tracking, file watching, panel provider, transcript parsing).
- `webview-ui/src/`: React + TypeScript frontend rendered inside the VS Code webview (office engine, editor tools, UI components).
- `scripts/`: asset import/export and helper tooling for tilesets and metadata workflows.
- `webview-ui/public/assets/`: runtime art assets and default layout JSON used by the webview.
- Build output: `dist/` (extension bundle). Treat `dist/` and generated files as build artifacts.

## Build, Test, and Development Commands
- `npm run build`: full verification + production build (type-check, lint, extension bundle, webview build).
- `npm run watch`: extension-side live workflow (`esbuild --watch` + `tsc --watch`).
- `npm run build:webview`: rebuild only the React/Vite webview.
- `npm run lint`: lint backend TypeScript in `src/`.
- `npm run check-types`: TypeScript type-check for extension sources.
- `cd webview-ui && npm run lint`: lint frontend (`.ts/.tsx`).
- `cd webview-ui && npm run dev`: run webview locally with Vite for UI iteration.

## Coding Style & Naming Conventions
- Language: TypeScript across backend and frontend; React with function components in webview.
- Indentation/style: follow existing file style (backend commonly 4 spaces, webview commonly 2 spaces); avoid reformat-only diffs.
- ESLint is authoritative (`eslint.config.mjs`, `webview-ui/eslint.config.js`).
- Prefer descriptive camelCase for variables/functions, PascalCase for React components/types.
- Centralize shared constants instead of inline magic values (`src/constants.ts`, `webview-ui/src/constants.ts`).

## Testing Guidelines
- No dedicated automated test suite is configured yet.
- Required baseline before PR: run `npm run build` and verify behavior in a VS Code Extension Development Host (`F5`).
- For UI changes, manually validate key flows (agent spawn, movement/state updates, layout editor actions).

## Commit & Pull Request Guidelines
- Use short, imperative commit subjects consistent with history (examples: `Add ...`, `Fix ...`, `Update ...`).
- Keep commits focused and logically scoped; separate refactors from behavior changes where possible.
- PRs should include:
- clear summary of what changed and why,
- verification steps (commands run, manual checks),
- screenshots/GIFs for UI changes.
- Link related issues when applicable and note limitations or follow-up work explicitly.

## Agent-Specific Instructions
- Default communication language is Korean.
- Respond in Korean unless the user explicitly requests another language.
- Keep code identifiers as-is, but write explanations, reviews, and guidance in Korean by default.
