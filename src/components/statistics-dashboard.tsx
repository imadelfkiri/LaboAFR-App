"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Skeleton } from './ui/skeleton';

interface Result {
    id: string;
    date_arrivage: { seconds: number; nanoseconds: number };
    type_combustible: string;
    pcs: number;
    h2o: number;
    chlore: number;
    pci_brut: number;
}

const formatNumber = (num: number, fractionDigits: number = 0) => {
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
};


export function StatisticsDashboard() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "resultats"), orderBy("date_arrivage", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const resultsData: Result[] = [];
      querySnapshot.forEach((doc) => {
        resultsData.push({ id: doc.id, ...doc.data() } as Result);
      });
      setResults(resultsData);
      setLoading(false);
    }, (error) => {
      console.error("Erreur de lecture Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const summaryStats = useMemo(() => {
    if (results.length === 0) {
      return { pciMoyen: 0, h2oMoyen: 0, chloreMoyen: 0 };
    }
    const totalPci = results.reduce((acc, curr) => acc + curr.pci_brut, 0);
    const totalH2o = results.reduce((acc, curr) => acc + curr.h2o, 0);
    const totalChlore = results.reduce((acc, curr) => acc + curr.chlore, 0);

    return {
      pciMoyen: totalPci / results.length,
      h2oMoyen: totalH2o / results.length,
      chloreMoyen: totalChlore / results.length,
    };
  }, [results]);

  const pciByFuelType = useMemo(() => {
    const dataByFuel: { [key: string]: { totalPci: number; count: number } } = {};
    results.forEach(result => {
      if (!dataByFuel[result.type_combustible]) {
        dataByFuel[result.type_combustible] = { totalPci: 0, count: 0 };
      }
      dataByFuel[result.type_combustible].totalPci += result.pci_brut;
      dataByFuel[result.type_combustible].count++;
    });

    return Object.entries(dataByFuel).map(([name, data]) => ({
      name,
      pciMoyen: data.totalPci / data.count,
    }));
  }, [results]);
  
  const pciOverTime = useMemo(() => {
    return results.map(result => ({
      date: format(new Date(result.date_arrivage.seconds * 1000), 'dd/MM/yy'),
      pci_brut: result.pci_brut,
    }));
  }, [results]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">PCI Brut Moyen</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(summaryStats.pciMoyen)}</div>
                    <p className="text-xs text-muted-foreground">kcal/kg</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">% H2O Moyen</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(summaryStats.h2oMoyen, 1)}</div>
                    <p className="text-xs text-muted-foreground">sur l'ensemble des analyses</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taux de Chlore Moyen</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(summaryStats.chloreMoyen, 2)}%</div>
                     <p className="text-xs text-muted-foreground">sur l'ensemble des analyses</p>
                </CardContent>
            </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>PCI Moyen par Type de Combustible</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={pciByFuelType}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
                            <YAxis />
                            <Tooltip formatter={(value) => formatNumber(value as number)} />
                            <Bar dataKey="pciMoyen" fill="hsl(var(--primary))" name="PCI Moyen" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Évolution du PCI Brut dans le Temps</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={pciOverTime}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatNumber(value as number)} />
                            <Line type="monotone" dataKey="pci_brut" stroke="hsl(var(--primary))" name="PCI Brut" dot={false}/>
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
