"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
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
  ClipboardList,
  Menu,
  X,
  Factory,
} from "lucide-react";

const allLinks = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard },
  { href: '/rapport-synthese', label: 'Rapport Synthèse', icon: BookOpen },
  { href: '/calculateur', label: 'Calculateur PCI', icon: Flame },
  { href: '/resultats', label: 'Résultats', icon: FlaskConical },
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

export function SidebarNav({ userRole }: { userRole: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();

  const toggleSidebar = () => setIsOpen(!isOpen);

  const visibleLinks = allLinks.filter(link => !link.adminOnly || userRole === 'admin');

  return (
    <motion.aside
      animate={{ width: isOpen ? 250 : 80 }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      className="h-screen bg-[#0B101A]/95 backdrop-blur-md border-r border-gray-800 text-gray-300 flex flex-col shadow-xl fixed z-50"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl">
            <Factory className="text-emerald-400 w-6 h-6" />
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <h1 className="text-base font-semibold text-white">FuelTrack</h1>
                <p className="text-xs text-gray-500">AFR Monitoring</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-800 rounded-lg transition"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-gray-400" />
          ) : (
            <Menu className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {visibleLinks
          .map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-400 font-medium border-l-4 border-emerald-400"
                    : "hover:bg-[#1A2233] hover:text-emerald-300 border-l-4 border-transparent"
                )}
              >
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Icon className="w-5 h-5 min-w-[20px]" />
                </motion.div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
          )})}
      </nav>

      {/* FOOTER */}
      <div className="text-center text-xs text-gray-500 py-4 border-t border-gray-800">
        © {new Date().getFullYear()} FuelTrack AFR
      </div>
    </motion.aside>
  );
}