# CampusOS demo runbook

## Before going on stage (10 min)

1. Start the three servers, each in its own terminal:
   ```bash
   # InternPrep API (resume fit + mock interviews)
   cd "C:/Interview preparation platform/apps/api" && .venv/Scripts/python.exe -m uvicorn main:app --port 8000
   # InternPrep web (practice links); 3000 is taken by Tarashio
   cd "C:/Interview preparation platform/apps/web" && npx next dev -p 3200
   # CampusOS: restart it fresh so no test state carries over
   cd "C:/Claude Build Day/campusos" && npm run dev
   ```
2. Open http://localhost:3100 in Chrome (voice input needs Chrome or Edge). Check that the header shows **Google Calendar connected** and **Krishna · IIT Bombay**.
3. Open http://localhost:3200 in a second tab and log into InternPrep, so practice links open straight into the session.
4. Do one warm-up run of each card (it also warms the InternPrep API), then clear any warm-up events from Google Calendar.
5. Keep your phone unlocked and visible for the Telegram message. Turn the laptop volume up for the spoken summary.

## The 2-minute script

**0:00 Problem.** "Students already have powerful AI. But it still leaves us doing the annoying part: moving between opportunity sites, resume tools, case prep, calendars and messages."

**0:15 Introduce.** "I'd already built three products for this: Opportunity OS finds opportunities, InternPrep AI prepares you for interviews, CaseForge prepares you for case competitions. CampusOS connects them into one loop. You don't ask it what to know. You tell it what you want done."

**0:25 Interview prep (hero).** Click the mic and say: *"I have a strategy internship interview next week. Check my resume against the role and set up a mock interview."*
- Point at the timeline: resume from InternPrep, the role from Opportunity OS, the real Google Calendar.
- Wait for the score ring: "InternPrep's own ATS engine: 56 out of 100, and it tells me exactly which keywords are missing."
- Approve one calendar block, then show it appearing in Google Calendar.

**1:05 Case competition.** Click the card. "Same engine, different product: it pulls my real Meesho case from CaseForge, including my team's existing work, researches live, and books prep time around my classes."
- Approve the Telegram recap and hold up the phone.

**1:40 Close.** Scroll the timeline: "Every step says which product did the work and whether the data is live. Anything consequential waits for my approval."
"We didn't build another chatbot. We built a layer that turns what a student wants done into actions."

## If something breaks

- **InternPrep API down:** the fit and mock steps show a red error, and Claude continues without them. Say: "and when a tool fails, you see it, not silence."
- **Wifi down:** set `DEMO_MODE=true` in `.env.local` and restart CampusOS. Every tool switches to its fixture, and the badges honestly say "demo data".
- **A run is slow:** runs take 50–80s. Narrate over the timeline, and don't restart mid-run.
