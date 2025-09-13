
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

export type Modules = {
  ms?: number;
  af?: number;
  lsf?: number;
};

export interface ImpactTableHorizontalProps {
  cendresMelange: ChemSet;
  clinkerSans: ChemSet;
  clinkerAvec: ChemSet;
  modulesSans: Modules;
  modulesAvec: Modules;
  c3sSans?: number | null;
  c3sAvec?: number | null;
  showDelta?: boolean;
}

// --- Constantes
const ELEMENTS: (keyof ChemSet)[] = [
  "pf","sio2","al2o3","fe2o3","cao","mgo","so3","k2o","tio2","mno","p2o5"
];
const ELEMENT_LABELS: Record<string, string> = {
  pf: "PF", sio2: "SiO2", al2o3: "Al2O3", fe2o3: "Fe2O3", cao: "CaO", 
  mgo: "MgO", so3: "SO3", k2o: "K2O", tio2: "TiO2", mno: "MnO", p2o5: "P2O5",
  ms: "MS", af: "AF", lsf: "LSF", c3s: "C3S"
};


// --- Utils
const fmt = (v?: number | null) => (v != null ? Number(v).toFixed(2) : "–");
const delta = (a?: number | null, b?: number | null) => {
  if (a == null || b == null) return undefined;
  return a - b;
};

// --- Composant
export default function ImpactTableHorizontal({
  cendresMelange, clinkerSans, clinkerAvec, modulesSans, modulesAvec, c3sSans, c3sAvec, showDelta = true
}: ImpactTableHorizontalProps) {

  const rows = [
    { label: "Cendres Mélange", data: cendresMelange, modules: {} },
    { label: "Clinker sans Cendres", data: clinkerSans, modules: modulesSans, c3s: c3sSans },
    { label: "Clinker avec Cendres", data: clinkerAvec, modules: modulesAvec, c3s: c3sAvec },
  ];

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle>Résultats horizontaux – Impact sur le Clinker</CardTitle>
        <CardDescription>Éléments chimiques et modules fixés en haut • valeurs en %</CardDescription>
      </CardHeader>

      <CardContent className="relative overflow-x-auto">
        <Table role="table" className="min-w-max">
          <TableHeader>
            <TableRow className="sticky top-0 z-10 bg-background">
              <TableHead className="sticky left-0 top-0 z-20 bg-background border-r px-3 text-left min-w-[200px]">
                Paramètre
              </TableHead>

              {ELEMENTS.map((el) => (
                <TableHead key={String(el)} className="text-center px-3">
                  {ELEMENT_LABELS[el]}
                </TableHead>
              ))}
               <TableHead className="text-center px-3 font-bold border-l">MS</TableHead>
               <TableHead className="text-center px-3 font-bold">AF</TableHead>
               <TableHead className="text-center px-3 font-bold">LSF</TableHead>
               <TableHead className="text-center px-3 font-bold">C3S</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium px-3 whitespace-nowrap">
                  {r.label}
                </TableCell>

                {ELEMENTS.map((el) => (
                  <TableCell key={String(el)} className="px-3 text-center tabular-nums">
                    {fmt(r.data?.[el])}
                  </TableCell>
                ))}
                <TableCell className="px-3 text-center tabular-nums font-medium border-l">{fmt(r.modules?.ms)}</TableCell>
                <TableCell className="px-3 text-center tabular-nums font-medium">{fmt(r.modules?.af)}</TableCell>
                <TableCell className="px-3 text-center tabular-nums font-medium">{fmt(r.modules?.lsf)}</TableCell>
                <TableCell className="px-3 text-center tabular-nums font-medium">{fmt(r.c3s)}</TableCell>
              </TableRow>
            ))}

            {showDelta && (
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium px-3 whitespace-nowrap">
                  Δ (Avec - Sans)
                </TableCell>
                {ELEMENTS.map((el) => {
                  const d = delta(clinkerAvec?.[el], clinkerSans?.[el]);
                   const cls = d == null ? "" : d >= 0.001 ? "bg-emerald-600/15 text-emerald-500" : d <= -0.001 ? "bg-rose-600/15 text-rose-500" : "text-muted-foreground";
                  return (
                    <TableCell key={`delta-${String(el)}`} className="px-3 text-center">
                      {d == null ? "–" : (
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                          {(d>=0?"+":"")}{d.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                 {[ 'ms', 'af', 'lsf', 'c3s'].map((mod) => {
                  const d = delta(
                    mod === 'c3s' ? c3sAvec : modulesAvec[mod as keyof Modules],
                    mod === 'c3s' ? c3sSans : modulesSans[mod as keyof Modules]
                  );
                  const cls = d == null ? "" : d >= 0.001 ? "bg-emerald-600/15 text-emerald-500" : d <= -0.001 ? "bg-rose-600/15 text-rose-500" : "text-muted-foreground";
                  return (
                    <TableCell key={`delta-${mod}`} className={`px-3 text-center font-medium ${mod === 'ms' ? 'border-l' : ''}`}>
                      {d == null ? "–" : (
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                          {(d>=0?"+":"")}{d.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

    