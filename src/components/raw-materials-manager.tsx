"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory } from 'lucide-react';

export function RawMaterialsManager() {

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-6 w-6 text-primary" />
          Raw Materials Management
        </CardTitle>
        <CardDescription>
          Centralisez et gérez les informations sur vos matières premières ici.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">
                Le module de gestion des matières premières est en cours de construction.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
