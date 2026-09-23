import type Anthropic from "@anthropic-ai/sdk";
import {
  calendarEvents,
  caseLibrary,
  githubFixture,
  opportunities,
  searchFixture,
  studentProfile,
} from "./fixtures";

// Autonomy levels from the product spec: observe → prepare → execute (gated).
export type Risk = "observe" | "prepare" | "execute";

export type ToolOutput = {
  data: unknown; // sent back to Claude
  summary: string; // one line for the timeline
  source: "live" | "demo"; // honest badge in the UI
  artifact?: Artifact; // something tangible to show in the results panel
};

export type Artifact =
  | { kind: "event"; title: string; start: string; end: string; link: string }
  | { kind: "message"; channel: string; text: string; delivered: boolean }
  | { kind: "email"; to: string; subject: string; body: string }
  | { kind: "repo"; name: string; url: string; stars: number };

type ToolDef = {
  name: string;
  app: string; // which existing capability this wraps
  risk: Risk;
  requiresApproval: boolean;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
  label: (input: any) => string;
  run: (input: any) => Promise<ToolOutput>;
};

const env = (k: string) => process.env[k]?.trim() || undefined;
const DEMO = env("DEMO_MODE") === "true";

// In-memory calendar so newly created events show up in later get_calendar calls.
const g = globalThis as unknown as { __createdEvents?: { title: string; start: string; end: string }[] };
g.__createdEvents ??= [];

function gcalLink(title: string, start: string, end: string, details: string) {
  const fmt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${fmt(start)}/${fmt(end)}`, details });
  return `https://calendar.google.com/calendar/render?${p}`;
}

async function tavily(path: "search" | "extract", body: object) {
  const key = env("TAVILY_API_KEY");
  if (!key || DEMO) return null;
  const res = await fetch(`https://api.tavily.com/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ api_key: key, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_student_profile",
    app: "InternPrep AI",
    risk: "observe",
    requiresApproval: false,
    description: "Read the student's profile from InternPrep AI: education, skills, projects, resume highlights, interests and preferences. Call this early for any personalised goal.",
    input_schema: { type: "object", properties: {}, required: [] },
    label: () => "Loading your profile from InternPrep AI",
    run: async () => ({
      data: studentProfile,
      summary: `${studentProfile.name} · ${studentProfile.degree} · ${studentProfile.skills.length} skills, ${studentProfile.projects.length} projects`,
      source: "demo",
    }),
  },
  {
    name: "web_search",
    app: "Research (Tavily)",
    risk: "observe",
    requiresApproval: false,
    description: "Search the live web and get a synthesized answer plus top sources. Use focused queries.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Focused search query" } },
      required: ["query"],
    },
    label: (i) => `Searching the web: “${i.query}”`,
    run: async ({ query }) => {
      const live = await tavily("search", { query, max_results: 5, include_answer: true });
      if (live) {
        const results = (live.results ?? []).map((r: any) => ({ title: r.title, url: r.url, content: String(r.content ?? "").slice(0, 500) }));
        return { data: { answer: live.answer, results }, summary: `${results.length} sources read`, source: "live" };
      }
      const f = searchFixture(query);
      return { data: f, summary: `${f.results.length} sources read`, source: "demo" };
    },
  },
  {
    name: "read_page",
    app: "Research (Tavily Extract)",
    risk: "observe",
    requiresApproval: false,
    description: "Extract the main text of a web page by URL.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    label: (i) => `Reading ${safeHost(i.url)}`,
    run: async ({ url }) => {
      const live = await tavily("extract", { urls: [url] });
      const text = live?.results?.[0]?.raw_content;
      if (text) return { data: { url, text: String(text).slice(0, 5000) }, summary: `${String(text).length.toLocaleString()} characters extracted`, source: "live" };
      return { data: { url, text: "Page content unavailable in demo mode; rely on search snippets." }, summary: "Used cached snippet", source: "demo" };
    },
  },
  {
    name: "github_search",
    app: "GitHub",
    risk: "observe",
    requiresApproval: false,
    description: "Search GitHub for reusable open-source repositories. Returns stars, license and last update so you can judge maturity.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    label: (i) => `Scanning GitHub for “${i.query}”`,
    run: async ({ query }) => {
      if (!DEMO) {
        try {
          const res = await fetch(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`,
            { headers: { "User-Agent": "CampusOS", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10000) },
          );
          if (res.ok) {
            const json = await res.json();
            const repos = (json.items ?? []).map((r: any) => ({
              name: r.full_name, stars: r.stargazers_count, description: r.description, url: r.html_url,
              license: r.license?.spdx_id ?? "none", updated: r.pushed_at,
            }));
            if (repos.length) return { data: repos, summary: `${repos.length} repos · top: ${repos[0].name} (★${fmtK(repos[0].stars)})`, source: "live" };
          }
        } catch { /* fall through to fixture */ }
      }
      const repos = githubFixture(query);
      return { data: repos, summary: `${repos.length} repos · top: ${repos[0].name}`, source: "demo" };
    },
  },
  {
    name: "find_opportunities",
    app: "Opportunity OS",
    risk: "observe",
    requiresApproval: false,
    description: "Fetch open opportunities (internships, fellowships, hackathons) from Opportunity OS with deadlines, eligibility and apply links. You do the matching against the profile.",
    input_schema: {
      type: "object",
      properties: { within_days: { type: "number", description: "Only deadlines within this many days" } },
      required: [],
    },
    label: (i) => `Querying Opportunity OS${i.within_days ? ` (deadlines ≤ ${i.within_days} days)` : ""}`,
    run: async ({ within_days }) => {
      let list = opportunities();
      let source: "live" | "demo" = "demo";
      const url = env("OPPORTUNITY_SUPABASE_URL");
      const key = env("OPPORTUNITY_SUPABASE_KEY");
      if (url && key && !DEMO) {
        try {
          const res = await fetch(
            `${url}/rest/v1/opportunities?status=eq.active&deadline=gte.${new Date().toISOString()}&order=deadline.asc&limit=40&select=id,title,organization,category,tags,eligibility,deadline,location,compensation,apply_url`,
            { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) },
          );
          if (res.ok) { const rows = await res.json(); if (rows.length) { list = rows; source = "live"; } }
        } catch { /* fixture */ }
      }
      if (within_days) {
        const cutoff = Date.now() + within_days * 864e5;
        list = list.filter((o: any) => !o.deadline || new Date(o.deadline).getTime() <= cutoff);
      }
      return { data: list, summary: `${list.length} open opportunities found`, source };
    },
  },
  {
    name: "analyze_case",
    app: "CaseForge",
    risk: "observe",
    requiresApproval: false,
    description: "Load the student's upcoming case competition from CaseForge: company, problem statement, constraints, key questions, suggested frameworks and data needed.",
    input_schema: { type: "object", properties: { hint: { type: "string", description: "Competition or company name, if known" } }, required: [] },
    label: () => "Pulling your case brief from CaseForge",
    run: async () => {
      const c = caseLibrary()[0];
      return { data: c, summary: `${c.company} · ${c.industry} · ${c.competition}`, source: "demo" };
    },
  },
  {
    name: "get_calendar",
    app: "Calendar",
    risk: "observe",
    requiresApproval: false,
    description: "Read the student's calendar for the next N days to find free slots. Times are ISO strings in the student's local time.",
    input_schema: { type: "object", properties: { days: { type: "number" } }, required: ["days"] },
    label: (i) => `Checking your calendar (next ${i.days ?? 7} days)`,
    run: async ({ days = 7 }) => {
      const cutoff = Date.now() + days * 864e5;
      const events = [...calendarEvents(), ...g.__createdEvents!]
        .filter((e) => new Date(e.start).getTime() <= cutoff)
        .sort((a, b) => a.start.localeCompare(b.start));
      return { data: { now: new Date().toISOString(), events }, summary: `${events.length} events · free slots identified`, source: "demo" };
    },
  },
  {
    name: "create_calendar_event",
    app: "Calendar",
    risk: "execute",
    requiresApproval: true,
    description: "Create a calendar event (e.g. a focused prep session or a deadline reminder). The student approves it in the UI before it is created. Never overlap existing events.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO datetime" },
        end: { type: "string", description: "ISO datetime" },
        notes: { type: "string", description: "Agenda / checklist for the session" },
      },
      required: ["title", "start", "end"],
    },
    label: (i) => `Scheduling “${i.title}” · ${fmtWhen(i.start)}`,
    run: async ({ title, start, end, notes = "" }) => {
      g.__createdEvents!.push({ title, start, end });
      const link = gcalLink(title, start, end, notes);
      return {
        data: { status: "created", title, start, end },
        summary: `Added ${fmtWhen(start)} → ${fmtTime(end)}`,
        source: "live",
        artifact: { kind: "event", title, start, end, link },
      };
    },
  },
  {
    name: "draft_email",
    app: "Email",
    risk: "prepare",
    requiresApproval: false,
    description: "Prepare an email draft (never sends). Use for outreach, application cover notes or team coordination.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
      required: ["to", "subject", "body"],
    },
    label: (i) => `Drafting email: “${i.subject}”`,
    run: async ({ to, subject, body }) => ({
      data: { status: "drafted" },
      summary: `Draft ready for ${to}`,
      source: "live",
      artifact: { kind: "email", to, subject, body },
    }),
  },
  {
    name: "send_telegram",
    app: "Telegram",
    risk: "execute",
    requiresApproval: true,
    description: "Send the student a Telegram message (their preferred channel) with a crisp summary/next steps. Plain text, under 900 characters. The student approves before it is sent.",
    input_schema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
    label: () => "Sending you a Telegram summary",
    run: async ({ message }) => {
      const token = env("TELEGRAM_BOT_TOKEN");
      const chat = env("TELEGRAM_CHAT_ID");
      if (token && chat && !DEMO) {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text: message, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return { data: { status: "sent" }, summary: "Delivered to your phone", source: "live", artifact: { kind: "message", channel: "Telegram", text: message, delivered: true } };
      }
      return { data: { status: "sent (simulated)" }, summary: "Queued (Telegram not configured)", source: "demo", artifact: { kind: "message", channel: "Telegram", text: message, delivered: false } };
    },
  },
];

export const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

export const PLAN_TOOL: Anthropic.Tool = {
  name: "create_plan",
  description: "Publish your execution plan to the student's screen. Call this exactly once, first, before any other tool.",
  input_schema: {
    type: "object",
    properties: {
      goal: { type: "string", description: "The outcome, restated in under 12 words" },
      steps: {
        type: "array",
        description: "3-7 concrete steps in order",
        items: {
          type: "object",
          properties: { title: { type: "string" }, tool: { type: "string", description: "Tool you expect to use, or 'reasoning'" } },
          required: ["title", "tool"],
        },
      },
    },
    required: ["goal", "steps"],
  },
};

export const anthropicTools: Anthropic.Tool[] = [
  PLAN_TOOL,
  ...TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
];

function safeHost(u: string) { try { return new URL(u).host; } catch { return u; } }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function fmtWhen(s: string) {
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}
function fmtTime(s: string) {
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
