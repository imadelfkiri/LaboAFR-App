
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { auth, db, functions } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getAllUsers, updateUserRole, type UserProfile } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, HardHat, Eye, PlusCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';


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

const newUserSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse email valide." }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères." }),
  role: z.enum(['technician', 'viewer', 'admin'], { required_error: "Veuillez sélectionner un rôle." }),
});

export function UserManagementTable() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();
    const { toast } = useToast();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [pageLoading, setPageLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    const form = useForm<z.infer<typeof newUserSchema>>({
        resolver: zodResolver(newUserSchema),
        defaultValues: {
            email: "",
            password: "",
            role: "technician",
        },
    });

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

    const onCreateUserSubmit = async (values: z.infer<typeof newUserSchema>) => {
        try {
            const adminCreateUser = httpsCallable(functions, 'adminCreateUser');
            await adminCreateUser(values);

            toast({ title: "Utilisateur créé !", description: `Le compte pour ${values.email} a été créé avec succès.` });
            setIsCreateModalOpen(false);
            form.reset();
            fetchUsers();
        } catch (error: any) {
            console.error("Error creating user:", error);
            let errorMessage = "Une erreur est survenue lors de la création de l'utilisateur.";
            if (error.message.includes('already-exists')) {
                errorMessage = "Cette adresse email est déjà utilisée par un autre compte.";
            } else if (error.message.includes('permission-denied')) {
                errorMessage = "Vous n'avez pas les permissions pour effectuer cette action.";
            }
            toast({ variant: "destructive", title: "Erreur de création", description: errorMessage });
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
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-6 w-6 text-primary" />
                            Gestion des Utilisateurs
                        </CardTitle>
                        <CardDescription>
                            Gérez les rôles et l'accès de chaque membre de l'équipe.
                        </CardDescription>
                    </div>
                     <Button onClick={() => setIsCreateModalOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer un utilisateur
                    </Button>
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
                                            disabled={u.id === user?.uid} // Admin cannot change their own role
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

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                        <DialogDescription>
                            Ajoutez un nouveau membre et assignez-lui un rôle. Un mot de passe temporaire est requis.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onCreateUserSubmit)} className="space-y-4 py-4">
                             <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input type="email" placeholder="nom@exemple.com" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mot de passe</FormLabel>
                                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rôle</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Sélectionner un rôle..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="viewer">👁 Lecteur</SelectItem>
                                        <SelectItem value="technician">👷 Technicien</SelectItem>
                                        <SelectItem value="admin">👑 Administrateur</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <DialogFooter className="pt-4">
                                <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? "Création..." : "Créer l'utilisateur"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}
