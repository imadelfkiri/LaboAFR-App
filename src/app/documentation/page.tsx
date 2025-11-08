import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookText, BookOpen, Flame, Beaker, FlaskConical } from "lucide-react";
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Documentation | FuelTrack AFR",
  description: "Documentation et principes de calcul de l'application FuelTrack AFR.",
};

const documentationArticles = [
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
    title: "Principe du Calcul d'Impact",
    description: "Méthodologie détaillée de la simulation de l'effet des cendres sur la composition et la qualité du clinker.",
    href: "/documentation/principe-calcul-impact",
    icon: BookText,
  },
  {
    title: "Fonctionnement de la Page Résultats",
    description: "Consultez, filtrez, triez et gérez l'historique complet de toutes les analyses de combustibles.",
    href: "/documentation/principe-resultats",
    icon: FlaskConical,
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
