// Starts everything the demo needs in one terminal: InternPrep API + web, then CampusOS.
// Usage: npm run demo   (Ctrl+C stops all three)
import { spawn } from "node:child_process";
import path from "node:path";

const INTERNPREP = process.env.INTERNPREP_DIR ?? "C:/Interview preparation platform";
const procs = [
  { name: "internprep-api", color: 35, cwd: path.join(INTERNPREP, "apps/api"), cmd: path.join(INTERNPREP, "apps/api/.venv/Scripts/python.exe"), args: ["-m", "uvicorn", "main:app", "--port", "8000"] },
  { name: "internprep-web", color: 34, cwd: path.join(INTERNPREP, "apps/web"), cmd: "npx", args: ["next", "dev", "-p", "3200"] },
  { name: "campusos", color: 33, cwd: process.cwd(), cmd: "npx", args: ["next", "dev", "-p", "3100"] },
];

const children = procs.map((p) => {
  const child = spawn(p.cmd, p.args, { cwd: p.cwd, shell: process.platform === "win32" && p.cmd === "npx", env: process.env });
  const tag = `\x1b[${p.color}m[${p.name}]\x1b[0m `;
  const pipe = (stream) => stream.on("data", (d) => d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => console.log(tag + l)));
  pipe(child.stdout); pipe(child.stderr);
  child.on("exit", (code) => console.log(`${tag}exited (${code})`));
  return child;
});

const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log("Starting InternPrep API :8000, InternPrep web :3200, CampusOS :3100. Run `npm run preflight` once they're up.");
