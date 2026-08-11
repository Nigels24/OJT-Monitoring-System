# OJT Monitoring System — Knowledge Base

The running record of what this project is, what's built, and how to work on it.
Updated at the end of every working session.

**Last updated:** 2026-08-11 · after *Student Management (Coordinator)*

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
npm run seed                 # idempotent demo accounts
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

### Demo accounts (`npm run seed`)

| Role | Email | Password |
|---|---|---|
| Coordinator | `coordinator@wphi.edu` | `admin123` |
| Supervisor | `hr@techsolutions.com` | `hr123456` |
| Student | `student@wphi.edu` | `student123` |

The seed is idempotent and non-destructive: it matches on email, resets those three
passwords to the documented values, and repairs a missing profile row. It never deletes.
(`hr123456` rather than the prototype's `hr123` — the API enforces `MinLength(8)`.)

---

## 3. Build status

### Done end to end

- **Auth** — `POST /auth/login`, JWT bearer, role-based routing.
- **Establishment (Coordinator)** — full CRUD, PSGC cascading address dropdowns. The original reference slice.
- **Student Management (Coordinator)** — full CRUD, computed hours, progress, stats. See §5.

### Partially built

| Module | Backend | Frontend |
|---|---|---|
| Coordinator dashboard | none | full UI on **mock constants** (`ATTENDANCE_TREND`, `TOP_ESTABLISHMENTS`, `RECENT_STUDENTS`, hardcoded `stats`) |
| Student self-service | `GET /student/dashboard`, `POST/GET /student/attendance` | **none** — `app/student/*` empty |
| Supervisor | `GET /supervisor/attendance`, approve/decline, `POST /supervisor/evaluations` | **none** — `app/supervisor/*` empty |

### Not started

Messaging (models + `socket.io` installed, zero code), Documents, Credentials,
Coordinator attendance oversight, Evaluation views.

### Remaining build order

1. ~~Foundation pass~~ ✅
2. ~~Student Management (Coordinator)~~ ✅
3. **Student self-service** ← next
4. Supervisor
5. Evaluations
6. Coordinator dashboard stats
7. Attendance oversight
8. Documents + Credentials
9. Messaging

---

## 4. Architecture

### Auth and roles

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
- **Passwords:** the prototype's form has no password field. `POST` therefore accepts an optional `password`; when omitted the server generates one and returns it as **`temporaryPassword` exactly once** (it is hashed immediately and unrecoverable). `NewCredentialsDialog` shows it with a copy button.
- **`studentIdNumber` is unique table-wide** and immutable in the UI after creation — it identifies the student across attendance and evaluations. Duplicates return **409**.
- `contactNumber` is validated as exactly 11 digits (`09123456789`), matching the prototype.
- Deleting removes the `Credential` rows, the `Student` row, **and** the `User` row — otherwise a login would survive with no profile.

Files: `lib/api/studentApi.ts`, `features/student/hooks/use-students.ts`,
`features/student/components/{StudentList,StudentForm,StudentEditDialog,StudentViewDialog,NewCredentialsDialog}.tsx`,
`app/coordinator/students/page.tsx`.

> `features/student/` and `lib/api/studentApi.ts` are the **coordinator's** view of students.
> The student-facing `/student/*` routes are a separate concern and should get their own slice.

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

> **If `migrate dev` ever offers to reset the database, stop.** It means drift again.
> Reconcile with a baseline migration + `migrate resolve --applied`. This is a live
> database with real data; `migrate reset` drops all of it.

**Policy: one migration per module** — add only the columns the current module needs.

### Known schema gaps

- **Evaluation** — one `score Float?` + `feedback`. The prototype wants evaluation period, overall rating, performance level and per-criterion ratings. Needs rework (module 5).
- **Attendance** — **no unique constraint on `(studentId, date)`**, so duplicate submissions for one day are accepted and every hours total double-counts. Fix when building attendance.
- **Student** — no `gender`, no `endDate`. Gender appears on the student's own Profile screen (module 3).
- **Supervisor** — no contact fields; the prototype's messaging panels show email + phone.
- **Document / Credential** — store a `fileUrl` string with no storage wired. `@supabase/supabase-js` is installed but unused; Supabase Storage is the obvious fit.

---

## 7. Known issues / tech debt

1. **`npm test` is red — 10 of 12 suites fail.** Every `*.spec.ts` is untouched Nest scaffolding that instantiates a service without providing `PrismaService`, so DI fails. A real test needs a Prisma mock. (`npm run test:e2e` passes.)
2. **`npm run lint` on the client reports 30 problems**, all pre-existing in the establishment feature — `any` types and setState-in-effect. New code should not add to this.
3. **`npm run start:prod` is broken** — wrong entry path (see §2).
4. Filtering and pagination are client-side over a full `findMany()`. Fine at current scale; will not hold.
5. `coordinator/dashboard` still renders mock constants. There is no dashboard-stats endpoint.
6. `@Max(5)` on evaluation `score` (`supervisor.controller.ts`) is an **unverified assumption** about the rating scale. Confirm before building evaluations.
7. `@IsDateString()` on the AM/PM attendance fields requires a full ISO timestamp, so a native `<input type="time">` value like `"08:00"` is rejected. Decide the wire format when building attendance UI.
8. No password reset / "Forgot Password" flow, despite the link on the login form.
9. The login page's role tabs are cosmetic — the server decides the role.

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
