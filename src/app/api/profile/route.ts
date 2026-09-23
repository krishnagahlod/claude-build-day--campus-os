import { fetchProfile } from "@/lib/sources";
import { studentProfile } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = await fetchProfile().catch(() => null);
  return Response.json(p ? { name: p.full_name, college: p.college } : { name: studentProfile.name, college: studentProfile.university });
}
