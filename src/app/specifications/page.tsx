
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList } from "lucide-react";

interface Spec {
  id: string;
  combustible: string;
  fournisseur: string;
  h2o: string;
  pci: string;
  chlorures: string;
  cendres: string;
  soufre: string;
  granulometrie: string;
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
      // Tri côté client
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ClipboardList className="h-8 w-8" />
          Spécifications Techniques
        </h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combustible</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>H₂O</TableHead>
                <TableHead>PCI (kcal/kg)</TableHead>
                <TableHead>Chlorures</TableHead>
                <TableHead>Cendres</TableHead>
                <TableHead>Soufre</TableHead>
                <TableHead>Granulométrie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : (
                data.map((spec) => (
                  <TableRow key={spec.id}>
                    <TableCell className="font-medium">{spec.combustible}</TableCell>
                    <TableCell>{spec.fournisseur}</TableCell>
                    <TableCell>{spec.h2o}</TableCell>
                    <TableCell>{spec.pci}</TableCell>
                    <TableCell>{spec.chlorures}</TableCell>
                    <TableCell>{spec.cendres}</TableCell>
                    <TableCell>{spec.soufre}</TableCell>
                    <TableCell>{spec.granulometrie}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
           { !loading && data.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    Aucune spécification trouvée.
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
