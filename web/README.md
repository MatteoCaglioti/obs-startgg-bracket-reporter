# web — Bracket Manager Frontend

React/TypeScript/Vite frontend for the OBS Start.gg Bracket Reporter.

This package provides the bracket manager UI — the control surface used by tournament staff to assign matches to streams, track scores, run character drafts, and submit results to start.gg.

In development it runs on `http://localhost:5173`. In production it is bundled into the Electron app and served by the Express backend.

## Development

```bash
npm run dev
```

Requires the API server to be running on `http://localhost:3001` (`npm run dev:api` from the project root).

## Build

```bash
npm run build
```

Output goes to `dist/`, where Electron picks it up.

## Key files

| File | Description |
|---|---|
| `src/App.tsx` | Main bracket manager — match queue, score controls, stream assignment |
| `src/Draft.tsx` | Character draft control panel |
| `src/draftTypes.ts` | Shared draft type definitions |

## Socket.io

The frontend connects to the backend via Socket.io on mount and listens for `match:update` and `draft:update` events. All state changes flow through the backend — the frontend never holds authoritative state. Multiple open windows stay in sync automatically.

See the [project README](../README.md) for full documentation.
