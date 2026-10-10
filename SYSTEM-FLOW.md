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
    → AuthService.login: "@" in identifier ? User by email (exact)
                                          : User by username (case-insensitive)
    → bcrypt.compare
    → jwt.sign({ sub, email, role, mcp?: true })   mcp only when User.mustChangePassword
  ← client stores token (localStorage) + persistSession() sets ojt_role cookie (role only)
    and the stored user carries mustChangePassword

Every subsequent request
  Bearer token → JwtStrategy.validate → req.user = { userId, email, role, mustChangePassword }
    → RolesGuard, step 1: req.user.mustChangePassword?
        YES → 403 { code: PASSWORD_CHANGE_REQUIRED } — even on routes with no @Roles
    → RolesGuard, step 2: does @Roles(...) on this handler/class allow req.user.role?
        NO  → 403, request dies here. These two are the ONLY things RolesGuard checks.
        YES → continue into the service
    (PATCH /auth/password has AuthGuard('jwt') only — never reaches RolesGuard, so a
     must-change session can always reach it)
    → Service: re-derive the caller's OWN profile row from req.user.userId
        (getStudentByUserId / getSupervisorByUserId)
      → does the row being read/written belong to THIS profile's establishment?
        NO  → ForbiddenException (403), thrown by the service, not the guard
        YES → proceed with the query
```

The *why* behind both checks, and the forgeable-cookie caveat on `proxy.ts`, are in
CLAUDE.md §4. What matters here is the ordering above: the guard runs first and can only
reject on role (or the must-change flag); ownership is a second, separate rejection
thrown from inside the service.

### Generated credentials → forced change

```
Coordinator: POST /establishments {…, supervisor} | /establishments/:id/supervisor
             (no username/password in body; the establishment create writes Establishment +
              User + Supervisor in one $transaction)
         or  POST /coordinator/{students,supervisors}/:id/resend-credentials
Supervisor:  POST /supervisor/students   (establishmentId = the caller's Supervisor row,
              found from req.user.userId — never the body; User + Student in one $transaction)
         or  POST /supervisor/students/:id/resend-credentials   (own establishment, else 404)
  → generatePassword() → bcrypt.hash → user row (username via usernameBase +
    nextFreeUsername, retried on a P2002 race), mustChangePassword = true
  ← { …, credentials: { username, tempPassword } }  — the only time the plaintext exists
  → CredentialsDialog shows it once; closing drops it

User signs in with it → token has mcp → stored user mustChangePassword: true
  → Sidebar (every role page) opens ChangePasswordDialog in forced mode
  → every other request meanwhile: 403 PASSWORD_CHANGE_REQUIRED
      (baseQuery raises the stored flag if it wasn't already set; no logout)
  → PATCH /auth/password { currentPassword: <temporary>, newPassword }
      → flag cleared ← { changed, accessToken (no mcp), user }
  → persistSession(fresh token) → page reload → everything refetches normally
```

`proxy.ts` is not involved: it only sees the role cookie, so it routes a must-change
session like any other. The server is what refuses it.

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
Student punches (four separately approved clock events per day)
  GET  /student/attendance/today          → punches by kind + allowed{kind: true | reason}
  POST /student/attendance/punch { kind } → NO date, NO time in the body (a sent one is a 400)
    server stamps time = now, day = manilaToday()
    day row: upsert on @@unique([studentId, date]); a losing concurrent insert (P2002) re-reads

    BLOCKS, all 400, same for remarks (attendanceBlockedReason, student.service.ts):
      status COMPLETED                → "Your OJT is complete."
      no establishmentId              → "You are not assigned to an establishment yet."
                                         (nothing logged here could ever be approved —
                                          the supervisor's queue is establishment-scoped)
      manilaToday() < startDate       → names the start date
      NOTE: no calendar date is a bound (the old expected endDate is retired).
      Completion is by hours; only status COMPLETED closes logging.

    ORDER (punchAvailability, attendance-hours.ts — no clock windows):
      Out needs its In, not DECLINED · PM In blocked while AM is open ·
      a standing PM In closes the morning · PENDING/APPROVED kind again → 409
      (and @@unique([attendanceId, kind]) catches a double tap)
      DECLINED kind → re-punch overwrites it (new time, PENDING, decision cleared),
        unless it's an In whose Out already stands
    every punch lands PENDING
  PATCH /student/attendance/today/remarks { remarks } → the student's note, per day
       ↓
Supervisor decides each punch on its own (no bulk approve)
  GET   /supervisor/attendance?status=PENDING → days with ≥1 PENDING punch, punches nested
  PATCH /supervisor/punches/:id/approve
  PATCH /supervisor/punches/:id/decline  { reason } 3–500 chars → AttendancePunch.declineReason
                                         (never Attendance.remarks, which is the student's)
    ownership: verifyPunchBelongsToSupervisor, punch → day → student → establishment → 403
    FINAL: updateMany where status = PENDING; a decided punch → 409, never overwritten
    sets decidedById + decidedAt
       ↓
Client: the student's PunchCard renders /today's `allowed` and `blockedReason` verbatim
  (no rule copies), confirms every punch, polls /today every 30s; the supervisor's queue
  polls every 30s and shows ✓/✕ only on PENDING punches. Labels live in lib/attendance.ts.
       ↓
A session (AM or PM) counts only when its In AND Out are both APPROVED.
Every hour figure goes through src/common/attendance-hours.ts
(totalApprovedHours / summarizeDay / hasApprovedSession):
    - Student dashboard:        stats.completedHours / requiredHours; counts are punches
    - Supervisor dashboard:     totalApprovedHours; pending/declined/approvedThisWeek are punches
    - Supervisor roster + coordinator student list: completedHours per student
                                 (the roster also lastApprovedDay — the evaluation's end date)
    - Coordinator dashboard:    totalHoursLogged; pendingApprovals + weekly trend count punches
    - Attendance oversight:     presentDays (days with an approved session, within
                                 the window) ÷ totalDays (calendar days in the window)
                                 = attendancePercentage, plus approvedHours.
                                 window = [startDate, today], or with ?month=YYYY-MM
                                 [max(month start, startDate), min(month end, today)]
                                     (null % if no startDate or an empty window —
                                      never a fake 0%, never a division by zero)
    - DTR PDF (one student, one month): APPROVED punches only, an unpaired one
                                 still printed; TOTAL = totalApprovedHours (complete
                                 sessions only); rows placed by Attendance.date (the
                                 Manila day), times printed in Asia/Manila
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
approved sessions they have. See CLAUDE.md §7 ("Needs live verification").

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
  → ownership (student at the caller's establishment, else 403)
  → GATE: student.status must be COMPLETED, else 409 "…not completed OJT yet (x / y hrs)"
      (x = totalApprovedHours). Create only — never applied to PATCH/DELETE.
  → trainingStartedAt = Student.startDate, trainingEndedAt = lastApprovedDay(attendance)
      ──STORED SNAPSHOTS──▶ derived here, NOT in the DTO (a body date is a 400);
      null when there is nothing to derive from, never today. The picker shows the same
      two values in advance from the roster row (startDate, lastApprovedDay).
  → totalRating = raw sum, 19–95  ──STORED on the row──▶ survives a later rubric change
      never accepted from the body; forbidNonWhitelisted rejects an attempt to supply it
  → trainingEmployedAt / evaluatorName / evaluatorPosition  ──STORED SNAPSHOTS──▶
      captured once, at write time, so a later supervisor rename, a student transfer or
      a deleted establishment cannot rewrite a sheet that was already signed
  → there is deliberately NO percentage, letter grade or performance band. The old
      Excellent/Very Good/Good/Fair/Poor labels were retired with the old rubric.

PATCH /supervisor/evaluations/:id   (the whole sheet again, not a partial)
  → recomputes totalRating; comments/recommendations. NO header field is rewritten:
      the training dates and the three snapshots above stay as stored — re-deriving
      them from the student's current record would let later attendance or a
      reassignment rewrite a signed sheet. No COMPLETED gate on an edit.

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

## 6b. Establishment reads and the list's filters

```
GET /establishments        any signed-in role
  → explicit select: ESTABLISHMENT_FIELDS + _count + earliest supervisor {id,name,email,position}
  ← coordinator page loads it once; useEstablishmentFilters filters it IN THE CLIENT
      (search name/supervisor, industry, province → city, status, has/no supervisor),
      options = distinct values in the loaded rows — no PSGC, no request, and none of
      useEstablishment's form/cascade state is read or written

GET /establishments/:id    any signed-in role
  → the same fields
  → role === COORDINATOR ? + second query: students {id, name, studentIdNumber,
                                            course, yearLevel, status}
                         : no `students` key, no student query
  ← only the coordinator's view dialog calls it (refetch on every open)
```

## 7. Where to look for a given bug

| Symptom | Start here |
|---|---|
| Wrong/missing data for one student but not others | Ownership check in the service (§2) — is it filtering by the right profile id? |
| Hours don't match across two pages | `src/common/attendance-hours.ts` usage — is one call site bypassing `totalApprovedHours()`/`summarizeDay()`, or counting a session with only one punch approved? |
| A field silently became `0` instead of blank | Missing `ToOptionalNumber()`/`EmptyToUndefined()` on that DTO field (CLAUDE.md §4, "Validation and DTOs") |
| 400 on a request that looks right | An undeclared body property (`forbidNonWhitelisted`) — check the DTO lists every field the form sends |
| User stuck bounced to `/login` in a loop | Cookie `Max-Age` vs JWT `expiresIn` drift, or a stale token past its 1-day expiry (§3) |
| A role sees another role's/establishment's data | Missing or wrong ownership re-derivation in the service — never trust a body/param id directly. Also check for an `include` on a parent row (returns **every** column of it) on an endpoint other roles can reach: `GET /establishments/:id` leaked classmates' rows that way until F7 (CLAUDE.md §8 item 30) |
| Percentage/aggregate shows `0%`/`0` instead of blank | Should probably be `null`/absent — see "no data vs zero", CLAUDE.md §4. **But** a real `0` is correct once that field has a backend; the absent-not-zero half applies only while the module is unbuilt |
| Emptying a field and saving silently restores the old value | The DTO used `EmptyToUndefined()` on a nullable column — Prisma reads `undefined` as "leave unchanged". Nullable update fields need `EmptyToNull()`/`ToNullableNumber()`, and the client must send `null`, not omit the key (CLAUDE.md §4) |
| A date renders one day off, or a weekday doesn't match its date | A date-only column read in local time. Client: use `formatDateOnly`/`formatWeekdayOnly` (`lib/format.ts`). Server: `manilaToday()`, never `startOfUtcDay(new Date())` (§4) |
| A whole page is blank after one query fails | The endpoint used `Promise.all`. The dashboards use `Promise.allSettled` + per-section defaults + `failedSections`; a list minting signed URLs must not let one bad row throw (§4, CLAUDE.md §8) |
| A supervisor's own evaluation vanished or won't save | Authorship, not placement, governs a sheet. Check `getEvaluations`' union and that `updateEvaluation` guards on `supervisorId` only (§5) |
| A document shows as submitted but View/Download fails, or a file is orphaned in Storage | The replace order in §6 — the row must be repointed before the old object is deleted. A 503 from `/coordinator/documents/:id/download` means the row's object is gone from the bucket |
