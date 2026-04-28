# Sync

Sync is a premium, minimal real-time communication app for one-to-one messaging and live video calls. It uses a React/Vite frontend, a NestJS backend, PostgreSQL with Prisma, Socket.IO for realtime events, and WebRTC for peer-to-peer calls.

## 1. Full Folder Structure

```text
Sync/
  backend/
    .env.example
    Dockerfile
    docker-entrypoint.sh
    prisma/migrations/
    prisma/schema.prisma
    src/
      auth/
      calls/
      chat/
      common/
      gateway/
      prisma/
      users/
      app.module.ts
      main.ts
  frontend/
    .env.example
    Dockerfile
    nginx.conf
    src/
      components/
      hooks/
      layouts/
      pages/
      services/
      store/
      types/
      utils/
      App.tsx
      main.tsx
      styles.css
  .env.example
  docker-compose.dev.yml
  docker-compose.yml
  .github/workflows/ci.yml
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  scripts/
  README.md
```

## 2. Backend Setup

The backend is a NestJS API in `backend/` with typed modules, DTO validation, JWT auth, Prisma services, and Socket.IO. The API is prefixed with `/api` and defaults to port `4000`.

## 3. Prisma Schema

Prisma models are defined in `backend/prisma/schema.prisma`:

- `User`
- `Conversation`
- `ConversationParticipant`
- `Message`
- `CallLog`

## 4. Auth Module

Auth includes register, login, bcrypt-compatible password hashing, JWT issuing, protected `/auth/me`, and a Passport JWT strategy.

## 5. Chat Module

Chat includes conversation listing, one-to-one conversation creation, message fetching, participant checks, message persistence, and seen state updates.

## 6. Socket Gateway

The gateway authenticates sockets with JWT and supports:

- `user:online`
- `user:offline`
- `conversation:join`
- `message:send`
- `message:new`
- `message:seen`
- `typing:start`
- `typing:stop`

## 7. Call Signaling

Call signaling supports:

- `call:initiate`
- `call:incoming`
- `call:accept`
- `call:reject`
- `call:end`
- `call:unavailable`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice`

## 8. Frontend Setup

The frontend is a React + Vite + TypeScript app in `frontend/`. It uses Tailwind CSS, React Router, Axios, Socket.IO Client, Zustand, lucide icons, and WebRTC browser APIs.

## 9. UI Components

Reusable components live in `frontend/src/components/`:

- `Button`
- `Input`
- `Modal`
- `Avatar`
- `ChatBubble`
- `CallControls`
- `Loader`

## 10. Pages

Implemented screens:

- Login
- Register
- Main chat dashboard
- User search modal
- Profile settings modal
- Incoming call modal
- Active video call screen
- Empty chat state

## 11. API Integration

Axios services are in `frontend/src/services/api.ts`. The token is stored in local storage as `sync_token` and sent as a Bearer token for protected requests.

## 12. WebRTC Integration

WebRTC logic lives in `frontend/src/hooks/useWebRTC.ts`. It handles local media, remote tracks, STUN configuration, SDP offer/answer exchange, ICE candidates, mute, camera toggle, screen share, and cleanup.

## 13. Final Polish

The UI is intentionally restrained: compact navigation, focused conversation list, clean chat surface, minimal forms, moderate rounding, neutral color system, one blue accent, and no marketing sections, footer, fake analytics, or decorative filler.

## 14. README

This file is the project guide.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, Axios, Socket.IO Client, Zustand
- Backend: NestJS, TypeScript, REST API, Socket.IO Gateway, JWT, Prisma
- Database: PostgreSQL
- Realtime: Socket.IO
- Calls: WebRTC

## Installation

This repo is configured for pnpm. If pnpm is already installed:

```bash
pnpm install
pnpm prisma:generate
```

This workspace also includes a local pnpm binary at `.tools/pnpm-bin/pnpm`, so these commands work here even without a global pnpm install:

```bash
.tools/pnpm-bin/pnpm install
.tools/pnpm-bin/pnpm prisma:generate
```

Local `.env`, `backend/.env`, and `frontend/.env` files have already been created with development defaults.

## Environment Variables

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sync?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
PORT=4000
FRONTEND_URL="http://localhost:5173"
VITE_API_URL="http://localhost:4000"
```

## Local Database

Start PostgreSQL with Docker:

```bash
./scripts/docker-dev.sh
```

That script starts the Postgres container, deploys Prisma migrations, and launches both apps.

If you do not have Docker running, start any local PostgreSQL server on port `5432` with:

```text
user: postgres
password: postgres
database: sync
```

Then run:

```bash
pnpm prisma:deploy
```

## Run Backend

```bash
pnpm dev:backend
```

Backend URL:

```text
http://localhost:4000
```

## Run Frontend

```bash
pnpm dev:frontend
```

Frontend URL:

```text
http://localhost:5173
```

## Run Both Apps

```bash
pnpm dev
```

## Production Build

```bash
./scripts/local-check.sh
```

## Production With Docker

Build and run the production-style stack:

```bash
./scripts/docker-prod.sh
```

Services:

```text
web: http://localhost:8080
api: http://localhost:4000
postgres: localhost:5432
```

The API container runs `prisma migrate deploy` before starting.

Before a real deployment, change:

```env
JWT_SECRET="change-me-before-production"
FRONTEND_URL="https://your-domain.com"
VITE_API_URL="https://your-api-domain.com"
```

## GitHub Push

The repository remote is configured as:

```text
https://github.com/Suraj1812/Sync.git
```

Authenticate and push:

```bash
./scripts/git-auth-and-push.sh
```

The script uses the workspace-local GitHub CLI if present, otherwise falls back to a normal `gh` install. It stores auth config under `.tools/gh-config`, wires Git credentials, and pushes `main`.

## CI

GitHub Actions runs on pushes and pull requests to `main`:

- install dependencies
- generate Prisma Client
- validate Prisma schema
- lint
- build backend and frontend

## Features

- Register, login, session restore, logout
- Protected API routes
- Profile editing with name, status, and avatar URL
- User search
- One-to-one conversations
- Real-time messaging
- Typing indicators
- Seen/read state
- Timestamps
- Emoji picker
- Online/offline presence and last seen
- Incoming call modal
- Accept, reject, unavailable, ringing, and end call states
- WebRTC video calling
- Microphone toggle
- Camera toggle
- Screen sharing
- Call timer
- Responsive desktop, tablet, and mobile layout

## Notes

WebRTC camera and microphone access requires a secure context in most browsers. `localhost` is treated as secure for local development.
