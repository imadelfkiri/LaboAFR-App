
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { getAllUsers, updateUserRole, type UserProfile } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, HardHat, Eye } from 'lucide-react';

const roleIcons = {
    admin: <Crown className="h-4 w-4 text-amber-400" />,
    technician: <HardHat className="h-4 w-4 text-sky-400" />,
    viewer: <Eye className="h-4 w-4 text-emerald-400" />,
};

const roleColors: Record<string, string> = {
    admin: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    technician: "bg-sky-400/10 text-sky-400 border-sky-400/20",
    viewer: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
};


export function UserManagementTable() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();
    const { toast } = useToast();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [pageLoading, setPageLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        setPageLoading(true);
        try {
            const allUsers = await getAllUsers();
            setUsers(allUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger la liste des utilisateurs." });
        } finally {
            setPageLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const checkPermissionsAndFetch = async () => {
            if (authLoading) return;
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists() && userDoc.data().role === 'admin') {
                    fetchUsers();
                } else {
                    router.push('/unauthorized');
                }
            } catch (error) {
                 console.error("Error checking permissions:", error);
                 router.push('/unauthorized');
            }
        };
        checkPermissionsAndFetch();
    }, [user, authLoading, router, fetchUsers]);

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'technician' | 'viewer') => {
        try {
            await updateUserRole(userId, newRole);
            toast({ title: "Succès", description: "Le rôle de l'utilisateur a été mis à jour." });
            fetchUsers(); // Refresh the user list
        } catch (error) {
            console.error("Error updating user role:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le rôle." });
        }
    };
    
    if (authLoading || pageLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    Gestion des Utilisateurs
                </CardTitle>
                <CardDescription>
                    Gérez les rôles et l'accès de chaque membre de l'équipe.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Rôle Actuel</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="w-[200px]">Modifier le Rôle</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.email}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={roleColors[u.role]}>
                                        {roleIcons[u.role]}
                                        <span className="capitalize ml-2">{u.role}</span>
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={u.active ? "secondary" : "destructive"}>
                                        {u.active ? "Actif" : "Inactif"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Select 
                                        defaultValue={u.role} 
                                        onValueChange={(newRole) => handleRoleChange(u.id!, newRole as any)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Changer le rôle..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="technician">Technicien</SelectItem>
                                            <SelectItem value="viewer">Lecteur</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

