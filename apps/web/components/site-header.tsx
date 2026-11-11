"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Compass } from "lucide-react";
const links = [{href:"/search",label:"Explore schools"},{href:"/dashboard",label:"My shortlist"},{href:"/compare",label:"Compare"},{href:"/decision",label:"Decide"}];
export function SiteHeader(){const pathname=usePathname();return <header className="guide-header print:hidden"><Link className="guide-brand" href="/" aria-label="College Exploration"><Compass size={31} strokeWidth={1.5}/><span>college<span className="brand-second">explorer<span className="brand-dot">.</span></span></span></Link><nav aria-label="Main"><ul>{links.map(({href,label})=><li key={href}><Link href={href} aria-current={pathname===href?"page":undefined}>{label}</Link></li>)}</ul></nav><Link className="header-start" href="/onboarding">Find your fit <ArrowUpRight size={16}/></Link></header>}
