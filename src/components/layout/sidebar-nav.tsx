
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Flame, Database, BarChart3, ClipboardCheck } from 'lucide-react';

const links = [
  { href: '/calculateur', label: 'Calculateur PCI', icon: Flame },
  { href: '/resultats', label: 'Résultats', icon: Database },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3 },
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
