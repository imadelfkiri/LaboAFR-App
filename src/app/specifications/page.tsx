
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Spec {
  id: string;
  combustible: string;
  fournisseur: string;
  H2O_max?: number;
  PCI_min?: number;
  chlorures_max?: number;
  cendres_max?: number;
  soufre_max?: number;
  granulometrie_max_mm?: number;
}

const formatNumber = (num: number | undefined | null, suffix = '') => {
    if (num === undefined || num === null) return <span className="text-muted-foreground">-</span>;
    return <>{num.toLocaleString('fr-FR')} {suffix}</>;
}


export default function SpecificationsPage() {
  const [data, setData] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, "specifications"));
      const querySnapshot = await getDocs(q);
      const specs: Spec[] = [];
      querySnapshot.forEach((doc) => {
        specs.push({ id: doc.id, ...doc.data() } as Spec);
      });
      // Tri côté client pour éviter les erreurs d'index
      specs.sort((a, b) => {
        const combustibleCompare = a.combustible.localeCompare(b.combustible);
        if (combustibleCompare !== 0) return combustibleCompare;
        return a.fournisseur.localeCompare(b.fournisseur);
      });
      setData(specs);
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Spécifications Techniques</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((spec) => (
            <Card key={spec.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-xl">{spec.combustible}</CardTitle>
                <p className="text-sm text-muted-foreground">{spec.fournisseur}</p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm flex-1">
                <div className="font-medium">H₂O Max</div>
                <div className="text-right">{formatNumber(spec.H2O_max, '%')}</div>

                <div className="font-medium">PCI Min</div>
                <div className="text-right">{formatNumber(spec.PCI_min, 'kcal/kg')}</div>
                
                <div className="font-medium">Chlorures Max</div>
                <div className="text-right">{formatNumber(spec.chlorures_max, '%')}</div>
                
                <div className="font-medium">Cendres Max</div>
                <div className="text-right">{formatNumber(spec.cendres_max, '%')}</div>
                
                <div className="font-medium">Soufre Max</div>
                <div className="text-right">{formatNumber(spec.soufre_max, '%')}</div>

                <div className="font-medium">Granulométrie Max</div>
                <div className="text-right">{formatNumber(spec.granulometrie_max_mm, 'mm')}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
