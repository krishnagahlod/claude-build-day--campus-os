import fs from "fs";
import path from "path";

// Google Calendar, reusing Life Archive's OAuth client. Tokens come from
// Life Archive's Supabase when its service key is set, else from a local
// file written by CampusOS's own connect flow (gitignored).

type Tokens = { access_token: string; refresh_token?: string; expires_at?: number; email?: string };

const env = (k: string) => process.env[k]?.trim() || undefined;
const TOKEN_FILE = path.join(process.cwd(), ".data", "google-tokens.json");
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const redirectUri = (origin: string) => `${origin}/api/auth/google-calendar/callback`;

export function authUrl(origin: string) {
  const p = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID") ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env("GOOGLE_CLIENT_ID")!, client_secret: env("GOOGLE_CLIENT_SECRET")!, redirect_uri: redirectUri(origin), grant_type: "authorization_code" }),
  });
  const t = await res.json();
  if (!res.ok) throw new Error(t.error_description ?? t.error ?? "token exchange failed");
  const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
  saveLocal({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000, email: me.email });
  return me.email as string | undefined;
}

function saveLocal(t: Tokens) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t));
}

async function loadTokens(): Promise<{ tokens: Tokens; from: "campusos" | "lifearchive" } | null> {
  try { return { tokens: JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")), from: "campusos" }; } catch { /* none */ }
  const url = env("LIFEARCHIVE_SUPABASE_URL"), key = env("LIFEARCHIVE_SUPABASE_KEY");
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/planning_preferences?google_calendar_tokens=not.is.null&select=google_calendar_tokens,google_calendar_connected_email&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
  });
  const rows = res.ok ? await res.json() : [];
  const t = rows[0]?.google_calendar_tokens;
  return t?.access_token ? { tokens: { ...t, email: rows[0].google_calendar_connected_email }, from: "lifearchive" } : null;
}

async function accessToken(): Promise<string | null> {
  const loaded = await loadTokens();
  if (!loaded) return null;
  const t = loaded.tokens;
  if (t.expires_at && t.expires_at > Date.now() + 60_000) return t.access_token;
  if (!t.refresh_token) return t.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID")!, client_secret: env("GOOGLE_CLIENT_SECRET")!, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
  });
  const r = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${r.error}`);
  const fresh = { ...t, access_token: r.access_token, expires_at: Date.now() + (r.expires_in ?? 3600) * 1000 };
  if (loaded.from === "campusos") saveLocal(fresh);
  return fresh.access_token;
}

export async function googleStatus() {
  const loaded = await loadTokens().catch(() => null);
  return loaded ? { connected: true, email: loaded.tokens.email, via: loaded.from } : { connected: false };
}

export async function listEvents(days: number) {
  const token = await accessToken();
  if (!token) return null;
  const p = new URLSearchParams({ timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + days * 864e5).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "100" });
  const res = await fetch(`${API}?${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
  const j = await res.json();
  return (j.items ?? []).map((e: any) => ({ title: e.summary ?? "(busy)", start: e.start?.dateTime ?? e.start?.date, end: e.end?.dateTime ?? e.end?.date }));
}

export async function insertEvent(title: string, start: string, end: string, notes: string) {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: title, description: `${notes}\n\nScheduled by CampusOS`.trim(), start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() }, reminders: { useDefault: true } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const e = await res.json();
  return { id: e.id as string, link: e.htmlLink as string };
}
