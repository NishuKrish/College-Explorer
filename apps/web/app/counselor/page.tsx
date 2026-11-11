import type { Metadata } from "next";
import { Counselor } from "./counselor";
export const metadata: Metadata = { title: "College counselor" };
export default function Page() { return <Counselor />; }
