
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/auth-provider';
import { ThemeToggleButton } from './theme-toggle-button';
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
  LogOut,
  BookText,
} from "lucide-react";

const allLinks = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard },
  { href: '/rapport-synthese', label: 'Rapport Synthèse', icon: BookOpen },
  { href: '/calculateur', label: 'Calculateur PCI', icon: Flame },
  { href: '/resultats', label: 'Résultats', icon: FlaskConical },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3 },
  { href: '/specifications', label: 'Spécifications', icon: ClipboardCheck },
  { href: '/analyses-cendres', label: 'Analyses Cendres', icon: ClipboardList },
  { href: '/matieres-premieres', label: 'Matières Premières', icon: Factory },
  { href: '/donnees-combustibles', label: 'Données Combustibles', icon: Cog },
  { href: '/calcul-melange', label: 'Calcul de Mélange', icon: Beaker },
  { href: '/simulation-melange', label: 'Simulation de Mélange', icon: FlaskConical },
  { href: '/indicateurs', label: 'Indicateurs', icon: TrendingUp },
  { href: '/calcul-impact', label: "Calcul d'Impact", icon: Activity },
  { href: '/bilan-cl-s', label: 'Bilan Cl & S', icon: Wind },
  { href: '/historique-impact', label: "Historique Impact", icon: Book },
  { href: '/documentation', label: 'Documentation', icon: BookText },
  { href: '/suivi-chlore', label: 'Suivi Chlore', icon: Wind },
  { href: '/gestion-utilisateurs', label: 'Gestion Utilisateurs', icon: Users, adminOnly: true },
  { href: '/gestion-seuils', label: 'Gestion des Seuils', icon: SlidersHorizontal, adminOnly: true },
];

interface SidebarNavProps {
  userRole: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLogout: () => void;
}

export function SidebarNav({ userRole, isOpen, setIsOpen, onLogout }: SidebarNavProps) {
  const pathname = usePathname();
  const { user, userProfile, allowedRoutes } = useAuth();
  const toggleSidebar = () => setIsOpen(!isOpen);

  const visibleLinks = allLinks.filter(link => {
    if (userRole === 'admin') return true; // Admin sees everything
    return allowedRoutes.includes(link.href);
  });

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
                title={isOpen ? undefined : label}
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

      {/* FOOTER & USER SECTION */}
      <div className="px-3 py-4 border-t border-gray-800 space-y-4">
        {userProfile && (
            <div className={cn("px-2 py-2 rounded-lg bg-brand-surface/50 border border-brand-line/50 text-center transition-all duration-300", isOpen ? "opacity-100" : "opacity-0 h-0 p-0 m-0 border-0")}>
               <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                        <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                        <p className="text-xs text-emerald-400 capitalize">{userProfile.role}</p>
                    </motion.div>
                )}
               </AnimatePresence>
            </div>
        )}

        <div className={cn("flex items-center gap-2", isOpen ? "justify-between" : "flex-col justify-center")}>
            <ThemeToggleButton />
            <button
                onClick={onLogout}
                title="Déconnexion"
                className={cn("flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-900/40 hover:bg-red-900/60 transition-colors", !isOpen && "w-full")}
            >
                <LogOut className="w-5 h-5" />
                <AnimatePresence>
                  {isOpen && (
                    <motion.span initial={{ opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>Déconnexion</motion.span>
                  )}
                </AnimatePresence>
            </button>
        </div>

        <div className="text-center text-xs text-gray-500 py-1">
            <AnimatePresence>
                {isOpen && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        © {new Date().getFullYear()} FuelTrack AFR
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
