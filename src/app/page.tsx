"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Icon, appMeta } from "@/components/Icon";

type Step = {
  id: string; tool: string; app: string; risk: string; label: string;
  status: "running" | "done" | "error" | "awaiting" | "skipped";
  summary?: string; source?: string; input?: Record<string, unknown>;
};
type Artifact =
  | { kind: "event"; title: string; start: string; end: string; link: string }
  | { kind: "message"; channel: string; text: string; delivered: boolean }
  | { kind: "email"; to: string; subject: string; body: string }
  | { kind: "repo"; name: string; url: string; stars: number }
  | { kind: "fit"; role: string; score: number; tier?: string; wins: string[] }
  | { kind: "practice"; title: string; question: string; link: string };
type Plan = { goal: string; steps: { title: string; tool: string }[] };
type Final = { markdown: string; spoken: string };
type System = { id: string; name: string; stage: "find" | "prepare" | "perform"; detail: string; live: boolean };
type SavedRun = { id: string; goal: string; at: number; ms: number; plan: Plan | null; steps: Step[]; artifacts: Artifact[]; final: Final };

const WORKFLOWS = [
  { icon: "user", title: "Interview prep", text: "I have a strategy internship interview next week. Check my resume against the role and set up a mock interview.", flow: ["Opportunity OS", "InternPrep AI", "Calendar"] },
  { icon: "target", title: "Opportunities", text: "Find opportunities I should apply to this week, check my resume fit for the best one, and put the deadlines on my calendar.", flow: ["Opportunity OS", "InternPrep AI", "Telegram"] },
  { icon: "briefcase", title: "Case competition", text: "I have a case competition coming up. Help me prepare and block prep time.", flow: ["CaseForge", "Research (Tavily)", "Calendar"] },
  { icon: "zap", title: "Build Day copilot", text: "I want to build something impressive for Claude Build Day tonight. Plan it using what I've already built.", flow: ["GitHub", "Research (Tavily)", "Calendar"] },
];
const STAGES = [
  { id: "find", icon: "compass", title: "Find", text: "Surface what's worth your time, ranked by your own match scores." },
  { id: "prepare", icon: "book", title: "Prepare", text: "Score your resume, rehearse interviews, build on your case work." },
  { id: "perform", icon: "rocket", title: "Perform", text: "Block the time, nudge you on your phone, keep you on track." },
] as const;
const HISTORY_KEY = "campusos.history";

const fmtDuration = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const loadHistory = (): SavedRun[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; } };

export default function Home() {
  const [goal, setGoal] = useState("");
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [me, setMe] = useState<{ name: string; college: string }>({ name: "Krishna Gahlod", college: "IIT Bombay" });
  const [systems, setSystems] = useState<{ demo: boolean; calendarConnected: boolean; systems: System[] } | null>(null);
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [viewing, setViewing] = useState<SavedRun | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const recRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const autoApproveRef = useRef(false);
  const running = activeGoal !== null && !final && !error && !viewing;

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((p) => p?.name && setMe(p)).catch(() => {});
    fetch("/api/status").then((r) => r.json()).then(setSystems).catch(() => {});
    setHistory(loadHistory());
    try { setVoiceOn(localStorage.getItem("campusos.voice") !== "off"); } catch {}
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Save each completed run so it can be reopened later.
  useEffect(() => {
    if (!final || viewing || !activeGoal || !startedAt) return;
    const run: SavedRun = { id: runId ?? String(Date.now()), goal: activeGoal, at: startedAt, ms: (endedAt ?? Date.now()) - startedAt, plan, steps, artifacts, final };
    const next = [run, ...loadHistory().filter((h) => h.id !== run.id)].slice(0, 8);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    setHistory(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final]);

  useEffect(() => {
    document.title = viewing || activeGoal === null ? "CampusOS · Get it done"
      : error ? "Stopped · CampusOS"
      : final ? "✓ Done · CampusOS"
      : steps.some((s) => s.status === "awaiting") ? "● Needs your approval · CampusOS"
      : "Working… · CampusOS";
  }, [activeGoal, final, error, steps, viewing]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.03;
    const v = window.speechSynthesis.getVoices().find((v) => /Samantha|Google US English|Aria|Jenny/i.test(v.name));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  async function run(text: string) {
    const g = text.trim();
    if (!g || running) return;
    window.speechSynthesis?.cancel();
    autoApproveRef.current = false; runIdRef.current = null;
    setViewing(null); setActiveGoal(g); setPlan(null); setSteps([]); setArtifacts([]); setFinal(null); setError(null); setRunId(null);
    setStartedAt(Date.now()); setEndedAt(null); setNow(Date.now());
    setStatus("Understanding your goal");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: g }), signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(JSON.parse(line));
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus(null);
      setEndedAt(Date.now());
    }
  }

  function handle(e: any) {
    switch (e.type) {
      case "run": setRunId(e.runId); runIdRef.current = e.runId; break;
      case "status": setStatus(e.text); break;
      case "plan": setPlan({ goal: e.goal, steps: e.steps }); break;
      case "step":
        if (e.status === "awaiting" && autoApproveRef.current) { decide(e.id, true); break; }
        setSteps((prev) => {
          const i = prev.findIndex((s) => s.id === e.id);
          if (i === -1) return [...prev, e];
          const next = [...prev]; next[i] = { ...next[i], ...e }; return next;
        });
        break;
      case "artifact": setArtifacts((a) => [...a, e.artifact]); break;
      case "final":
        setEndedAt(Date.now());
        setFinal({ markdown: e.markdown, spoken: e.spoken });
        if (voiceOn) speak(e.spoken);
        break;
      case "error": setError(e.message); break;
    }
  }

  async function decide(stepId: string, approved: boolean) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status: approved ? "running" : "skipped" } : s)));
    await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: runIdRef.current, stepId, approved }) });
  }

  function approveAll(stepId: string) {
    autoApproveRef.current = true; // every later action in this run is approved automatically
    decide(stepId, true);
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input needs Chrome or Edge."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    let finalText = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t; else interim += t;
      }
      setGoal((finalText + interim).trim());
    };
    rec.onend = () => { setListening(false); if (finalText.trim()) run(finalText); };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function home() {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setViewing(null); setActiveGoal(null); setGoal(""); setPlan(null); setSteps([]); setArtifacts([]); setFinal(null); setError(null);
  }

  function stop() {
    abortRef.current?.abort();
    setError("Stopped. Nothing further will run.");
  }

  function openRun(r: SavedRun) {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setViewing(r); setActiveGoal(r.goal); setPlan(r.plan); setSteps(r.steps); setArtifacts(r.artifacts); setFinal(r.final); setError(null);
    setStartedAt(r.at); setEndedAt(r.at + r.ms);
  }

  function toggleVoice() {
    const next = !voiceOn; setVoiceOn(next);
    try { localStorage.setItem("campusos.voice", next ? "on" : "off"); } catch {}
    if (!next) window.speechSynthesis?.cancel();
  }

  async function copyBrief() {
    if (!final) return;
    try { await navigator.clipboard.writeText(final.markdown); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  // Plan item i is "done" once enough steps of its tool have completed.
  const doneByTool: Record<string, number> = {};
  steps.forEach((s) => { if (s.status === "done" || s.status === "skipped") doneByTool[s.tool] = (doneByTool[s.tool] ?? 0) + 1; });
  const seen: Record<string, number> = {};
  const planDone = plan?.steps.map((p) => {
    seen[p.tool] = (seen[p.tool] ?? 0) + 1;
    return !!final || (doneByTool[p.tool] ?? 0) >= seen[p.tool];
  });
  const awaitingStep = steps.find((s) => s.status === "awaiting") ?? null;
  const awaiting = !!awaitingStep;
  const elapsed = startedAt ? (endedAt ?? now) - startedAt : 0;
  const liveCount = systems?.systems.filter((s) => s.live).length ?? 0;
  const usedApps = Array.from(new Map(steps.filter((s) => s.status === "done").map((s) => [appMeta(s.app).short, appMeta(s.app).color])));

  const pill = viewing ? { cls: "done", icon: "history", text: `Saved run · ${new Date(viewing.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` }
    : error ? { cls: "err", icon: "x", text: error.startsWith("Stopped") ? "Stopped" : "Something went wrong" }
    : final ? { cls: "done", icon: "check", text: `Done in ${fmtDuration(elapsed)}` }
    : awaiting ? { cls: "wait", icon: "hand", text: "Needs your approval" }
    : { cls: "run", icon: "clock", text: `Working · ${fmtDuration(elapsed)}` };

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={home} aria-label="CampusOS home"><span className="logo" /> CampusOS</button>
          <div className="top-actions">
            {systems && !systems.calendarConnected && (
              <a className="chip-btn" href="/api/auth/google-calendar/connect"><Icon name="calendar" size={14} /> Connect Google Calendar</a>
            )}
            {systems && (
              <span className={`chip-btn static ${systems.demo ? "demo" : ""}`} title={systems.systems.map((s) => `${s.name}: ${s.live ? "live" : "offline"}`).join("\n")}>
                <span className={`dot ${liveCount === systems.systems.length && !systems.demo ? "" : "amber"}`} />
                {systems.demo ? "Demo mode" : `${liveCount}/${systems.systems.length} systems live`}
              </span>
            )}
            <button className="chip-btn icon-only" onClick={toggleVoice} title={voiceOn ? "Spoken summary on" : "Spoken summary off"} aria-label="Toggle spoken summary">
              <Icon name={voiceOn ? "volume" : "mute"} size={15} />
            </button>
            <div className="profile-pill"><span className="avatar">{me.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span><span className="profile-name">{me.name}</span></div>
          </div>
        </div>
      </header>

      <main className="shell">
        {activeGoal === null ? (
          <>
            <section className="hero">
              <div className="eyebrow"><Icon name="sparkles" size={13} /> Your AI execution layer for college</div>
              <h1 className="title">What do you want to <em>get done?</em></h1>
              <p className="subtitle">Give CampusOS an outcome, not a prompt. It plans the work across Opportunity OS, InternPrep AI and CaseForge, acts with your approval, and reports back.</p>
              <Composer goal={goal} setGoal={setGoal} onRun={() => run(goal)} onMic={toggleMic} listening={listening} disabled={running} />
            </section>

            <section className="section">
              <div className="section-h"><h2>Start with an outcome</h2><span>One click runs the whole workflow</span></div>
              <div className="workflows">
                {WORKFLOWS.map((w) => (
                  <button key={w.title} className="wf" onClick={() => { setGoal(w.text); run(w.text); }}>
                    <div className="wf-top">
                      <span className="wf-icon"><Icon name={w.icon} size={18} /></span>
                      <Icon name="arrow" size={16} className="wf-go" />
                    </div>
                    <div className="wf-title">{w.title}</div>
                    <div className="wf-text">{w.text}</div>
                    <div className="wf-flow">
                      {w.flow.map((a, i) => (
                        <span key={a} className="flow-step">
                          {i > 0 && <span className="flow-sep">→</span>}
                          <span className="flow-dot" style={{ background: appMeta(a).color }} />{appMeta(a).short}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-h"><h2>One loop across your products</h2><span>Every step shows which product did the work</span></div>
              <div className="stages">
                {STAGES.map((st, i) => (
                  <div key={st.id} className="stage">
                    <div className="stage-h">
                      <span className="stage-icon"><Icon name={st.icon} size={17} /></span>
                      <span className="stage-n">0{i + 1}</span>
                      <span className="stage-title">{st.title}</span>
                    </div>
                    <p className="stage-text">{st.text}</p>
                    <ul className="stage-systems">
                      {(systems?.systems ?? []).filter((s) => s.stage === st.id).map((s) => (
                        <li key={s.id}>
                          <span className={`dot ${s.live ? "" : "off"}`} />
                          <span className="sys-name">{s.name}</span>
                          <span className="sys-detail">{s.detail}</span>
                        </li>
                      ))}
                      {!systems && <li><span className="skel" style={{ width: "70%" }} /></li>}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {history.length > 0 && (
              <section className="section">
                <div className="section-h"><h2>Recent</h2><span>Reopen a previous run</span></div>
                <div className="recent">
                  {history.map((h) => (
                    <button key={h.id} className="recent-row" onClick={() => openRun(h)}>
                      <Icon name="history" size={15} className="muted-ic" />
                      <span className="recent-goal">{h.final.markdown.match(/^##\s*(.+)$/m)?.[1] ?? h.goal}</span>
                      <span className="recent-meta">{h.steps.filter((s) => s.status === "done").length} actions · {fmtDuration(h.ms)} · {new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="goalbar">
              <div className="q"><small>Your outcome</small>{activeGoal}</div>
              <div className="goalbar-actions">
                <span className={`run-pill ${pill.cls}`}><Icon name={pill.icon} size={13} />{pill.text}</span>
                {running
                  ? <button className="ghost-btn" onClick={stop}><Icon name="stop" size={13} /> Stop</button>
                  : <button className="ghost-btn" onClick={home}>New outcome</button>}
              </div>
            </div>

            <PlanBar plan={plan} planDone={planDone} final={!!final} />

            <div className="grid">
              <div>
                <div className="card">
                  <div className="card-h"><span>Live execution</span><span>{steps.filter((s) => s.status === "done").length} actions</span></div>
                  <div className="timeline">
                    {steps.map((s) => <StepRow key={s.id} s={s} />)}
                    {running && status && !awaitingStep && <div className="thinking"><span className="spinner" /><span className="shimmer">{status}…</span></div>}
                    {!running && steps.length === 0 && !error && <div className="placeholder">No actions recorded.</div>}
                  </div>
                  {error && !error.startsWith("Stopped") && <div className="error-banner"><Icon name="x" size={14} /> {error}</div>}
                </div>
              </div>

              <div>
                {artifacts.length > 0 && (
                  <div className="card outcomes">
                    <div className="card-h"><span>What got done</span>
                      {artifacts.some((x) => x.kind === "event") && <button className="chip-btn small" onClick={() => downloadIcs(artifacts)}><Icon name="download" size={12} /> .ics</button>}
                    </div>
                    <OutcomeSummary artifacts={artifacts} />
                    <div className="artifacts">{artifacts.map((a, i) => <ArtifactRow key={i} a={a} />)}</div>
                  </div>
                )}

                <div className="card">
                  <div className="card-h">
                    <span>Brief</span>
                    {final && (
                      <div className="card-actions">
                        <button className="chip-btn small" onClick={() => speak(final.spoken)}><Icon name="play" size={12} /> Listen</button>
                        <button className="chip-btn small" onClick={copyBrief}><Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}</button>
                      </div>
                    )}
                  </div>
                  {final ? (
                    <>
                      <div className="result"><ReactMarkdown components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{final.markdown}</ReactMarkdown></div>
                      {usedApps.length > 0 && (
                        <div className="sources">
                          <span>Built from</span>
                          {usedApps.map(([name, color]) => <span key={name} className="src-chip"><span className="flow-dot" style={{ background: color }} />{name}</span>)}
                        </div>
                      )}
                    </>
                  ) : running ? (
                    <div className="working">
                      <div className="working-orb"><span /></div>
                      <div>
                        <div className="working-t">{awaitingStep ? "Waiting for your approval" : status ?? "Working"}</div>
                        <div className="working-s">
                          {usedApps.length > 0 ? <>So far: {usedApps.map(([n]) => n).join(", ")}. </> : null}
                          Your brief lands here when every step is done.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="placeholder">No brief for this run.</div>
                  )}
                </div>
              </div>
            </div>

            {awaitingStep && !viewing && <ApprovalDock step={awaitingStep} onDecide={decide} onApproveAll={approveAll} />}
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span><span className="logo small" /> CampusOS</span>
          <span className="footer-note"><Icon name="shield" size={13} /> Calendar events and messages always wait for your approval</span>
          <span className="footer-note">Powered by Claude</span>
        </div>
      </footer>
    </div>
  );
}

function Composer({ goal, setGoal, onRun, onMic, listening, disabled }: { goal: string; setGoal: (s: string) => void; onRun: () => void; onMic: () => void; listening: boolean; disabled: boolean }) {
  return (
    <div className="composer">
      <textarea
        value={goal}
        rows={2}
        placeholder={listening ? "Listening…" : "e.g. I have a strategy interview next week. Get me ready."}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onRun(); } }}
        autoFocus
        aria-label="Describe the outcome you want"
      />
      <div className="composer-row">
        <span className="hint"><kbd>Enter</kbd> to run · or tap the mic and just say it</span>
        <div className="actions">
          <button className={`icon-btn ${listening ? "live" : ""}`} onClick={onMic} aria-label="Voice input" title="Voice input">
            <Icon name="mic" size={18} />
          </button>
          <button className="run-btn" onClick={onRun} disabled={disabled || !goal.trim()}>
            Get it done <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ s }: { s: Step }) {
  const meta = appMeta(s.app);
  const status = s.status === "running" ? <span className="spinner" />
    : s.status === "done" ? <Icon name="check" size={14} />
    : s.status === "error" ? <Icon name="x" size={14} />
    : s.status === "awaiting" ? <Icon name="hand" size={14} />
    : <Icon name="minus" size={14} />;
  return (
    <div className={`step ${s.status}`}>
      <div className={`status ${s.status}`}>{status}</div>
      <div className="step-body">
        <div className="step-label">{s.label}</div>
        <div className="step-meta">
          <span className="app-badge" style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}14` }}>
            <Icon name={meta.icon} size={11} /> {meta.short}
          </span>
          {s.status === "awaiting" && <span className="tag execute">waiting for your approval</span>}
          {s.source && <span className={`tag ${s.source}`}>{s.source === "live" ? "live" : "demo data"}</span>}
          {s.summary && <span className="step-summary">{s.summary}</span>}
        </div>
      </div>
    </div>
  );
}

function PlanBar({ plan, planDone, final }: { plan: Plan | null; planDone?: boolean[]; final: boolean }) {
  const [open, setOpen] = useState(false);
  if (!plan) return <div className="planbar"><div className="planbar-row"><span className="planbar-label">Plan</span><span className="shimmer">Building your plan…</span></div><div className="progress"><span style={{ width: "4%" }} /></div></div>;
  const done = planDone?.filter(Boolean).length ?? 0;
  const current = plan.steps.findIndex((_, i) => !planDone?.[i]);
  return (
    <div className="planbar">
      <button className="planbar-row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="planbar-label">Plan</span>
        <span className="planbar-goal">{plan.goal}</span>
        <span className="planbar-now">{final || current === -1 ? "All steps complete" : <>Step {current + 1} of {plan.steps.length} · {plan.steps[current].title}</>}</span>
        <span className="planbar-toggle">{open ? "Hide steps" : "All steps"}</span>
      </button>
      <div className="progress"><span style={{ width: `${Math.max(4, (done / plan.steps.length) * 100)}%` }} /></div>
      {open && (
        <ol className="planbar-list">
          {plan.steps.map((p, i) => (
            <li key={i} className={planDone?.[i] ? "done" : i === current ? "now" : ""}>
              <span className="pc">{planDone?.[i] ? <Icon name="check" size={11} /> : i + 1}</span>{p.title}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function OutcomeSummary({ artifacts }: { artifacts: Artifact[] }) {
  const events = artifacts.filter((a) => a.kind === "event").length;
  const fits = artifacts.filter((a): a is Extract<Artifact, { kind: "fit" }> => a.kind === "fit");
  const mocks = artifacts.filter((a) => a.kind === "practice").length;
  const msgs = artifacts.filter((a) => a.kind === "message").length;
  const chips = [
    events ? { icon: "calendar", color: appMeta("Calendar").color, text: `${events} session${events > 1 ? "s" : ""} booked` } : null,
    fits.length ? { icon: "file", color: appMeta("InternPrep AI").color, text: `Resume fit ${fits.map((f) => f.score).join(" / ")}` } : null,
    mocks ? { icon: "mic", color: appMeta("InternPrep AI").color, text: `${mocks} mock interview${mocks > 1 ? "s" : ""} ready` } : null,
    msgs ? { icon: "send", color: appMeta("Telegram").color, text: "Recap sent" } : null,
  ].filter((c): c is { icon: string; color: string; text: string } => !!c);
  if (!chips.length) return null;
  return (
    <div className="outcome-chips">
      {chips.map((c) => <span key={c.text} className="outcome-chip" style={{ color: c.color, borderColor: `${c.color}44`, background: `${c.color}12` }}><Icon name={c.icon} size={13} />{c.text}</span>)}
    </div>
  );
}

function ApprovalDock({ step, onDecide, onApproveAll }: { step: Step; onDecide: (id: string, ok: boolean) => void; onApproveAll: (id: string) => void }) {
  const i = step.input ?? {};
  const meta = appMeta(step.app);
  const fmt = (x: unknown, o: Intl.DateTimeFormatOptions) => { const d = new Date(String(x)); return isNaN(+d) ? String(x ?? "") : d.toLocaleString("en-US", o); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "Enter") { e.preventDefault(); onDecide(step.id, true); }
      if (e.key === "Escape") onDecide(step.id, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step.id, onDecide]);
  return (
    <>
    <div className="dock-spacer" />
    <div className="dock-wrap" role="dialog" aria-label="Approval needed">
      <div className="dock" key={step.id}>
        <div className="dock-head">
          <span className="dock-icon" style={{ color: meta.color, background: `${meta.color}18`, borderColor: `${meta.color}44` }}><Icon name={meta.icon} size={16} /></span>
          <div className="dock-titles">
            <div className="dock-kicker"><Icon name="shield" size={12} /> {step.tool === "send_telegram" ? "CampusOS wants to message you on Telegram" : `CampusOS wants to add this to your ${meta.short}`}</div>
            {step.tool === "create_calendar_event" && <div className="dock-title">{String(i.title ?? "")}</div>}
          </div>
        </div>
        {step.tool === "create_calendar_event" ? (
          <div className="dock-body">
            <div className="dock-when"><Icon name="clock" size={13} /> {fmt(i.start, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} – {fmt(i.end, { hour: "numeric", minute: "2-digit" })}</div>
            {i.notes ? <p className="dock-notes">{String(i.notes)}</p> : null}
          </div>
        ) : step.tool === "send_telegram" ? (
          <div className="dock-body"><div className="bubble">{String(i.message ?? "")}</div></div>
        ) : (
          <div className="dock-body"><pre className="dock-notes">{JSON.stringify(i, null, 2)}</pre></div>
        )}
        <div className="dock-actions">
          <button className="approve" onClick={() => onDecide(step.id, true)}><Icon name="check" size={14} /> Approve <kbd className="kbd-dark">↵</kbd></button>
          <button className="skip" onClick={() => onDecide(step.id, false)}>Skip <kbd>Esc</kbd></button>
          <button className="linkish" onClick={() => onApproveAll(step.id)}>Approve all for this run</button>
        </div>
      </div>
    </div>
    </>
  );
}

// One .ics with every event from this run: works with Google, Apple and Outlook calendars.
function downloadIcs(artifacts: Artifact[]) {
  const stamp = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const events = artifacts.filter((a): a is Extract<Artifact, { kind: "event" }> => a.kind === "event");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CampusOS//EN", "CALSCALE:GREGORIAN"];
  events.forEach((e, i) => lines.push("BEGIN:VEVENT", `UID:campusos-${Date.now()}-${i}@campusos`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${esc(e.title)}`, "DESCRIPTION:Scheduled by CampusOS", "END:VEVENT"));
  lines.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "campusos-plan.ics" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function ArtifactRow({ a }: { a: Artifact }) {
  if (a.kind === "event") {
    const d = new Date(a.start);
    const google = !a.link.includes("/render?");
    return (
      <div className="artifact">
        <div className="a-ic" style={{ color: appMeta("Calendar").color }}><Icon name="calendar" size={18} /></div>
        <div>
          <div className="a-t">{a.title}</div>
          <div className="a-s">{d.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} → {new Date(a.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
          <a href={a.link} target="_blank" rel="noreferrer" className="a-link">{google ? "Open in Google Calendar" : "Add to Google Calendar"} <Icon name="external" size={11} /></a>
        </div>
      </div>
    );
  }
  if (a.kind === "message") {
    return (
      <div className="artifact">
        <div className="a-ic" style={{ color: appMeta("Telegram").color }}><Icon name="send" size={18} /></div>
        <div><div className="a-t">{a.channel} · {a.delivered ? "delivered" : "simulated"}</div><div className="a-s">{a.text}</div></div>
      </div>
    );
  }
  if (a.kind === "email") {
    return (
      <div className="artifact">
        <div className="a-ic"><Icon name="mail" size={18} /></div>
        <div><div className="a-t">Draft: {a.subject}</div><div className="a-s">To {a.to}{"\n\n"}{a.body}</div></div>
      </div>
    );
  }
  if (a.kind === "fit") {
    const color = a.score >= 75 ? "var(--ok)" : a.score >= 60 ? "var(--warn)" : "var(--err)";
    return (
      <div className="artifact">
        <div className="score-ring" style={{ borderColor: color, color }}>{a.score}</div>
        <div>
          <div className="a-t">Resume fit · {a.role}</div>
          <div className="a-s">{a.tier ? `InternPrep ATS · ${a.tier}` : "InternPrep ATS"}</div>
          {a.wins.length > 0 && <ul className="wins">{a.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      </div>
    );
  }
  if (a.kind === "practice") {
    return (
      <div className="artifact">
        <div className="a-ic" style={{ color: appMeta("InternPrep AI").color }}><Icon name="mic" size={18} /></div>
        <div>
          <div className="a-t">{a.title}</div>
          <div className="a-s clamp">“{a.question}{a.question.length >= 400 ? "…" : ""}”</div>
          <a href={a.link} target="_blank" rel="noreferrer" className="a-link">Start practising in InternPrep AI <Icon name="external" size={11} /></a>
        </div>
      </div>
    );
  }
  return (
    <div className="artifact"><div className="a-ic"><Icon name="github" size={18} /></div><div><div className="a-t">{a.name}</div><a href={a.url} target="_blank" rel="noreferrer" className="a-link">{a.url}</a></div></div>
  );
}
