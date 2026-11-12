"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpRight, Bookmark, MapPin, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useSchoolActionState } from "@/lib/school-actions";
import type { SchoolSearchCard, SchoolSearchResponse } from "@/types/api";
import coordinates from "@/data/campus-coordinates.json";
import "./campuses.css";
const CampusMap = dynamic(() => import("./campus-map"),{ssr:false,loading:()=> <p role="status">Loading campus map…</p>});
export type Campus = SchoolSearchCard & {lat:number;lng:number};
export function CampusExplorer() {
  const [schools,setSchools] = useState<SchoolSearchCard[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [query,setQuery] = useState("");
  const [onlySaved,setOnlySaved] = useState(false);
  const [showMap,setShowMap] = useState(false);
  const [selected,setSelected] = useState<number|null>(null);
  const {savedIds,toggleSaved} = useSchoolActionState();
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    const abort = new AbortController();setLoading(true);setError("");
    async function load() {
      try {
        const first = await apiFetch<SchoolSearchResponse>("/schools/search?page_size=50&page=1",{signal:abort.signal});
        const pages = Math.ceil(first.total_results/50);
        const rest = await Promise.all(Array.from({length:Math.max(0,pages-1)},(_,i)=> apiFetch<SchoolSearchResponse>(`/schools/search?page_size=50&page=${i+2}`,{signal:abort.signal})));
        if (!abort.signal.aborted) setSchools([...first.results,...rest.flatMap(p=>p.results)]);
      } catch {if(!abort.signal.aborted)setError("Could not load college data. Please try again.");}
      finally{if(!abort.signal.aborted)setLoading(false);}
    } load();return()=>abort.abort();
  },[retry]);
  const campuses = useMemo(()=>schools.flatMap(school=>{
    const point=coordinates.find(p=>p.name===school.name);
    return point ? [{...school,lat:point.lat,lng:point.lng}] : [];
  }),[schools]);
  const filtered = useMemo(()=>{
    const aliases:Record<string,string>={ucla:"los angeles",usc:"southern california",mit:"massachusetts institute of technology","uc berkeley":"berkeley"};
    const term=aliases[query.toLowerCase().trim()] ?? query.toLowerCase().trim();
    return campuses.filter(s=>(!onlySaved || savedIds.has(s.school_id)) && `${s.name} ${s.city} ${s.state}`.toLowerCase().includes(term));
  },[campuses,onlySaved,savedIds,query]);
  const active = filtered.find(s=>s.school_id===selected);
  return <main className="campus-page"><header className="campus-heading"><div><p>PUT YOUR FUTURE ON THE MAP</p><h1>Find your place.</h1><span>Explore campuses. Picture the possibilities.</span></div><Link href="/planner">Plan a campus visit <ArrowUpRight size={17}/></Link></header>
    <div className="campus-filters"><label><Search size={17}/><input aria-label="Search campuses" placeholder="School, city, or state…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button aria-pressed={onlySaved} onClick={()=>setOnlySaved(!onlySaved)}><Bookmark size={15}/> My shortlist</button><span>{filtered.length} campuses</span></div>
    {error && <p role="alert" className="campus-error">{error} <button onClick={()=>setRetry(retry+1)}>Retry</button></p>}
    {loading ? <p role="status">Finding campuses…</p> : <div className="campus-layout"><section className="campus-map-panel" aria-label="Campus locations">{!showMap ? <div className="campus-map-cover"><MapPin size={45} strokeWidth={1.3}/><h2>A different view of your shortlist.</h2><p>Load an interactive map to explore campus locations. Map tiles are served by OpenStreetMap; your browser connects to that provider.</p><button onClick={()=>setShowMap(true)}>Load interactive map <ArrowUpRight size={17}/></button><small>The school list works without loading the map.</small></div> : <CampusMap campuses={filtered} selected={active?.school_id ?? null} onSelect={setSelected}/>}{active && <div className="campus-selection"><MapPin size={20}/><div><h2>{active.name}</h2><p>{active.city}, {active.state}</p></div><Link href={`/schools/${active.school_id}`}>View school ↗</Link></div>}</section>
      <section className="campus-list" aria-label="Campus list">{!filtered.length ? <div className="campus-no-results"><h2>No campuses here yet.</h2><p>{onlySaved ? "Save colleges from Explore schools, or show all campuses." : "Try another school, city, or state."}</p><Link href="/search">Explore schools ↗</Link></div> : filtered.map(s=><article key={s.school_id} className={selected===s.school_id?"campus-selected":""}><button className="campus-school-select" onClick={()=>{setSelected(s.school_id);}} aria-pressed={selected===s.school_id}><span><h2>{s.name}</h2><p>{s.city}, {s.state}</p></span><MapPin size={17}/></button><div><Link href={`/schools/${s.school_id}`}>School profile ↗</Link><button aria-label={`${savedIds.has(s.school_id)?"Unsave":"Save"} ${s.name}`} onClick={()=>toggleSaved(s)}><Bookmark size={15} fill={savedIds.has(s.school_id)?"currentColor":"none"}/>{savedIds.has(s.school_id)?"Saved":"Save"}</button></div></article>)}</section></div>}
    <p className="campus-data-note">Campus locations come from the college data snapshot. {schools.length-campuses.length > 0 ? `${schools.length-campuses.length} schools have no mapped coordinates. `:""}For visit times, accessibility, and meeting points, check the college’s official website.</p>
  </main>;
}
