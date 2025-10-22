

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-provider';
import { useRouter } from 'next/navigation';
import { functions } from '@/lib/firebase';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getAllUsers, updateUserRole, type UserProfile, getRoles, type Role, updateRoleAccess } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, HardHat, Eye, PlusCircle, Settings, Edit, LayoutDashboard, BookOpen, Flame, FlaskConical, BarChart3, ClipboardCheck, ClipboardList, Factory, Cog, Beaker, DollarSign, Archive, TrendingUp, Activity, Wind, Book, BookText } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';


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

const allPages = [
    { id: '/', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: '/rapport-synthese', label: 'Rapport Synthèse', icon: BookOpen },
    { id: '/calculateur', label: 'Calculateur PCI', icon: Flame },
    { id: '/resultats', label: 'Résultats', icon: FlaskConical },
    { id: '/statistiques', label: 'Statistiques', icon: BarChart3 },
    { id: '/specifications', label: 'Spécifications', icon: ClipboardCheck },
    { id: '/analyses-cendres', label: 'Analyses Cendres', icon: ClipboardList },
    { id: '/matieres-premieres', label: 'Matières Premières', icon: Factory },
    { id: '/donnees-combustibles', label: 'Données Combustibles', icon: Cog },
    { id: '/calcul-melange', label: 'Calcul de Mélange', icon: Beaker },
    { id: '/simulation-melange', label: 'Simulation de Mélange', icon: FlaskConical },
    { id: '/gestion-couts', label: 'Gestion des Coûts', icon: DollarSign },
    { id: '/gestion-stock', label: 'Gestion du Stock', icon: Archive },
    { id: '/indicateurs', label: 'Indicateurs', icon: TrendingUp },
    { id: '/calcul-impact', label: "Calcul d'Impact", icon: Activity },
    { id: '/bilan-cl-s', label: 'Bilan Cl & S', icon: Wind },
    { id: '/historique-impact', label: "Historique Impact", icon: Book },
    { id: '/documentation', label: 'Documentation', icon: BookText },
    { id: '/suivi-chlore', label: 'Suivi Chlore', icon: Wind },
    { id: '/gestion-utilisateurs', label: 'Gestion Utilisateurs', icon: Users, adminOnly: true },
    { id: '/gestion-seuils', label: 'Gestion des Seuils', icon: Settings, adminOnly: true },
];

const RolePermissionsModal = ({ role, onSave }: { role: Role; onSave: (access: string[]) => void; }) => {
    const [selectedPages, setSelectedPages] = useState<string[]>(role.access || []);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setSelectedPages(role.access || []);
    }, [role]);

    const handleTogglePage = (pageId: string) => {
        setSelectedPages(prev => 
            prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(selectedPages);
        setIsSaving(false);
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Modifier les accès pour le rôle: <span className="capitalize font-bold">{role.id}</span></DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-72 my-4">
                <div className="grid grid-cols-1 gap-2 p-1">
                    {allPages.filter(p => !p.adminOnly || role.id === 'admin').map(page => (
                        <div key={page.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                            <Checkbox
                                id={`page-${role.id}-${page.id}`}
                                checked={selectedPages.includes(page.id)}
                                onCheckedChange={() => handleTogglePage(page.id)}
                            />
                            <label htmlFor={`page-${role.id}-${page.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {page.label}
                            </label>
                        </div>
                    ))}
                </div>
            </ScrollArea>
            <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Annuler</Button></DialogClose>
                <DialogClose asChild><Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Sauvegarde..." : "Sauvegarder"}</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
    );
};


export function UserManagementTable() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [pageLoading, setPageLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    
    const form = useForm<z.infer<typeof newUserSchema>>({
        resolver: zodResolver(newUserSchema),
        defaultValues: {
            email: "",
            password: "",
            role: "technician",
        },
    });

    const fetchAllData = useCallback(async () => {
        setPageLoading(true);
        try {
            const [allUsers, allRoles] = await Promise.all([getAllUsers(), getRoles()]);
            setUsers(allUsers);
            setRoles(allRoles);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données." });
        } finally {
            setPageLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (authLoading) return;
        if (!userProfile) {
            router.push('/login');
            return;
        }
        if (userProfile.role !== 'admin') {
            router.push('/unauthorized');
            return;
        }
        fetchAllData();
    }, [userProfile, authLoading, router, fetchAllData]);

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'technician' | 'viewer') => {
        try {
            await updateUserRole(userId, newRole);
            toast({ title: "Succès", description: "Le rôle de l'utilisateur a été mis à jour." });
            fetchAllData(); // Refresh the user list
        } catch (error) {
            console.error("Error updating user role:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le rôle." });
        }
    };
    
    const handleUpdateRoleAccess = async (roleId: string, access: string[]) => {
        try {
            await updateRoleAccess(roleId, access);
            toast({ title: "Succès", description: `Les permissions pour le rôle ${roleId} ont été mises à jour.` });
            fetchAllData(); // Refresh roles
        } catch (error) {
            console.error("Error updating role access:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour les permissions." });
        }
    };

    const onCreateUserSubmit = async (values: z.infer<typeof newUserSchema>) => {
        try {
            const adminCreateUser = httpsCallable(functions, 'adminCreateUser');
            await adminCreateUser(values);

            toast({ title: "Utilisateur créé !", description: `Le compte pour ${values.email} a été créé avec succès.` });
            setIsCreateModalOpen(false);
            form.reset();
            fetchAllData();
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
                <CardHeader className="flex flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-6 w-6 text-primary" />
                            Gestion des Utilisateurs
                        </CardTitle>
                        <CardDescription>
                            Gérez les rôles et l'accès de chaque membre de l'équipe.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                         <Button variant="outline" onClick={() => setIsRoleManagerOpen(true)}>
                            <Settings className="mr-2 h-4 w-4" />
                            Gérer les Rôles
                        </Button>
                         <Button onClick={() => setIsCreateModalOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Créer un utilisateur
                        </Button>
                    </div>
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
                                            disabled={u.uid === userProfile?.uid} // Admin cannot change their own role
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

             <Dialog open={isRoleManagerOpen} onOpenChange={setIsRoleManagerOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Gestion des Permissions par Rôle</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {roles.map(role => (
                            <Card key={role.id}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                     <CardTitle className="text-lg capitalize flex items-center gap-2">
                                        {roleIcons[role.id as keyof typeof roleIcons]}
                                        {role.id}
                                    </CardTitle>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                             <Button variant="outline" size="sm" onClick={() => setEditingRole(role)}><Edit className="mr-2 h-3 w-3" /> Modifier les accès</Button>
                                        </DialogTrigger>
                                        {editingRole && editingRole.id === role.id && (
                                            <RolePermissionsModal 
                                                role={editingRole} 
                                                onSave={(access) => handleUpdateRoleAccess(editingRole.id, access)}
                                            />
                                        )}
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">
                                        Accès à {role.access.length} page(s).
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

        </>
    );
}
