
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { getFuelSupplierCombinations, getFuelCosts, saveFuelCost, FuelCost } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Save } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface FuelCombination {
    fuel: string;
    supplier: string;
}

export function CostManager() {
    const [costs, setCosts] = useState<Record<string, number>>({});
    const [combinations, setCombinations] = useState<FuelCombination[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const getCostKey = (fuel: string, supplier: string) => `${fuel}|${supplier}`;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedCombinations, fetchedCosts] = await Promise.all([
                getFuelSupplierCombinations(),
                getFuelCosts()
            ]);
            setCombinations(fetchedCombinations);
            
            const initialCosts: Record<string, number> = {};
            fetchedCombinations.forEach(({ fuel, supplier }) => {
                const key = getCostKey(fuel, supplier);
                initialCosts[key] = fetchedCosts[key]?.cost || 0;
            });
            setCosts(initialCosts);

        } catch (error) {
            console.error("Error fetching cost data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données de coût." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCostChange = (key: string, value: string) => {
        const newCost = parseFloat(value);
        setCosts(prev => ({
            ...prev,
            [key]: isNaN(newCost) ? 0 : newCost
        }));
    };

    const handleSaveCost = async (fuel: string, supplier: string) => {
        const key = getCostKey(fuel, supplier);
        setSaving(prev => ({...prev, [key]: true}));
        try {
            const costToSave = costs[key];
            await saveFuelCost(fuel, supplier, costToSave);
            toast({ title: "Succès", description: `Le coût pour ${fuel} (${supplier}) a été enregistré.` });
        } catch (error) {
             console.error("Error saving cost:", error);
            toast({ variant: "destructive", title: "Erreur", description: `Impossible d'enregistrer le coût pour ${fuel} (${supplier}).` });
        } finally {
            setSaving(prev => ({...prev, [key]: false}));
        }
    };

    if (loading) {
        return (
            <div className="p-4 md:p-8">
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-6 w-6 text-primary"/>
                        Gestion des Coûts des Combustibles
                    </CardTitle>
                    <CardDescription>
                        Définissez ici le coût en dirhams par tonne (MAD/t) pour chaque combinaison combustible/fournisseur.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead>Type de Combustible</TableHead>
                                    <TableHead>Fournisseur</TableHead>
                                    <TableHead>Coût (MAD/t)</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {combinations.map(({ fuel, supplier }) => {
                                    const key = getCostKey(fuel, supplier);
                                    return (
                                        <TableRow key={key}>
                                            <TableCell className="font-medium">{fuel}</TableCell>
                                            <TableCell>{supplier}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number"
                                                    value={costs[key] || ''}
                                                    onChange={(e) => handleCostChange(key, e.target.value)}
                                                    className="max-w-xs"
                                                    placeholder="0.00"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleSaveCost(fuel, supplier)}
                                                    disabled={saving[key]}
                                                >
                                                    <Save className="mr-2 h-4 w-4" />
                                                    {saving[key] ? 'En cours...' : 'Enregistrer'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
