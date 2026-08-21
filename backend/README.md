# CampusSphere backend

Modular Express + TypeScript API using PostgreSQL and Prisma. API routes are versioned under `/api/v1`.

## Setup

1. Install Node.js 20 or newer and PostgreSQL 16 or newer.
2. Copy `.env.example` to `.env`, then set real database and JWT values.
3. Run `npm install`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. Run `npm run dev`.

Health check: `GET http://localhost:4000/api/health`

## API overview

All product routes are under `/api/v1`. Protected routes require an `Authorization: Bearer <access-token>` header. Authentication also sets an HTTP-only refresh cookie.

- `/auth` - register, login, logout, refresh, and current user.
- `/users`, `/connections` - profiles and connection requests.
- `/communities`, `/posts` - communities, membership, feed, likes, and comments.
- `/events`, `/projects`, `/opportunities` - campus activities and discovery.
- `/notifications`, `/conversations` - notification and persisted messaging APIs.
- `/search`, `/dashboard` - grouped search and personalised dashboard data.
- `/academic` - student academic enrollment data, assignment-scoped teacher data, admin summaries, and an optional development-only role assignment endpoint.

New public accounts always receive the `STUDENT` role. To test teacher/admin routing locally, set a private 32+ character `DEV_ROLE_ASSIGNMENT_KEY` and call the authenticated development endpoint with the matching `x-dev-role-key` header. The endpoint returns 404 in production and when the key is not configured.

## Verification

Run `npm run build` for TypeScript validation, `npm run test` for automated tests, and `npm audit --omit=dev` for the dependency audit. Do not commit `.env`; it is ignored by the repository.

`npm run db:seed` is intentionally a no-op. CampusSphere does not ship demo users or fake product data.

### Database safety for verification

- Never create verification users, projects, or other fixtures in the normal development database.
- Database-backed automated tests must use a dedicated `TEST_DATABASE_URL` whose database name ends in `_test`. Test setup must refuse to run if it resolves to the normal `DATABASE_URL`.
- Create each test's records inside a transaction that is rolled back, or delete the complete fixture graph in `afterEach`/`finally` cleanup.
- Manual browser verification should use the three existing development accounts. If temporary data is unavoidable, record its IDs and remove it in the same verification run.
- Unit tests that do not need PostgreSQL should continue using mocks or pure validators and must not connect to the development database.
