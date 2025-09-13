
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Types
export type ChemSet = {
  pf?: number | null;
  sio2?: number | null;
  al2o3?: number | null;
  fe2o3?: number | null;
  cao?: number | null;
  mgo?: number | null;
  so3?: number | null;
  k2o?: number | null;
  tio2?: number | null;
  mno?: number | null;
  p2o5?: number | null;
};

export interface ImpactTableHorizontalProps {
  farine: ChemSet;         // Analyse Farine (H)
  cendresMelange: ChemSet; // Cendres mélange
  clinkerSans: ChemSet;    // Clinker sans cendres
  clinkerAvec: ChemSet;    // Clinker avec cendres
  showDelta?: boolean;     // défaut: true
}

// --- Constantes
const ELEMENTS: (keyof ChemSet)[] = [
  "pf","sio2","al2o3","fe2o3","cao","mgo","so3","k2o","tio2","mno","p2o5"
];
const ELEMENT_LABELS: Record<keyof ChemSet, string> = {
  pf: "PF", sio2: "SiO2", al2o3: "Al2O3", fe2o3: "Fe2O3", cao: "CaO", 
  mgo: "MgO", so3: "SO3", k2o: "K2O", tio2: "TiO2", mno: "MnO", p2o5: "P2O5"
};


// --- Utils
const fmt = (v?: number | null) => (v != null ? Number(v).toFixed(2) : "–");
const delta = (a?: number | null, b?: number | null) => {
  if (a == null || b == null) return undefined;
  const base = Math.abs(b) < 1e-6 ? 1e-6 : b;
  return ((a - b) / base) * 100;
};

// --- Composant
export default function ImpactTableHorizontal({
  farine, cendresMelange, clinkerSans, clinkerAvec, showDelta = true
}: ImpactTableHorizontalProps) {

  const rows = [
    { label: "Cendres Mélange", data: cendresMelange },
    { label: "Clinker sans Cendres", data: clinkerSans },
    { label: "Clinker avec Cendres", data: clinkerAvec },
  ];

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle>Résultats horizontaux – Impact sur le Clinker</CardTitle>
        <CardDescription>Éléments chimiques fixés en haut • valeurs en %</CardDescription>
      </CardHeader>

      {/* Défilement horizontal + positionnement sticky possible */}
      <CardContent className="relative overflow-x-auto">
        <Table role="table" className="min-w-max">
          <TableHeader>
            <TableRow className="sticky top-0 z-10 bg-background">
              {/* COLONNE PARAMÈTRE STICKY GAUCHE */}
              <TableHead className="sticky left-0 top-0 z-20 bg-background border-r px-3 text-left min-w-[200px]">
                Paramètre
              </TableHead>

              {ELEMENTS.map((el) => (
                <TableHead key={String(el)} className="text-center px-3">
                  {ELEMENT_LABELS[el]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                {/* CELLULE LIGNE STICKY GAUCHE */}
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium px-3 whitespace-nowrap">
                  {r.label}
                </TableCell>

                {ELEMENTS.map((el) => (
                  <TableCell key={String(el)} className="px-3 text-center tabular-nums">
                    {fmt(r.data?.[el])}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {showDelta && (
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium px-3 whitespace-nowrap">
                  Δ% (Avec vs Sans)
                </TableCell>
                {ELEMENTS.map((el) => {
                  const d = delta(clinkerAvec?.[el], clinkerSans?.[el]);
                   const cls = d == null ? "" : d >= 0 ? "bg-emerald-600/15 text-emerald-500" : "bg-rose-600/15 text-rose-500";
                  return (
                    <TableCell key={String(el)} className="px-3 text-center">
                      {d == null ? "–" : (
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                          {(d>=0?"+":"")}{d.toFixed(2)}%
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
