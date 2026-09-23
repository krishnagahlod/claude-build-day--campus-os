import { authUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.redirect(authUrl(new URL(req.url).origin));
}
