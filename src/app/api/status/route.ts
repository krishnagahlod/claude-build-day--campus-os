import { googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

const has = (...keys: string[]) => keys.every((k) => !!process.env[k]?.trim());

async function reachable(url: string | undefined) {
  if (!url) return false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    return res.status < 500;
  } catch {
    return false;
  }
}

// Which of the student's products CampusOS can reach right now.
export async function GET() {
  const demo = process.env.DEMO_MODE === "true";
  const [internprepApi, gcal] = await Promise.all([
    reachable(process.env.INTERNPREP_API_URL ? `${process.env.INTERNPREP_API_URL}/docs` : undefined),
    googleStatus().catch(() => ({ connected: false })),
  ]);
  const systems = [
    { id: "opportunity", name: "Opportunity OS", stage: "find", detail: "Opportunities + your match scores", live: has("OPPORTUNITY_SUPABASE_URL", "OPPORTUNITY_SUPABASE_KEY") },
    { id: "internprep", name: "InternPrep AI", stage: "prepare", detail: "Resume, ATS fit, mock interviews", live: has("INTERNPREP_SUPABASE_URL", "INTERNPREP_SUPABASE_KEY") && internprepApi },
    { id: "caseforge", name: "CaseForge", stage: "prepare", detail: "Case competitions + team work", live: has("CASEFORGE_DATABASE_URL") },
    { id: "calendar", name: "Google Calendar", stage: "perform", detail: gcal.connected ? "Connected via Life Archive's client" : "Not connected", live: gcal.connected },
    { id: "telegram", name: "Telegram", stage: "perform", detail: "Nudges to your phone", live: has("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") },
    { id: "research", name: "Research", stage: "prepare", detail: "Tavily web + GitHub", live: has("TAVILY_API_KEY") },
  ].map((s) => ({ ...s, live: s.live && !demo }));
  return Response.json({ demo, calendarConnected: gcal.connected, systems });
}
