
import { SpecificationsTable } from "@/components/specifications-table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default function SpecificationsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 h-full">
       <Card className="flex-1">
        <CardContent className="p-0 h-full">
            <SpecificationsTable />
        </CardContent>
       </Card>
    </div>
  );
}
