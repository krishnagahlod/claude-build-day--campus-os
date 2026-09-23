# Phase 2: Wire CampusOS into the existing projects

**Goal:** every step in the three demo workflows says `live`, backed by the user's real products, without modifying those products.
**Rule:** thin read-only adapters in `src/lib/tools.ts`. No copying of project code, no new services, and every adapter keeps its fixture fallback.

## What exists (from inspection)

| Capability | Where | How CampusOS reaches it | Auth | Plan |
|---|---|---|---|---|
| Opportunities | Opportunity OS → Supabase `opportunities` | REST (already live) | service key ✓ | keep |
| Student profile + resume | Opportunity OS → Supabase `profiles` | REST | service key ✓ | **P0** |
| Per-user match scores | Opportunity OS → Supabase `scores` (from `lib/scoring/score.ts`) | REST | service key ✓ | **P0** |
| Case competitions | CaseForge → Neon Postgres (Prisma: `Competition`, `Case`, `CompetitionRound`, `ResearchQuestion`) | read-only SQL via `pg` | `DATABASE_URL` ✓ | **P0** |
| Telegram | Opportunity OS `lib/telegram/send.ts` pattern | Bot API (already wired) | token ✓ | **P0** (verify + HTML format) |
| Calendar export | Opportunity OS `/api/calendar.ics` pattern | generate `.ics` in CampusOS | none | P1 |
| Resume ATS / fit check | InternPrep FastAPI `POST /resume/ats-check`, `/resume/analyze` | HTTP to local `apps/api` | Supabase JWT (separate project `wggmao…`) | P1 |
| Mock case interview | InternPrep `POST /interview/start_case` | deep link / HTTP | Supabase JWT | P1 |
| Outreach drafting | Opportunity OS `POST /api/ai/outreach/generate` | HTTP | user session | P2 (Claude already drafts well) |
| Case readiness / milestones / defense Q&A | CaseForge `/api/cases/[id]/readiness`, `/milestones`, `/defense` | read tables directly | session cookie | P1 |
| Research fallbacks | SearXNG / Firecrawl | not found configured locally | – | parked |
| Google Calendar write | none in the workspace | – | no OAuth | parked (keep template links) |
| Browser automation | none in the workspace | browser-use (Python, ★116k) | – | P2, gated |

## P0: makes the demo real (~50 min)

1. **Real profile (15 min).** `get_student_profile` reads `profiles` from Opportunity OS Supabase for one demo user (`CAMPUSOS_USER_ID`): name, college, skills and resume text. Fallback: fixture. The UI header pill reads from the same source.
2. **Real CaseForge case (20 min).** New read-only adapter using `pg` + `CASEFORGE_DATABASE_URL`:
   - `list_competitions` → active competitions with next round date
   - `analyze_case` → competition `rulesSummary`, `judgingCriteria`, `coreMemory`, case problem statement, open `ResearchQuestion`s
   All queries are SELECT-only with a 5-second timeout. Fallback: current Zepto fixture.
3. **Real match scores (10 min).** `find_opportunities` joins the user's `scores` rows, so Claude ranks with Opportunity OS's own scoring rather than inventing its own. It also passes `score` and `matched terms` through to the brief.
4. **Telegram, verified (5 min).** Send one approved test message to your phone. Switch to HTML parse mode, matching `send.ts`, so recaps show bold text and links.

**Checkpoint:** re-run all three workflows. Every observe step should say `live`.

## P1: adds real depth (~60 min, pick by time)

5. **Tailor the application (25 min).** New `check_resume_fit(opportunity)` tool calls InternPrep `POST /resume/ats-check` (run `apps/api` locally with a demo JWT). This adds "your resume scores 62/100 for this role; add these 3 keywords" to the Opportunity workflow. Risk: needs the FastAPI server running during the demo, so it falls back to Claude doing the fit check itself.
6. **One-click calendar (15 min).** `/api/calendar.ics?run=<id>` bundles every approved event into one download. The "Add all to calendar" button works with Google, Apple and Outlook.
7. **Case depth (15 min).** `analyze_case` also returns CaseForge milestones and the readiness report, so prep sessions map to real milestones.
8. **Practice handoff (5 min).** The case brief ends with a deep link to an InternPrep mock case interview on the same industry.

## P2: only if P0 and P1 are solid

9. **Open application (browser).** An `open_application` tool, gated, that opens `apply_url` and shows pre-filled answers to copy. Full browser-use form filling stays parked: it's Python, a new runtime, and high variance on stage.
10. **Speed.** Runs take 41–52s today. Targets: fewer turns (prompt Claude to batch calendar events in one turn), an "Approve all" button, and trying `claude-opus-5` fast mode. Aim for under 30s.
11. **Week planner polish.** The fourth card already works through the same engine. Only add a CaseForge + Opportunity OS deadlines merge.

## Env additions

```
CAMPUSOS_USER_ID=            # demo user in Opportunity OS profiles
CASEFORGE_DATABASE_URL=      # copied from CaseForge/.env (read-only use)
INTERNPREP_API_URL=http://localhost:8000   # P1 only
INTERNPREP_JWT=              # P1 only
```

## Risks

- **CaseForge DB is Neon (serverless) and may cold-start in 1–3s.** The 5-second timeout plus fixture fallback covers it.
- **The live opportunity feed changes daily.** Today everything closes tonight, which reads as odd on stage. Filter to `deadline > now + 12h` or keep a pinned demo query.
- **A real Telegram send happens on stage.** It's gated behind Approve, and the phone needs to be visible.
- **Two Supabase projects.** InternPrep (`wggmao…`) and Opportunity OS (`vvhpne…`) are separate. Profile comes from Opportunity OS in P0; InternPrep is only reached through its API in P1.

## Proposed order

P0 1 → 2 → 3 → 4, re-test, commit. Then P1 5 → 6 → 7, re-test, commit. Feature freeze, then the demo script and 3 rehearsals.
