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
    <main className={cn("container mx-auto px-4 py-6")}> 
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Résultats des analyses</h1>
      <p className="text-muted-foreground mb-6">
        Filtrez par type, fournisseur et dates, puis exportez en PDF/Excel.
      </p>

      {/* Client component */}
      <ResultsTable />
    </main>
  );
}
