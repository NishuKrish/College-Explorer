import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalCompareTray } from "@/components/compare/global-compare-tray";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dream Campus",
    template: "%s | Dream Campus",
  },
  description:
    "Data-driven decision support for building transparent college shortlists.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <GlobalCompareTray />
      </body>
    </html>
  );
}
