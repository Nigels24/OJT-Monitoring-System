# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two independent npm projects, no workspace root — always `cd` into one of them before running anything:

- `app/server` — NestJS 11 API (port 3000), Prisma 6 + PostgreSQL (Supabase; `DATABASE_URL` pooled + `DIRECT_URL` direct).
- `app/client` — Next.js 16 App Router + React 19, Tailwind v4, Redux Toolkit Query.

## Commands

```bash
# server (app/server)
npm run start:dev                    # watch mode, http://localhost:3000
npm run build && npm run start:prod
npm run lint                         # eslint --fix
npm test                             # jest, *.spec.ts under src/
npm test -- establishment.service    # single suite by path substring
npm test -- -t "should be defined"   # single test by name
npm run test:e2e                     # jest with test/jest-e2e.json
npm run seed                         # tsx prisma/seed.ts — creates coordinator@wphi.edu / admin123

npx prisma migrate dev --name <desc> # create + apply a migration
npx prisma generate                  # REQUIRED after clone/schema change — see below

# client (app/client)
npm run dev -- -p 3001               # MUST be 3001; see CORS note
npm run build
npm run lint
```

The client has **no test setup**. The server's `*.spec.ts` files are all unmodified Nest scaffolding (`should be defined`) with no Prisma mocking — instantiating a service in a `TestingModule` without providing `PrismaService` will fail, so a real test needs a provider mock.

`app/client/README.md` is untouched `create-next-app` boilerplate (it says port 3000) — ignore it.

### Two things that bite on a fresh clone

- `app/server/generated/prisma` is **gitignored** (custom `prisma-client` generator output, not `node_modules/@prisma/client`). Nothing compiles until `npx prisma generate` runs.
- `app/server/.env` is gitignored and holds `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`. `main.ts`, `prisma.config.ts`, and `prisma/seed.ts` load it via `import 'dotenv/config'` — there is no `@nestjs/config`.

Prisma's own agent skills are vendored at `app/server/.agents/skills/` (symlinked into `.claude/skills/` and `.windsurf/skills/`) — consult them for CLI/client questions instead of guessing.

## Architecture

### Auth and role enforcement

JWT bearer tokens, no refresh flow, no sessions. `AuthService.login` verifies bcrypt and signs `{ sub, email, role }`; `JwtStrategy.validate` maps it onto `req.user` as `{ userId, email, role }` — **handlers read `req.user.userId`, not `req.user.id`**. `JwtStrategy` falls back to the literal secret `'dev-secret-change-this'` when `JWT_SECRET` is unset.

Authorization is the hand-rolled `RolesGuard` in `src/auth/roles.guard.ts` (which also exports the `Roles()` decorator). Guards are attached per-controller with `@UseGuards(AuthGuard('jwt'), RolesGuard)`; there is no global guard, so a controller without that line is fully public (e.g. `AppController`).

The guard resolves metadata with `getAllAndOverride('roles', [getHandler(), getClass()])`, so `@Roles(...)` works at either level and a handler-level decorator overrides the class:

- `StudentController`, `SupervisorController`, `CoordinatorController` declare `@Roles(...)` once **at the class level**, covering every handler.
- `EstablishmentController` carries no class-level `@Roles` and is the deliberate mixed case: reads stay open to any authenticated user, while `@Roles('COORDINATOR')` on the `create`/`update`/`remove` **handlers** restricts writes.

Absent metadata still means "any authenticated user" — `canActivate` returns `true` when no `@Roles` is found at either level. A controller needs both `@UseGuards(...)` and a `@Roles(...)` somewhere to be restricted at all.

(This guard previously read `reflector.get(..., getHandler())`, which silently ignored the class-level decorators and left the student/supervisor/coordinator routes unrestricted. Fixed — but the same failure mode returns if anyone reverts to `reflector.get`.)

### Ownership scoping lives in the services

The guard only checks the role string. Row-level ownership is re-derived per request in the service layer, and this pattern must be preserved when adding endpoints:

1. `getSupervisorByUserId(userId)` / `getStudentByUserId(userId)` translate the JWT's `userId` into the domain profile row.
2. Every mutation then verifies the target belongs to that profile's establishment (`verifyAttendanceBelongsToSupervisor`, or the inline establishment check in `createEvaluation`) and throws `ForbiddenException`.

Never trust an id from the request body to imply ownership.

### Modules

`AuthModule`, `PrismaModule`, plus one module per actor: `coordinator` (creates supervisor/student accounts, lists them, `PATCH students/:id`), `student` (own dashboard, submit attendance, own history), `supervisor` (approve/decline attendance for their establishment, create evaluations), `establishment` (CRUD).

DTOs are plain classes declared inline at the top of each controller file. `class-validator`/`ValidationPipe` is **not** installed — request bodies are unvalidated, and numeric coercion is done by hand in services (e.g. `Number(data.coordinatorAge)` in `EstablishmentService`).

`PrismaService` exposes the client as a `.client` property rather than extending `PrismaClient`, so all queries read `this.prisma.client.<model>`.

Prisma schema notes: `Attendance` splits AM/PM into four nullable `DateTime`s (`timeInAM`/`timeOutAM`/`timeInPM`/`timeOutPM`) and has no uniqueness constraint on `(studentId, date)` — duplicate submissions for one day are accepted. `Document`, `Credential`, `Conversation`/`ConversationParticipant`/`Message` are modeled and migrated but have no module yet; `socket.io` and `@nestjs/websockets` are installed with no gateway written. Deleting an establishment is blocked in `EstablishmentService.remove` when students or supervisors reference it — it throws a bare `Error` (500), not an HTTP exception.

### Client

The client is a Next.js 16 App Router project; read `app/client/AGENTS.md` before writing Next code — Next 16 conventions differ from older releases and the docs ship in `app/client/node_modules/next/dist/docs/`. `app/client/CLAUDE.md` just imports that file. That `AGENTS.md` block is regenerated by `next dev`, so commit it with your work rather than reverting it.

Structure convention:

- `app/<role>/<page>/page.tsx` — thin, `"use client"`, composes a `Sidebar` (nav array declared locally per page, e.g. `COORDINATOR_NAV`) + feature components.
- `features/<domain>/hooks/use-<domain>.ts` — all state, RTK Query calls, filtering, pagination, and handlers for a domain, returned as one large object. `features/<domain>/components/` are presentational and receive that object's fields as props.
- `components/ui/` — generic primitives; `lib/api/*Api.ts` — one RTK Query `createApi` slice per domain, registered in `lib/store.ts`.
- `@/*` maps to the client root. (Feature imports in existing pages use relative `../../../features/...` — either works.)

**How much actually exists:** only three real pages — `login`, `coordinator/dashboard`, `coordinator/establishments` — and two API slices, `authApi` and `establishmentApi`. Every other route directory under `app/student/`, `app/supervisor/`, and `app/coordinator/` is **empty**, as is `types/`. Login redirects STUDENT → `/student/dashboard` and SUPERVISOR → `/supervisor/attendance`, both of which 404. `coordinator/dashboard` renders module-level mock constants (`ATTENDANCE_TREND`, `TOP_ESTABLISHMENTS`, `RECENT_STUDENTS`) and hardcoded `stats` set in a `useEffect` with a `TODO` — there is no dashboard-stats endpoint. `establishment` is the one end-to-end vertical slice; copy its shape when building a new domain.

Each API slice hardcodes `baseUrl: "http://localhost:3000"` and pulls the bearer token from `localStorage` in `prepareHeaders` (guarded with a `typeof window` check for SSR). There is no env var for the API base yet — changing it means editing every slice.

**CORS:** `main.ts` allows exactly `http://localhost:3001`, but `next dev` defaults to 3000, which the API already occupies. Run the client with `-p 3001` or every request fails.

There is no route protection: `login/page.tsx` writes `token`/`user` to `localStorage` and `router.push`es by role; nothing stops a direct URL visit to a role's pages. The role tabs on the login form are cosmetic — the server decides the role. Reading the display name from stored `user` is inconsistent: `dashboard/page.tsx` parses it out of `localStorage`, while `establishments/page.tsx` still passes a literal `userName="Admin Coordinator"`.

Philippine region/province/city/barangay dropdowns come from `@aivangogh/ph-address`, keyed by PSGC code. The DB stores **names**, not codes, so `useEstablishment.handleEdit` does a reverse name→code lookup (scanning every region for a matching province) and sets `isPopulatingRef` to stop the cascade effects from clearing the children it just restored; a `useEffect` on `editTarget` clears the flag afterwards. Touch that flag carefully.
