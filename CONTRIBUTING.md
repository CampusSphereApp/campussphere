# Contributing to CampusSphere

CampusSphere uses pull requests to keep `main` stable, reviewable, and safe for collaboration.

## Branch workflow

Do not work directly on `main` for normal feature or maintenance work.

1. Synchronize your local `main` branch.
2. Create a focused branch from `main`.
3. Develop and verify the change locally.
4. Commit only related files.
5. Push the branch and open a pull request.
6. Request review, address feedback, and merge only after checks pass.

Use a descriptive branch prefix:

- `feature/...` for product capabilities
- `fix/...` for bug fixes
- `ui/...` for focused interface work
- `ai/...` for AI-related development
- `mobile/...` for mobile development
- `docs/...` for documentation-only work
- `chore/...` for maintenance and tooling

Examples: `fix/avatar-media-url`, `ui/mobile-project-filter`, `ai/campus-assistant-api`.

## Local preparation

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

Supply your own local environment values. Never copy another developer's `.env`, database password, JWT secrets, session tokens, or personal credentials into Git, chat, issues, or pull requests.

## Before committing

Run the relevant checks from `backend/`:

```powershell
npm run lint
npm test
npm run build
```

Also verify the affected browser flow on desktop and, for UI work, at a narrow mobile viewport. Inspect the browser console and failed network requests for the changed flow.

Do not commit:

- `.env` files or secrets
- `node_modules/`, `dist/`, logs, or coverage
- local user uploads or real profile photos
- database dumps or real user data
- browser screenshots and temporary debug artifacts
- permanent QA users, projects, events, communities, or messages

Tests that need database records must use an isolated test database and clean up their complete fixture graph. Never reset or seed the shared development database.

## Commit messages

Write concise, imperative commit subjects describing one logical change:

- `fix: resolve uploaded avatar URLs against API origin`
- `feat: add Google account linking`
- `docs: document local Prisma setup`
- `chore: ignore runtime uploads`

Avoid messages such as `update`, `changes`, or `final fix`. Split unrelated work into separate commits.

## Pull requests

Each pull request should include:

- What changed and why
- The affected pages, API routes, or Prisma models
- Verification performed
- Screenshots only when they help reviewers assess UI changes
- Migration and environment-variable notes, when applicable
- Any known limitations or follow-up work

Never include secret values in descriptions, screenshots, logs, or review comments. New environment variables must be documented as empty or clearly fake placeholders in `.env.example`.

## Database changes

- Commit `schema.prisma` and generated migration SQL.
- Do not edit an already-shared migration to represent a new change; create another migration.
- Do not commit local databases or dumps.
- Review cascade behavior and data preservation before applying destructive schema changes.
- Keep `prisma/seed.mjs` free of fake users and product content unless the team explicitly adopts an isolated demo database.

## Review expectations

Reviewers should check scope, correctness, authorization, data ownership, error handling, responsive behavior, accessibility, tests, and secret exposure. At least one teammate should review normal changes before they are merged into `main`.
