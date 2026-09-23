import { runAgent, type AgentEvent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams agent events as newline-delimited JSON.
export async function POST(req: Request) {
  const { goal } = (await req.json()) as { goal?: string };
  if (!goal?.trim()) return Response.json({ error: "goal is required" }, { status: 400 });

  const runId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(e) + "\n")); } catch { /* client gone */ }
      };
      emit({ type: "run", runId });
      try {
        await runAgent(goal.trim(), runId, emit, req.signal);
      } catch (e) {
        if (req.signal.aborted) return;
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
