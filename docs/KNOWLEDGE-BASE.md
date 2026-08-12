# OJT Monitoring System — Knowledge Base

The running record of what this project is, what's built, and how to work on it.
Updated at the end of every working session.

**Last updated:** 2026-08-12 · after *Evaluations*

**Workflow:** one module at a time → verify → **commit and push to `origin/main`** → update this file → stop for review.

---

## 1. What this is

An On-the-Job Training monitoring system for **West Prime Horizon Institute Inc.**
Three roles: **Student**, **Supervisor** (establishment HR), **Coordinator** (school admin).

The scope is defined by a static HTML prototype:

- Live: `https://wilfred1097.github.io/OJT/`
- Source: `https://github.com/Wilfred1097/OJT`

The prototype has 13 screens. Treat it as the spec for what each page contains.

| Role | Prototype pages |
|---|---|
| Login | `index.html` |
| Coordinator (`admin/`) | dashboard, establishments, students, attendance, evaluation, messages |
| Supervisor (`establishment/`) | dashboard, attendance approval, evaluation, messages |
| Student (`students/`) | dashboard (Dashboard / Attendance / Documents / Credentials / Profile), messages |

---

## 2. Stack and layout

Two independent npm projects. **No workspace root — always `cd` into one.**

- `app/server` — NestJS 11, Prisma 6, PostgreSQL (Supabase). Port 3000.
- `app/client` — Next.js 16 App Router, React 19, Tailwind v4, Redux Toolkit Query. **Port 3001.**

```bash
# server
cd app/server
npm run start:dev            # watch mode
npm run build
npm test                     # jest — SEE §7, currently red
npm run test:e2e             # passes
npm run seed                 # bootstraps the coordinator only; no-op if it exists
npx prisma migrate dev --name <desc>
npx prisma generate          # REQUIRED after clone or schema change

# client
cd app/client
npm run dev -- -p 3001       # MUST be 3001 — CORS allows only that origin
npm run build
npm run lint
```

### Fresh-clone gotchas

- `app/server/generated/prisma` is gitignored. Nothing compiles until `npx prisma generate`.
- `app/server/.env` is gitignored: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`. Loaded by `import 'dotenv/config'` in `main.ts` **and** `app.module.ts` — there is no `@nestjs/config`.
- `npm run start:prod` is **broken**: it runs `node dist/main` but `nest build` emits `dist/src/main.js` (because `prisma.config.ts` sits at the package root and widens the TS rootDir). Use `node dist/src/main`. `start:dev` is fine.

### Bootstrap account (`npm run seed`)

The seed creates **only the coordinator** — the one account the system cannot create
for itself:

| Role | Username | Email | Password |
|---|---|---|---|
| Coordinator | `coordinator` | `coordinator@wphi.edu` | `admin123` |

Overridable with `SEED_COORDINATOR_{EMAIL,USERNAME,NAME,PASSWORD}`. Re-running is a
no-op when the coordinator already exists; it never overwrites a password and never
deletes anything.

**Everything else is created through the app.** The coordinator signs in and creates
establishments, supervisors and students, issuing each account's username and password
by hand at that point. There is no self-registration.

> The prototype's login page advertises three demo logins (student / hr / coordinator).
> Those are a mock-up device, not a description of how accounts come to exist. An earlier
> version of this seed created all three; that was wrong and has been removed, along with
> the two accounts it had created.

---

## 3. Build status

### Done end to end

- **Auth** — `POST /auth/login`, JWT bearer, role-based routing.
- **Establishment (Coordinator)** — full CRUD, PSGC cascading address dropdowns. The original reference slice.
- **Student Management (Coordinator)** — full CRUD, computed hours, progress, stats. See §5.
- **Student self-service** — dashboard + attendance logging and history. See §5.
- **Supervisor** — dashboard + attendance approval with required decline reasons. See §5.
- **Evaluations** — 9-criterion weighted rubric; supervisor writes, coordinator reads across establishments. See §5.

**All three roles now land on a real page after login. No role 404s.**

### Partially built

| Module | Backend | Frontend |
|---|---|---|
| Coordinator dashboard | none | full UI on **mock constants** (`ATTENDANCE_TREND`, `TOP_ESTABLISHMENTS`, `RECENT_STUDENTS`, hardcoded `stats`) |
| Student self-service | done | dashboard + attendance done; **Documents, Credentials, Profile and Messages from the prototype are not built** (no backend for any) |
| Supervisor | done | dashboard, approval and evaluation done; **Messages not built** |

### Not started

Messaging (models + `socket.io` installed, zero code), Documents, Credentials,
Coordinator attendance oversight.

Also unbuilt and not yet in the numbered order: the student **Profile** section (needs
`gender` and `endDate` on `Student`), **Forgot Password**, and **supervisor contact
fields** (blocks part of messaging).

### Remaining build order

1. ~~Foundation pass~~ ✅
2. ~~Student Management (Coordinator)~~ ✅
3. ~~Student self-service~~ ✅
4. ~~Supervisor~~ ✅
5. ~~Evaluations~~ ✅
6. **Coordinator dashboard stats** ← next
7. Attendance oversight
8. Documents + Credentials
9. Messaging

---

## 4. Architecture

### Auth and roles

**Login is by username or email.** The coordinator issues both credentials by hand when creating a student or supervisor account — there is no self-registration and no server-generated password. `AuthService.login(identifier, password)` matches `identifier` against `User.email` OR `User.username` (`findFirst` with `OR`). `User.username` is nullable (accounts from before this existed have none, so they still sign in with email) and unique, and is barred from containing `"@"` — that's what stops a username from ever colliding with someone else's email. `POST /auth/login` body is `{ identifier, password }`, not `{ email, password }`.

`AuthService.login` verifies bcrypt and signs `{ sub, email, role }`.
`JwtStrategy.validate` maps it to `req.user` as `{ userId, email, role }` —
**handlers read `req.user.userId`, not `.id`.**

`JWT_SECRET` is **required**; `getJwtSecret()` in `src/auth/jwt.constants.ts` throws at
startup if unset. There is no fallback secret.

Authorization is the hand-rolled `RolesGuard` (`src/auth/roles.guard.ts`, which also
exports `Roles()`). Attached per controller with
`@UseGuards(AuthGuard('jwt'), RolesGuard)`. **There is no global guard — a controller
without that line is fully public.**

The guard uses `getAllAndOverride('roles', [getHandler(), getClass()])`, so `@Roles()`
works at class or handler level, handler wins. Absent metadata means "any authenticated
user". `EstablishmentController` is the deliberate mixed case: reads open to all,
writes `@Roles('COORDINATOR')` per handler.

> Do not revert this to `reflector.get(..., getHandler())` — that silently ignores
> class-level decorators and leaves whole controllers unrestricted.

### Ownership scoping lives in the services

The guard only checks the role string. Row-level ownership is re-derived per request:

1. `getStudentByUserId(userId)` / `getSupervisorByUserId(userId)` turn the JWT's userId into a profile row.
2. Every mutation verifies the target belongs to that profile's establishment, else `ForbiddenException`.

**Never trust an id from the request body to imply ownership.** Preserve this in new endpoints.

### Validation

`class-validator` + a global `ValidationPipe` in `main.ts` with
`whitelist`, `forbidNonWhitelisted`, `transform`. Unknown body properties are a **400**,
not silently dropped — so a DTO must declare every field its form sends.

Two shared transforms in `src/common/transforms.ts`:

- `EmptyToUndefined()` — `""` means "not supplied". `@IsOptional()` alone only skips null/undefined.
- `ToOptionalNumber()` — use **instead of** `@Type(() => Number)` on optional numbers. `@Type` maps `""` to `0`, which silently turns a blank field into a real zero.

`UpdateXDto extends PartialType(CreateXDto)` (`@nestjs/mapped-types`). Plain `extends`
does not work — class-validator inherits `@IsOptional()` and makes required fields optional.

### Client conventions

- `app/<role>/<page>/page.tsx` — thin, `"use client"`, declares its own `*_NAV`, renders `<Sidebar>` + feature components.
- `features/<domain>/hooks/use-<domain>.ts` — **all** state, RTK Query calls, filtering, pagination, handlers, returned as one object.
- `features/<domain>/components/*.tsx` — presentational, take those fields as props.
- `lib/api/<domain>Api.ts` — one `createApi` per domain, registered in `lib/store.ts` (reducer **and** middleware).
- Reuse `components/ui/`: `DataTable`, `StatCard`, `StatusBadge`, `ProgressBar`, `TrendChart`, `RankedBarList`, `ConfirmDialog`, `ViewDialog`, `TextField`, `TextArea`, `SelectField`, `SearchInput`, `Tabs`, `Card`, `Button`, `PageHeader`, `Avatar`, `DetailItem`. Feedback via `useSnackbar()`.
- Read `app/client/AGENTS.md` before writing Next code. Next 16 differs from older releases; docs ship in `app/client/node_modules/next/dist/docs/`. That block is regenerated by `next dev` — commit it, don't revert it.

### Routing and sessions

- All slices share `lib/api/baseQuery.ts` → `NEXT_PUBLIC_API_URL`, default `http://localhost:3000`. On a **401** it clears the session and hard-navigates to `/login` (`/auth/login` exempt).
- `proxy.ts` at the client root is the route guard. **Next 16 renamed `middleware.ts` → `proxy.ts`**, exporting `proxy`. It redirects unauthenticated visitors to `/login?next=…`, sends the wrong role to their own home, and points `/` at the right place.
- `lib/auth.ts` holds `persistSession` / `clearSession` / `getStoredUser`, `ROLE_HOME`, `ROLE_PREFIX`, and the `ojt_role` cookie.

> The cookie carries **only the role**, and its `Max-Age` must stay equal to the server's
> JWT `expiresIn` (currently 1 day, `SESSION_MAX_AGE_SECONDS`). If the cookie outlives
> the token the user gets trapped: bounced off `/login` to a page where every request 401s.
>
> The proxy is **navigation UX, not a security boundary** — the cookie is forgeable in
> devtools. Real enforcement is `RolesGuard` on the server.

- `useCurrentUser()` (`lib/hooks/use-current-user.ts`) reads the stored user via `useSyncExternalStore`. Do not reimplement with `useState` + `useEffect` — the React 19 lint rule rejects setState-in-effect.

---

## 5. Modules in detail

### Establishment (Coordinator)

`GET/POST /establishments`, `GET/PATCH/DELETE /establishments/:id`.
Reads open to any authenticated user; writes COORDINATOR-only.
Delete is blocked with **409** while students or supervisors reference it.

PH region/province/city/barangay come from `@aivangogh/ph-address`, keyed by PSGC code,
but **the DB stores names**. So `useEstablishment.handleEdit` does a reverse name→code
lookup and sets `isPopulatingRef` to stop the cascade effects clearing the children it
just restored; an effect on `editTarget` clears the flag. Touch that flag carefully.

### Student Management (Coordinator)

| Route | Notes |
|---|---|
| `GET /coordinator/students` | includes user, establishment, credential/document counts, and **`completedHours`** |
| `POST /coordinator/students` | User + Student created in a `$transaction` |
| `PATCH /coordinator/students/:id` | `User.name` recomposed from name parts |
| `DELETE /coordinator/students/:id` | **409** if attendance/evaluations/documents exist |

- **`completedHours`** is computed from **APPROVED attendance only**, via `src/common/attendance-hours.ts` (`hoursForAttendance`, `totalHours`). AM and PM spans are summed; a reversed in/out pair clamps to 0. Reuse this for the student and supervisor modules.
- **Credentials:** `POST` requires both `username` and `password` — the coordinator sets them and hands them to the student directly. (This replaced an earlier server-generated-password design; the client asked for manual issuance instead. See the 2026-08-12 session log entry.) `username` must be 4–30 chars, letters/numbers/`.`/`_`/`-`, and must not contain `@`.
- **`studentIdNumber` is unique table-wide** and immutable in the UI after creation — it identifies the student across attendance and evaluations. Duplicates return **409**.
- `contactNumber` is validated as exactly 11 digits (`09123456789`), matching the prototype.
- Deleting removes the `Credential` rows, the `Student` row, **and** the `User` row — otherwise a login would survive with no profile.

Files: `lib/api/studentApi.ts`, `features/student/hooks/use-students.ts`,
`features/student/components/{StudentList,StudentForm,StudentEditDialog,StudentViewDialog,NewCredentialsDialog}.tsx`,
`app/coordinator/students/page.tsx`.

> `features/student/` and `lib/api/studentApi.ts` are the **coordinator's** view of students.
> The student's own view lives in `features/student-portal/` and `lib/api/studentPortalApi.ts`.

### Student self-service

Pages: `app/student/dashboard`, `app/student/attendance`.
Slice: `lib/api/studentPortalApi.ts`. Feature: `features/student-portal/`.

| Route | Notes |
|---|---|
| `GET /student/dashboard` | profile, establishment, `stats`, `recentAttendance` (5) |
| `GET /student/attendance` | full history, each row carrying derived `hours` |
| `POST /student/attendance` | always lands as `PENDING` |

- **One log per student per day**, enforced by `@@unique([studentId, date])` **and** a pre-insert check that returns a readable **409**. `date` is normalised to **UTC midnight** by `startOfUtcDay()` in `StudentService` — the constraint compares the whole timestamp, so without normalising, two submissions on the same calendar day at different clock times would both be accepted.
- **Wire format for times** (this resolves the open question from earlier): the client sends the calendar day as `yyyy-mm-dd` and each clock field as a **full ISO instant**. `toIsoInstant()` in `use-attendance-log.ts` joins the date with the `HH:mm` from `<input type="time">`, parsed in the browser's local zone. Hours are a difference between two instants, so the total is timezone-safe.
- A submission must contain **at least one complete session** (both in and out for AM or PM) and produce positive hours, else **400**. Both rules are enforced on the server and mirrored in the form for immediate feedback.
- `hours` is computed server-side on every record so the client never recomputes it. Only **APPROVED** logs count toward `completedHours`; `pendingHours` is reported separately so the student can see what is awaiting a supervisor.
- `STUDENT_NAV` (`features/student-portal/nav.ts`) deliberately lists only Dashboard and Attendance. The prototype's My Documents, Credentials, Profile and Messages have no backend, and linking to them would recreate the dead-link problem this module fixed. **Add each entry as its module lands.**

### Supervisor

Pages: `app/supervisor/dashboard`, `app/supervisor/attendance`.
Slice: `lib/api/supervisorApi.ts`. Feature: `features/supervisor/`.

| Route | Notes |
|---|---|
| `GET /supervisor/dashboard` | establishment, student counts, pending approvals, approved-this-week, total approved hours |
| `GET /supervisor/students` | students at this establishment, each with `completedHours` |
| `GET /supervisor/attendance?status=` | optional `PENDING`/`APPROVED`/`DECLINED`; omit for all |
| `PATCH /supervisor/attendance/:id/approve` | clears any previous `declineReason` |
| `PATCH /supervisor/attendance/:id/decline` | body `{ reason }` — **required**, 3–500 chars |
| `PATCH /supervisor/students/:id/status` | body `{ status: "ACTIVE" \| "COMPLETED" }` — see below |

**Mark Complete / Reopen** (client request, 2026-08-12): the client asked for a way to "delete all" a batch's attendance data before the next OJT intake. That was declined as too destructive — hours are an academic record a student could need to dispute, and a hard delete has no undo. `Student.status` already had an unused `COMPLETED` value, so that's what this uses instead: `setStudentStatus` in `SupervisorService` flips a student to `COMPLETED`, and `getAttendance`/`getDashboard` exclude `COMPLETED` students from the active queue and pending/declined counts by default. **Nothing is deleted** — every attendance record is intact, still counted in `totalApprovedHours`, and the coordinator's own views are unaffected. `GET /supervisor/attendance?includeCompleted=true` opts back in. The action is fully reversible (`ACTIVE` again). UI: `StudentRoster` on the supervisor dashboard, with a `ConfirmDialog` explaining what does and doesn't happen.

- **`getPendingAttendance` was renamed to `getAttendance` and now actually filters.** It previously returned every status regardless of its name, so the approval screen mixed already-actioned rows in with the queue. The UI defaults to `PENDING`.
- **Declining requires a written reason**, enforced server-side, stored in the new `Attendance.declineReason` column and shown to the student on their own history. The prototype wrote the reason into `remarks` — that is the *student's* note, so doing the same would have destroyed what they wrote. The two are separate columns.
- Approving clears `declineReason`, so a record that was declined and later approved does not keep the stale explanation.
- Ownership is re-derived per request as everywhere else: `verifyAttendanceBelongsToSupervisor` throws `ForbiddenException` for another establishment's record. Verified live — a supervisor at a different establishment sees an empty queue and gets 403 on both approve and decline.
- `approvedById` is set on decline too. The column name is misleading (it means "who actioned this"), but renaming it is a migration not worth spending here.
- `SUPERVISOR_NAV` omits Messages for the same reason `STUDENT_NAV` does — no backend, so no dead links. Evaluation was added once that module landed.
- `ROLE_HOME.SUPERVISOR` is still `/supervisor/attendance` rather than the dashboard, since approving is the supervisor's actual job. Both pages exist, so either is fine.

### Evaluations

Pages: `app/supervisor/evaluation` (write + own list), `app/coordinator/evaluations` (read-only, all establishments).
Slice: `lib/api/evaluationApi.ts`. Feature: `features/evaluation/`.

| Route | Role | Notes |
|---|---|---|
| `POST /supervisor/evaluations` | SUPERVISOR | 9 criteria required, 1–5 each |
| `GET /supervisor/evaluations` | SUPERVISOR | scoped to own establishment |
| `GET /coordinator/evaluations` | COORDINATOR | every establishment, read-only |

**The rubric lives in `src/common/evaluation-scoring.ts`** — nine criteria in three weighted categories, taken from the prototype's `calculateOverallRating`:

| Category | Weight | Criteria |
|---|---|---|
| Work Performance | 40% | quality, quantity, efficiency |
| Professional Behavior | 30% | attendance, teamwork, communication |
| Technical Skills | 30% | knowledge, problemSolving, initiative |

`overall = (WP avg × 0.4) + (PB avg × 0.3) + (TS avg × 0.3)`, then banded into a performance level: ≥4.5 Excellent, ≥3.5 Very Good, ≥2.5 Good, ≥1.5 Fair, else Poor.

- **The client's "remove the 5 star rating" meant the star glyphs, not the scale.** Confirmed before building: the 1–5 scoring, the nine criteria, the weights and the bands all stay; criteria are rendered as dropdowns instead of clickable stars. `features/evaluation/rubric.ts` holds the client-side labels and repeats the weights *for display only*.
- **`overallRating` and `performanceLevel` are computed server-side and stored**, never accepted from the request — `forbidNonWhitelisted` rejects a body that tries to supply them (verified). They're stored rather than derived on read so an evaluation keeps the rating it was given if the rubric or its bands ever change.
- `categories` (per-category averages) is *not* stored — it's recomputed on read by `withBreakdown`, since it's a presentation detail. Create and both list endpoints all return it, so a new evaluation renders without a refetch.
- Ownership: `createEvaluation` re-derives the supervisor from the JWT and rejects a student outside their establishment with 403; `getEvaluations` filters by establishment. The coordinator's list is deliberately unscoped — their remit is the whole programme.
- `EVALUATION_INCLUDE`, `pickCriteria` and `withBreakdown` are exported from `supervisor.service.ts` and reused by `CoordinatorService.listEvaluations`, so both lists have an identical shape.
- Nothing prevents a student being evaluated more than once — repeat evaluations across periods are expected. `periodStart`/`periodEnd` are optional.

### Attendance forms — hours totals removed (client request, 2026-08-12)

Two client-requested removals, both cosmetic — the underlying hours are still computed, validated, and used everywhere else:

- **Student submit form** (`AttendanceForm`, `app/student/attendance`) no longer shows the live "Total hours" preview box. The four AM/PM time fields are unchanged and still the only required input.
- **Student attendance history** (`AttendanceTable`) no longer has a "Total Hours" column. The running totals still appear on the student dashboard's stat cards and progress bar — that's the only place a student sees their hours now.

---

## 6. Database

PostgreSQL via Supabase. `DATABASE_URL` is pooled, `DIRECT_URL` direct.

Models: `User`, `Establishment`, `Supervisor`, `Coordinator`, `Student`, `Attendance`,
`Document`, `Credential`, `Evaluation`, `Conversation`, `ConversationParticipant`, `Message`.

### Migration history

| Migration | Note |
|---|---|
| `20260806062356_init` | |
| `20260806063520_full_schema` | |
| `20260807064450_attendance_am_pm_split` | |
| `20260808013305_establishment_full_details` | |
| `20260808013306_establishment_region` | **Baseline.** `Establishment.region` had been added straight to the DB with no migration, so every `migrate dev` demanded a full reset. This file records the existing column and was applied with `prisma migrate resolve --applied`, not executed. |
| `20260811071701_student_personal_details` | `Student`: firstName, lastName, middleInitial, age, dateOfBirth, school, contactNumber, address, yearLevel — all nullable |
| `20260811085904_attendance_one_per_day` | `@@unique([studentId, date])` on `Attendance`. Written with `prisma migrate diff` and applied with `migrate deploy`, because `migrate dev` needs an interactive confirmation for the unique-constraint warning and cannot run non-interactively. Verified zero duplicates first. |
| `20260811091601_attendance_decline_reason` | `Attendance.declineReason` — the supervisor's explanation, kept separate from the student's `remarks` |
| `20260811120804_user_username` | `User.username` — nullable, unique. Login accepts username or email (`AuthService.login`); usernames may not contain `@`. |
| `20260811234804_evaluation_rubric` | Replaced `Evaluation.score`/`feedback` with the 9 criteria, `overallRating`, `performanceLevel`, `periodStart`/`periodEnd`, `comments`, `recommendations`. Destructive (drops two columns) but the table was empty — verified 0 rows first. |

> **If `migrate dev` ever offers to reset the database, stop.** It means drift again.
> Reconcile with a baseline migration + `migrate resolve --applied`. This is a live
> database with real data; `migrate reset` drops all of it.

**Policy: one migration per module** — add only the columns the current module needs.

### Known schema gaps

- **Student** — no `gender`, no `endDate`. Gender appears on the student's own Profile screen, which is not built.
- **Supervisor** — no contact fields; the prototype's messaging panels show email + phone.
- **Document / Credential** — store a `fileUrl` string with no storage wired. `@supabase/supabase-js` is installed but unused; Supabase Storage is the obvious fit.

---

## 7. Known issues / tech debt

1. **`npm test` is red — 10 of 12 suites fail.** Every `*.spec.ts` is untouched Nest scaffolding that instantiates a service without providing `PrismaService`, so DI fails. A real test needs a Prisma mock. (`npm run test:e2e` passes.)
2. **`npm run lint` on the client reports 30 problems**, all pre-existing in the establishment feature — `any` types and setState-in-effect. New code should not add to this.
3. **`npm run start:prod` is broken** — wrong entry path (see §2).
4. Filtering and pagination are client-side over a full `findMany()`. Fine at current scale; will not hold.
5. `coordinator/dashboard` still renders mock constants. There is no dashboard-stats endpoint.
6. No password reset / "Forgot Password" flow, despite the link on the login form. More pressing now that the coordinator sets each password by hand: a forgotten one has **no recovery path** short of editing the database.
7. The login page's role tabs are cosmetic — the server decides the role.
8. The prototype's student Documents, Credentials and Profile sections are not built, and there is no backend for them. `STUDENT_NAV` and `SUPERVISOR_NAV` omit unbuilt sections on purpose.
9. `Attendance.approvedById` is set when declining too — it means "who actioned this", not "who approved this".
10. The coordinator dashboard's "Avg. Performance" tile is still a hardcoded `3.8`. Real evaluation data now exists to compute it from — wire it up in the dashboard-stats module.
11. Evaluations cannot be edited or deleted once submitted, and there is no per-period uniqueness. Fine for now, but a mis-scored evaluation currently has no correction path.

---

## 8. Session log

### 2026-08-11 — Foundation pass

Cross-cutting work to make later modules safe.

- Added `class-validator` + `class-transformer` + `@nestjs/mapped-types`; global `ValidationPipe`; decorators on all 7 inline DTOs. Previously **every request body was unvalidated** — `POST /coordinator/students` with no password reached `bcrypt.hash(undefined)` and returned a 500.
- `EstablishmentService.remove` now throws `ConflictException` (409) instead of a bare `Error` (500).
- `JWT_SECRET` required; removed the `'dev-secret-change-this'` fallback that would have let anyone mint a coordinator token on a misconfigured deploy.
- Single API base URL via `NEXT_PUBLIC_API_URL` (was hardcoded in every slice) + `.env.example`.
- Route protection via `proxy.ts`; session helpers in `lib/auth.ts`; `useCurrentUser()`.
- Seed rewritten: idempotent, one account per role.
- Sidebar uses `next/link` (was full page reloads); `establishments/page.tsx` no longer hardcodes `userName="Admin Coordinator"`.

Then a `/code-review high` pass found 9 issues; high + medium fixed the same session:

- **The login trap** — the role cookie was a session cookie unconnected to token validity, so an expired JWT left the user bounced off `/login` forever. For STUDENT/SUPERVISOR that was a hard lock-out, since their home routes are still empty and render no sidebar (hence no logout). Fixed by matching cookie `Max-Age` to the JWT lifetime **and** clearing the session on any 401.
- **e2e regression I introduced** — `AppModule` reads `JWT_SECRET` at init but only `main.ts` loaded dotenv, so `npm run test:e2e` broke. Added `import 'dotenv/config'` to `app.module.ts`. Verified passing again.
- **Seed profile gap** — a nested `create` only runs when the User row is absent, so a half-finished run left an account that logs in but 404s everywhere, and re-seeding reported success without repairing it. Profiles are now upserted explicitly. Verified by deleting a profile and re-seeding.
- `Sidebar.handleLogout` returned early when given an `onLogout` prop, skipping `clearSession()` and leaving the cookie behind.

### 2026-08-11 — Student Management (Coordinator)

- Migration `student_personal_details` (9 nullable columns). Hit **drift**: `Establishment.region` existed in the DB with no migration, and Prisma wanted to reset the database. Resolved non-destructively with a baseline migration + `migrate resolve --applied`. All data intact.
- Server: `createStudent` (transaction, temp password, duplicate-ID 409), `listStudents` (+`completedHours`), `updateStudent` (recomposes `User.name`), `removeStudent` (409 when referenced). New `src/common/attendance-hours.ts` and `src/common/transforms.ts`.
- Client: `studentApi` slice, `use-students` hook, 5 components, `app/coordinator/students/page.tsx`. Search, status filter, pagination, 4 stat cards, view/edit/delete dialogs.
- Also fixed review finding 6 here, since this module's form is what would have triggered it: blank numeric inputs became `0` rather than "absent".
- Verified with 9 live API checks against a real server, then removed the test data.

### 2026-08-11 — Student self-service

Fixes the STUDENT login 404 — `/student/dashboard` had never existed.

- Migration `attendance_one_per_day` adds `@@unique([studentId, date])`. `migrate dev` refused to run non-interactively because of the unique-constraint warning, so the SQL was generated with `migrate diff` and applied with `migrate deploy`. Checked for duplicates first: none.
- `StudentService` rewritten: `getDashboard` now returns real aggregates (approved / pending / remaining hours, log counts, recent attendance); `submitAttendance` normalises the date to UTC midnight, requires a complete AM or PM session, rejects reversed times, and returns 409 on a duplicate day; history carries per-record `hours`.
- Client: `studentPortalApi` slice, `use-attendance-log` hook, `AttendanceForm` and `AttendanceTable`, plus `app/student/dashboard` and `app/student/attendance`.
- Settled the attendance wire format (previously an open question): `yyyy-mm-dd` for the day, full ISO instants for the clock fields, joined client-side from `<input type="time">`.
- Verified the whole loop live: student submits 8h → dashboard shows 8h pending → supervisor approves → dashboard shows 8h completed / 492 remaining → the coordinator's student list agrees. Cross-role guards return 403, unauthenticated 401. Test row removed afterwards.

**Still open:** the SUPERVISOR login still 404s (`/supervisor/attendance` has a backend but no page) — that is the next module.

### 2026-08-11 — Supervisor

Fixes the last role 404. All three roles now land on a real page.

- Migration `attendance_decline_reason` adds `Attendance.declineReason`.
- `getPendingAttendance` → `getAttendance`, now honouring a `status` filter. It had always returned every status despite the name, which would have shown already-actioned rows in the approval queue with no way to tell them apart.
- Declining now **requires** a reason (3–500 chars, enforced server-side). It is stored separately from the student's `remarks` and surfaced on the student's own attendance history, so a declined log is actionable. Approving clears it.
- New `GET /supervisor/dashboard` and `GET /supervisor/students`, both scoped to the supervisor's establishment.
- Client: `supervisorApi` slice, `use-attendance-approval` hook, `ApprovalTable` and `DeclineDialog`, plus the dashboard and attendance pages. Also extended the student's `AttendanceTable` to display the decline reason — the supervisor writing one is useless if the student cannot read it.
- Verified live with 14 checks: dashboard aggregates, student list, status filtering (`PENDING`/`APPROVED`/`DECLINED`/none), 400 on an invalid status, 400 on a missing or too-short decline reason, decline preserving the student's own remarks, the student reading the reason back, re-approval clearing it, and cross-role 403/401. Crucially, a supervisor created at a *different* establishment saw an empty queue and got 403 on both approve and decline. Test data removed afterwards.

### 2026-08-12 — Client feedback batch

Five items from the client, spanning four already-built areas rather than one new module. Not part of the numbered build order.

1. **Coordinator issues both username and password.** Reversed the module-2 design where the server generated a temporary password. `User.username` added (migration `user_username`), unique, nullable, barred from containing `@` so it can never collide with an email in `AuthService.login`'s lookup. `POST /auth/login` body changed from `{ email, password }` to `{ identifier, password }`. `CreateStudentDto`/`CreateSupervisorDto` now require both fields; `NewCredentialsDialog` and the generated-password code path were deleted entirely. Login page's Email field became a Username field (label and copy only — it still accepts either).
2. **Student submit form:** removed the live total-hours preview box. Time fields unchanged.
3. **Student attendance history:** removed the Total Hours column. Aggregate totals still live on the dashboard.
4. **Supervisor "clear the board" control.** Requested as "delete all/hide" — declined as a literal delete (see the schema-gaps note below) in favor of `Student.status = COMPLETED`, which already existed unused. New `PATCH /supervisor/students/:id/status`; `getAttendance` and `getDashboard` exclude completed students from the active queue by default; nothing is deleted; fully reversible. `StudentRoster` component added to the supervisor dashboard.
5. **Evaluation score has no upper bound.** `@Max(5)` removed from `CreateEvaluationDto.score`. The replacement scale is still undecided — flagged for the Evaluations module.

Verified live: username and email both authenticate, wrong password still 401, `@` in a username 400s, duplicate usernames 409, a password-less create now 400s (no more silent generation), mark-complete/reopen round-trips and is correctly excluded from dashboard stats while remaining in the roster, cross-establishment guard still holds on the new status endpoint, and evaluation scores of 6 and 87 both succeed where `@Max(5)` would have rejected them. Test data removed afterward.

### 2026-08-12 — Evaluations

- Confirmed with the user before building that "remove the 5 star rating" meant the star *glyphs*, not the 1–5 scale — the prototype's whole rubric (9 criteria, 40/30/30 weights, performance bands) is built on that scale, so the two readings implied very different schemas.
- Migration `evaluation_rubric` replaces `score`/`feedback` with the nine criteria plus `overallRating`, `performanceLevel`, period dates, comments and recommendations. Destructive, but the table was verified empty first.
- New `src/common/evaluation-scoring.ts` holds the rubric — criteria, weights, bands, and the overall/breakdown functions — shared by the supervisor (writes) and coordinator (reads) so both agree on how a score becomes a label.
- Client: `evaluationApi` slice, `use-evaluations` hook, `EvaluationForm`/`EvaluationList`/`EvaluationViewDialog`, and both pages. The form previews the weighted rating live; the stored value is always the server's.
- Also centralised `COORDINATOR_NAV` into `features/coordinator/nav.ts` — it had been duplicated inline across three pages and this module added a fourth entry. Removed the icon imports that orphaned.

Verified live with 10 checks: all-5s → 5.0 Excellent, all-1s → 1.0 Poor, and the weighting demonstrably applies (5s on the 40% category → 2.6, the same 5s on a 30% category → 2.2). Out-of-range and missing criteria 400. A body supplying its own `overallRating`/`performanceLevel` is rejected by the whitelist. A supervisor at another establishment gets 403 on create and an empty list. Cross-role access 403, unauthenticated 401. Test supervisors and their evaluations removed afterwards.

One bug caught during verification: `createEvaluation` returned the raw row without `categories`, so the create response didn't match the shape the list endpoints and the client's `Evaluation` type promised. Fixed by running `withBreakdown` on it too.

A judgment call worth restating: the client's literal ask for item 4 was deletion. I pushed back before building — attendance is the record a graduation requirement is checked against, and a hard delete has no undo and would also erase the coordinator's history for that batch. `COMPLETED` gives them the same "clean board for the next OJT" outcome without that risk. If they actually want data gone (e.g. for storage or privacy reasons), that's a distinct, separate decision — flag it back to me rather than building it silently.
