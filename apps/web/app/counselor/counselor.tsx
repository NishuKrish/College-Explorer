"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, BookOpen, Compass, MapPin, PenLine, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { components } from "@/types/api.gen";
import "./counselor.css";

type Response = components["schemas"]["CounselorResponse"];
type Status = components["schemas"]["CounselorStatus"];
type Message = components["schemas"]["ChatMessage"] & { result?: Response };
const modes = [
  { id: "plan", label: "College fit", icon: Compass, title: "Your next chapter, together.", prompt: "Help me figure out what I want in a college.", note: "Explore your interests, then build a shortlist with school data." },
  { id: "essay", label: "Essay studio", icon: PenLine, title: "Your story. Your voice.", prompt: "Review my draft for clarity, structure, and authentic voice.", note: "Get specific feedback and revision ideas. Your experiences stay yours." },
  { id: "visits", label: "Campus visits", icon: MapPin, title: "Get a feel for your future.", prompt: "Help me plan what to ask and notice on a campus visit.", note: "Prepare questions and a visit checklist. Confirm schedules with each college." },
] as const;
type Mode = typeof modes[number]["id"];

export function Counselor() {
  const [mode, setMode] = useState<Mode>("plan");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [essay, setEssay] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const selected = modes.find(m => m.id === mode)!;
  useEffect(() => {
    const abort = new AbortController();
    apiFetch<Status>("/counselor/status", { signal: abort.signal }).then(setStatus).catch(() => { if (!abort.signal.aborted) setError("Could not connect. Please refresh to try again."); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);
  function reset(next = mode) {
    controller.current?.abort(); controller.current = null;
    setMode(next); setMessages([]); setInput(""); setEssay(""); setError(""); setBusy(false);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || !consent || busy || !status?.available) return;
    const next: Message[] = [...messages, { role: "user", content }];
    if (next.length > 9 || next.reduce((sum, m) => sum + m.content.length, 0) > 12000) {
      setError("This conversation is full. Start a new chat to continue."); return;
    }
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError("");
    try {
      const result = await apiFetch<Response>("/counselor/chat", { method: "POST", signal: abort.signal,
        body: { messages: next.map(({ role, content }) => ({ role, content })), mode, essay: mode === "essay" ? essay : "", consent: true } });
      if (abort.signal.aborted) return;
      setMessages([...next, { role: "assistant", content: result.reply, result }]); setInput("");
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not send. Please try again.");
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <main className="counselor-page">
    <div className="counselor-heading"><div><p className="counselor-eyebrow">THE NEXT CHAPTER</p><h1>A little direction.<br /><em>A lot of possibility.</em></h1></div><div className="counselor-heading-note"><span className="counselor-status-dot" />AI college counselor<p>Think it through. Make it yours.</p></div></div>
    <div className="counselor-workspace">
      <aside className="counselor-sidebar"><p className="counselor-label">WHERE SHALL WE START?</p><div className="counselor-modes">{modes.map(({id, label, icon: Icon}) => <button key={id} onClick={() => reset(id)} aria-pressed={mode === id}><Icon size={20}/>{label}<span>↗</span></button>)}</div>
        <div className="counselor-margin-note"><BookOpen size={24}/><h2>A thinking partner.</h2><p>{selected.note}</p><p>School facts come from our 92-school snapshot. AI can make mistakes; verify details with each college.</p></div>
        <div className="counselor-attribution">Inspired by <a href="https://github.com/chiv-heng/college-navigator-plugin" target="_blank" rel="noreferrer">College Navigator ↗</a><br/><a href="https://github.com/NishuKrish/College-Explorer" target="_blank" rel="noreferrer">Open source · AGPL-3.0 ↗</a></div>
      </aside>
      <section className="counselor-chat" aria-label={selected.label}>
        <div className="counselor-chat-header"><span>{selected.label}<small>GPT-OSS · via Groq</small></span><button onClick={() => reset()}><RotateCcw size={15}/> New chat</button></div>
        <div className="counselor-transcript" role="log" aria-label="Conversation" aria-live="polite">
          {!messages.length && <div className="counselor-welcome"><span className="counselor-welcome-mark"><selected.icon size={30} strokeWidth={1.4}/></span><h2>{selected.title}</h2><p>{mode === "essay" ? "Add a draft below, then tell me what you want to work on." : "No perfect answers needed. We’ll take it one step at a time."}</p><button className="counselor-starter" onClick={() => setInput(selected.prompt)}>{selected.prompt}<ArrowUp size={17}/></button></div>}
          {messages.map((message, index) => <article key={index} className={`counselor-message counselor-message-${message.role}`}><p className="counselor-message-label">{message.role === "user" ? "YOU" : "YOUR COUNSELOR"}</p><div className="counselor-message-content">{message.content}</div>{!!message.result?.sources.length && <div className="counselor-sources"><p>School sources</p>{message.result.sources.map(source => /^\/schools\/\d+$/.test(source.url) ? <Link key={source.id} href={source.url} title={source.detail}>[{source.id}] {source.title} ↗</Link> : <span key={source.id}>{source.title}</span>)}</div>}</article>)}
          {busy && <p className="counselor-thinking" role="status">Thinking it through<span>…</span></p>}<div ref={end}/>
        </div>
        <form className="counselor-compose" onSubmit={send}>
          {mode === "essay" && <details className="counselor-draft" open={!messages.length}><summary>Your essay draft <span>{essay.length.toLocaleString()} / 8,000 characters</span></summary><textarea aria-label="Essay draft" maxLength={8000} value={essay} onChange={e => setEssay(e.target.value)} placeholder="Paste a draft without your name or identifying details." disabled={busy}/></details>}
          {status && !status.available && <p role="status" className="counselor-error">The counselor is not connected yet. <Link href="/search">Explore schools</Link> while we get ready.</p>}
          {error && <p className="counselor-error" role="alert">{error}</p>}
          <div className="counselor-input-wrap"><textarea aria-label="Message your counselor" placeholder={mode === "essay" ? "What would you like feedback on?" : "What’s on your mind?"} value={input} maxLength={4000} onChange={e => setInput(e.target.value)} disabled={busy}/><button type="submit" aria-label="Send message" disabled={!input.trim() || !consent || busy || !status?.available}><ArrowUp size={22}/></button></div>
          <label className="counselor-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>I agree to send my messages and draft to Groq. Dream Campus does not save chats. <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noreferrer">Provider privacy ↗</a></span></label>
          <p className="counselor-fine-print">Skip identifying or sensitive details. General planning support, not professional admissions or financial advice.</p>
        </form>
      </section>
    </div>
  </main>;
}
