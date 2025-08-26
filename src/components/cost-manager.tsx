
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { getUniqueFuelTypes, getFuelCosts, saveFuelCost, FuelCost } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Save } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

export function CostManager() {
    const [costs, setCosts] = useState<Record<string, number>>({});
    const [fuelTypes, setFuelTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedFuelTypes, fetchedCosts] = await Promise.all([
                getUniqueFuelTypes(),
                getFuelCosts()
            ]);
            setFuelTypes(fetchedFuelTypes.sort());
            
            const initialCosts: Record<string, number> = {};
            fetchedFuelTypes.forEach((fuel) => {
                initialCosts[fuel] = fetchedCosts[fuel]?.cost || 0;
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

    const handleCostChange = (fuelType: string, value: string) => {
        const newCost = parseFloat(value);
        setCosts(prev => ({
            ...prev,
            [fuelType]: isNaN(newCost) ? 0 : newCost
        }));
    };

    const handleSaveCost = async (fuelType: string) => {
        setSaving(prev => ({...prev, [fuelType]: true}));
        try {
            const costToSave = costs[fuelType];
            await saveFuelCost(fuelType, costToSave);
            toast({ title: "Succès", description: `Le coût pour ${fuelType} a été enregistré.` });
        } catch (error) {
             console.error("Error saving cost:", error);
            toast({ variant: "destructive", title: "Erreur", description: `Impossible d'enregistrer le coût pour ${fuelType}.` });
        } finally {
            setSaving(prev => ({...prev, [fuelType]: false}));
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
                        Définissez ici le coût en dirhams par tonne (MAD/t) pour chaque type de combustible.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead>Type de Combustible</TableHead>
                                    <TableHead>Coût (MAD/t)</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fuelTypes.map((fuelType) => {
                                    return (
                                        <TableRow key={fuelType}>
                                            <TableCell className="font-medium">{fuelType}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number"
                                                    value={costs[fuelType] || ''}
                                                    onChange={(e) => handleCostChange(fuelType, e.target.value)}
                                                    className="max-w-xs"
                                                    placeholder="0.00"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleSaveCost(fuelType)}
                                                    disabled={saving[fuelType]}
                                                >
                                                    <Save className="mr-2 h-4 w-4" />
                                                    {saving[fuelType] ? 'En cours...' : 'Enregistrer'}
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
