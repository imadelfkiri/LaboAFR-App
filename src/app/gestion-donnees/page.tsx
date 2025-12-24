
"use client";

import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DownloadCloud, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function GestionDonneesPage() {
    const [isExporting, setIsExporting] = useState(false);
    const { toast } = useToast();

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const resultsCollection = collection(db, 'resultats');
            const snapshot = await getDocs(resultsCollection);

            if (snapshot.empty) {
                toast({
                    variant: 'destructive',
                    title: 'Aucune donnée',
                    description: 'La collection "resultats" est vide.',
                });
                return;
            }

            const dataToExport = snapshot.docs.map(doc => {
                const data = doc.data();
                // Convertir les Timestamps Firebase en dates ISO string pour une meilleure portabilité
                const convertedData: { [key: string]: any } = {};
                for (const key in data) {
                    if (data[key] instanceof Timestamp) {
                        convertedData[key] = data[key].toDate().toISOString();
                    } else {
                        convertedData[key] = data[key];
                    }
                }
                return { id: doc.id, ...convertedData };
            });

            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `export_brut_resultats_${format(new Date(), "yyyy-MM-dd")}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({
                title: 'Exportation réussie',
                description: `${dataToExport.length} documents exportés au format JSON.`,
            });

        } catch (error) {
            console.error("Erreur lors de l'exportation :", error);
            const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
            toast({
                variant: 'destructive',
                title: 'Erreur d'exportation',
                description: errorMessage,
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                    <Database className="h-8 w-8" />
                    Gestion des Données
                </h1>
                <p className="text-muted-foreground mt-2">
                    Effectuez des opérations avancées sur vos données brutes.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Exportation Brute des Données</CardTitle>
                    <CardDescription>
                        Cette fonctionnalité vous permet de télécharger une copie complète de la collection "resultats" de votre base de données. 
                        Le fichier sera au format JSON, ce qui est idéal pour les sauvegardes ou l'importation dans d'autres systèmes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-start gap-4">
                        <p className="text-sm">
                            Cliquez sur le bouton ci-dessous pour lancer l'exportation de toutes les analyses enregistrées.
                        </p>
                        <Button onClick={handleExport} disabled={isExporting}>
                            <DownloadCloud className="mr-2 h-4 w-4" />
                            {isExporting ? 'Exportation en cours...' : 'Exporter la collection "resultats"'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
