import { exchangeCode } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response(`Google sign-in failed: ${url.searchParams.get("error") ?? "no code"}`, { status: 400 });
  try {
    await exchangeCode(code, url.origin);
    return Response.redirect(`${url.origin}/?calendar=connected`);
  } catch (e) {
    return new Response(`Google sign-in failed: ${e instanceof Error ? e.message : e}`, { status: 500 });
  }
}
