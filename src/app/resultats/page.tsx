import { ResultsTable } from "@/components/results-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResultsPage() {
  return (
    <div className="flex flex-1 flex-col">
       <Card>
         <CardHeader>
            <CardTitle>Historique des Résultats</CardTitle>
            <CardDescription>
              Consultez, filtrez et gérez toutes les analyses de combustibles enregistrées.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ResultsTable />
        </CardContent>
       </Card>
    </div>
  );
}
