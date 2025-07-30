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
    <div className="flex flex-1 items-start justify-center rounded-lg border border-dashed shadow-sm p-4 md:p-6">
       <Card className="w-full shadow-none border-0">
         <CardHeader className="text-center">
            <CardTitle className="text-2xl">Historique des Résultats</CardTitle>
            <CardDescription>
              Consultez toutes les analyses de combustibles enregistrées.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ResultsTable />
        </CardContent>
       </Card>
    </div>
  );
}
