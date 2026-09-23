# BUILD STATE

## Current Goal
Phase 1 is done: one agent engine running three workflows end to end. Next is Phase 2: replace demo fixtures with real data from the existing projects (see PHASE2_PLAN.md).

## Working (tested end to end on 2026-09-23)
- [x] Goal input (text + voice, Web Speech API)
- [x] Claude planner (`create_plan` tool → plan checklist in UI)
- [x] Tool registry: 10 tools with risk levels (observe / prepare / execute)
- [x] Execution timeline (live NDJSON stream; `live` vs `demo data` badges)
- [x] Approval gates: calendar + Telegram pause for Approve/Skip
- [x] Result brief + actions list + spoken summary (TTS)
- [x] Research: Tavily search + extract (**live**)
- [x] GitHub search (**live**)
- [x] Opportunity OS: reads the `opportunities` table from Supabase (**live**, 40 rows)
- [~] Calendar: fixture reads; writes produce Google Calendar "add" links (no OAuth exists anywhere in the workspace)
- [~] Telegram: wired live but not yet sent in a test (declined in automated runs)
- [ ] Profile: fixture (not yet from InternPrep / Opportunity OS Supabase)
- [ ] CaseForge: fixture case (not yet from CaseForge's Neon DB)
- [ ] Browser automation

## Measured runs
| Workflow | Time | Tools | Notes |
|---|---|---|---|
| Case competition | 52s | 8 | 2 live Tavily searches, 3 events scheduled around the calendar |
| Opportunities | 41s | 6 | 40 live Opportunity OS rows, 4 shortlisted with apply links |
| Build Day | 46s | 6 | GitHub query was too long (fixed: tool now asks for 2–3 keywords) |

## Current Blocker
None.

## Next 3 Tasks
See PHASE2_PLAN.md, P0 items 1–3.

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
