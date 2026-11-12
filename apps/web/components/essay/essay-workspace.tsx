"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { diffWords } from "diff";
import { Bold, Italic, List, Save, Download, History } from "lucide-react";
import { getVisibleSavedSchools, useSchoolActionState } from "@/lib/school-actions";
import "./essay-workspace.css";
const storageKey = "dream-campus.essay-drafts.v1";
type Draft = { text: string; baseline: string; prompt: string; updated: string };
type Drafts = Record<string,Draft>;
function readDrafts(): Drafts {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return {};
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Drafts = {};
  for (const [id,item] of Object.entries(input).slice(0,100)) {
    if (!/^(general|\d+)$/.test(id) || !item || typeof item !== "object") continue;
    const draft = item as Draft;
    if (typeof draft.text !== "string" || draft.text.length > 8000 || typeof draft.baseline !== "string" || draft.baseline.length > 8000 || typeof draft.prompt !== "string" || draft.prompt.length > 1000 || typeof draft.updated !== "string") continue;
    out[id] = draft;
  }
  return out;
}
function documentFor(text: string) {
  return { type: "doc", content: text.split("\n").map(line => ({type:"paragraph",content:line ? [{type:"text",text:line}] : []})) };
}
export function EssayWorkspace({value,onChange,onContextChange,disabled}: {value:string;onChange:(text:string)=>void;onContextChange:(context:string)=>void;disabled:boolean}) {
  const { savedSchools } = useSchoolActionState();
  const schools = getVisibleSavedSchools(savedSchools);
  const [school,setSchool] = useState("general");
  const [prompt,setPrompt] = useState("");
  const [baseline,setBaseline] = useState("");
  const [compare,setCompare] = useState(false);
  const [wordLimit,setWordLimit] = useState(650);
  const [status,setStatus] = useState("");
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const editor = useEditor({
    extensions:[StarterKit.configure({link:false})], immediatelyRender:false, shouldRerenderOnTransaction:true,
    content:documentFor(value), editable:!disabled,
    editorProps:{attributes:{"aria-label":"Essay draft",role:"textbox","aria-multiline":"true",class:"essay-document"}},
    onUpdate:({editor}) => {
      const text = editor.getText({blockSeparator:"\n"});
      if (text.length > 8000) {editor.commands.setContent(documentFor(value), {emitUpdate:false});setStatus("Drafts are limited to 8,000 characters.");return;}
      onChange(text);setStatus("");
    },
  });
  useEffect(() => { if (editor && editor.getText({blockSeparator:"\n"}) !== value) editor.commands.setContent(documentFor(value), {emitUpdate:false}); }, [editor,value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor,disabled]);
  useEffect(() => {
    const name = schools.find(s => String(s.school_id) === school)?.name;
    onContextChange([name ? `Essay target: ${name}.` : "",prompt ? `Student-provided essay prompt (unverified): ${prompt}` : ""].filter(Boolean).join("\n"));
  }, [school,prompt,schools,onContextChange]);
  function save() {
    try {const drafts = readDrafts();drafts[school] = {text:value,baseline,prompt,updated:new Date().toISOString()};localStorage.setItem(storageKey,JSON.stringify(drafts));setStatus("Draft saved on this device. Formatting is saved as plain text.");}
    catch {setStatus("Could not save. Download your draft to keep a copy.");}
  }
  function load() {
    try {const draft = readDrafts()[school]; if (!draft) {setStatus("No saved draft for this selection.");return;} onChange(draft.text);setBaseline(draft.baseline);setPrompt(draft.prompt);setStatus("Saved draft loaded. Any unsaved text was replaced.");}
    catch {setStatus("Could not read saved drafts from this browser.");}
  }
  function remove() {
    try {const drafts = readDrafts();delete drafts[school];localStorage.setItem(storageKey,JSON.stringify(drafts));setStatus("Saved copy removed from this device. Your open draft is unchanged.");}
    catch {setStatus("Could not remove the saved copy.");}
  }
  function download() {
    const url = URL.createObjectURL(new Blob([value],{type:"text/plain;charset=utf-8"}));const a = document.createElement("a");a.href=url;a.download="dream-campus-essay.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const differences = compare ? diffWords(baseline,value) : [];
  return <section className="essay-workspace" aria-label="Essay workspace"><header><span>YOUR WRITING DESK</span><span className={words > wordLimit ? "essay-over-limit" : ""}>{words} / {wordLimit} words · {value.length.toLocaleString()} / 8,000 characters</span></header>
    <div className="essay-context"><label>Draft for<select aria-label="Essay school" disabled={disabled} value={school} onChange={e => {setSchool(e.target.value);setStatus("Selection changed. Load a saved draft or keep working on your current text.");}}><option value="general">General personal statement</option>{schools.map(s => <option key={s.school_id} value={s.school_id}>{s.name}</option>)}</select></label><label>Word target<input aria-label="Essay word target" type="number" min={1} max={2000} value={wordLimit} onChange={e => setWordLimit(Math.max(1,Math.min(2000,Number(e.target.value)||1)))}/></label></div>
    <label className="essay-prompt">Essay prompt <span>(optional, entered by you)</span><textarea aria-label="Essay prompt" placeholder="What is this essay asking you to share?" value={prompt} maxLength={1000} onChange={e => setPrompt(e.target.value)} disabled={disabled}/></label>
    <div className="essay-format" role="group" aria-label="Essay formatting"><button type="button" aria-label="Bold" aria-pressed={editor?.isActive("bold") ?? false} disabled={!editor || disabled} onClick={()=>editor?.chain().focus().toggleBold().run()}><Bold size={15}/></button><button type="button" aria-label="Italic" aria-pressed={editor?.isActive("italic") ?? false} disabled={!editor || disabled} onClick={()=>editor?.chain().focus().toggleItalic().run()}><Italic size={15}/></button><button type="button" aria-label="Bullet list" aria-pressed={editor?.isActive("bulletList") ?? false} disabled={!editor || disabled} onClick={()=>editor?.chain().focus().toggleBulletList().run()}><List size={16}/></button><span>Your words. Your voice.</span></div>
    <EditorContent editor={editor}/>
    <div className="essay-actions"><button type="button" disabled={disabled || !value} onClick={save}><Save size={14}/> Save on device</button><button type="button" disabled={disabled} onClick={load}>Load saved</button><button type="button" disabled={disabled || !value} onClick={download}><Download size={14}/> Download</button><button type="button" disabled={disabled} onClick={remove}>Delete saved copy</button></div>
    <div className="essay-revision"><button type="button" disabled={!value || disabled} onClick={()=>{setBaseline(value);setCompare(false);setStatus("Comparison point captured for this session. Edit your draft, then compare.");}}><History size={14}/> Set comparison point</button><button type="button" aria-pressed={compare} disabled={!baseline} onClick={()=>setCompare(!compare)}>{compare ? "Hide changes" : "Compare revisions"}</button></div>
    {compare && <div className="essay-diff" aria-label="Draft changes"><p><ins>Added</ins> <del>Removed</del> · Compared with your captured draft</p><div>{differences.map((part,index)=>part.added ? <ins key={index}>{part.value}</ins> : part.removed ? <del key={index}>{part.value}</del> : <span key={index}>{part.value}</span>)}</div></div>}
    {status && <p className="essay-status" role="status">{status}</p>}<p className="essay-privacy">Drafts stay temporary unless you choose Save on device. Saved copies remain after refresh; use Delete saved copy to remove them. Only sending a message shares your current draft and prompt with Groq.</p>
  </section>;
}
