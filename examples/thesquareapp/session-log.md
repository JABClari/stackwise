# Reference Implementation: TheSquareApp Session

This is the real session that shaped the stackwise design.
Every rule, scoring weight, and phase pattern in the tool can be traced back to something that happened here.

---

## The Project

TheSquareApp — a Next.js App Router + Supabase job board.
Stack: Next.js 16, Supabase (Postgres + Storage + RLS), TypeScript, Tailwind.

---

## What was audited

5 areas identified before any code was written:

1. Education date fields needed future year support + start/end range
2. "View Full Profile" button should be inside the quick-view modal, not on cards
3. Missing dashboard icons (Bookmark not rendering)
4. Company "under review" status missing from public profile
5. Course picker — multi-select dropdown for jobseeker education form

---

## Phase plan (as executed)

### Phase 1 — Critical: Data integrity
- Education filter in `app/api/jobseeker/portfolio/route.ts:127`
  dropped rows where `start_year = null` (pre-migration rows)
  **Fix:** remove `&& edu.start_year` from the filter
- Empty education list showed blank instead of default row
  **Fix:** explicit `.length > 0` check instead of `|| [default]`

### Phase 2 — Security: Admin client misuse (8 routes)
All routes under `/api/super/` were using `createClient()` (RLS-restricted)
for data reads and writes. On a multi-tenant system, RLS blocks cross-user
access — these operations would silently fail or return empty data.

Routes fixed: verification GET, tokens PUT/DELETE, universities GET/PUT,
cms GET/POST, users block route (profile read).

**Fix:** import `createAdminClient` and use it for data operations.
Keep `createClient()` only for `auth.getUser()` to verify the caller.

### Phase 3 — Architecture: Server Component refactor
`settings/page.tsx` was "use client" and fetched 4 separate APIs via
`useEffect` after hydration. Component unmounted on tab switch, causing
re-fetches every time the user navigated away and back.

`PortfolioSettings` used `useEffect` to fetch qualifications and courses
(static reference data), causing empty dropdowns on initial render and
a race condition on unmount.

**Fix:**
- Convert `settings/page.tsx` to async Server Component
- Single `Promise.all` fetches all 4 data sources before page reaches browser
- Extract interactive UI into `settings-shell.tsx` ("use client")
- `PortfolioSettings` becomes prop-driven — no useEffect, no async state
- `coursesByCategory` is a plain `const` (props are stable, no memo needed)
- `YEARS` and `CURRENT_YEAR` are module-level constants
- Education state uses lazy initializer `useState(() => array.map(...))`

---

## Scoring examples

| Issue | Severity | Effort | Blast | Score | Phase |
|---|---|---|---|---|---|
| edu filter drops null rows | 5 | 1 | 3 | 15.0 | 1 |
| empty edu list shows blank | 3 | 1 | 2 | 6.0 | 1 |
| admin client misuse (8 routes) | 4 | 2 | 4 | 8.0 | 2 |
| settings page client-side fetch | 3 | 4 | 4 | 3.0 | 3 |
| useEffect for static data | 3 | 3 | 3 | 3.0 | 3 |

Priority score = severity × (1 / effort) × blastRadius

---

## Key lesson: dependency ordering matters more than score

The admin client fixes (score 8.0) came before the architecture refactor (score 3.0)
not because of scoring alone, but because:
- The refactor involved moving data fetching server-side
- Server-side fetching uses `createClient()` (the regular client)
- If RLS was blocking that client in admin routes, the refactor might surface new issues
- Fixing the admin routes first meant the refactor had a clean baseline

This cross-issue dependency is what the AI phaser reasons about.
The local phaser uses scoring alone — good enough for most cases.

---

## Additional features built in this session

- Education start/end year fields + "Currently Studying" toggle
- Course picker grouped by category with "type my own" fallback
- Super admin Courses management tab
- Browse CV — course category filter (server-side pre-filter pattern)
- Employer verification badge on company public profile
- Jobseeker portfolio intro video — record, upload (compressed), display on full profile
