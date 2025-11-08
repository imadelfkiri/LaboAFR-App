import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookText, BookOpen, Flame, Beaker, FlaskConical, BarChart3, ClipboardCheck, ClipboardList, FilePieChart, LayoutDashboard, Cog, DollarSign, TrendingUp, SlidersHorizontal, Calculator } from "lucide-react";
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Documentation | FuelTrack AFR",
  description: "Documentation et principes de calcul de l'application FuelTrack AFR.",
};

const documentationArticles = [
  {
    title: "Principe du Tableau de Bord",
    description: "Comprendre les indicateurs, les graphiques et les relations du tableau de bord principal.",
    href: "/documentation/principe-tableau-de-bord",
    icon: LayoutDashboard,
  },
  {
    title: "Principe du Calculateur PCI",
    description: "Fonctionnement, champs, calculs et fonctionnalités de la page Calculateur PCI.",
    href: "/documentation/principe-calcul-pci",
    icon: Flame,
  },
  {
    title: "Principe du Calcul de Mélange",
    description: "Logique, calculs et fonctionnalités de l'outil de simulation de mélange de combustibles.",
    href: "/documentation/principe-calcul-melange",
    icon: Beaker,
  },
  {
    title: "Principe de la Simulation de Mélange",
    description: "Utiliser l'environnement 'bac à sable' pour tester librement des recettes de mélange avec des données manuelles.",
    href: "/documentation/principe-simulation-melange",
    icon: FlaskConical,
  },
  {
    title: "Principe du Calcul d'Impact",
    description: "Méthodologie détaillée de la simulation de l'effet des cendres sur la composition et la qualité du clinker.",
    href: "/documentation/principe-calcul-impact",
    icon: BookText,
  },
  {
    title: "Principe des Analyses de Cendres",
    description: "Gestion des analyses chimiques des cendres et leur relation avec le calcul d'impact.",
    href: "/documentation/principe-analyses-cendres",
    icon: ClipboardList,
  },
  {
    title: "Principe de la Page Résultats",
    description: "Consultez, filtrez, triez et gérez l'historique complet de toutes les analyses de combustibles.",
    href: "/documentation/principe-resultats",
    icon: FlaskConical,
  },
  {
    title: "Principe de la Page Statistiques",
    description: "Visualisez les tendances et comparez les performances des combustibles sur différentes périodes.",
    href: "/documentation/principe-statistiques",
    icon: BarChart3,
  },
  {
    title: "Principe de la Page Spécifications",
    description: "Définissez les seuils de qualité pour chaque couple combustible-fournisseur.",
    href: "/documentation/principe-specifications",
    icon: ClipboardCheck,
  },
    {
    title: "Principe des Données de Référence Combustibles",
    description: "Gérez les données de base (poids godet, teneur H) cruciales pour les calculs de l'application.",
    href: "/documentation/principe-donnees-combustibles",
    icon: Cog,
  },
  {
    title: "Principe de la Gestion des Coûts",
    description: "Définissez le coût par tonne pour chaque combustible et son impact sur le calcul de mélange.",
    href: "/documentation/principe-gestion-couts",
    icon: DollarSign,
  },
  {
    title: "Principe du Rapport de Synthèse",
    description: "Générez un rapport consolidé du mélange et de son impact, prêt à être partagé ou archivé.",
    href: "/documentation/rapport-synthese",
    icon: FilePieChart,
  },
  {
    title: "Principe des Indicateurs de Performance",
    description: "Comprendre le Taux de Substitution (TSR) et la Consommation Calorifique (CC).",
    href: "/documentation/principe-indicateurs",
    icon: TrendingUp,
  },
   {
    title: "Principe de la Gestion des Seuils",
    description: "Configurez les seuils de qualité (vert, jaune, rouge) pour les indicateurs de l'application.",
    href: "/documentation/principe-gestion-seuils",
    icon: SlidersHorizontal,
  },
  {
    title: "Principes des Formules de Calcul",
    description: "Détail de toutes les formules de calcul utilisées dans l'application (PCI, Modules, TSR, etc.).",
    href: "/documentation/principe-formules-calcul",
    icon: Calculator,
  },
];

export default function DocumentationHubPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <BookOpen className="h-8 w-8" />
            Portail de Documentation
        </h1>
        <p className="text-muted-foreground mt-2">
            Retrouvez ici l'ensemble des documents expliquant les logiques et principes de calcul de l'application.
        </p>
      </div>
      
      <div className="grid gap-6">
        {documentationArticles.map((article) => (
          <Link href={article.href} key={article.title} legacyBehavior>
            <a className="block">
              <Card className="hover:border-primary/50 hover:bg-card/80 transition-all duration-200 cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4">
                  <article.icon className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>{article.title}</CardTitle>
                    <CardDescription className="mt-1">{article.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
