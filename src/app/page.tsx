"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Step = {
  id: string; tool: string; app: string; risk: string; label: string;
  status: "running" | "done" | "error" | "awaiting" | "skipped";
  summary?: string; source?: string; input?: Record<string, unknown>;
};
type Artifact =
  | { kind: "event"; title: string; start: string; end: string; link: string }
  | { kind: "message"; channel: string; text: string; delivered: boolean }
  | { kind: "email"; to: string; subject: string; body: string }
  | { kind: "repo"; name: string; url: string; stars: number };
type Plan = { goal: string; steps: { title: string; tool: string }[] };

const WORKFLOWS = [
  { icon: "🏆", title: "Case competition", text: "I have a case competition this weekend. Help me prepare and block prep time." },
  { icon: "🎯", title: "Opportunities", text: "Find opportunities I should apply to this week, and put the deadlines on my calendar." },
  { icon: "⚡", title: "Build Day copilot", text: "I want to build something impressive for Claude Build Day tonight. Plan it using what I've already built." },
  { icon: "🗓️", title: "Plan my week", text: "I have a probability mid-sem, club work and a case competition. Plan my week around my calendar." },
];
const CONNECTED = ["InternPrep AI", "CaseForge", "Opportunity OS", "Calendar", "Telegram", "GitHub", "Tavily research"];

export default function Home() {
  const [goal, setGoal] = useState("");
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [final, setFinal] = useState<{ markdown: string; spoken: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const recRef = useRef<any>(null);
  const running = activeGoal !== null && !final && !error;

  useEffect(() => { try { setVoiceOn(localStorage.getItem("campusos.voice") !== "off"); } catch {} }, []);

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
    setActiveGoal(g); setPlan(null); setSteps([]); setArtifacts([]); setFinal(null); setError(null); setRunId(null);
    setStatus("Understanding your goal");
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: g }) });
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus(null);
    }
  }

  function handle(e: any) {
    switch (e.type) {
      case "run": setRunId(e.runId); break;
      case "status": setStatus(e.text); break;
      case "plan": setPlan({ goal: e.goal, steps: e.steps }); setStatus("Executing plan"); break;
      case "step":
        setSteps((prev) => {
          const i = prev.findIndex((s) => s.id === e.id);
          if (i === -1) return [...prev, e];
          const next = [...prev]; next[i] = { ...next[i], ...e }; return next;
        });
        if (e.status === "running") setStatus(null);
        break;
      case "artifact": setArtifacts((a) => [...a, e.artifact]); break;
      case "final":
        setFinal({ markdown: e.markdown, spoken: e.spoken });
        if (voiceOn) speak(e.spoken);
        break;
      case "error": setError(e.message); break;
    }
  }

  async function decide(stepId: string, approved: boolean) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status: approved ? "running" : "skipped" } : s)));
    await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, stepId, approved }) });
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

  function reset() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setActiveGoal(null); setGoal(""); setPlan(null); setSteps([]); setArtifacts([]); setFinal(null); setError(null);
  }

  function toggleVoice() {
    const next = !voiceOn; setVoiceOn(next);
    try { localStorage.setItem("campusos.voice", next ? "on" : "off"); } catch {}
    if (!next) window.speechSynthesis?.cancel();
  }

  // Plan item i is "done" once enough steps of its tool have completed.
  const doneByTool: Record<string, number> = {};
  steps.forEach((s) => { if (s.status === "done" || s.status === "skipped") doneByTool[s.tool] = (doneByTool[s.tool] ?? 0) + 1; });
  const seen: Record<string, number> = {};
  const planDone = plan?.steps.map((p) => {
    seen[p.tool] = (seen[p.tool] ?? 0) + 1;
    return !!final || (doneByTool[p.tool] ?? 0) >= seen[p.tool];
  });

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="CampusOS home"><span className="logo" /> CampusOS</button>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="speak-btn" onClick={toggleVoice} title="Spoken summary">{voiceOn ? "🔊 Voice on" : "🔇 Voice off"}</button>
          <div className="profile-pill"><span className="avatar">AM</span>Aarav · IIT Bombay</div>
        </div>
      </header>

      {activeGoal === null ? (
        <section className="hero">
          <div className="eyebrow"><span className="dot" /> 7 tools connected · Powered by Claude</div>
          <h1 className="title">What do you want to <em>get done?</em></h1>
          <p className="subtitle">Give CampusOS an outcome, not a prompt. It plans, pulls from your tools, takes action with your approval, and reports back.</p>

          <Composer goal={goal} setGoal={setGoal} onRun={() => run(goal)} onMic={toggleMic} listening={listening} disabled={running} />

          <div className="workflows">
            {WORKFLOWS.map((w) => (
              <button key={w.title} className="wf" onClick={() => { setGoal(w.text); run(w.text); }}>
                <div className="wf-icon">{w.icon}</div>
                <div className="wf-title">{w.title}</div>
                <div className="wf-text">{w.text}</div>
              </button>
            ))}
          </div>
          <div className="connected">{CONNECTED.map((c) => <span key={c} className="chip">{c}</span>)}</div>
        </section>
      ) : (
        <>
          <div className="goalbar">
            <div className="q"><small>Your outcome</small>{activeGoal}</div>
            <button className="ghost-btn" onClick={reset}>{running ? "Cancel" : "New goal"}</button>
          </div>

          <div className="grid">
            <div>
              <div className="card">
                <div className="card-h"><span>Plan</span>{plan && <span>{planDone?.filter(Boolean).length}/{plan.steps.length}</span>}</div>
                {plan ? (
                  <>
                    <div className="plan-goal">{plan.goal}</div>
                    <ul className="plan-list">
                      {plan.steps.map((p, i) => (
                        <li key={i} className={planDone?.[i] ? "done" : ""}><span className="pc">{planDone?.[i] ? "✓" : ""}</span>{p.title}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="placeholder"><div className="skel" style={{ width: "70%" }} /><div className="skel" style={{ width: "90%" }} /><div className="skel" style={{ width: "60%" }} /></div>
                )}
              </div>

              <div className="card">
                <div className="card-h"><span>Live execution</span><span>{steps.filter((s) => s.status === "done").length} actions</span></div>
                <div className="timeline">
                  {steps.map((s) => <StepRow key={s.id} s={s} onDecide={decide} />)}
                  {running && status && <div className="thinking"><span className="spinner" /><span className="shimmer">{status}…</span></div>}
                </div>
                {error && <div className="error-banner">⚠ {error}</div>}
              </div>
            </div>

            <div>
              <div className="card">
                <div className="card-h">
                  <span>Result</span>
                  {final && <button className="speak-btn" onClick={() => speak(final.spoken)}>▶ Play summary</button>}
                </div>
                {final ? (
                  <div className="result"><ReactMarkdown components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{final.markdown}</ReactMarkdown></div>
                ) : (
                  <div className="placeholder">
                    <span>{running ? "Working on it. Results land here." : "No result."}</span>
                    <div className="skel" style={{ width: "85%" }} /><div className="skel" style={{ width: "95%" }} /><div className="skel" style={{ width: "70%" }} /><div className="skel" style={{ width: "80%" }} />
                  </div>
                )}
              </div>

              {artifacts.length > 0 && (
                <div className="card">
                  <div className="card-h"><span>Actions taken</span><span>{artifacts.length}</span></div>
                  <div className="artifacts">{artifacts.map((a, i) => <ArtifactRow key={i} a={a} />)}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function Composer({ goal, setGoal, onRun, onMic, listening, disabled }: { goal: string; setGoal: (s: string) => void; onRun: () => void; onMic: () => void; listening: boolean; disabled: boolean }) {
  return (
    <div className="composer">
      <textarea
        value={goal}
        rows={2}
        placeholder={listening ? "Listening…" : "e.g. I have a case competition this weekend. Help me prepare."}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onRun(); } }}
        autoFocus
      />
      <div className="composer-row">
        <span className="hint">Press Enter to run · or tap the mic and just say it</span>
        <div className="actions">
          <button className={`icon-btn ${listening ? "live" : ""}`} onClick={onMic} aria-label="Voice input" title="Voice input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <button className="run-btn" onClick={onRun} disabled={disabled || !goal.trim()}>
            Get it done
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ s, onDecide }: { s: Step; onDecide: (id: string, ok: boolean) => void }) {
  const icon = s.status === "running" ? <span className="spinner" /> : s.status === "done" ? "✓" : s.status === "error" ? "!" : s.status === "awaiting" ? "✋" : "–";
  return (
    <div className={`step ${s.status}`}>
      <div className={`status ${s.status}`}>{icon}</div>
      <div>
        <div className="step-label">{s.label}</div>
        <div className="step-meta">
          <span className="tag app">{s.app}</span>
          {s.risk === "execute" && <span className="tag execute">needs approval</span>}
          {s.source && <span className={`tag ${s.source}`}>{s.source === "live" ? "live" : "demo data"}</span>}
          {s.summary && <span>{s.summary}</span>}
        </div>
        {s.status === "awaiting" && (
          <div className="approval">
            <pre>{formatInput(s)}</pre>
            <div className="approval-btns">
              <button className="approve" onClick={() => onDecide(s.id, true)}>Approve</button>
              <button className="skip" onClick={() => onDecide(s.id, false)}>Skip</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatInput(s: Step) {
  const i = s.input ?? {};
  if (s.tool === "send_telegram") return String(i.message ?? "");
  if (s.tool === "create_calendar_event") {
    const when = (x: unknown) => new Date(String(x)).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `${i.title}\n${when(i.start)} → ${new Date(String(i.end)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${i.notes ? `\n\n${i.notes}` : ""}`;
  }
  return JSON.stringify(i, null, 2);
}

function ArtifactRow({ a }: { a: Artifact }) {
  if (a.kind === "event") {
    const d = new Date(a.start);
    return (
      <div className="artifact">
        <div className="a-ic">📅</div>
        <div>
          <div className="a-t">{a.title}</div>
          <div className="a-s">{d.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} → {new Date(a.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
          <a href={a.link} target="_blank" rel="noreferrer">Add to Google Calendar →</a>
        </div>
      </div>
    );
  }
  if (a.kind === "message") {
    return (
      <div className="artifact">
        <div className="a-ic">✈️</div>
        <div><div className="a-t">{a.channel} {a.delivered ? "· delivered" : "· simulated"}</div><div className="a-s">{a.text}</div></div>
      </div>
    );
  }
  if (a.kind === "email") {
    return (
      <div className="artifact">
        <div className="a-ic">✉️</div>
        <div><div className="a-t">Draft: {a.subject}</div><div className="a-s">To {a.to}{"\n\n"}{a.body}</div></div>
      </div>
    );
  }
  return (
    <div className="artifact"><div className="a-ic">⭐</div><div><div className="a-t">{a.name}</div><a href={a.url} target="_blank" rel="noreferrer">{a.url}</a></div></div>
  );
}
