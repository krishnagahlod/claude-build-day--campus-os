import { approvals } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { runId, stepId, approved } = (await req.json()) as { runId: string; stepId: string; approved: boolean };
  const key = `${runId}:${stepId}`;
  const resolve = approvals.get(key);
  if (!resolve) return Response.json({ ok: false, error: "No pending approval" }, { status: 404 });
  approvals.delete(key);
  resolve(Boolean(approved));
  return Response.json({ ok: true });
}
