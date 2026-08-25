# SYSTEM-FLOW.md

How data and requests actually move through the OJT Monitoring System. Read `CLAUDE.md`
first for what exists and the rules; this file is the *mechanics* — read it when you need
to trace a bug across layers or add a new module that has to fit the same shape.

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

**Why two checks:** `RolesGuard` only ever sees a role string off the JWT — it has no
idea whose data is being touched. Every module re-derives ownership itself in the
service layer. A new endpoint that skips step 2 and trusts an `id` in the request body
is a cross-tenant data leak (e.g. a supervisor approving another establishment's
attendance record just by knowing its id).

**Route-guard vs security-boundary, client side:** `proxy.ts` (Next 16's middleware)
reads the `ojt_role` cookie and redirects — but that cookie is forgeable in devtools.
It only prevents an authenticated-but-wrong-role user from *seeing* a page; the actual
enforcement for every read/write is the two-check chain above, running on the server.

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

If the cookie's `Max-Age` and the JWT's `expiresIn` ever drift apart, a user can end up
with a live cookie but a dead token: bounced to `/login`, every subsequent call 401s,
and for STUDENT/SUPERVISOR the pages that would show a logout button don't exist yet on
some routes — a real lock-out, not just an inconvenience. Keep the two in sync.

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
                                   = attendancePercentage (null if no startDate — never a fake 0%)
```

`Student.startDate` is the newest input to this pipeline (§7/§8 of CLAUDE.md) — until it's
set on a student, their attendance-oversight percentage is `null` throughout, regardless
of how much approved attendance they have.

## 5. Evaluation scoring flow

```
Supervisor submits POST /supervisor/evaluations
  9 criteria, 1–5 each, grouped into 3 categories:
    Work Performance (40%): quality, quantity, efficiency
    Professional Behavior (30%): attendance, teamwork, communication
    Technical Skills (30%): knowledge, problemSolving, initiative
    ↓  src/common/evaluation-scoring.ts
  overall = WPavg×0.4 + PBavg×0.3 + TSavg×0.3
  performanceLevel = band(overall)   [≥4.5 Excellent … else Poor]
    ↓
  overallRating + performanceLevel STORED on the row (never accepted from the request body —
  forbidNonWhitelisted rejects an attempt to supply them)
    ↓
  categories breakdown recomputed on every READ (withBreakdown) — not stored, presentation-only
    ↓
  Supervisor's own list (scoped to establishment) and Coordinator's list (all establishments,
  read-only) both call the same withBreakdown/pickCriteria helpers → identical shape
```

## 6. Module dependency map (why the build order in CLAUDE.md §7 is what it is)

```
Auth ──┬─▶ Establishment ──┬─▶ Student Mgmt (Coordinator) ──┬─▶ Student self-service
       │                   │                                 ├─▶ Supervisor ──▶ Evaluations
       │                   │                                 └─▶ Attendance oversight
       │                   │                                       (needs Student.startDate,
       │                   │                                        landed in §7 "in progress")
       │                   └─▶ Supervisor contact fields ─▶ Messaging (not started)
       └─▶ Password recovery (cuts across all three roles once accounts exist)

Documents / Credentials: needs only Student Mgmt (establishment + student rows already
exist) — no other blocker, which is why it's next regardless of Messaging's state.
```

## 7. Where to look for a given bug

| Symptom | Start here |
|---|---|
| Wrong/missing data for one student but not others | Ownership check in the service (§2) — is it filtering by the right profile id? |
| Hours don't match across two pages | `src/common/attendance-hours.ts` usage — is one call site bypassing `totalHours()`? |
| A field silently became `0` instead of blank | Missing `ToOptionalNumber()`/`EmptyToUndefined()` on that DTO field (CLAUDE.md §5) |
| 400 on a request that looks right | An undeclared body property (`forbidNonWhitelisted`) — check the DTO lists every field the form sends |
| User stuck bounced to `/login` in a loop | Cookie `Max-Age` vs JWT `expiresIn` drift, or a stale token past its 1-day expiry (§3) |
| A role sees another role's/establishment's data | Missing or wrong ownership re-derivation in the service — never trust a body/param id directly |
| Percentage/aggregate shows `0%`/`0` instead of blank | Should probably be `null`/absent instead — see the "no data vs zero" convention, CLAUDE.md §5 |
