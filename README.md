# CampusSphere

CampusSphere is a full-stack campus networking and collaboration platform that brings students, communities, events, projects, opportunities, and meaningful connections into one unified experience.

## Core features

- Student profiles, discovery, and partial-name search
- Connection requests and connection management
- Communities, memberships, posts, comments, and reactions
- Events, registration, and cancellation
- Projects, team formation, applications, and membership management
- Opportunity discovery, filters, deadlines, and external applications
- Backend-driven notifications and unread state
- Persistent real-time direct messaging with Socket.IO
- Email/password authentication and Google Sign-In
- Persistent profile-photo uploads with safe fallbacks

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | HTML, CSS, modern browser JavaScript |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Authentication | JWT access tokens, HTTP-only refresh cookies, Google Identity Services |
| Real time | Socket.IO |
| Logging | Pino |

## Project structure

```text
.
|-- *.html, *.css, *.js       Frontend pages, styles, and browser code
|-- assets/                   Versioned product and founder assets
|-- backend/
|   |-- src/                  Express API, middleware, and realtime server
|   |-- prisma/
|   |   |-- schema.prisma     Database schema
|   |   `-- migrations/       Versioned database migrations
|   |-- uploads/              Local runtime uploads (ignored by Git)
|   `-- package.json          Backend dependencies and scripts
|-- .gitignore
`-- CONTRIBUTING.md
```

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 16 or newer
- A static frontend server such as VS Code Live Server

### Backend environment

Create the local environment file from the safe template:

```powershell
Copy-Item backend/.env.example backend/.env
```

Configure these variables in `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment |
| `PORT` | Express API port; defaults to `4000` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access-token signing secret, at least 32 characters |
| `JWT_REFRESH_SECRET` | Separate refresh-token signing secret, at least 32 characters |
| `FRONTEND_URL` | Allowed frontend origin for CORS and Socket.IO |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID used to verify Google ID tokens |

Never commit `.env` files or place real credentials in `.env.example`.

### Install and prepare Prisma

```powershell
Set-Location backend
npm install
npx prisma generate
npx prisma migrate dev
```

Use `npx prisma migrate deploy` in deployment or shared environments. Prisma schema and migration files are intentionally versioned.

The seed command is a safe no-op: CampusSphere does not ship fake users or demo product records. Never run database-reset commands against a database containing real data.

### Start the backend

```powershell
Set-Location backend
npm run dev
```

The default API is available at `http://localhost:4000/api/v1`. The health endpoint is `http://localhost:4000/api/health`.

### Start the frontend

Serve the repository root with a static server and open `index.html`. On `localhost` or `127.0.0.1`, the frontend automatically uses port `4000` for the API.

For another backend origin, set this before the application scripts load:

```html
<script>window.CAMPUSSPHERE_API_ORIGIN = 'https://api.example.invalid';</script>
```

Do not commit a real production hostname until the deployment configuration is agreed by the team.

## Backend commands

Run these inside `backend/`:

```powershell
npm run dev          # Development server with file watching
npm run build        # Compile TypeScript into dist/
npm start            # Run the compiled server
npm run lint         # Type-check without writing output
npm test             # Run unit tests
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Create/apply a development migration
npm run db:deploy    # Apply committed migrations
npm run db:seed      # Safe no-op; no demo data is created
```

## Authentication and local media

Google Sign-In obtains its Client ID from the backend configuration endpoint; it is not duplicated in frontend source. The backend verifies Google credentials and links a verified matching email to the existing CampusSphere user instead of creating a duplicate.

Local profile photos are stored under `backend/uploads/` during development and are served by Express from `/uploads`. This runtime directory is ignored so real user-uploaded photos are never committed. Use object storage for production deployments.

## Security notes

- Keep database credentials, signing secrets, and tokens only in environment configuration.
- Use separate, randomly generated values for access-token and refresh-token secrets.
- Never commit local logs, uploads, database dumps, screenshots, or test credentials.
- Do not use the normal development database for automated test fixtures.
- Review dependency and secret-scanning results before every release.

## Contribution workflow

`main` is the stable branch. Normal work belongs on a focused branch and is merged through a reviewed pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, validation, commit, and review guidance.

## Founding team

- Vijay Gaikwad — Founder & Product/Engineering Lead
- Krishna Ravva — Co-Founder & UI/UX + QA Lead
- Siddhant Bhasme — Co-Founder & AI + Mobile Lead
