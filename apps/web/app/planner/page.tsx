import type { Metadata } from "next";
import { Planner } from "./planner";
export const metadata: Metadata = { title: "Application planner" };
export default function Page() { return <Planner/>; }
