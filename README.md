# stackwise

**Audit-first CLI agent for codebases.**

Scans your project, scores issues by severity / effort / blast-radius, and produces an ordered phase plan — so you always know what to fix first.

Built on the principle that the hardest part of a messy codebase is not knowing *what's wrong*, it's knowing **what to fix first so you don't block yourself**.

---

## Install

```bash
npm install -g stackwise
```

Or run without installing:

```bash
npx stackwise scan .
```

---

## Usage

```bash
# 1. Scan your codebase
stackwise scan ./my-app

# 2. Generate an ordered phase plan
stackwise plan ./my-app

# 3. Check session state
stackwise status ./my-app
```

### With AI-powered ordering (recommended)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
stackwise plan ./my-app
```

Claude reasons about cross-issue dependencies (e.g. "migration must precede API update")
that pure scoring cannot detect.

Without the key, stackwise falls back to local scoring — still useful, slightly less nuanced.

---

## What it detects

| Category | Examples |
|---|---|
| **Security** | Admin routes using RLS-restricted client, service key in client code |
| **Data integrity** | Filters that silently drop nullable rows, eager state initializers, missing empty fallbacks |
| **Performance** | `useEffect` fetching static data, `"use client"` pages doing server work, unnecessary `useMemo` |
| **Architecture** | Module constants defined inside components, helper functions recreated each render |
| **UX** | Hardcoded "coming soon" UI, missing loading states, silent error swallowing |

---

## The scoring model

Every issue gets three scores (1–5):

- **Severity** — how bad if not fixed (5 = data loss / security)
- **Effort** — how hard to fix (1 = one line, 5 = multi-file refactor)
- **Blast radius** — how many other things depend on this

```
Priority = severity × (1 / effort) × blastRadius
```

High severity + low effort + high blast radius → fix first.

---

## Phase output example

```
PHASE 1 — Critical: data integrity          [~700 tokens · ~1 min]
  Rationale: These issues cause data loss on save. Fix before touching anything else.

  • ⚠️  Array filter may silently drop rows with null fields
       app/api/jobseeker/portfolio/route.ts:127

PHASE 2 — Security: admin client misuse     [~2,400 tokens · ~5 min]
  Rationale: Admin routes using the regular client will fail silently under RLS.

  • 🔐  Super-admin route using RLS-restricted client for data write
       app/api/super/verification/route.ts:14
  • 🔐  Super-admin route using RLS-restricted client for data write
       app/api/super/tokens/[id]/route.ts:22
```

---

## Options

```bash
stackwise scan [path] [options]
  --adapter <type>    Stack adapter: nextjs | supabase | generic (default: nextjs)
  --skip <rules>      Comma-separated rule IDs to skip

stackwise plan [path] [options]
  --no-ai             Use local scoring only (no API key needed)
  --model <model>     Claude model for AI phasing (default: claude-opus-4-6)
```

---

## Skip rules

```bash
stackwise scan . --skip performance/use-effect-static-fetch,ux/hardcoded-coming-soon
```

---

## Reference implementation

The session that shaped every design decision in this tool:

[examples/thesquareapp/session-log.md](examples/thesquareapp/session-log.md)

---

## Built-in adapters

- **nextjs** — Next.js App Router patterns (Server Components, "use client", API routes)
- **supabase** — Supabase-specific patterns (RLS, admin client, storage buckets)
- **generic** — Framework-agnostic rules only

---

## Roadmap

- `v0.1` — scan + plan + status (this release)
- `v0.2` — `stackwise execute [phase]` — AI agent applies fixes with approval gate
- `v0.3` — GitHub Issues / Linear integration for backlog input
- `v0.4` — Custom rule SDK (write your own rules in TypeScript)

---

## License

MIT
