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
    must contain ≥1 complete session (AM or PM) with positive hours, else 400
    hours computed server-side (hoursForAttendance) and stored on the row
    always lands PENDING
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

`Student.startDate` is the newest input to this pipeline — until it is set on a student,
their attendance-oversight percentage is `null` throughout, regardless of how much
approved attendance they have. See CLAUDE.md §7 ("Needs live verification").

## 5. Evaluation scoring flow

The rubric itself — nine criteria, three weighted categories, the formula and its bands —
is in CLAUDE.md §4. The only thing worth tracing here is **what is stored versus what is
recomputed**, because the two are deliberately different:

```
POST /supervisor/evaluations  (9 criteria, 1–5 each)
  → src/common/evaluation-scoring.ts
      overallRating + performanceLevel  ──STORED on the row──▶ survive a later rubric change
      (never accepted from the body; forbidNonWhitelisted rejects an attempt to supply them)
  ← on every READ: `categories` breakdown RECOMPUTED by withBreakdown() — never stored
      supervisor's list (own establishment) and coordinator's list (all establishments,
      read-only) call the same withBreakdown/pickCriteria → identical shape
```

So a rating shown next to a *stale* category breakdown is possible by design: the rating
is historical, the breakdown is current.

## 6. Module dependency map

The build order lives in CLAUDE.md §7; this is only the graph that explains it.

```
Auth ──┬─▶ Establishment ──┬─▶ Student Mgmt (Coordinator) ──┬─▶ Student self-service
       │                   │                                ├─▶ Supervisor ──▶ Evaluations
       │                   │                                └─▶ Attendance oversight
       │                   └─▶ Supervisor contact fields ─▶ Messaging
       └─▶ Password recovery (cuts across all three roles once accounts exist)
```

Documents / Credentials hang off Student Mgmt alone — the rows they need already exist,
which is why they came next regardless of Messaging's state. Both are built, sharing
`src/common/storage.ts`. Messaging's backend is also built now — polling (RTK Query), not
a websocket gateway; see CLAUDE.md §7. Its client is what's left (CLAUDE.md §7 "Remaining
build order").

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
