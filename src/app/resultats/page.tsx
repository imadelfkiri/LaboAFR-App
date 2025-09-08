
import React from "react";
import type { Metadata } from "next";
import ResultsTable from "@/components/results-table";

export const metadata: Metadata = {
  title: "Résultats | AFR",
  description: "Historique et export des analyses des combustibles (PDF, Excel)",
};

export default function ResultsPage() {
  return (
      <ResultsTable />
  );
}
