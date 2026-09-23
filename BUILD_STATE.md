# BUILD STATE

## Current Goal
One loop across the student's three products: FIND (Opportunity OS) → PREPARE (InternPrep AI, CaseForge) → PERFORM (calendar, Telegram, practice). InternPrep is now integrated. Next: Life Archive (calendar sync + activity log) if time permits.

## Working (tested end to end on 2026-09-23)
- [x] Goal input (text + voice, Web Speech API)
- [x] Claude planner (`create_plan` tool → plan checklist in UI)
- [x] Tool registry: 10 tools with risk levels (observe / prepare / execute)
- [x] Execution timeline (live NDJSON stream; `live` vs `demo data` badges)
- [x] Approval gates: calendar + Telegram pause for Approve/Skip
- [x] Result brief + actions list + spoken summary (TTS)
- [x] Research: Tavily search + extract (**live**)
- [x] GitHub search (**live**)
- [x] Opportunity OS (**live**, `opportunities` joined with its own per-user `scores`; skips deadlines <12h away)
- [~] Calendar: fixture reads; writes produce Google Calendar "add" links (no OAuth exists anywhere in the workspace)
- [x] Telegram (**live**, test recap delivered to phone 2026-09-23)
- [x] Profile (**live**, Opportunity OS `profiles`, Krishna Gahlod)
- [x] CaseForge (**live**, Neon over HTTPS since port 5432 is blocked on venue wifi; Meesho DICE 3.0 + Oliver Wyman Decode)
- [x] InternPrep AI resume (**live**, `resumes` table in InternPrep Supabase)
- [x] InternPrep AI ATS fit check (**live**, FastAPI `POST /resume/ats-check`, ~11s)
- [x] InternPrep AI mock interviews (**live**, `POST /interview/start_case|start_domain`, 15–27s; link opens InternPrep web)
- [ ] Browser automation

## Measured runs
| Workflow | Time | Tools | Notes |
|---|---|---|---|
| Case competition | 52s | 8 | 2 live Tavily searches, 3 events scheduled around the calendar |
| Opportunities | 41s | 6 | 40 live Opportunity OS rows, 4 shortlisted with apply links |
| Build Day | 46s | 6 | GitHub query was too long (fixed: tool now asks for 2–3 keywords) |

## Phase 2 P0 runs
| Workflow | Time | Notes |
|---|---|---|
| Opportunities | 46s | 30 live, all pre-scored; Telegram delivered |
| Case (Meesho DICE 3.0) | 68s | real 3-slide round, live RTO research, 3 blocks |
| Interview prep | 79s | Opportunity OS role → InternPrep ATS 56/100 (6/13 critical keywords) → live growth mock case → 2 events |
| Case + team work | 53s | reads 19 items of team work (playbook, reasoning nodes, sources); built on existing blocks |

## Demo gotchas
- Three servers must be running: CampusOS (3100), InternPrep API (8000, `apps/api/.venv`), InternPrep web (3200, since 3000 is used by Tarashio).
- Log into local InternPrep web once before the demo so practice links open straight into the session.
- Interview-prep run takes ~80s (mock-interview creation is the slow step). Narrate over it.
- Restart the dev server before the demo: created events persist in memory across runs.

## Current Blocker
None.

## Next 3 Tasks
1. Decide: InternPrep resume-fit (needs its FastAPI running) vs feature freeze
2. Speed: target <35s per run
3. Demo script + 3 rehearsals

## Do NOT Build Yet
- persistent memory / run history
- multi-agent architecture
- mobile, WhatsApp
- Google Calendar OAuth (none exists to reuse; template links are enough for the demo)

## Idea Parking Lot
- SearXNG / Firecrawl as research fallbacks behind Tavily
- "Approve all" button when Claude proposes several events at once
- Stream Claude's between-step narration into the timeline
- Server-side refusal fallbacks (`fallbacks: "default"`)

## Demo
- [x] End-to-end workflow
- [x] Build Day
- [x] CaseForge
- [x] Opportunity
- [x] Fallback data
- [ ] Demo script
- [ ] Rehearsal ×3
