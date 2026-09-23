# What CampusOS takes from your existing projects

CampusOS doesn't copy code from your projects. It calls them. Each capability is a thin adapter in [src/lib/sources.ts](src/lib/sources.ts) or [src/lib/google.ts](src/lib/google.ts), exposed to Claude as a tool in [src/lib/tools.ts](src/lib/tools.ts). None of the four projects were modified.

## Summary

| Project | Role in the loop | What CampusOS uses | How it connects | Status |
|---|---|---|---|---|
| **Opportunity OS** | Find | Opportunities, match scores, profile, Telegram bot | Supabase REST (read-only) + Telegram Bot API | Live, tested |
| **InternPrep AI** | Prepare | Resume, ATS fit check, mock case and domain interviews | Supabase REST (read-only) + its FastAPI | Live, tested |
| **CaseForge** | Prepare | Active competitions, rounds, case brief, team's work | Neon Postgres over HTTPS (SELECT only) | Live, tested |
| **Life Archive** | Perform | Google Calendar OAuth client | Same OAuth client, CampusOS holds its own token | Live, tested |

## Opportunity OS

**Workflows taken**
- **Opportunity discovery:** the `opportunities` table, filtered to active listings closing more than 12 hours from now.
- **Personal matching:** Opportunity OS's own per-user `scores` (the `computeScore` engine output: score + "why"). These are joined onto each listing, so Claude ranks with your scoring engine instead of inventing its own.
- **Student profile:** `profiles` (college, interests, skills, resume skills, location and time preferences).
- **Telegram nudges:** the same bot and chat as your daily digest.

**How well it's integrated**
- **Strong.** A test run returned 30 live listings, all pre-scored for you. Claude cited the scores and reasons and skipped listings that didn't fit your profile. A Telegram recap was delivered to your phone.
- **Gap.** The scores were computed in June, so newer listings may have none. CampusOS reads existing scores and doesn't trigger a re-score.
- **Not used:** AI outreach generation (`/api/ai/outreach`) and the per-opportunity LLM match (`/api/ai/match`). Both need a logged-in user session, and Claude covers the same ground with the resume.

## InternPrep AI

**Workflows taken**
- **Resume:** your latest `resumes` row (a 5,146-character Chemical Engineering resume). It's the ground truth for your background.
- **ATS fit check:** `POST /resume/ats-check` with the role and job description. It returns the overall score, tier, keyword match (found and missing critical terms), section health and quick wins.
- **Mock interviews:** `POST /interview/start_case` and `/interview/start_domain` create a real InternPrep session. CampusOS shows the opening question and links to `localhost:3200/interview?id=…`.

**How well it's integrated**
- **Strong, and the deepest of the four.** The Interview prep workflow uses InternPrep twice in one run (score the resume, then create a mock interview), with an Opportunity OS role in between. The test run scored 56/100 for Turtlemint Strategy (keyword match 20/100, 6 of 13 critical terms), and Claude turned the missing terms into concrete resume edits.
- **Gap: InternPrep must be running locally.** The API runs on port 8000 and the web app on port 3200. Scoring two roles in parallel is slow (about 27s against 11s for one).
- **Gap: the mock interview itself happens in InternPrep's UI.** CampusOS creates the session, but doesn't conduct the interview or read the feedback afterwards.
- **Not used:** the resume builder, placement analysis and the Accenture interview suite.

## CaseForge

**Workflows taken**
- **Competition intelligence:** active `Competition` rows with rules, judging criteria and core memory.
- **Rounds:** `CompetitionRound` (deliverable format, slide and time limits, deadline).
- **Case brief:** `Case` (problem statement, objectives, constraints, archetypes).
- **Your team's existing work:** the case `playbook` (milestone progress, strategy pillars), top `ReasoningNode`s and `Source`s.

**How well it's integrated**
- **Strong.** Claude picked up Meesho DICE 3.0 (Valmo, "Reducing RTO", 3-slide deck) and built the prep plan on top of your playbook and 19 existing work items instead of starting over.
- **Gap: read-only.** Nothing flows back into CaseForge. Prep sessions and research findings aren't written back as milestones or sources.
- **Gap: no Round 1 deadline recorded.** So Claude has to ask you to confirm the date.
- **Not used:** the AI synthesis, red-team and defense endpoints. They need CaseForge's login session.

## Life Archive

**Workflows taken**
- **Google Calendar sync:** Life Archive's Google OAuth client and its connect/refresh pattern (`getGoogleCalendarAuthUrl`, `getValidGoogleAccessToken`), mirrored in `src/lib/google.ts`. CampusOS reads your real events to find free slots, and creates approved events in your real calendar.

**How well it's integrated**
- **Working, but shallow.** 10 real events were read and 1 approved event was created and verified in Google Calendar.
- **Gap: CampusOS signed in separately.** It holds its own Google token instead of reading Life Archive's, because Life Archive's Supabase admin key isn't on this machine.
- **Not used yet:** activity logging (`daily_activity_logs`), tasks and time tracking. These are the best next integration: completed prep sessions would be logged automatically, closing the loop from "planned" to "done".

## What CampusOS adds on top

- **One planner across all four projects.** Claude decides which product to use for a goal and carries it from find through prepare to perform.
- **Approval gates.** Calendar writes and Telegram messages wait for your click.
- **An honest timeline.** Every step shows which product did the work and whether the data was live or demo.
- **Fallbacks.** Every adapter falls back to demo data if its product is unreachable, so the demo can't fail silently.

## Best next integrations, by value

1. **Life Archive activity log.** Log completed CampusOS sessions as activities. Needs the Life Archive service key.
2. **CaseForge write-back.** Save research findings as `Source`s and prep sessions as milestones.
3. **InternPrep feedback loop.** After a mock interview, read its session feedback and adjust the next prep block.
4. **Opportunity OS re-score.** Trigger a fresh score for new listings before ranking them.
