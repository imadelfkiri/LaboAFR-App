import { ResultsTable } from "@/components/results-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";

export default function ResultsPage() {
  return (
    <div className="flex flex-1 flex-col">
       <Card>
        <CardHeader>
            <CardTitle>Historique des Résultats</CardTitle>
        </CardHeader>
        <CardContent>
            <ResultsTable />
        </CardContent>
       </Card>
    </div>
  );
}
