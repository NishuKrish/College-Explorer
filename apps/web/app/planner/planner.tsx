"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpRight, CalendarDays, Check, Download, ListChecks, Plus, X } from "lucide-react";
import { getVisibleSavedSchools, useSchoolActionState } from "@/lib/school-actions";
import { defaultPlan, parsePlanner, plannerKey, stages, dateLabel, type ApplicationPlan, type PlannerState, type ApplicationStage } from "@/lib/application-planner";
import "./planner.css";
const DeadlineCalendar = dynamic(() => import("./deadline-calendar"), { ssr: false, loading: () => <p>Loading calendar…</p> });
export function Planner() {
  const { savedSchools } = useSchoolActionState();
  const schools = getVisibleSavedSchools(savedSchools);
  const [plans, setPlans] = useState<PlannerState>({});
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"checklist" | "calendar">("checklist");
  const [error, setError] = useState("");
  useEffect(() => {
    function load() { try { setPlans(parsePlanner(localStorage.getItem(plannerKey))); } catch { setError("Browser storage is unavailable. Changes will last only for this session."); } setReady(true); }
    load();
    const sync = (event: StorageEvent) => { if (event.key === plannerKey || event.key === null) load(); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  function update(id: number, change: Partial<ApplicationPlan>) {
    const next = { ...plans, [id]: { ...(plans[id] ?? defaultPlan()), ...change } };
    setPlans(next);
    try { localStorage.setItem(plannerKey, JSON.stringify(next)); setError(""); }
    catch { setError("Could not save to this browser. Export a backup before leaving."); }
  }
  const events = useMemo(() => schools.flatMap(school => {
    const plan = plans[school.school_id];
    return [plan?.deadline ? { id: `deadline-${school.school_id}`, title: `${school.name} · Application due`, start: plan.deadline, allDay: true, color: "#005587", url: `#application-${school.school_id}` } : null,
      plan?.visitDate ? { id: `visit-${school.school_id}`, title: `${school.name} · Campus visit`, start: plan.visitDate, allDay: true, color: "#8a6b00", url: `#application-${school.school_id}` } : null].filter(event => event !== null);
  }), [schools, plans]);
  const upcoming = [...events].sort((a,b) => a.start.localeCompare(b.start));
  const completed = schools.filter(s => plans[s.school_id]?.stage === "Submitted" || plans[s.school_id]?.stage === "Decision received").length;
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), schools: schools.map(s => ({ school_id: s.school_id, name: s.name, plan: plans[s.school_id] ?? defaultPlan() })) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "dream-campus-applications.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="planning-page">
    <header className="planning-heading"><div><p className="planning-eyebrow">ONE STEP CLOSER</p><h1>Your next chapter,<br/><em>one task at a time.</em></h1><p>Keep your applications, deadlines, and visits together.</p></div><Link href="/campuses">Explore the campus map <ArrowUpRight size={17}/></Link></header>
    <div className="planning-stats"><div><strong>{schools.length.toString().padStart(2,"0")}</strong><span>schools on your list</span></div><div><strong>{completed.toString().padStart(2,"0")}</strong><span>applications submitted</span></div><div><strong>{events.length.toString().padStart(2,"0")}</strong><span>dates on your calendar</span></div></div>
    <div className="planning-toolbar"><div role="group" aria-label="Planner view"><button aria-pressed={view === "checklist"} onClick={() => setView("checklist")}><ListChecks size={17}/> Checklists</button><button aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarDays size={17}/> Calendar</button></div><button onClick={exportBackup} disabled={!ready || !schools.length}><Download size={16}/> Export backup</button></div>
    <p className="planning-storage-note">Saved in this browser only. Dates are entered by you—confirm them with each college. Clearing browser data removes your plans.</p>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {!ready ? <p role="status">Loading your planner…</p> : !schools.length ? <section className="planning-empty"><ListChecks size={34}/><h2>A fresh page for your plans.</h2><p>Save a college to start its application checklist.</p><Link href="/search">Find your first school <ArrowUpRight size={16}/></Link></section> : view === "calendar" ? <section className="planning-calendar"><DeadlineCalendar events={events} onSelect={id => { setView("checklist"); setTimeout(() => document.getElementById(`application-${id}`)?.scrollIntoView({ behavior: "smooth" }), 0); }}/>{!events.length && <p>Add an application deadline or campus visit in Checklists to see it here.</p>}<div className="planning-agenda"><h2>Your dates</h2>{upcoming.map(event => <button key={event.id} onClick={() => { setView("checklist"); setTimeout(() => document.getElementById(event.url.slice(1))?.scrollIntoView({ behavior: "smooth" }), 0); }}><span>{dateLabel(event.start)}</span>{event.title}<ArrowUpRight size={16}/></button>)}</div></section> : <div className="planning-cards">{schools.map((school,index) => <ApplicationCard key={school.school_id} id={school.school_id} name={school.name} location={`${school.city}, ${school.state}`} index={index} plan={plans[school.school_id] ?? defaultPlan()} onChange={change => update(school.school_id,change)}/>)}</div>}
  </main>;
}
function ApplicationCard({ id, name, location, index, plan, onChange }: { id: number; name: string; location: string; index: number; plan: ApplicationPlan; onChange: (change: Partial<ApplicationPlan>) => void }) {
  const [task, setTask] = useState(""); const done = plan.tasks.filter(t => t.done).length;
  return <section id={`application-${id}`} className="application-card"><header><span className="application-number">{String(index+1).padStart(2,"0")}</span><div><Link href={`/schools/${id}`}><h2>{name} ↗</h2></Link><p>{location}</p></div><span className="application-count">{done}/{plan.tasks.length}</span></header><progress aria-label={`${name} checklist progress`} max={plan.tasks.length || 1} value={done}/>
    <label className="application-stage">Application stage<select value={plan.stage} onChange={e => onChange({stage:e.target.value as ApplicationStage})}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label>
    <div className="application-dates"><label>Application deadline<input type="date" aria-label={`${name} application deadline`} value={plan.deadline} onChange={e => onChange({deadline:e.target.value})}/></label><label>Campus visit<input type="date" aria-label={`${name} campus visit`} value={plan.visitDate} onChange={e => onChange({visitDate:e.target.value})}/></label></div>
    <div className="application-tasks">{plan.tasks.map(t => <div key={t.id}><label><input type="checkbox" checked={t.done} onChange={() => onChange({tasks:plan.tasks.map(row => row.id === t.id ? {...row,done:!row.done}:row)})}/><span className={t.done ? "is-done" : ""}>{t.label}</span>{t.done && <Check size={13}/>}</label><button aria-label={`Remove ${t.label} task`} onClick={() => onChange({tasks:plan.tasks.filter(row => row.id !== t.id)})}><X size={13}/></button></div>)}</div>
    <form className="application-add-task" onSubmit={e => {e.preventDefault(); if (task.trim() && plan.tasks.length < 25) { onChange({tasks:[...plan.tasks,{id:crypto.randomUUID(),label:task.trim(),done:false}]}); setTask(""); } }}><input aria-label={`New task for ${name}`} maxLength={120} value={task} onChange={e => setTask(e.target.value)} placeholder={plan.tasks.length >= 25 ? "25-task limit reached" : "Add a task…"} disabled={plan.tasks.length >= 25}/><button aria-label={`Add task for ${name}`} disabled={!task.trim() || plan.tasks.length >= 25}><Plus size={18}/></button></form>
  </section>;
}
