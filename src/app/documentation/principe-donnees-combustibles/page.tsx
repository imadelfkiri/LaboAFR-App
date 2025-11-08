"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cog } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';

export default function PrincipeDonneesCombustiblesPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Page Données de Référence", page_width / 2, yPos, { align: "center" });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Document généré le ${date}`, page_width / 2, yPos, { align: "center" });
    yPos += 15;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Introduction", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const introText = [
      "La page \"Données de Référence des Combustibles\" est la colonne vertébrale technique de l'application. Elle centralise les caractéristiques physiques intrinsèques de chaque type de combustible. Ces données sont considérées comme des constantes pour un type de combustible donné.",
      "Son objectif est de fournir des valeurs de référence fiables qui seront utilisées dans tous les modules de calcul. Une configuration incorrecte sur cette page peut entraîner des erreurs en cascade dans toute l'application."
    ];
    for (const text of introText) {
        const lines = doc.splitTextToSize(text, page_width - margin * 2);
        for (const line of lines) {
            doc.text(line, margin, yPos);
            yPos += 6;
        }
        yPos += 4;
    }
    yPos += 6;
    
    const sections = [
        {
            title: "1. Description des Champs Clés",
            content: "Cette page contient des informations critiques qui servent de base à de nombreux calculs.",
            points: [
                "Poids par Godet (tonnes) : Il s'agit du poids moyen, en tonnes, qu'un seul godet représente pour un type de combustible donné. C'est une donnée essentielle pour la page \"Calcul de Mélange\", car elle permet de traduire un \"nombre de godets\" en un poids réel, qui est ensuite utilisé pour calculer la proportion de chaque combustible dans le mélange.",
                "Teneur en Hydrogène (%) : C'est le pourcentage massique d'hydrogène (H) dans le combustible. Cette valeur est l'un des paramètres les plus importants pour le calcul du Pouvoir Calorifique Inférieur (PCI) à partir du Pouvoir Calorifique Supérieur (PCS). Une valeur de H incorrecte ici faussera tous les calculs de PCI sur la page \"Calculateur PCI\"."
            ]
        },
        {
            title: "2. Relation avec les Autres Pages (Impact Critique)",
            content: "Les données de cette page sont fondamentales pour deux autres modules principaux :",
            points: [
                 "Calculateur PCI : Lorsque vous sélectionnez un combustible dans le formulaire du calculateur, l'application vient automatiquement chercher la \"Teneur en Hydrogène\" correspondante sur cette page pour effectuer le calcul du PCI. Si la valeur n'est pas définie ici, le calcul sera impossible.",
                 "Calcul de Mélange : Lorsque vous définissez une recette en nombre de godets, l'outil utilise le \"Poids par Godet\" défini ici pour convertir ce nombre en un poids réel (en tonnes). Ce poids est ensuite utilisé pour calculer les proportions de chaque combustible dans le mélange et en déduire les indicateurs globaux (PCI moyen, % Chlore moyen, etc.).",
            ]
        },
        {
            title: "3. Gestion des Données",
            content: "L'interface est conçue pour une gestion simple et sécurisée de ces données de base.",
            points: [
                "Ajouter des Données : Permet de créer une entrée pour un nouveau type de combustible qui n'est pas encore dans la base de données.",
                "Modifier : Permet de mettre à jour le poids par godet ou la teneur en hydrogène pour un combustible existant. Soyez prudent, car cette modification affectera tous les calculs futurs qui utilisent ce combustible."
            ]
        }
    ];

    for (const section of sections) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, yPos);
        yPos += 7;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        if(section.content) {
            const contentLines = doc.splitTextToSize(section.content, page_width - margin * 2);
            for (const line of contentLines) {
                doc.text(line, margin, yPos);
                yPos += 6;
            }
            yPos += 4;
        }
        
        if(section.points) {
            for (const point of section.points) {
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                const pointLines = doc.splitTextToSize(point, page_width - margin * 2 - 10);
                doc.text("•", margin + 5, yPos);
                for(const line of pointLines) {
                    doc.text(line, margin + 10, yPos);
                    yPos += 6;
                }
                yPos += 3;
            }
        }
        yPos += 8;
    }

    doc.save(`Principe_Donnees_Combustibles_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Page Données de Référence", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Données de Référence des Combustibles\" est la colonne vertébrale technique de l'application. Elle centralise les caractéristiques physiques intrinsèques de chaque type de combustible. Ces données sont considérées comme des constantes pour un type de combustible donné."),
        new Paragraph("Son objectif est de fournir des valeurs de référence fiables qui seront utilisées dans tous les modules de calcul. Une configuration incorrecte sur cette page peut entraîner des erreurs en cascade dans toute l'application."),

        new Paragraph({ text: "1. Description des Champs Clés", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cette page contient des informations critiques qui servent de base à de nombreux calculs."),
        new Paragraph({ text: "Poids par Godet (tonnes) : Il s'agit du poids moyen, en tonnes, qu'un seul godet représente pour un type de combustible donné. C'est une donnée essentielle pour la page \"Calcul de Mélange\", car elle permet de traduire un \"nombre de godets\" en un poids réel, qui est ensuite utilisé pour calculer la proportion de chaque combustible dans le mélange.", bullet: { level: 0 } }),
        new Paragraph({ text: "Teneur en Hydrogène (%) : C'est le pourcentage massique d'hydrogène (H) dans le combustible. Cette valeur est l'un des paramètres les plus importants pour le calcul du Pouvoir Calorifique Inférieur (PCI) à partir du Pouvoir Calorifique Supérieur (PCS). Une valeur de H incorrecte ici faussera tous les calculs de PCI sur la page \"Calculateur PCI\".", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Relation avec les Autres Pages (Impact Critique)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Les données de cette page sont fondamentales pour deux autres modules principaux :"),
        new Paragraph({ text: "Calculateur PCI : Lorsque vous sélectionnez un combustible dans le formulaire du calculateur, l'application vient automatiquement chercher la \"Teneur en Hydrogène\" correspondante sur cette page pour effectuer le calcul du PCI. Si la valeur n'est pas définie ici, le calcul sera impossible.", bullet: { level: 0 } }),
        new Paragraph({ text: "Calcul de Mélange : Lorsque vous définissez une recette en nombre de godets, l'outil utilise le \"Poids par Godet\" défini ici pour convertir ce nombre en un poids réel (en tonnes). Ce poids est ensuite utilisé pour calculer les proportions de chaque combustible dans le mélange et en déduire les indicateurs globaux (PCI moyen, % Chlore moyen, etc.).", bullet: { level: 0 } }),
        
        new Paragraph({ text: "3. Gestion des Données", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("L'interface est conçue pour une gestion simple et sécurisée de ces données de base."),
        new Paragraph({ text: "Ajouter des Données : Permet de créer une entrée pour un nouveau type de combustible qui n'est pas encore dans la base de données.", bullet: { level: 0 } }),
        new Paragraph({ text: "Modifier : Permet de mettre à jour le poids par godet ou la teneur en hydrogène pour un combustible existant. Soyez prudent, car cette modification affectera tous les calculs futurs qui utilisent ce combustible.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Donnees_Combustibles_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <Cog className="h-8 w-8 text-primary" />
          Fonctionnement de la Page Données de Référence
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique l'importance des données de référence (poids godet, teneur H) et leur rôle central dans les calculs de l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Données de Référence des Combustibles" est la colonne vertébrale technique de l'application. Elle centralise les caractéristiques physiques intrinsèques de chaque type de combustible. Ces données sont considérées comme des constantes pour un type de combustible donné.
          </p>
          <p>
            Son objectif est de fournir des valeurs de référence fiables qui seront utilisées dans tous les modules de calcul. Une configuration incorrecte sur cette page peut entraîner des erreurs en cascade dans toute l'application.
          </p>
          
          <h2>1. Description des Champs Clés</h2>
          <p>
            Cette page contient des informations critiques qui servent de base à de nombreux calculs.
          </p>
          <ul>
            <li><strong>Poids par Godet (tonnes) :</strong> Il s'agit du poids moyen, en tonnes, qu'un seul godet représente pour un type de combustible donné. C'est une donnée essentielle pour la page <Link href="/calcul-melange">Calcul de Mélange</Link>, car elle permet de traduire un "nombre de godets" en un poids réel, qui est ensuite utilisé pour calculer la proportion de chaque combustible dans le mélange.</li>
            <li><strong>Teneur en Hydrogène (%) :</strong> C'est le pourcentage massique d'hydrogène (H) dans le combustible. Cette valeur est l'un des paramètres les plus importants pour le calcul du Pouvoir Calorifique Inférieur (PCI) à partir du Pouvoir Calorifique Supérieur (PCS). Une valeur de H incorrecte ici faussera tous les calculs de PCI sur la page <Link href="/calculateur">Calculateur PCI</Link>.</li>
          </ul>

          <h2>2. Relation avec les Autres Pages (Impact Critique)</h2>
          <p>
            Les données de cette page sont fondamentales pour deux autres modules principaux :
          </p>
          <ul>
            <li><strong>Calculateur PCI :</strong> Lorsque vous sélectionnez un combustible dans le formulaire du calculateur, l'application vient automatiquement chercher la "Teneur en Hydrogène" correspondante sur cette page pour effectuer le calcul du PCI. Si la valeur n'est pas définie ici, le calcul sera impossible.</li>
            <li><strong>Calcul de Mélange :</strong> Lorsque vous définissez une recette en nombre de godets, l'outil utilise le "Poids par Godet" défini ici pour convertir ce nombre en un poids réel (en tonnes). Ce poids est ensuite utilisé pour calculer les proportions de chaque combustible dans le mélange et en déduire les indicateurs globaux (PCI moyen, % Chlore moyen, etc.).</li>
          </ul>

          <h2>3. Gestion des Données</h2>
          <p>
            L'interface est conçue pour une gestion simple et sécurisée de ces données de base.
          </p>
          <ul>
              <li><strong>Ajouter des Données :</strong> Permet de créer une entrée pour un nouveau type de combustible qui n'est pas encore dans la base de données.</li>
              <li><strong>Modifier :</strong> Permet de mettre à jour le poids par godet ou la teneur en hydrogène pour un combustible existant. Soyez prudent, car cette modification affectera tous les calculs futurs qui utilisent ce combustible.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
