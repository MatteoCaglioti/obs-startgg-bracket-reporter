# OBS Start.gg Bracket Reporter

A tournament management platform for livestreamed events. Replaces TournamentStreamHelper with a purpose-built Electron app that communicates with the [start.gg](https://start.gg) API and provides real-time browser overlays for OBS.

## Features

- **Bracket Manager** — Electron desktop app (React/Vite) for managing tournament sets: assign matches to streams, track scores, and submit results to start.gg.
- **Scoreboard Overlay** — Browser source for OBS; auto-updates via WebSocket when scores or players change.
- **Character Draft Overlay** — Browser source for OBS; displays a live ban/pick draft for team-format matches.
- **Stream Deck Integration** — HTTP endpoints (GET or POST) for hardware controllers to adjust scores and toggle scoreboard visibility.
- **Multi-instance Sync** — All open bracket manager windows stay in sync in real time via Socket.io; the backend is the single source of truth.

---

## Architecture

```
obs-startgg-bracket-reporter/
├── api/          Node/Express/Socket.io backend + static overlay pages
├── web/          React/Vite bracket manager frontend (served by Electron)
├── electron/     Electron shell (loads api server + web UI)
└── assets/       App icons and shared assets
```

- **Backend** runs on `http://localhost:3001`
- **Bracket manager** runs on `http://localhost:5173` in dev, embedded in Electron in production
- **Scoreboard overlay**: `http://localhost:3001/scoreboard`
- **Draft overlay**: `http://localhost:3001/draft-overlay`

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [start.gg](https://start.gg) developer API token
- Your tournament slug (e.g. `tournament/my-event`)

### Install

```bash
npm run install:all
```

### Development

Run the API server and web frontend in separate terminals:

```bash
# Terminal 1 — API server
npm run dev:api

# Terminal 2 — Web frontend
npm run dev:web
```

Then open `http://localhost:5173` in a browser for the bracket manager, or launch the Electron app.

### Production Build

```bash
npm run build
```

### Package (Windows installer)

```bash
npm run dist
```

Outputs an NSIS installer to `release/`.

---

## Configuration

On first launch, enter your start.gg API token and tournament slug in the bracket manager settings screen. These are persisted to `api/config.json`.

To configure the character draft ruleset (ban/pick order, roster), edit `api/config/ruleset.json`. See [Ruleset Format](#ruleset-format) below.

---

## OBS Setup

Add the following as **Browser Sources** in OBS:

| Source | URL |
|---|---|
| Scoreboard | `http://localhost:3001/scoreboard` |
| Draft Overlay | `http://localhost:3001/draft-overlay` |

Both pages connect to the backend via WebSocket and update automatically.

---

## API Reference

All endpoints are on `http://localhost:3001`.

### Match Management

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/matches` | — | All matches in backend state |
| `GET` | `/streams` | — | Tournament streams from start.gg |
| `POST` | `/refresh` | — | Pull latest sets from start.gg (preserves local scores) |
| `POST` | `/assign` | `{ matchId, streamId }` | Assign a match to a stream |
| `POST` | `/unassign` | `{ matchId }` | Remove a match from a stream |
| `POST` | `/start` | `{ matchId }` | Mark a match as live on start.gg |
| `POST` | `/updateScoreLocal` | `{ matchId, score1, score2 }` | Update scores in backend only |
| `POST` | `/saveResult` | `{ matchId }` | Push current scores to start.gg |
| `POST` | `/submitFinal` | `{ matchId }` | Report final result and mark complete |

### Configuration

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/config` | — | Check if token/slug are configured |
| `POST` | `/config` | `{ STARTGG_API_TOKEN, TOURNAMENT_SLUG }` | Save configuration |

### Stream Deck Endpoints

All Stream Deck endpoints accept **GET or POST**. Pass `streamId` as a query param or JSON body field to target a specific stream; omit it to target the first live/assigned match.

| Path | Description |
|---|---|
| `/streamdeck/p1/score/up` | Increment P1 score |
| `/streamdeck/p1/score/down` | Decrement P1 score |
| `/streamdeck/p2/score/up` | Increment P2 score |
| `/streamdeck/p2/score/down` | Decrement P2 score |
| `/streamdeck/swap` | Toggle player side swap on scoreboard |
| `/streamdeck/scoreboard/show` | Show scoreboard overlay |
| `/streamdeck/scoreboard/hide` | Hide scoreboard overlay |
| `/streamdeck/display` | Get current display state (GET only) |

### Draft Endpoints

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/draft` | — | Current draft state |
| `POST` | `/draft/start` | `{ team1Name, team2Name }` | Start a new draft (enters RPS phase) |
| `POST` | `/draft/rps-winner` | `{ winner: 1 \| 2 }` | Record RPS winner; begins ban phase |
| `POST` | `/draft/ban` | `{ codename }` | Ban a character |
| `POST` | `/draft/pick` | `{ codename }` | Pick a character |
| `POST` | `/draft/undo` | — | Undo last ban/pick |
| `POST` | `/draft/redo` | — | Redo last undone action |
| `POST` | `/draft/restart` | — | Restart draft from RPS (keeps team names) |

---

## WebSocket Events

Connect to `http://localhost:3001` with Socket.io. On connection the server immediately emits current state.

| Event | Direction | Payload | Description |
|---|---|---|---|
| `match:update` | server → client | `Record<string, Match>` | Full match state; emitted on every change |
| `draft:update` | server → client | `DraftState` | Full draft state; emitted on every change |
| `scoreboard:display` | server → client | `Record<string, { visible, swapped }>` | Display state per stream |

---

## Match Status Lifecycle

```
idle → assigned → live → saved → complete
              ↑___________|
              (can re-assign after unassign)
```

- **idle** — known to the system but not on stream
- **assigned** — assigned to a stream, not yet started
- **live** — actively in progress
- **saved** — result recorded locally, not yet submitted to start.gg
- **complete** — final result submitted; cannot be modified

The backend preserves local scores and status across start.gg refreshes. start.gg is only updated when you explicitly call `/saveResult` or `/submitFinal`.

---

## Ruleset Format

`api/config/ruleset.json` controls the character draft:

```jsonc
{
  "name": "SF3TS 3v3",
  "teamSize": 3,
  "banOrder": [0, 1, 1, 0],      // 0 = team1, 1 = team2
  "pickOrder": [0, 1, 1, 0, 0, 1],
  "characters": [
    { "codename": "Ryu", "displayName": "Ryu", "imagePath": "/assets/characters/sf3ts/Ryu.png" }
    // ...
  ]
}
```

Character images must be placed in `api/assets/characters/<game>/`.

---

## Development Notes

- The backend store (`api/core/store.ts`) is the source of truth for all match state. The start.gg API is only consulted on explicit refresh.
- Socket.io broadcasts `match:update` on every `store.dispatch()` call automatically via a store subscriber.
- In development, the web frontend runs on port 5173 (Vite) and the API on 3001. CORS is configured to allow both origins.
- Logs are written to `api/app.log` alongside the binary in production.
