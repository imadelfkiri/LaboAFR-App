
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { getFuelTypes, getFuelCosts, saveFuelCost, FuelCost, FuelType } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Save } from 'lucide-react';

export function CostManager() {
    const [costs, setCosts] = useState<Record<string, number>>({});
    const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedFuels, fetchedCosts] = await Promise.all([
                getFuelTypes(),
                getFuelCosts()
            ]);
            setFuelTypes(fetchedFuels);
            
            const initialCosts: Record<string, number> = {};
            fetchedFuels.forEach(fuel => {
                initialCosts[fuel.name] = fetchedCosts[fuel.name]?.cost || 0;
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

    const handleCostChange = (fuelName: string, value: string) => {
        const newCost = parseFloat(value);
        setCosts(prev => ({
            ...prev,
            [fuelName]: isNaN(newCost) ? 0 : newCost
        }));
    };

    const handleSaveCost = async (fuelName: string) => {
        setSaving(prev => ({...prev, [fuelName]: true}));
        try {
            const costToSave = costs[fuelName];
            await saveFuelCost(fuelName, costToSave);
            toast({ title: "Succès", description: `Le coût pour ${fuelName} a été enregistré.` });
        } catch (error) {
             console.error("Error saving cost:", error);
            toast({ variant: "destructive", title: "Erreur", description: `Impossible d'enregistrer le coût pour ${fuelName}.` });
        } finally {
            setSaving(prev => ({...prev, [fuelName]: false}));
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
                        Définissez ici le coût en euros par tonne (€/t) pour chaque type de combustible. Ces valeurs seront utilisées dans le calculateur de mélange.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type de Combustible</TableHead>
                                <TableHead>Coût (€/t)</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fuelTypes.map(fuel => (
                                <TableRow key={fuel.id}>
                                    <TableCell className="font-medium">{fuel.name}</TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number"
                                            value={costs[fuel.name] || ''}
                                            onChange={(e) => handleCostChange(fuel.name, e.target.value)}
                                            className="max-w-xs"
                                            placeholder="0.00"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            size="sm"
                                            onClick={() => handleSaveCost(fuel.name)}
                                            disabled={saving[fuel.name]}
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            {saving[fuel.name] ? 'En cours...' : 'Enregistrer'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
