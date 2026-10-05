# SYSTEM-FLOW.md

How data and requests actually move through the OJT Monitoring System. Read `CLAUDE.md`
first for what exists and the rules; this file is the *mechanics* — read it when you need
to trace a bug across layers or add a new module that has to fit the same shape.

Section references like "§2" point within this file unless prefixed with `CLAUDE.md`.

## 1. Request lifecycle (every module follows this)

```
Client page (app/<role>/<page>/page.tsx)
  → features/<domain>/hooks/use-<domain>.ts   (state, derived values, handlers)
    → lib/api/<domain>Api.ts                  (RTK Query createApi slice)
      → lib/api/baseQuery.ts                  (adds bearer token, NEXT_PUBLIC_API_URL)
        ──HTTP──▶
Nest Controller (src/<module>/<module>.controller.ts)
  → AuthGuard('jwt') + RolesGuard              (role check only — see §2)
  → inline DTO validated by global ValidationPipe (whitelist/forbidNonWhitelisted/transform)
  → <module>.service.ts
    → ownership re-derived from req.user.userId (see §2) — NOT from the request body
    → this.prisma.client.<model>...            (PrismaService)
        ──SQL──▶ PostgreSQL (Supabase)
  ← service returns a plain object (shape mirrors the client's TS interface in <domain>Api.ts)
  ← controller returns it as-is (no separate response DTO/serializer layer)
        ◀──JSON──
  ← RTK Query caches it under the slice's tag; components re-render
```

There is no separate "response DTO" or serialization layer — what the service returns is
what the client receives, so a service change that adds/removes a field is a client
contract change. Keep `lib/api/<domain>Api.ts`'s TS interfaces in sync by hand.

## 2. Auth and ownership — two separate checks, two separate places

```
Login
  POST /auth/login { identifier, password }
    → AuthService.login: User.findFirst({ email: identifier OR username: identifier })
    → bcrypt.compare
    → jwt.sign({ sub, email, role })
  ← client stores token (localStorage) + persistSession() sets ojt_role cookie (role only)

Every subsequent request
  Bearer token → JwtStrategy.validate → req.user = { userId, email, role }
    → RolesGuard: does @Roles(...) on this handler/class allow req.user.role?
        NO  → 403, request dies here. This is the ONLY thing RolesGuard checks.
        YES → continue into the service
    → Service: re-derive the caller's OWN profile row from req.user.userId
        (getStudentByUserId / getSupervisorByUserId)
      → does the row being read/written belong to THIS profile's establishment?
        NO  → ForbiddenException (403), thrown by the service, not the guard
        YES → proceed with the query
```

The *why* behind both checks, and the forgeable-cookie caveat on `proxy.ts`, are in
CLAUDE.md §4. What matters here is the ordering above: the guard runs first and can only
reject on role; ownership is a second, separate rejection thrown from inside the service.

## 3. Login → landing page flow

```
/login  (role tabs are cosmetic — server decides the role from the JWT, not the tab)
  submit { identifier, password }
    ├─ 401 → show error, stay on /login
    └─ 200 → persistSession(token, user)   [lib/auth.ts]
              sets ojt_role cookie, Max-Age = SESSION_MAX_AGE_SECONDS (must equal JWT expiresIn, 1d)
             → redirect to ROLE_HOME[role]
                 COORDINATOR → /coordinator/dashboard
                 SUPERVISOR  → /supervisor/attendance   (approving is the job, not viewing)
                 STUDENT     → /student/dashboard

Every later navigation:
  proxy.ts intercepts →
    no cookie/token           → /login?next=<attempted path>
    cookie role ≠ path's role → redirect to that role's ROLE_HOME
    401 from any API call     → baseQuery clears session, hard-navigates to /login
                                 (except /auth/login itself, where 401 = bad credentials, not session death)
```

(Cookie `Max-Age` must equal the JWT's `expiresIn` or the user is locked out — reasoning
in CLAUDE.md §4, "Client conventions".)

## 4. Attendance → hours → dashboards (the data pipeline every hour figure depends on)

```
Student submits attendance
  POST /student/attendance { date, timeInAM?, timeOutAM?, timeInPM?, timeOutPM? }
    date normalised to UTC midnight (startOfUtcDay) — one row per calendar day,
    enforced by @@unique([studentId, date]) AND a pre-insert check (readable 409, not a raw constraint error)

    OJT-PERIOD GUARD, in this order, all 400 (src/common/dates.ts does the date math):
      status COMPLETED                → "Your OJT is complete."
      no establishmentId              → "You are not assigned to an establishment yet."
                                         (nothing logged here could ever be approved —
                                          the supervisor's queue is establishment-scoped)
      date < Student.startDate        → names the start date
      date > manilaToday()            → "Attendance cannot be logged for a future date."
      NOTE: endDate is deliberately NOT a bound. Completion is by hours, not the
      calendar, so a student short of requiredHours keeps logging past their
      scheduled end; only status COMPLETED closes logging.

    must contain ≥1 complete session (AM or PM), and each supplied session's
      time out must be strictly later than its time in (checked per session, not
      on the combined total), else 400
    hours computed server-side (hoursForAttendance) and stored on the row
    always lands PENDING

    A DECLINED row for the same date is UPDATED in place (status back to PENDING,
      declineReason/approvedById cleared); PENDING or APPROVED is a 409.
       ↓
Supervisor approves/declines
  PATCH /supervisor/attendance/:id/approve   → clears any declineReason
  PATCH /supervisor/attendance/:id/decline   → { reason } required 3–500 chars, stored in
                                                Attendance.declineReason (separate column from
                                                the student's own `remarks` — never overwrite one with the other)
    ownership check: verifyAttendanceBelongsToSupervisor → 403 if another establishment's row
       ↓
Everywhere "completed hours" is shown, it is APPROVED-only, via totalHours()
in src/common/attendance-hours.ts — the single shared function:
    - Student dashboard:        stats.completedHours / requiredHours, progress bar
    - Coordinator student list: completedHours per row
    - Coordinator dashboard:    totalHoursLogged aggregate
    - Attendance oversight:     presentDays (APPROVED rows within [startDate, today])
                                   ÷ totalDays (calendar days since startDate)
                                   = attendancePercentage
                                     (null if startDate is missing OR still in the
                                      future — never a fake 0%)
```

**"Today" is always Manila's calendar day, never the server's.** `manilaToday()` in
`src/common/dates.ts` is the only correct source; `startOfUtcDay(new Date())` is not.
The server may run in UTC, where the day rolls over at 08:00 Manila — the write path
used Manila while the coordinator's dashboard and oversight used UTC, so between 00:00
and 07:59 Manila they disagreed by a day and "Present Today" read 0 while students had
already logged. The client has the mirror-image rule: date-only columns render through
`formatDateOnly`/`formatWeekdayOnly` in `lib/format.ts` (both force `timeZone: "UTC"`,
since those columns are stored as UTC midnight), while `createdAt`/`updatedAt`/
`uploadedAt` are real instants and stay in the viewer's local time.

`Student.startDate` is the newest input to this pipeline — until it is set on a student,
their attendance-oversight percentage is `null` throughout, regardless of how much
approved attendance they have. See CLAUDE.md §7 ("Needs live verification").

## 5. Evaluation scoring flow

The sheet itself — four sections, nineteen items, the wording and the per-section
maximums — is in CLAUDE.md §4. What is worth tracing here is **where the form's text
lives** and **what is stored versus recomputed**, because both are deliberate.

```
The form's text has exactly ONE source: src/common/evaluation-scoring.ts (SECTIONS).
The two projects share no code, so rather than retyping nineteen wordings into the
client (where they would drift from the sheet the school issues), it is SERVED:

  GET /supervisor/evaluations/form   → sheetDefinition()
        sections[] { key, numeral, label, maxPoints, items[] { key, letter, label } }
        scale[] (5 OUTSTANDING … 1 NEEDS IMPROVEMENT), maxTotalRating (95)
        evaluator { name, position } + employedAt
          ↳ the header/footer blanks as they will be stamped for THIS supervisor,
            served here so the form needs one endpoint, not two (it used to read
            them off /supervisor/dashboard, which blanked the footer when that failed)

POST /supervisor/evaluations   (19 items, 1–5 each)
  → totalRating = raw sum, 19–95  ──STORED on the row──▶ survives a later rubric change
      never accepted from the body; forbidNonWhitelisted rejects an attempt to supply it
  → trainingEmployedAt / evaluatorName / evaluatorPosition  ──STORED SNAPSHOTS──▶
      captured once, at write time, so a later supervisor rename, a student transfer or
      a deleted establishment cannot rewrite a sheet that was already signed
  → there is deliberately NO percentage, letter grade or performance band. The old
      Excellent/Very Good/Good/Fair/Poor labels were retired with the old rubric.

PATCH /supervisor/evaluations/:id   (the whole sheet again, not a partial)
  → recomputes totalRating and rewrites the two editable header DATES only.
      The three snapshots above are NOT recomputed — re-deriving them from the
      student's current placement would blank the establishment on a sheet whose
      student has since been unassigned.

← on every READ: withSectionTotals() recomputes each section's total and attaches
    its items WITH their scores, so the coordinator's read-only view renders the whole
    filled-in sheet from one response. Plus canModify, decided server-side.
```

**Who may do what** — the guard is authorship, not current placement:

| | see | create | edit / delete |
|---|---|---|---|
| Supervisor, sheets they wrote | always | — | yes |
| Supervisor, students currently placed with them | yes | yes | no (403) |
| Coordinator | all establishments | no | no (`canModify: false`) |

`getEvaluations` returns the **union** of those first two rows. Filtering on the
student's current establishment alone made a supervisor's own sheet vanish the moment
the student was unassigned — which the establishment cascade does routinely, since it
nulls `Student.establishmentId` rather than deleting students (CLAUDE.md §6).

## 6. Module dependency map

The build order lives in CLAUDE.md §7; this is only the graph that explains it.

```
Auth ──┬─▶ Establishment ──┬─▶ Student Mgmt (Coordinator) ──┬─▶ Student self-service
       │                   │                                ├─▶ Supervisor ──▶ Evaluations
       │                   │                                └─▶ Attendance oversight
       │                   └─▶ Supervisor contact fields ─▶ Messaging
       └─▶ Password recovery (cuts across all three roles once accounts exist)
```

Documents hang off Student Mgmt alone — the rows they need already exist, which is why
they came next regardless of Messaging's state. Credentials used to be a sibling module;
they were folded into Documents as a typed checklist (one file per `DocumentType` per
student) and no longer exist. The server side is built on `src/common/storage.ts`; the
student and coordinator clients are built on it too (CLAUDE.md §7).

Replacing a document, which is the one write whose order matters:

```
POST /student/documents  (multipart: type + file)
  1. read the existing row's fileUrl for (studentId, type), if any
  2. upload the new object to documents/<studentId>/<uuid>.<ext>
  3. upsert the row → new fileUrl, originalFileName, uploadedAt = now
       └─ fails → delete the NEW object, rethrow; the old file is untouched
  4. delete the OLD object (logged, never fatal — worst case an orphan)
```

Coordinator reads never mint signed URLs: the checklist is one `student.findMany`, and a
view/download/ZIP goes through Nest (`downloadFile`), which buffers every file before the
first response header so a storage failure is a 503, not a truncated download. Messaging is now fully built too, backend and client — polling
(RTK Query), not a websocket gateway; see CLAUDE.md §7. Evaluations were rebuilt on the
school's official sheet, backend and client (§5). Every module in the graph is built; what
remains is the hand-verification pass listed in CLAUDE.md §7.

## 7. Where to look for a given bug

| Symptom | Start here |
|---|---|
| Wrong/missing data for one student but not others | Ownership check in the service (§2) — is it filtering by the right profile id? |
| Hours don't match across two pages | `src/common/attendance-hours.ts` usage — is one call site bypassing `totalHours()`? |
| A field silently became `0` instead of blank | Missing `ToOptionalNumber()`/`EmptyToUndefined()` on that DTO field (CLAUDE.md §4, "Validation and DTOs") |
| 400 on a request that looks right | An undeclared body property (`forbidNonWhitelisted`) — check the DTO lists every field the form sends |
| User stuck bounced to `/login` in a loop | Cookie `Max-Age` vs JWT `expiresIn` drift, or a stale token past its 1-day expiry (§3) |
| A role sees another role's/establishment's data | Missing or wrong ownership re-derivation in the service — never trust a body/param id directly |
| Percentage/aggregate shows `0%`/`0` instead of blank | Should probably be `null`/absent — see "no data vs zero", CLAUDE.md §4. **But** a real `0` is correct once that field has a backend; the absent-not-zero half applies only while the module is unbuilt |
| Emptying a field and saving silently restores the old value | The DTO used `EmptyToUndefined()` on a nullable column — Prisma reads `undefined` as "leave unchanged". Nullable update fields need `EmptyToNull()`/`ToNullableNumber()`, and the client must send `null`, not omit the key (CLAUDE.md §4) |
| A date renders one day off, or a weekday doesn't match its date | A date-only column read in local time. Client: use `formatDateOnly`/`formatWeekdayOnly` (`lib/format.ts`). Server: `manilaToday()`, never `startOfUtcDay(new Date())` (§4) |
| A whole page is blank after one query fails | The endpoint used `Promise.all`. The dashboards use `Promise.allSettled` + per-section defaults + `failedSections`; a list minting signed URLs must not let one bad row throw (§4, CLAUDE.md §8) |
| A supervisor's own evaluation vanished or won't save | Authorship, not placement, governs a sheet. Check `getEvaluations`' union and that `updateEvaluation` guards on `supervisorId` only (§5) |
| A document shows as submitted but View/Download fails, or a file is orphaned in Storage | The replace order in §6 — the row must be repointed before the old object is deleted. A 503 from `/coordinator/documents/:id/download` means the row's object is gone from the bucket |
