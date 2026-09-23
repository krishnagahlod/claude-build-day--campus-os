import Anthropic from "@anthropic-ai/sdk";
import { anthropicTools, toolByName, type Artifact } from "./tools";

export type AgentEvent =
  | { type: "run"; runId: string }
  | { type: "status"; text: string }
  | { type: "plan"; goal: string; steps: { title: string; tool: string }[] }
  | { type: "step"; id: string; tool: string; app: string; risk: string; label: string; status: "running" | "done" | "error" | "awaiting" | "skipped"; summary?: string; source?: string; input?: unknown }
  | { type: "artifact"; artifact: Artifact }
  | { type: "final"; markdown: string; spoken: string }
  | { type: "error"; message: string };

const MODEL = process.env.CAMPUSOS_MODEL || "claude-opus-5";
const MIN_STEP_MS = Number(process.env.MIN_STEP_MS ?? 700); // keeps the timeline readable on stage

// Approval gates: the loop parks on a promise; /api/approve resolves it.
const g = globalThis as unknown as { __approvals?: Map<string, (ok: boolean) => void> };
g.__approvals ??= new Map();
export const approvals = g.__approvals;

function systemPrompt() {
  const now = new Date();
  return `You are CampusOS, an execution layer for a college student. The student gives you an outcome, not a question. You plan, use tools to gather context and take actions, then report what you did.

Current local time: ${now.toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} (ISO ${now.toISOString()}).

CampusOS connects the student's own three products into one loop:
- FIND: Opportunity OS (opportunities + its own match scores).
- PREPARE: InternPrep AI (resume, ATS fit check, mock interviews) and CaseForge (case competitions, team's case work).
- PERFORM: calendar blocks, Telegram nudges, and practice sessions.
When a goal touches more than one stage, carry it through: e.g. a shortlisted opportunity gets a resume fit check and, if it is a strong match, a mock interview and a prep block. Say which product each insight came from.

How to work:
- First call create_plan (once) with 3-7 concrete steps. Then execute.
- Personalise: read the student profile early for anything career- or schedule-related.
- Call independent tools in parallel in the same turn (e.g. profile + calendar + search together). Keep total tool calls under about 12; be decisive. Run check_resume_fit for at most the top 2 roles.
- Before scheduling, read the calendar and pick genuinely free slots within the student's work hours. Use ISO datetimes with the local offset.
- create_calendar_event and send_telegram are gated: the student approves each one on screen. Propose them when they genuinely help; if one is declined, continue without it.
- End with send_telegram carrying a short plain-text recap with the key next action, when that fits the goal.
- If a tool fails, say so briefly and continue with what you have.

Final answer format (markdown, tight, no preamble, no tables wider than 4 columns):
## <outcome in a few words>
2-3 sentence summary of what you did and found.
Never paste raw URLs: always write markdown links with a short label, e.g. [Apply](url) or [Start the mock interview](url).
Then the most useful sections for this goal (e.g. "Top matches", "Prep plan", "Build plan", "Scheduled"), using bullets with specifics: names, dates, numbers, links.
## Next action
One concrete thing the student should do now.

On the very last line write: SPOKEN: <one or two natural sentences summarising what you did, for text-to-speech, no markdown>.`;
}

export async function runAgent(goal: string, runId: string, emit: (e: AgentEvent) => void, signal?: AbortSignal) {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];
  let stepCounter = 0;

  emit({ type: "status", text: "Understanding your goal" });

  for (let turn = 0; turn < 12; turn++) {
    if (signal?.aborted) return; // student pressed Stop or closed the tab
    // Stream so the timeline can say what Claude is drafting while it writes, instead of going quiet.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(),
      tools: anthropicTools,
      output_config: { effort: (process.env.CAMPUSOS_EFFORT as "low" | "medium" | "high") || "low" },
      messages,
    } as Anthropic.MessageStreamParams, { signal });
    const drafting: string[] = [];
    stream.on("streamEvent", (ev) => {
      if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
        const name = ev.content_block.name;
        if (name === "create_plan") emit({ type: "status", text: "Building your plan" });
        else if (name === "create_calendar_event") emit({ type: "status", text: `Drafting prep session ${drafting.push(name)}` });
        else if (name === "send_telegram") emit({ type: "status", text: "Writing your Telegram recap" });
        else emit({ type: "status", text: `Preparing ${toolByName.get(name)?.app ?? name}` });
      } else if (ev.type === "content_block_start" && ev.content_block.type === "text") {
        emit({ type: "status", text: "Writing your brief" });
      }
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal") {
      emit({ type: "error", message: "The model declined this request." });
      return;
    }

    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      const m = text.match(/\n?SPOKEN:\s*([\s\S]+)$/);
      const spoken = m ? m[1].trim() : "Done. Here's what I got done for you.";
      const markdown = m ? text.slice(0, m.index).trim() : text;
      emit({ type: "final", markdown, spoken });
      return;
    }

    // Ungated tools run in parallel; gated tools wait for the student one at a time.
    const results = new Map<string, Anthropic.ToolResultBlockParam>();
    const ungated = toolUses.filter((t) => !toolByName.get(t.name)?.requiresApproval);
    const gated = toolUses.filter((t) => toolByName.get(t.name)?.requiresApproval);

    const runOne = async (tu: Anthropic.ToolUseBlock) => {
      if (tu.name === "create_plan") {
        const input = tu.input as { goal: string; steps: { title: string; tool: string }[] };
        emit({ type: "plan", goal: input.goal, steps: input.steps ?? [] });
        results.set(tu.id, { type: "tool_result", tool_use_id: tu.id, content: "Plan shown to the student. Proceed." });
        return;
      }
      const def = toolByName.get(tu.name);
      const id = `s${++stepCounter}`;
      if (!def) {
        results.set(tu.id, { type: "tool_result", tool_use_id: tu.id, content: `Unknown tool ${tu.name}`, is_error: true });
        return;
      }
      const base = { id, tool: def.name, app: def.app, risk: def.risk, label: def.label(tu.input ?? {}), input: tu.input };

      if (def.requiresApproval) {
        emit({ type: "step", ...base, status: "awaiting" });
        const ok = await new Promise<boolean>((resolve) => {
          approvals.set(`${runId}:${id}`, resolve);
          const release = () => { if (approvals.delete(`${runId}:${id}`)) resolve(false); };
          setTimeout(release, 5 * 60_000);
          signal?.addEventListener("abort", release, { once: true });
        });
        if (!ok) {
          emit({ type: "step", ...base, status: "skipped", summary: "You declined this action" });
          results.set(tu.id, { type: "tool_result", tool_use_id: tu.id, content: "The student declined this action. Do not retry it." });
          return;
        }
      }

      emit({ type: "step", ...base, status: "running" });
      const started = Date.now();
      try {
        const out = await def.run(tu.input ?? {});
        const wait = MIN_STEP_MS - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        emit({ type: "step", ...base, status: "done", summary: out.summary, source: out.source });
        if (out.artifact) emit({ type: "artifact", artifact: out.artifact });
        results.set(tu.id, { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out.data).slice(0, 12000) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emit({ type: "step", ...base, status: "error", summary: msg.slice(0, 160) });
        results.set(tu.id, { type: "tool_result", tool_use_id: tu.id, content: `Tool failed: ${msg}`, is_error: true });
      }
    };

    // Plan first so it renders before the steps it describes.
    const plan = ungated.filter((t) => t.name === "create_plan");
    for (const t of plan) await runOne(t);
    await Promise.all(ungated.filter((t) => t.name !== "create_plan").map(runOne));
    for (const t of gated) await runOne(t);

    emit({ type: "status", text: "Analysing results" });
    // All results go back in one user message, in the original order.
    messages.push({ role: "user", content: toolUses.map((t) => results.get(t.id)!) });
  }

  emit({ type: "error", message: "Stopped after too many steps." });
}
