
"use client";

import React, {useState} from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Save, Trash2 } from "lucide-react";
import { saveRawMealPreset, type RawMealPreset } from '@/lib/data';
import { useToast } from "@/hooks/use-toast";


// --- Types
export type ChemSet = {
  [key: string]: number | null | undefined;
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
  rawMealAnalysis: ChemSet;
  onRawMealChange: (newAnalysis: ChemSet) => void;
  presets: RawMealPreset[];
  onPresetLoad: (id: string) => void;
  onPresetSave: () => void;
  onPresetDelete: (id: string) => void;
  cendresMelange: ChemSet;
  clinkerSans: ChemSet;
  clinkerAvec: ChemSet;
  modulesFarine: Modules;
  modulesCendres: Modules;
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

const SavePresetDialog = ({ currentAnalysis, onSave }: { currentAnalysis: ChemSet, onSave: () => void }) => {
    const [name, setName] = useState("");
    const { toast } = useToast();

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ variant: "destructive", title: "Erreur", description: "Veuillez donner un nom au preset." });
            return;
        }
        await saveRawMealPreset(name, currentAnalysis);
        toast({ title: "Succès", description: `Preset "${name}" sauvegardé.` });
        onSave();
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                    <Save className="h-4 w-4 mr-1" /> Sauvegarder
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-brand-surface border-brand-line text-white">
                <DialogHeader>
                    <DialogTitle>Sauvegarder l'analyse du cru</DialogTitle>
                    <DialogDescription>Donnez un nom à ce préréglage pour le réutiliser plus tard.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label htmlFor="preset-name" className="text-sm text-neutral-300">Nom du Preset</label>
                    <Input id="preset-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cru standard Hiver" className="mt-1 bg-brand-bg border-brand-line text-white" />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Annuler</Button></DialogClose>
                    <DialogClose asChild><Button onClick={handleSave} className="bg-brand-accent text-black hover:bg-brand-accent/80">Sauvegarder</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// --- Composant
export default function ImpactTableHorizontal({
  rawMealAnalysis, onRawMealChange, presets, onPresetLoad, onPresetSave, onPresetDelete,
  cendresMelange, clinkerSans, clinkerAvec, modulesFarine, modulesCendres, modulesSans, modulesAvec, c3sSans, c3sAvec, showDelta = true
}: ImpactTableHorizontalProps) {

  const calculateSum = (data: ChemSet) => {
    return ELEMENTS.reduce((sum, key) => sum + (data[key] ?? 0), 0);
  };
  
  const rows = [
    { label: "Cendres Mélange", data: cendresMelange, modules: modulesCendres, c3s: null, sum: calculateSum(cendresMelange) },
    { label: "Clinker sans Cendres", data: clinkerSans, modules: modulesSans, c3s: c3sSans, sum: calculateSum(clinkerSans) },
    { label: "Clinker avec Cendres", data: clinkerAvec, modules: modulesAvec, c3s: c3sAvec, sum: calculateSum(clinkerAvec) },
  ];
  
  const handleInputChange = (key: keyof ChemSet, value: string) => {
    onRawMealChange({ ...rawMealAnalysis, [key]: parseFloat(value) || undefined });
  };


  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
            <div>
                 <CardTitle>Calcul d'impact</CardTitle>
            </div>
             <div className="flex items-center gap-2">
                <Select onValueChange={onPresetLoad}>
                    <SelectTrigger className="w-[180px] h-9 text-xs bg-brand-surface border-brand-line"><SelectValue placeholder="Charger un preset..." /></SelectTrigger>
                    <SelectContent className="bg-brand-surface border-brand-line text-white">
                        {presets.map(p => (
                            <div key={p.id} className="flex items-center justify-between pr-2">
                                <SelectItem value={p.id} className="flex-grow">{p.name}</SelectItem>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onPresetDelete(p.id); }}><Trash2 className="h-3 w-3 text-red-500/80" /></Button>
                            </div>
                        ))}
                    </SelectContent>
                </Select>
                <SavePresetDialog currentAnalysis={rawMealAnalysis} onSave={onPresetSave} />
            </div>
        </div>
      </CardHeader>

      <CardContent className="relative overflow-x-auto">
        <Table role="table" className="min-w-max">
          <TableHeader>
            <TableRow className="sticky top-0 z-10 bg-background">
              <TableHead className="sticky left-0 top-0 z-20 bg-background border-r px-3 text-left min-w-[200px]">
                Paramètre
              </TableHead>

              {ELEMENTS.map((el) => (
                <TableHead key={String(el)} className="text-center px-1">
                  {ELEMENT_LABELS[el]}
                </TableHead>
              ))}
               <TableHead className="text-center px-1 font-bold border-l">Somme</TableHead>
               <TableHead className="text-center px-1 font-bold">MS</TableHead>
               <TableHead className="text-center px-1 font-bold">AF</TableHead>
               <TableHead className="text-center px-1 font-bold">LSF</TableHead>
               <TableHead className="text-center px-1 font-bold">C3S</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* --- Ligne de saisie pour l'analyse du cru --- */}
            <TableRow>
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium px-3 whitespace-nowrap">
                   <span>Farine</span>
                </TableCell>
                {ELEMENTS.map(key => (
                    <TableCell key={key} className="px-1">
                        <Input
                            type="number"
                            step="any"
                            value={rawMealAnalysis[key] ?? ''}
                            onChange={e => handleInputChange(key, e.target.value)}
                            className="h-8 w-20 text-center bg-brand-surface/80 border-brand-line/80"
                        />
                    </TableCell>
                ))}
                <TableCell className="px-1 text-center tabular-nums font-medium border-l">{fmt(calculateSum(rawMealAnalysis))}</TableCell>
                {/* Modules for raw meal */}
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(modulesFarine?.ms)}</TableCell>
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(modulesFarine?.af)}</TableCell>
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(modulesFarine?.lsf)}</TableCell>
                <TableCell></TableCell>
            </TableRow>


            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium px-3 whitespace-nowrap">
                  {r.label}
                </TableCell>

                {ELEMENTS.map((el) => (
                  <TableCell key={String(el)} className="px-1 text-center tabular-nums">
                    {fmt(r.data?.[el])}
                  </TableCell>
                ))}
                <TableCell className="px-1 text-center tabular-nums font-medium border-l">{fmt(r.sum)}</TableCell>
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(r.modules?.ms)}</TableCell>
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(r.modules?.af)}</TableCell>
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(r.modules?.lsf)}</TableCell>
                <TableCell className="px-1 text-center tabular-nums font-medium">{fmt(r.c3s)}</TableCell>
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
                    <TableCell key={`delta-${String(el)}`} className="px-1 text-center">
                      {d == null ? "–" : (
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                          {(d>=0?"+":"")}{d.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                {/* Delta for Sum */}
                <TableCell className="px-1 text-center border-l">
                  {(() => {
                    const d = delta(calculateSum(clinkerAvec), calculateSum(clinkerSans));
                    const cls = d == null ? "" : d >= 0.001 ? "bg-emerald-600/15 text-emerald-500" : d <= -0.001 ? "bg-rose-600/15 text-rose-500" : "text-muted-foreground";
                    return d == null ? "–" : (
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                        {(d>=0?"+":"")}{d.toFixed(2)}
                      </span>
                    );
                  })()}
                </TableCell>
                 {[ 'ms', 'af', 'lsf', 'c3s'].map((mod) => {
                  const d = delta(
                    mod === 'c3s' ? c3sAvec : modulesAvec[mod as keyof Modules],
                    mod === 'c3s' ? c3sSans : modulesSans[mod as keyof Modules]
                  );
                  const cls = d == null ? "" : d >= 0.001 ? "bg-emerald-600/15 text-emerald-500" : d <= -0.001 ? "bg-rose-600/15 text-rose-500" : "text-muted-foreground";
                  return (
                    <TableCell key={`delta-${mod}`} className={`px-1 text-center font-medium`}>
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
