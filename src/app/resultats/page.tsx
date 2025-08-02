import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ResultsTable } from "@/components/results-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Plus } from 'lucide-react';

export default function ResultsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Historique des Résultats</h1>
        <Button asChild>
          <Link href="/">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un Résultat
          </Link>
        </Button>
      </div>
       <Card>
        <CardContent className="p-0">
            <ResultsTable />
        </CardContent>
       </Card>
    </div>
  );
}
