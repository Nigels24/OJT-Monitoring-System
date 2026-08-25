# CLAUDE.md

This is the **only** living project doc. There is no knowledge base, no `.agent-comms/`,
no multi-agent (Coordinator/Implementor/Reviewer) pipeline anymore — one terminal, one
task at a time. `SYSTEM-FLOW.md` (repo root) is the companion doc: read it for *how data
moves through the system*; this file is *what exists, what's next, and the rules*.

## 0. Workflow

- **Solo, single-session build.** No sub-agents playing coordinator/implementor/reviewer roles. Do the task directly.
- **One module/task at a time.** Confirm what already exists before building, follow existing conventions, don't jump ahead or refactor unrelated code.
- **Definition of done:** build it, verify it (run it, hit the real endpoints/UI, don't just read the diff), then tell the user explicitly what changed and what to click through to test.
- **Never run `git add`, `git commit`, or `git push`.** The user commits and pushes themselves after manually testing. Offer a commit message; don't execute it.
- **When a task finishes, update this file** (§8 Build status, and §9 if it's a new gotcha/decision worth keeping) instead of writing session notes elsewhere. Keep entries as facts, not narrative — this file is read at the start of every future task, so token cost compounds.
- Schema changes: **one migration per module**, only the columns that module needs.

## 1. What this is

An On-the-Job Training monitoring system for **West Prime Horizon Institute Inc.**
Three roles: **Student**, **Supervisor** (establishment HR), **Coordinator** (school admin).

Scope is defined by a static HTML prototype — treat it as the spec for what each page contains:

- Live: `https://wilfred1097.github.io/OJT/`
- Source: `https://github.com/Wilfred1097/OJT`

| Role | Prototype pages |
|---|---|
| Login | `index.html` |
| Coordinator (`admin/`) | dashboard, establishments, students, attendance, evaluation, messages |
| Supervisor (`establishment/`) | dashboard, attendance approval, evaluation, messages |
| Student (`students/`) | dashboard (Dashboard / Attendance / Documents / Credentials / Profile), messages |

## 2. Repo / folder architecture

No workspace root. Two independent npm projects — always `cd` into one before running anything.

```
OJT-Monitoring-System/
├── CLAUDE.md              # this file — the only project doc
├── SYSTEM-FLOW.md         # request/data flow, diagrams
└── app/
    ├── server/             # NestJS 11 API, port 3000
    │   ├── src/
    │   │   ├── auth/           # AuthModule, JwtStrategy, RolesGuard, jwt.constants.ts
    │   │   ├── common/         # attendance-hours.ts, evaluation-scoring.ts, transforms.ts
    │   │   ├── coordinator/    # coordinator.controller.ts, coordinator.service.ts
    │   │   ├── establishment/  # CRUD, open reads / COORDINATOR writes
    │   │   ├── student/        # student's own dashboard + attendance
    │   │   ├── supervisor/     # approve/decline attendance, evaluations
    │   │   └── prisma/         # PrismaService (client exposed as `.client`)
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   ├── seed.ts             # bootstraps ONLY the coordinator
    │   │   └── migrations/         # 10 migrations, see §7
    │   ├── scripts/reset-coordinator.ts
    │   └── generated/prisma/       # gitignored — `npx prisma generate` to create
    └── client/             # Next.js 16 App Router, React 19, Tailwind v4, RTK Query, port 3001
        ├── app/
        │   ├── login/
        │   ├── coordinator/{dashboard,establishments,students,evaluations,attendance,messages*}
        │   ├── student/{dashboard,attendance,credentials*,documents*,messages*,profile*}
        │   └── supervisor/{dashboard,attendance,evaluation,messages*}
        │         (* = route folder exists, no page.tsx yet — unbuilt)
        ├── features/<domain>/
        │   ├── nav.ts             # COORDINATOR_NAV / SUPERVISOR_NAV / STUDENT_NAV
        │   ├── hooks/use-<domain>.ts   # all state, RTK Query, filtering, handlers
        │   └── components/             # presentational, take hook's return as props
        │       (domains: establishment, student [coordinator's view], student-portal
        │        [student's own view], supervisor, evaluation, attendance-oversight,
        │        coordinator [nav only], account)
        ├── components/ui/         # DataTable, StatCard, StatusBadge, ProgressBar, TrendChart,
        │                          # RankedBarList, ConfirmDialog, ViewDialog, TextField, TextArea,
        │                          # SelectField, SearchInput, Tabs, Card, Button, PageHeader,
        │                          # Avatar, DetailItem, Snackbar
        ├── lib/
        │   ├── api/            # one createApi slice per domain (see list below), baseQuery.ts
        │   ├── auth.ts         # persistSession, clearSession, getStoredUser, ROLE_HOME, ROLE_PREFIX
        │   ├── hooks/use-current-user.ts
        │   └── store.ts
        ├── proxy.ts            # route guard (Next 16 renamed middleware.ts → proxy.ts)
        └── AGENTS.md           # Next 16 conventions, regenerated by `next dev` — commit, don't revert
```

API slices (`lib/api/*.ts`): `authApi`, `establishmentApi`, `studentApi` (coordinator's view
of students), `studentPortalApi` (student's own view), `supervisorApi`, `evaluationApi`,
`dashboardApi`, `attendanceOversightApi`.

`establishment`, `student` (coordinator side) and `supervisor` are the reference
end-to-end vertical slices — copy their shape when building a new domain.

## 3. Commands

```bash
# server (app/server)
npm run start:dev                    # watch mode, http://localhost:3000
npm run build && node dist/src/main  # start:prod is broken, see §5
npm run lint                         # eslint --fix — MUTATES the tree, see §9
npx eslint src                       # read-only lint check instead
npm test                             # jest — currently red, see §5
npm run test:e2e                     # passes
npm run seed                         # bootstraps the coordinator only; no-op if it exists
npm run reset-coordinator            # recover a locked-out coordinator; bare = generate, or -- 'newpassword'

npx prisma migrate dev --name <desc> # create + apply a migration
npx prisma generate                  # REQUIRED after clone/schema change

# client (app/client)
npm run dev -- -p 3001               # MUST be 3001 — CORS allows only that origin
npm run build
npm run lint
```

## 4. Fresh-clone gotchas

- `app/server/generated/prisma` is **gitignored** (custom `prisma-client` generator output). Nothing compiles until `npx prisma generate` runs.
- `app/server/.env` is gitignored: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`. Loaded via `import 'dotenv/config'` in `main.ts` **and** `app.module.ts` (the latter needed because e2e tests boot `AppModule` directly) — there is no `@nestjs/config`.
- Prisma's own agent skills are vendored at `app/server/.agents/skills/` (symlinked into `.claude/skills/`) — consult them for CLI/client questions instead of guessing.

### Bootstrap account (`npm run seed`)

Creates **only the coordinator** — the one account the system can't create for itself.

| Role | Username | Email | Password |
|---|---|---|---|
| Coordinator | `coordinator` | `coordinator@wphi.edu` | `admin123` |

Overridable with `SEED_COORDINATOR_{EMAIL,USERNAME,NAME,PASSWORD}`. Idempotent, never
overwrites a password, never deletes anything. **Everything else is created through the
app** — the coordinator signs in and creates establishments, supervisors and students by
hand, issuing username + password directly. There is no self-registration. **Never add
sample students/supervisors to the seed** — the prototype's three demo logins are a
mock-up device, not the real account model.

## 5. Architecture

### Auth and role enforcement

JWT bearer, no refresh flow, no sessions. Login is by **username or email** —
`POST /auth/login` takes `{ identifier, password }`; `AuthService.login` matches
`identifier` against `User.email` OR `User.username` (`findFirst` with `OR`).
`User.username` is nullable (pre-existing accounts sign in with email), unique, and
barred from containing `"@"` — that's what stops a username colliding with an email in
that lookup.

`AuthService.login` verifies bcrypt and signs `{ sub, email, role }`. `JwtStrategy.validate`
maps it to `req.user` as `{ userId, email, role }` — **handlers read `req.user.userId`,
not `.id`.** `JWT_SECRET` is required; `getJwtSecret()` in `src/auth/jwt.constants.ts`
throws at startup if unset, no fallback.

Authorization is the hand-rolled `RolesGuard` (`src/auth/roles.guard.ts`, also exports
`Roles()`). Attached per-controller with `@UseGuards(AuthGuard('jwt'), RolesGuard)` —
**no global guard, a controller without that line is fully public** (e.g. `AppController`).

The guard uses `getAllAndOverride('roles', [getHandler(), getClass()])` — `@Roles()`
works at class or handler level, handler wins. Absent metadata means "any authenticated
user". `StudentController`/`SupervisorController`/`CoordinatorController` declare
`@Roles(...)` once at class level. `EstablishmentController` is the deliberate mixed
case: reads open to all, `@Roles('COORDINATOR')` per write handler.

> Do not revert the guard to `reflector.get(..., getHandler())` — that silently ignores
> class-level decorators and leaves whole controllers unrestricted. (Happened once already.)

### Ownership scoping lives in the services

The guard only checks the role string. Row-level ownership is re-derived per request —
preserve this pattern in new endpoints:

1. `getSupervisorByUserId(userId)` / `getStudentByUserId(userId)` translate the JWT's `userId` into the domain profile row.
2. Every mutation verifies the target belongs to that profile's establishment (`verifyAttendanceBelongsToSupervisor`, or the inline check in `createEvaluation`), else `ForbiddenException`.

**Never trust an id from the request body to imply ownership.**

### Password recovery — no email step

No mail library, no SMTP config, `@supabase/supabase-js` installed but unused — so
nothing sends a reset link. Recovery mirrors how accounts are issued: by hand, by the
coordinator.

| Route / command | Who | Notes |
|---|---|---|
| `PATCH /auth/password` | any signed-in user | `{ currentPassword, newPassword }` — current password required even with a valid JWT, since the token proves the session, not the person at the keyboard |
| `PATCH /coordinator/students/:id/password` | COORDINATOR | `{ password }`, no old password needed |
| `PATCH /coordinator/supervisors/:id/password` | COORDINATOR | same — has the endpoint, **no UI button yet** |
| `npm run reset-coordinator` | CLI, needs `.env` access | **the only way to reset a coordinator** — there is deliberately no web route for it, don't add one |

Changing a password does **not** invalidate already-issued JWTs (no refresh flow/blocklist)
— an old token stays valid up to its 1-day expiry.

### Validation and DTOs

DTOs are plain classes declared inline at the top of each controller file,
`class-validator`-decorated. `main.ts`'s global `ValidationPipe` has `whitelist`,
`forbidNonWhitelisted`, `transform` — an undeclared body property is a **400**, not a
silent drop, so a DTO must declare every field its form sends.

Two shared transforms in `src/common/transforms.ts`, mandatory for optional fields:
- `EmptyToUndefined()` — an HTML form posts `""` for a cleared input; `@IsOptional()` alone only skips `null`/`undefined`.
- `ToOptionalNumber()` — use instead of `@Type(() => Number)` on optional numbers; `@Type` coerces `""` to `0`, silently turning a blank field into a real zero.

`UpdateXDto extends PartialType(CreateXDto)` (`@nestjs/mapped-types`) for updates. Plain
`extends` does **not** work — class-validator inherits the parent's `@IsOptional()` and
makes required create fields optional.

### Shared common modules

- `src/common/attendance-hours.ts` (`hoursForAttendance`, `totalHours`) — the single place that turns the four AM/PM clock columns into hours. Reuse it; completed hours must count **APPROVED** attendance only.
- `src/common/evaluation-scoring.ts` — the rubric: nine criteria, 1–5 each, three weighted categories (Work Performance 40%, Professional Behavior 30%, Technical Skills 30%). `overall = WPavg×0.4 + PBavg×0.3 + TSavg×0.3`, banded into a performance level (≥4.5 Excellent, ≥3.5 Very Good, ≥2.5 Good, ≥1.5 Fair, else Poor). `overallRating`/`performanceLevel` are computed here and **stored** on the row, never accepted from the request (`forbidNonWhitelisted` rejects a body that tries) — stored so a rating survives if the rubric's bands ever change. `categories` breakdown is recomputed on read (`withBreakdown`), exported from `supervisor.service.ts` and reused by the coordinator's read so both lists share one shape.
- `PrismaService` exposes the client as `.client`, not by extending `PrismaClient` — all queries read `this.prisma.client.<model>`.

### "No data" vs "zero" — a repeated convention

Several endpoints deliberately return `null`/absent rather than `0` when there's nothing
to report, because a real zero and "not measured yet" are different claims:
- `averageRating` on the coordinator dashboard is `null`, not `0`, until an evaluation exists.
- `attendancePercentage` per student is `null` (rendered `—`) when there's no `startDate` or it's in the future — never `0%`.
- Fields with literally no backend (unread messages, pending documents) are **absent from a response entirely**, not `0`. Apply this to any future aggregate.

### Client conventions

- `app/<role>/<page>/page.tsx` — thin, `"use client"`, composes `Sidebar` + feature components. Each role's nav is `features/<role>/nav.ts` — import it, don't redeclare inline.
- `features/<domain>/hooks/use-<domain>.ts` — all state, RTK Query calls, filtering, pagination, handlers, returned as one object. `features/<domain>/components/` are presentational, take those fields as props.
- `lib/api/<domain>Api.ts` — one `createApi` per domain, registered in `lib/store.ts` (reducer **and** middleware).
- Reuse `components/ui/` primitives (list in §2) before adding a new one. Feedback via `useSnackbar()`.
- Read `app/client/AGENTS.md` before writing Next code — Next 16 conventions differ from older releases, full docs ship in `app/client/node_modules/next/dist/docs/`. That file is regenerated by `next dev`; commit it, don't revert it.
- A role's sidebar lists **only pages that exist**. The prototype shows more entries — add each as its module lands; a route with no page renders no sidebar, stranding the user with no logout button.
- `features/student/` + `lib/api/studentApi.ts` = the **coordinator's** view of students (`/coordinator/students`). `features/student-portal/` + `lib/api/studentPortalApi.ts` = the **student's own** view. Don't conflate them.

### Routing and sessions

- Every API slice shares `lib/api/baseQuery.ts` → `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`), bearer token from `localStorage`. On **401** it clears the session and hard-navigates to `/login` (`/auth/login` itself is exempt).
- `proxy.ts` at the client root is the route guard (Next 16 renamed `middleware.ts` → `proxy.ts`, exports `proxy`). Redirects unauthenticated visitors to `/login?next=…`, wrong role to their own home, `/` to the right place.
- `lib/auth.ts`: `persistSession`/`clearSession`/`getStoredUser`, `ROLE_HOME`, `ROLE_PREFIX`, the `ojt_role` cookie.
- The `ojt_role` cookie carries **only the role**; its `Max-Age` (`SESSION_MAX_AGE_SECONDS`) must equal the server JWT's `expiresIn` (currently `1d`). If the cookie outlives the token, the user is trapped: bounced to `/login`, every request 401s, and for STUDENT/SUPERVISOR that lands on a route with no sidebar → no logout button. **The proxy is navigation UX, not the security boundary** — the cookie is forgeable in devtools; `RolesGuard` on the server is what actually enforces access.
- `useCurrentUser()` (`lib/hooks/use-current-user.ts`) uses `useSyncExternalStore`. Do not reimplement with `useState`+`useEffect` — the React 19 lint rule rejects setState-in-effect.
- The login form's role tabs are cosmetic — the server decides the role.

### Philippine address dropdowns

Region/province/city/barangay come from `@aivangogh/ph-address`, keyed by PSGC code, but
**the DB stores names, not codes**. `useEstablishment.handleEdit` does a reverse
name→code lookup (scans every region for a matching province) and sets `isPopulatingRef`
to stop cascade effects from clearing the children it just restored; an effect on
`editTarget` clears the flag afterward. Touch that flag carefully.

## 6. Database

PostgreSQL via Supabase. `DATABASE_URL` pooled, `DIRECT_URL` direct.

Models: `User`, `Establishment`, `Supervisor`, `Coordinator`, `Student`, `Attendance`,
`Document`, `Credential`, `Evaluation`, `Conversation`, `ConversationParticipant`, `Message`.

`Attendance` splits AM/PM into four nullable `DateTime`s (`timeInAM`/`timeOutAM`/
`timeInPM`/`timeOutPM`) and carries `@@unique([studentId, date])` — `submitAttendance`
normalises `date` to UTC midnight on write, so one student gets at most one row per
calendar day; a repeat submission is a `ConflictException` (409). `Document`, `Credential`,
`Conversation`/`ConversationParticipant`/`Message` are modeled and migrated but have no
module yet; `socket.io`/`@nestjs/websockets` are installed with no gateway written.

Delete guards (both `ConflictException` 409): `EstablishmentService.remove` when
students/supervisors reference it; `CoordinatorService.removeStudent` when attendance/
evaluations/documents reference the student.

### Migration history

| Migration | Note |
|---|---|
| `20260806062356_init` | |
| `20260806063520_full_schema` | |
| `20260807064450_attendance_am_pm_split` | |
| `20260808013305_establishment_full_details` | |
| `20260808013306_establishment_region` | **Baseline, not executed.** `Establishment.region` had been added straight to the DB with no migration; recorded via `prisma migrate resolve --applied`. |
| `20260811071701_student_personal_details` | `Student`: firstName, lastName, middleInitial, age, dateOfBirth, school, contactNumber, address, yearLevel — all nullable |
| `20260811085904_attendance_one_per_day` | `@@unique([studentId, date])`. Applied via `migrate diff` + `migrate deploy` (non-interactive; `migrate dev` needs confirmation for unique-constraint warnings) |
| `20260811091601_attendance_decline_reason` | `Attendance.declineReason` |
| `20260811120804_user_username` | `User.username`, nullable, unique, no `@` |
| `20260811234804_evaluation_rubric` | Replaced `score`/`feedback` with 9 criteria, `overallRating`, `performanceLevel`, `periodStart`/`periodEnd`, `comments`, `recommendations` — destructive, table was empty |

> **If `migrate dev` ever offers to reset the database, stop — it means drift again.**
> Reconcile with a baseline migration + `migrate resolve --applied`, same as the region
> column above. This is a live Supabase DB with real data; `migrate reset` drops all of it.
>
> `migrate dev` also refuses to run non-interactively (e.g. a unique-constraint warning
> needing confirmation). When that happens: generate SQL with
> `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
> into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then `prisma migrate deploy`.

**Policy: one migration per module** — add only the columns the current module needs.

### Known schema gaps

- **Student** — no `gender`, no `endDate` (needed for the Profile screen, not built). `startDate` exists but see §8 — writability just landed, uncommitted.
- **Supervisor** — no contact fields; prototype's messaging panels show email + phone.
- **Document / Credential** — store a `fileUrl` string with no storage wired. `@supabase/supabase-js` is installed but unused; Supabase Storage is the obvious fit.

## 7. Build status

### Done end to end

- **Auth** — `POST /auth/login`, JWT bearer, role-based routing.
- **Establishment (Coordinator)** — full CRUD, PSGC cascading address dropdowns.
- **Student Management (Coordinator)** — full CRUD, computed hours, progress, stats.
- **Student self-service** — dashboard + attendance logging and history.
- **Supervisor** — dashboard + attendance approval with required decline reasons.
- **Evaluations** — 9-criterion weighted rubric; supervisor writes, coordinator reads across establishments.
- **Password recovery** — self-service change for everyone, coordinator-issued reset for students/supervisors, CLI for the coordinator.
- **Coordinator dashboard stats** — every tile/chart backed by real aggregates (`GET /coordinator/dashboard`).
- **Attendance oversight (Coordinator)** — read-only cross-establishment attendance %, `GET /coordinator/attendance`.

**All three roles land on a real page after login. No role 404s.**

### In progress (uncommitted in the working tree right now)

- **`Student.startDate` is now writable** from the coordinator's student form (`StudentForm.tsx`, `use-students.ts`, `studentApi.ts`, `coordinator.controller.ts`/`.service.ts`). This is what makes attendance-oversight percentages report real numbers instead of `null` for every student — previously nothing in the app wrote this column. **Not yet verified live or committed** — verify (create/edit a student with a start date, confirm the oversight page shows a real percentage) before considering it done.

### Partially built

| Module | Backend | Frontend |
|---|---|---|
| Student self-service | done | dashboard + attendance done; **Documents, Credentials, Profile, Messages** from the prototype not built (no backend for any) |
| Supervisor | done | dashboard, approval, evaluation done; **Messages** not built; supervisor password reset has an endpoint but no UI button |

### Not started

Messaging (models + `socket.io` installed, zero code), Documents, Credentials.
Student **Profile** section (needs `gender` + `endDate` on `Student`). Supervisor contact
fields (blocks part of messaging's UI).

### Remaining build order

1–8. ~~Foundation → Student Mgmt → Student self-service → Supervisor → Evaluations → Password recovery → Dashboard stats → Attendance oversight~~ ✅
9. **Finish + verify `Student.startDate`** (in progress above), then **Documents + Credentials** ← next
10. Messaging

## 8. Known issues / tech debt

1. **`npm test` is red — 10 of 12 suites fail.** Every `*.spec.ts` is untouched Nest scaffolding that instantiates a service without providing `PrismaService`, so DI fails. A real test needs a Prisma mock. `npm run test:e2e` passes.
2. **`npm run lint` on the client reports pre-existing problems** (`any` types, setState-in-effect) in the establishment feature. Don't add to this.
3. **`npm run start:prod` is broken** — wrong entry path, see §3/§4.
4. Filtering and pagination are client-side over a full `findMany()`. Fine at current scale, won't hold.
5. Password change doesn't invalidate already-issued JWTs — matters if a reset is because of a leak.
6. `Attendance.approvedById` is set when declining too — means "who actioned this", not "who approved this".
7. Evaluations can't be edited or deleted once submitted; no per-period uniqueness.
8. Supervisor password reset has no UI (endpoint exists) — no supervisor management page to hang it off yet.
9. Coordinator dashboard's attendance trend has no server-side date range — always last 6 weeks from today.
10. **`npm run lint` in `app/server` is `eslint --fix`** — mutates the tree on a plain check, reformatting unrelated files with style drift. Use `npx eslint src` for a read-only check.
11. `getAttendanceOversight` fetches every `APPROVED` attendance row programme-wide per request — scales with programme-years, not student count. Fine at current scale (prioritize first if pagination work starts, item 4).
12. The `(studentId, date)` uniqueness that attendance-oversight's percentage math leans on only strictly holds for rows written after migration `20260811085904_attendance_one_per_day`. No pre-migration rows exist today (verified); worth knowing if this DB is ever backfilled from an older source.
13. **Attendance-oversight percentage math has a subtlety already fixed once**: `presentDays` must be bounded by the student's own `startDate` on *both* ends, not just `date <= today` — an `APPROVED` row dated before `startDate` (backfilled data, early orientation log) can otherwise push the percentage past 100%. Fixed via a flat query + JS `Map<studentId, Date[]>` bucketing (`coordinator.service.ts`), since a Prisma filtered-relation count can't express a per-row correlated bound. If touching this code again, keep that bound.
