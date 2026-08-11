# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `docs/KNOWLEDGE-BASE.md` for the running project record: what is built, what is next, the session log, and the prototype that defines scope.

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

JWT bearer tokens, no refresh flow, no sessions. `AuthService.login` verifies bcrypt and signs `{ sub, email, role }`; `JwtStrategy.validate` maps it onto `req.user` as `{ userId, email, role }` — **handlers read `req.user.userId`, not `req.user.id`**. `JWT_SECRET` is required — `getJwtSecret()` in `src/auth/jwt.constants.ts` throws at startup when it is unset, and both `AuthModule` and `JwtStrategy` go through it. Because that runs at module-init, `app.module.ts` imports `dotenv/config` as well as `main.ts` (the e2e tests boot `AppModule` directly and never run `main.ts`).

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

DTOs are plain classes declared inline at the top of each controller file, decorated with `class-validator`. `main.ts` registers a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`, so an undeclared body property is a **400**, not a silent drop — a DTO must declare every field its form sends.

Two shared helpers in `src/common/transforms.ts` are mandatory for optional fields: `EmptyToUndefined()` (an HTML form posts `""` for a cleared input, and `@IsOptional()` only skips `null`/`undefined`) and `ToOptionalNumber()`, which replaces `@Type(() => Number)` on optional numbers — `@Type` coerces `""` to `0`, silently turning a blank "Required Hours" into a real zero.

Use `UpdateXDto extends PartialType(CreateXDto)` (`@nestjs/mapped-types`) for update DTOs. Plain `extends` does **not** work: class-validator inherits the parent's `@IsOptional()` and would make required create fields optional.

`src/common/attendance-hours.ts` (`hoursForAttendance`, `totalHours`) is the single place that turns the four AM/PM clock columns into hours. Reuse it — completed hours must count **APPROVED** attendance only.

`PrismaService` exposes the client as a `.client` property rather than extending `PrismaClient`, so all queries read `this.prisma.client.<model>`.

Prisma schema notes: `Attendance` splits AM/PM into four nullable `DateTime`s (`timeInAM`/`timeOutAM`/`timeInPM`/`timeOutPM`) and has no uniqueness constraint on `(studentId, date)` — duplicate submissions for one day are accepted. `Document`, `Credential`, `Conversation`/`ConversationParticipant`/`Message` are modeled and migrated but have no module yet; `socket.io` and `@nestjs/websockets` are installed with no gateway written. Deleting an establishment is blocked in `EstablishmentService.remove` when students or supervisors reference it, and deleting a student is blocked in `CoordinatorService.removeStudent` when attendance/evaluations/documents reference them — both throw `ConflictException` (409).

**Migrations:** one migration per module, adding only what that module needs. `20260808013306_establishment_region` is a **baseline** — `Establishment.region` had been added straight to the database with no migration, so `migrate dev` kept demanding a full reset; that file records the existing column and was applied with `prisma migrate resolve --applied`, not executed. If `migrate dev` ever offers to reset, it means drift again — reconcile the same way. This is a live database with real data.

### Client

The client is a Next.js 16 App Router project; read `app/client/AGENTS.md` before writing Next code — Next 16 conventions differ from older releases and the docs ship in `app/client/node_modules/next/dist/docs/`. `app/client/CLAUDE.md` just imports that file. That `AGENTS.md` block is regenerated by `next dev`, so commit it with your work rather than reverting it.

Structure convention:

- `app/<role>/<page>/page.tsx` — thin, `"use client"`, composes a `Sidebar` (nav array declared locally per page, e.g. `COORDINATOR_NAV`) + feature components.
- `features/<domain>/hooks/use-<domain>.ts` — all state, RTK Query calls, filtering, pagination, and handlers for a domain, returned as one large object. `features/<domain>/components/` are presentational and receive that object's fields as props.
- `components/ui/` — generic primitives; `lib/api/*Api.ts` — one RTK Query `createApi` slice per domain, registered in `lib/store.ts`.
- `@/*` maps to the client root. (Feature imports in existing pages use relative `../../../features/...` — either works.)

**How much actually exists:** eight real pages — `login`, `coordinator/{dashboard,establishments,students}`, `student/{dashboard,attendance}`, `supervisor/{dashboard,attendance}` — and five API slices: `authApi`, `establishmentApi`, `studentApi` (coordinator's view), `studentPortalApi` (student's own view), `supervisorApi`. **All three roles now land on a real page after login.** Still empty: `app/coordinator/{attendance,messages,evaluations}`, `app/student/*` beyond the two above, `app/supervisor/{evaluation,messages}`, and `types/`. `coordinator/dashboard` renders module-level mock constants (`ATTENDANCE_TREND`, `TOP_ESTABLISHMENTS`, `RECENT_STUDENTS`) and hardcoded `stats` set in a `useEffect` with a `TODO` — there is no dashboard-stats endpoint. `establishment`, `student` and `supervisor` are the end-to-end vertical slices; copy their shape when building a new domain.

Each role's sidebar (`features/<role>/nav.ts`) deliberately lists **only pages that exist**. The prototype shows more entries; add each one as its module lands rather than linking to a 404 — a 404 renders no sidebar, so it strands the user with no logout button.

Note `features/student/` and `lib/api/studentApi.ts` are the **coordinator's** view of students (`/coordinator/students`). The student-facing `/student/*` routes are a separate concern and should get their own slice.

Every API slice shares `lib/api/baseQuery.ts`, which reads `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`) and attaches the bearer token from `localStorage` (guarded with a `typeof window` check for SSR). On a **401** it clears the session and hard-navigates to `/login`; `/auth/login` is exempt, since a 401 there is just bad credentials.

**CORS:** `main.ts` allows exactly `http://localhost:3001`, but `next dev` defaults to 3000, which the API already occupies. Run the client with `-p 3001` or every request fails.

Route protection lives in `proxy.ts` at the client root — **Next 16 renamed the `middleware.ts` convention to `proxy.ts`**, exporting a `proxy` function. It sends unauthenticated visitors to `/login?next=…`, redirects the wrong role to their own home, and points `/` somewhere useful. Session helpers are in `lib/auth.ts` (`persistSession`, `clearSession`, `getStoredUser`, `ROLE_HOME`, `ROLE_PREFIX`).

The `ojt_role` cookie carries **only the role**, and its `Max-Age` (`SESSION_MAX_AGE_SECONDS`) must stay equal to the server's JWT `expiresIn` (currently `1d`). If the cookie outlives the token the user is trapped — bounced off `/login` onto a page where every request 401s, and for STUDENT/SUPERVISOR that page is a 404 with no sidebar and therefore no logout button. The proxy is **navigation UX, not the security boundary**: the cookie is forgeable in devtools, and `RolesGuard` on the server is what actually enforces access.

The role tabs on the login form are cosmetic — the server decides the role. Read the display name with `useCurrentUser()` (`lib/hooks/use-current-user.ts`), which uses `useSyncExternalStore`; do not reimplement it with `useState` + `useEffect`, as the React 19 lint rule rejects setState-in-effect.

Philippine region/province/city/barangay dropdowns come from `@aivangogh/ph-address`, keyed by PSGC code. The DB stores **names**, not codes, so `useEstablishment.handleEdit` does a reverse name→code lookup (scanning every region for a matching province) and sets `isPopulatingRef` to stop the cascade effects from clearing the children it just restored; a `useEffect` on `editTarget` clears the flag afterwards. Touch that flag carefully.
