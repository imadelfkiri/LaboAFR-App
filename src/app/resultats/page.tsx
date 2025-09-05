// app/results/page.tsx
// Server component that renders your client ResultsTable
// Adjust the import path to where you pasted the component

import React from "react";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import ResultsTable from "@/components/results-table";

export const metadata: Metadata = {
  title: "Résultats | AFR",
  description: "Historique et export des analyses des combustibles (PDF, Excel)",
};

export default function ResultsPage() {
  return (
    <main className={cn("flex flex-col flex-1")}>
      {/* Client component */}
      <ResultsTable />
    </main>
  );
}
