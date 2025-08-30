
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Flame, Database, BarChart3, ClipboardCheck, Beaker, TrendingUp, Activity, DollarSign, Archive, Cog, FlaskConical } from 'lucide-react';

const links = [
  { href: '/calculateur', label: 'Calculateur PCI', icon: Flame },
  { href: '/resultats', label: 'Résultats', icon: Database },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3 },
  { href: '/specifications', label: 'Spécifications', icon: ClipboardCheck },
  { href: '/donnees-combustibles', label: 'Données Combustibles', icon: Cog },
  { href: '/calcul-melange', label: 'Calcul de Mélange', icon: Beaker },
  { href: '/simulation-melange', label: 'Simulation de Mélange', icon: FlaskConical },
  { href: '/gestion-couts', label: 'Gestion des Coûts', icon: DollarSign },
  { href: '/gestion-stock', label: 'Gestion du Stock', icon: Archive },
  { href: '/indicateurs', label: 'Indicateurs', icon: TrendingUp },
  { href: '/calcul-impact', label: "Calcul d'Impact", icon: Activity },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname.startsWith(link.href)}
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

    