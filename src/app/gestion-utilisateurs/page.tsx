
import { UserManagementTable } from '@/components/user-management-table';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Gestion des Utilisateurs | FuelTrack AFR",
  description: "Gérer les rôles et les accès des utilisateurs de l'application.",
};

export default function GestionUtilisateursPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <UserManagementTable />
    </div>
  );
}
