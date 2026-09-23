import { neon } from "@neondatabase/serverless";

// Thin read-only adapters over the student's existing products.
// Each returns null when not configured so callers fall back to fixtures.

const env = (k: string) => process.env[k]?.trim() || undefined;
const DEMO = () => env("DEMO_MODE") === "true";

async function supabase<T>(path: string): Promise<T | null> {
  const url = env("OPPORTUNITY_SUPABASE_URL");
  const key = env("OPPORTUNITY_SUPABASE_KEY");
  if (!url || !key || DEMO()) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Opportunity OS ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

// Opportunity OS / InternPrep student profile.
export async function fetchProfile() {
  const id = env("CAMPUSOS_USER_ID");
  if (!id) return null;
  const rows = await supabase<Record<string, unknown>[]>(
    `profiles?id=eq.${id}&select=full_name,email,college,graduation_year,interests,skills,resume_skills,preferred_location,remote_preference,time_commitment,target_companies,avoid_tags,telegram_chat_id`,
  );
  return rows?.[0] ?? null;
}

// Opportunity OS listings, joined with Opportunity OS's own per-user match scores.
export async function fetchOpportunities(withinDays?: number) {
  const now = Date.now();
  const from = new Date(now + 12 * 3600e3).toISOString(); // skip anything closing in <12h
  const to = withinDays ? `&deadline=lte.${new Date(now + withinDays * 864e5).toISOString()}` : "";
  const opps = await supabase<Record<string, any>[]>(
    `opportunities?status=eq.active&deadline=gte.${from}${to}&order=deadline.asc&limit=60&select=id,title,organization,category,tags,eligibility,deadline,location,compensation,is_remote,apply_url,summary`,
  );
  if (!opps) return null;
  const id = env("CAMPUSOS_USER_ID");
  if (id && opps.length) {
    const scores = await supabase<{ opportunity_id: string; score: number; why: string }[]>(
      `scores?user_id=eq.${id}&opportunity_id=in.(${opps.map((o) => o.id).join(",")})&select=opportunity_id,score,why`,
    ).catch(() => null);
    const byId = new Map((scores ?? []).map((s) => [s.opportunity_id, s]));
    for (const o of opps) {
      const s = byId.get(o.id);
      if (s) { o.match_score = s.score; o.match_why = s.why; }
    }
    opps.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
  }
  return opps.slice(0, 30);
}

// CaseForge (Neon Postgres over HTTPS, SELECT only).
export async function fetchCase(hint?: string) {
  const url = env("CASEFORGE_DATABASE_URL");
  if (!url || DEMO()) return null;
  const sql = neon(url);
  const comps = (await sql.query(
    `select id, name, organizer, mode, "rulesSummary", "judgingCriteria", "coreMemory"
       from "Competition" where status = 'ACTIVE' order by "updatedAt" desc limit 10`,
  )) as Record<string, any>[];
  if (!comps.length) return null;
  const h = hint?.toLowerCase().trim();
  const comp = (h && comps.find((c) => `${c.name} ${c.organizer}`.toLowerCase().split(/\s+/).some((w) => w.length > 3 && h.includes(w)))) || comps[0];
  const [rounds, cases] = await Promise.all([
    sql.query(
      `select name, sequence, deadline, "deliverableFormat", "slideLimit", "timeLimitMinutes", "specificGuidelines", status
         from "CompetitionRound" where "competitionId" = $1 order by sequence`, [comp.id]),
    sql.query(
      `select title, "companyName", industry, "coreProblemStatement", objectives, constraints, "caseArchetypes", "coreMemory"
         from "Case" where "competitionId" = $1 order by "updatedAt" desc limit 2`, [comp.id]),
  ]);
  const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : s);
  return {
    competition: { name: comp.name, organizer: comp.organizer, mode: comp.mode, rules: clip(comp.rulesSummary, 1500), judgingCriteria: clip(comp.judgingCriteria, 800), coreMemory: clip(comp.coreMemory, 1500) },
    rounds,
    cases: (cases as Record<string, any>[]).map((c) => ({ ...c, coreProblemStatement: clip(c.coreProblemStatement, 3500), coreMemory: clip(c.coreMemory, 1500) })),
    otherActiveCompetitions: comps.filter((c) => c.id !== comp.id).map((c) => c.name),
  };
}
