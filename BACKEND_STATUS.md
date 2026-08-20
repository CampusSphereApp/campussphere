# Backend status

Current work: user profile and user discovery foundation complete; Connections is paused pending manual frontend confirmation.

## Verified: centralized current-user identity

- Root cause: authenticated pages contained independent Vijay/pravatar placeholder markup, while only part of the dashboard hydrated it. Discover and several header surfaces never read the authenticated user.
- `frontend-api.js` now owns a per-page cached `/auth/me` source. `current-user.js` hydrates sidebar and header identity from that source on every authenticated page that imports the API client.
- Logout removes the access token and clears the cached current user before redirecting.
- Dashboard and Discover no longer ship the old current-user name/avatar values; other authenticated headers use a neutral `data-current-user-avatar` placeholder that the shared renderer hydrates.
- Fresh Account A → logout → Account B verification passed: `GET /auth/me` returned only the respective account, with Account B's ID different from Account A's.

## Verified: authentication/session persistence

- API clients select `http://127.0.0.1:4000/api/v1` when the frontend is served from `http://127.0.0.1:5500`; `localhost` is used only for a localhost frontend.
- Access tokens remain in `localStorage`; the refresh token remains an HTTP-only cookie scoped to the matching API host.
- A 401 from an authenticated API call attempts `/auth/refresh` once, saves the replacement access token, then retries the original request.
- Dashboard, profile/settings, messages, and notifications restore `/auth/me` before treating a user as logged out; unauthenticated users are redirected to `login.html`.
- Dashboard logout calls `/auth/logout`, clears local token storage, and redirects to login.

## Step 1 verification

- Login on `127.0.0.1:4000` returned HTTP 200 and a refresh cookie/access token.
- Simulated browser refresh after clearing the access token: `/auth/refresh` returned HTTP 200 with a replacement access token.
- `/auth/me` with that replacement token returned the seeded user successfully.
- Logout returned HTTP 204; a subsequent refresh correctly returned HTTP 401.
- Backend tests and TypeScript build pass.

## Audit scope

See `INTEGRATION_AUDIT.md`. Steps 3-12 are explicitly unverified and must not be treated as complete.

## Verified: profile and user discovery foundation

- The existing settings screen now has editable skills, interests, and avatar URL fields alongside its existing profile fields.
- `PATCH /api/v1/users/me` updates scalar profile data and atomically replaces skill/interest relations in PostgreSQL.
- `/auth/me` and user detail responses include skills and interests for frontend rendering.
- A real profile update returned HTTP 200; a subsequent `/auth/me` read and direct Prisma query confirmed persisted bio, college, course, year, avatar URL, skills, and interests.
- Dashboard and Discover navigation now link to `profile.html` and `discover.html` instead of non-functional hash targets.
- `profile.html` now distinguishes the authenticated profile from a public profile using `profile.html?id=<USER_ID>`; public profiles load from `GET /api/v1/users/:id` and do not expose the edit action.
- User discovery now follows one mock-free path: `GET /api/v1/users?limit=20` loads registered users on entry, and `GET /api/v1/users/search?q=` performs text search by full name, email, college, or course. The discovery request does not call any Connection endpoint.
- Discovery and public-profile responses intentionally exclude email and all authentication fields; only `/auth/me` returns the signed-in user's email.
- Two fresh users were registered and verified in both directions: User A found User B by name and loaded User B's profile; User B found and loaded User A's profile. A repeated search after reload-equivalent API initialization also returned User B. All search and public-profile requests returned HTTP 200.
- Exact and partial-name searches through `GET /api/v1/users/search?q=` were reverified after the frontend wiring change. Both returned the expected PostgreSQL user and the public profile endpoint returned the matching database ID.
- Simple-discovery verification passed with fresh users: both appeared in the initial 20-user API list, each account's rendered data includes real profile fields and skills, partial A→B and B→A searches returned HTTP 200, and navigation targets were `profile.html?id=<database-user-id>`.
- Discovery follow-up: corrected the missing case-insensitive `college` predicate in the Prisma search `OR` clause. Fresh-server checks now return HTTP 200 for list, name, email, college, and course searches; the initial list contains both latest test accounts.

## Verified: dashboard user-search wiring

- The dashboard's exact top input is `#dashboard-user-search`.
- It now uses the existing authenticated API client and `GET /api/v1/users/search?q=<query>&limit=5` after a 300 ms debounce; no backend endpoint was added or changed.
- The dropdown displays loading, no-result, and API error states, closes outside the search area or below two characters, and routes a selected user to `profile.html?id=<database-user-id>`.
- Runtime API verification of `q=vij` returned HTTP 200, three users total, including two `Vijay Gaikwad` accounts. A selected Vijay profile endpoint returned HTTP 200 with the matching ID.
- The profile save/reload check returned HTTP 200 for `PATCH /users/me` and `GET /auth/me`; direct Prisma verification confirmed skills, interests, and profile fields persisted. Password hashes were confirmed not to be plaintext.

The local API was rebuilt and restarted on port 4000; `/api/health` returned database status `connected`. TypeScript build and 4 automated tests pass.

## Connections: paused and unverified from the frontend

- Prisma `Connection` is the authoritative relationship model with `PENDING`, `ACCEPTED`, and `REJECTED` states. Pair lookup is direction-agnostic to prevent reverse duplicates.
- Authenticated connection API now provides send, accepted list, incoming list, sent list, pending summary, relationship status, accept, reject, cancel/remove, and re-request after rejection.
- `connections-ui.js` is shared by public Profile and Discover; it derives button state from `GET /connections/status/:userId` and mutates state only after successful API calls.
- Connection requests and accepted requests create the existing notification records.
- Fresh two-account lifecycle verification passed: send 201, duplicate 409, unauthorized accept 403, accept 200, accepted state persisted in Prisma, removal 204, rejection 200, resend 201, cancellation 204. Login-again verification returned `CONNECTED` for both users before removal returned `NONE`.
- Browser click-through remains unavailable in this environment; the frontend scripts pass syntax validation and route only through the authenticated connection API.

Steps 3-12 remain unverified from the frontend.

## Communities: API and frontend integration implemented

- The Communities list, search, details, member list, join, leave, and create-community flows now use the authenticated Prisma API exclusively. The older overlapping mock-card/filter/join handler was removed.
- `GET /api/v1/communities` returns a user-specific `joined` and `membershipRole`, member/post counts, owner, and a case-insensitive search across name, category, and description.
- Community detail and members endpoints require authentication and return only safe member profile fields.
- Membership now has clear not-found, duplicate-member, and owner-cannot-leave responses. A community creator is added as `OWNER` atomically when a community is created.
- Direct live API verification passed against PostgreSQL: initial list `200`, creation `201`, detail owner state `200`, search `200`, second-account join `201`, member list `200` with two members, second-account leave `204`, and owner leave correctly rejected with `409 OWNER_CANNOT_LEAVE`.
- Backend TypeScript build/lint and the existing automated suite pass (4 tests). Frontend module syntax check passes.
- The in-app browser was unavailable in this environment, so browser click-through/visual verification remains a manual follow-up rather than being claimed as complete.

## Events: API and frontend integration implemented

- Events now have one authenticated, PostgreSQL-backed path: list/search/category filtering, details, participant list, registration, cancellation, and real registration state.
- `GET /api/v1/events` supports `upcoming`, `q`, `category`, `location`, pagination, participant counts, and the current user's `registered`/`registrationStatus` state. Detail responses include a safe organizer profile and participant responses include only safe public user fields.
- Event registration validates not-found, ended event, registration deadline, duplicate registration, and capacity/waitlist behavior. Cancellation validates that a registration exists.
- `events.html` and `event-details.html` no longer ship mock event cards/details. They route to `event-details.html?id=<event-id>` and only change registration controls after a successful API mutation.
- Dashboard upcoming-event cards now derive from `GET /api/v1/dashboard`, use real participant counts, and navigate to the corresponding event detail page.
- Two-account API/Prisma lifecycle verification passed: event create `201`; list/search `200`; details `200`; Account A register `201`; duplicate registration `409 ALREADY_REGISTERED`; refresh-equivalent detail showed `REGISTERED` and count `1`; participant list `200`; Account B register `201`; Account A cancellation `204`; refresh-equivalent detail showed not registered and count updated to `1`.
- Backend build/lint and the existing four automated tests pass. Frontend module syntax checks pass. Browser click-through/visual verification remains unavailable in this environment and is not claimed as completed.

## Projects and team recruitment: API and frontend integration implemented

- Projects are now loaded from PostgreSQL in the Projects page, with real skills, roles/open positions, owners, member counts, recruiting state, difficulty, and current-user application/member state.
- `project-details.html?id=<project-id>` shows real project details, owner, members, roles, skills, links, application state, and owner-only application review actions.
- The existing Create Project action now creates a project with skills and required roles; the creator is added as `OWNER` in the creation transaction.
- Applications validate owner/member/duplicate/closed-project/invalid-role cases. Accepting an application atomically records `ACCEPTED`, creates the member, and reduces the matching open-role count. Rejection records `REJECTED` without membership.
- The dashboard project section now loads the same PostgreSQL records and routes to the real details page. Profile project content loads projects where the viewed user is owner or member.
- Live two-account verification passed: project create `201`; applicant apply `201`; owner accept `200`; fresh project detail showed applicant `isMember: true`, application `ACCEPTED`, and the selected role's openings reduced to `0`. A separate rejection lifecycle returned `200`, persisted `REJECTED`, and did not create a member. Unauthorized application acceptance returned `403`.
- Backend TypeScript build/lint and all four existing automated tests pass; frontend syntax checks pass. Browser click-through verification remains unavailable in this environment.

## Opportunities: API and frontend integration implemented

- Opportunities list and detail pages now use PostgreSQL records only. The old static cards, local filtering, and fake “Applied” behavior were removed.
- `GET /api/v1/opportunities` supports partial case-insensitive title, organization, description, location, and type searches plus type/location/active filters. Detail views use `opportunity-details.html?id=<opportunity-id>`.
- Backend responses derive `ACTIVE`, `CLOSING_SOON`, or `EXPIRED` directly from the database deadline. Expired records disable the external application action; active records open the stored HTTP(S) URL in a safe new tab.
- Opportunity create/update/delete authorization remains creator-only. Creation now validates enum type, date, and HTTP(S) application URL.
- Live verification passed: create `201`; Google text search `200` with two matching records; internship filter `200`; detail `200` with organization and `ACTIVE` state; expired record returned `EXPIRED`; invalid URL was rejected with `400 VALIDATION_ERROR`.
- The current Dashboard has no opportunity-card section and Discover only links to the Opportunities page, so no parallel mock opportunity source exists there to replace.
- Backend build/lint, four automated tests, and frontend module syntax check pass. Browser click-through verification remains unavailable in this environment.

## Notifications: API and frontend integration implemented

- Notifications now have a dedicated mock-free page and module. List, read-one, read-all, delete, unread count, navigation targets, and action controls all use the authenticated notification API and persist in PostgreSQL.
- Connection-request notifications resolve their actionable state on each API read from the current `Connection` record. Accepted/rejected requests return `actionable: false` and `resolved: true`, so stale Accept/Reject controls do not return after refresh.
- Project applications create a notification for the project owner in the same transaction as the application. Acceptance and rejection create an applicant notification with the project/application IDs for navigation.
- Dashboard notification badge now reads the actual dashboard unread count instead of retaining a fixed value.
- Live two-account verification passed: connection send `201`, accept `200`, and the original recipient notification then returned `actionable: false`, `resolved: true`; project application produced an owner notification, acceptance produced an applicant notification; mark-read changed unread count from `3` to `2`; cross-account read attempt returned `404` and did not modify the other user's record.
- Backend build/lint, four automated tests, and notification frontend syntax check pass. Browser click-through verification remains unavailable in this environment.
