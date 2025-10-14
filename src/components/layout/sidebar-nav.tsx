"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Flame,
  Database,
  BarChart3,
  ClipboardCheck,
  Beaker,
  TrendingUp,
  Cog,
  SlidersHorizontal,
  Users,
  Activity,
  Book,
  Wind,
  FlaskConical,
  DollarSign,
  Archive,
  ClipboardList
} from "lucide-react";

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
  { href: '/gestion-utilisateurs', label: 'Gestion Utilisateurs', icon: Users, adminOnly: true },
  { href: '/gestion-seuils', label: 'Gestion des Seuils', icon: SlidersHorizontal, adminOnly: true },
];

export function SidebarNav({ userRole, allowedRoutes }: { userRole: string; allowedRoutes: string[] }) {
  const pathname = usePathname();

  const visibleLinks = allLinks.filter(link => 
    allowedRoutes.includes(link.href) && (!link.adminOnly || userRole === 'admin')
  );

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
      {visibleLinks.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
            pathname === href
              ? "bg-emerald-600/20 text-emerald-400 font-medium"
              : "hover:bg-[#1A2233] hover:text-emerald-300"
          )}
        >
          <motion.div
            whileHover={{ scale: 1.15 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Icon className="w-5 h-5" />
          </motion.div>
          <span className="text-sm">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
