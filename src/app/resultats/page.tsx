
import React from "react";
import type { Metadata } from "next";
import ResultsTable from "@/components/results-table";
import { FlaskConical } from "lucide-react";

export const metadata: Metadata = {
  title: "Résultats | AFR",
  description: "Historique et export des analyses des combustibles (PDF, Excel)",
};

export default function ResultsPage() {
  return (
    <div className="space-y-6">
       <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <FlaskConical className="h-8 w-8"/>
                Résultats des Analyses
            </h1>
            <p className="text-muted-foreground mt-1">Consultez, filtrez et exportez l'historique de toutes les analyses de combustibles.</p>
        </div>
      <ResultsTable />
    </div>
  );
}
