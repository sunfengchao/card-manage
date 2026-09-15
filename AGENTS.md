# AGENTS.md

This repository is an Electron + Vue 3 desktop app for managing credit cards and bank accounts. Keep changes aligned with the current app architecture and the operating conventions described in [README.md](README.md).

## Project at a glance

- App shell: Electron main process + Vue renderer process
- Language: TypeScript
- UI: Vue 3 + Element Plus + ECharts
- Routing: `vue-router` in hash mode for Electron
- Persistence: local JSON file stored in the Electron user-data directory

## Key entry points

- Main process: [src/main/index.ts](src/main/index.ts)
- Preload bridge: [src/preload/index.ts](src/preload/index.ts)
- Shared models: [src/shared/types.ts](src/shared/types.ts)
- Renderer data store: [src/renderer/src/store/data.ts](src/renderer/src/store/data.ts)
- App router: [src/renderer/src/router/index.ts](src/renderer/src/router/index.ts)
- App shell layout: [src/renderer/src/App.vue](src/renderer/src/App.vue)

## Working conventions

- Prefer small, targeted edits. Do not broaden the scope beyond the feature or bug being changed.
- Keep business logic and UI separation clear: main-process code should handle app lifecycle and file I/O; renderer code should use the IPC bridge and Vue state store.
- Follow the existing `AppData` contract in [src/shared/types.ts](src/shared/types.ts). If you change data models, update the relevant store logic and any UI consumers in the same change.
- Treat card numbers as sensitive data. Store only the last 4 digits when needed; do not add full PAN storage unless explicitly required.
- Use hash-based routing, not browser history, because this app runs inside Electron.
- Preserve the current data-save behavior: renderer state is debounced and the app flushes pending writes on shutdown to avoid losing unsaved changes.

## Important implementation notes

- The app persists JSON under Electron's user-data folder via `app.getPath('userData')`; in development, the project uses [dev-user-data](dev-user-data) for isolated testing data.
- Renderer code should work through `window.api` and the state store in [src/renderer/src/store/data.ts](src/renderer/src/store/data.ts) instead of direct file access.
- The app has default settings for reminder thresholds in [src/shared/types.ts](src/shared/types.ts); keep those defaults consistent when adjusting alert rules.
- When adding new views or routes, update the router and keep route metadata titles consistent with the existing Chinese labels.

## Validation commands

Run the relevant commands before calling work complete:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run dev`

Common build targets:

- `npm run build:win`
- `npm run build:mac`
- `npm run build:linux`

## Repo-specific guidance

- This project is a desktop app, not a web app, so behavior should remain stable in a local single-user environment.
- Keep UI copy and labels in Chinese where the project already uses Chinese naming and messages.
- Prefer reusing existing store helpers and composable patterns before introducing new global state patterns.
- If you need to inspect app behavior or state, start from [src/renderer/src/store/data.ts](src/renderer/src/store/data.ts) and the relevant view files under [src/renderer/src/views](src/renderer/src/views).

## Related docs

- [README.md](README.md)
- [electron.vite.config.ts](electron.vite.config.ts)
- [src/renderer/src/views](src/renderer/src/views)
