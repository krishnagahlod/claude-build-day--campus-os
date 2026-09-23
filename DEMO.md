# CampusOS demo runbook

## Before going on stage (10 min)

1. Start everything in one terminal:
   ```bash
   cd "C:/Claude Build Day/campusos" && npm run demo
   ```
   This starts the InternPrep API (:8000), InternPrep web (:3200) and CampusOS (:3100). Ctrl+C stops all three.
2. In a second terminal, run `npm run preflight`. Every line should be green. If a product is red, the demo still works, because that step falls back to labelled demo data.
3. Open http://localhost:3100 in Chrome (voice needs Chrome or Edge). The header should say **6/6 systems live**.
4. Open http://localhost:3200 and log into InternPrep once, so practice links open straight into the session.
5. Do one warm-up run of the hero card, then delete any warm-up events from Google Calendar.
6. Phone unlocked and visible for Telegram. Laptop volume up for the spoken summary.

**Controls to remember**
- **Approval dock** (bottom of screen): press <kbd>Enter</kbd> to approve or <kbd>Esc</kbd> to skip. "Approve all for this run" stops the dock from asking again.
- **Stop** (top right) really stops the run on the server.
- **Recent** on the home page reopens any finished run instantly, which is your backup if a live run is slow.

## The 2-minute script

**0:00 Problem.** "Students already have powerful AI. But it still leaves us doing the annoying part: moving between opportunity sites, resume tools, case prep, calendars and messages."

**0:15 Introduce.** "I'd already built three products for this: Opportunity OS finds opportunities, InternPrep AI prepares you for interviews, CaseForge prepares you for case competitions. CampusOS connects them into one loop. You don't ask it what to know. You tell it what you want done."

**0:25 Interview prep (hero).** Click the mic and say: *"I have a strategy internship interview next week. Check my resume against the role and set up a mock interview."*
- Point at the timeline: resume from InternPrep, the role from Opportunity OS, the real Google Calendar.
- Wait for the score ring: "InternPrep's own ATS engine: 56 out of 100, and it tells me exactly which keywords are missing."
- When the dock slides up, read the session title aloud, press Enter, and show the event landing in Google Calendar.

**1:05 Case competition.** Click the card. "Same engine, different product: it pulls my real Meesho case from CaseForge, including my team's existing work, researches live, and books prep time around my classes."
- Approve the Telegram recap and hold up the phone.

**1:40 Close.** Scroll the timeline: "Every step says which product did the work and whether the data is live. Anything consequential waits for my approval."
"We didn't build another chatbot. We built a layer that turns what a student wants done into actions."

## If something breaks

- **InternPrep API down:** the fit and mock steps show a red error, and Claude continues without them. Say: "and when a tool fails, you see it, not silence."
- **Wifi down:** set `DEMO_MODE=true` in `.env.local` and restart CampusOS. Every tool switches to its fixture, and the badges honestly say "demo data".
- **A run is slow:** runs take 50–80s. Narrate over the timeline and the plan progress bar, and don't restart mid-run.
- **A live run fails outright:** go home, open the same workflow from **Recent**, and walk through the finished result.
