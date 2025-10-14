
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Flame, Database, BarChart3, ClipboardCheck, Beaker, TrendingUp, Activity, DollarSign, Archive, Cog, FlaskConical, ClipboardList, Book, LayoutDashboard, Wind, BookOpen, Users, SlidersHorizontal } from 'lucide-react';

const allLinks = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard },
  { href: '/rapport-synthese', label: 'Rapport Synthèse', icon: BookOpen },
  { href: '/calculateur', label: 'Calculateur PCI', icon: Flame },
  { href: '/resultats', label: 'Résultats', icon: Database },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3 },
  { href: '/specifications', label: 'Spécifications', icon: ClipboardCheck },
  { href: '/analyses-cendres', label: 'Analyses Cendres', icon: ClipboardList },
  { href: '/donnees-combustibles', label: 'Données Combustibles', icon: Cog },
  { href: '/calcul-melange', label: 'Calcul de Mélange', icon: Beaker },
  { href: '/simulation-melange', label: 'Simulation de Mélange', icon: FlaskConical },
  { href: '/gestion-couts', label: 'Gestion des Coûts', icon: DollarSign },
  { href: '/gestion-stock', label: 'Gestion du Stock', icon: Archive },
  { href: '/indicateurs', label: 'Indicateurs', icon: TrendingUp },
  { href: '/calcul-impact', label: "Calcul d'Impact", icon: Activity },
  { href: '/historique-impact', label: "Historique Impact", icon: Book },
  { href: '/suivi-chlore', label: 'Suivi Chlore', icon: Wind },
  { href: '/gestion-utilisateurs', label: 'Gestion Utilisateurs', icon: Users },
  { href: '/gestion-seuils', label: 'Gestion des Seuils', icon: SlidersHorizontal },
];

export function SidebarNav({ allowedRoutes }: { allowedRoutes: string[] }) {
  const pathname = usePathname();
  
  const visibleLinks = allLinks.filter(link => allowedRoutes.includes(link.href));

  return (
    <SidebarMenu>
      {visibleLinks.map((link) => (
        <SidebarMenuItem key={link.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === link.href}
            tooltip={link.label}
          >
            <Link href={link.href}>
              <link.icon />
              <span>{link.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
