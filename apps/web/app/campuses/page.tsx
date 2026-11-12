import type { Metadata } from "next";
import { CampusExplorer } from "./campus-explorer";
export const metadata: Metadata = { title: "Campus map" };
export default function Page() { return <CampusExplorer/>; }
