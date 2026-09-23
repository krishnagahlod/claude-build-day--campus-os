// Pre-stage check: is every system the demo touches actually reachable right now?
// Usage: npm run preflight
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ok = (b) => (b ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m");
const get = async (url, init) => { try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) }); return r; } catch { return null; } };

const checks = [];
const campus = await get("http://localhost:3100/api/status");
checks.push(["CampusOS app (:3100)", !!campus?.ok, campus ? "" : "run `npm run demo`"]);
if (campus?.ok) {
  const s = await campus.json();
  if (s.demo) checks.push(["DEMO_MODE", false, "is on: every tool uses fixtures"]);
  for (const sys of s.systems) checks.push([sys.name, sys.live, sys.live ? sys.detail : "offline, will use demo data"]);
}
const web = await get("http://localhost:3200/");
checks.push(["InternPrep web (:3200)", !!web?.ok, web ? "log in once so practice links open directly" : "not running"]);
const claude = await get("https://api.anthropic.com/v1/models", { headers: { "x-api-key": env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" } });
checks.push(["Anthropic API key", !!claude?.ok, claude?.ok ? "" : `HTTP ${claude?.status ?? "unreachable"}`]);

console.log("\nCampusOS preflight\n");
for (const [name, pass, note] of checks) console.log(`  ${ok(pass)} ${name.padEnd(26)} ${note ?? ""}`);
const failed = checks.filter(([, p]) => !p).length;
console.log(failed ? `\n  ${failed} issue(s). Fix them, or set DEMO_MODE=true for a fully offline demo.\n` : "\n  All systems go.\n");
process.exit(failed ? 1 : 0);
