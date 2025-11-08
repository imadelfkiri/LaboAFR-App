
import { SpecificationsTable } from "@/components/specifications-table";
import { ClipboardCheck } from "lucide-react";

export default function SpecificationsPage() {
  return (
     <div className="space-y-6">
        <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8"/>
                Spécifications des Combustibles
            </h1>
            <p className="text-muted-foreground mt-1">Définissez les seuils de qualité pour chaque couple combustible-fournisseur.</p>
        </div>
        <SpecificationsTable />
    </div>
  );
}
