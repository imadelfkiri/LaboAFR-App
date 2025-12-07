"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeSpecificationsPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Page Spécifications", page_width / 2, yPos, { align: "center" });
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
      "La page \"Spécifications\" est le centre de contrôle de la qualité des combustibles. C'est ici que vous définissez les standards attendus pour chaque couple combustible-fournisseur.",
      "L'objectif est de créer un cahier des charges interne qui servira de référence dans toute l'application pour valider la conformité des lots reçus. Une spécification bien définie est la clé pour un suivi de qualité efficace et automatisé."
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
            title: "1. L'Interface de Gestion des Spécifications",
            content: "L'interface se présente sous la forme d'un tableau qui liste toutes les spécifications que vous avez créées. Chaque ligne représente une règle unique pour un combustible et un fournisseur donné.",
            points: [
                "Visualisation : Le tableau affiche clairement les seuils définis pour chaque indicateur : PCI Minimum, Humidité (H₂O) Maximum, Chlore (Cl-) Maximum, Cendres Maximum, et Soufre Maximum.",
                "Ajouter une spécification : Le bouton \"Ajouter une spécification\" ouvre une fenêtre modale où vous pouvez sélectionner un combustible, un fournisseur, puis définir les valeurs seuils pour la qualité attendue. Vous n'êtes pas obligé de remplir tous les champs, uniquement ceux qui sont pertinents.",
                "Modifier une spécification : En cliquant sur l'icône d'édition (crayon) sur une ligne, vous pouvez ajuster les seuils d'une spécification existante.",
                "Supprimer une spécification : L'icône de corbeille permet de supprimer une règle qui n'est plus d'actualité."
            ]
        },
        {
            title: "2. Importance et Impact dans l'Application",
            content: "Les spécifications que vous définissez ici ne sont pas juste des données informatives. Elles sont activement utilisées par d'autres modules de l'application pour automatiser le contrôle qualité :",
            points: [
                 "Page Calculateur PCI : Lorsque vous saisissez une nouvelle analyse, les champs (% H₂O, % Cl-, % Cendres) et le résultat du PCI changent de couleur (vert pour conforme, rouge pour non-conforme) en se basant sur les spécifications du couple combustible-fournisseur sélectionné.",
                 "Page Résultats des Analyses : La colonne \"Alertes\" affiche une icône verte ou rouge pour chaque analyse, vous permettant d'identifier en un coup d'œil les lots non-conformes. Le survol de l'icône rouge vous donne le détail de la ou des non-conformités.",
                 "Fiabilité des données : En centralisant les règles de qualité, vous assurez une cohérence dans l'évaluation des combustibles à travers toute l'application et pour tous les utilisateurs."
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

    doc.save(`Principe_Page_Specifications_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Page Spécifications", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Spécifications\" est le centre de contrôle de la qualité des combustibles. C'est ici que vous définissez les standards attendus pour chaque couple combustible-fournisseur."),
        new Paragraph("L'objectif est de créer un cahier des charges interne qui servira de référence dans toute l'application pour valider la conformité des lots reçus. Une spécification bien définie est la clé pour un suivi de qualité efficace et automatisé."),

        new Paragraph({ text: "1. L'Interface de Gestion des Spécifications", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("L'interface se présente sous la forme d'un tableau qui liste toutes les spécifications que vous avez créées. Chaque ligne représente une règle unique pour un combustible et un fournisseur donné."),
        new Paragraph({ text: "Visualisation : Le tableau affiche clairement les seuils définis pour chaque indicateur : PCI Minimum, Humidité (H₂O) Maximum, Chlore (Cl-) Maximum, Cendres Maximum, et Soufre Maximum.", bullet: { level: 0 } }),
        new Paragraph({ text: "Ajouter une spécification : Le bouton \"Ajouter une spécification\" ouvre une fenêtre modale où vous pouvez sélectionner un combustible, un fournisseur, puis définir les valeurs seuils pour la qualité attendue. Vous n'êtes pas obligé de remplir tous les champs, uniquement ceux qui sont pertinents.", bullet: { level: 0 } }),
        new Paragraph({ text: "Modifier une spécification : En cliquant sur l'icône d'édition (crayon) sur une ligne, vous pouvez ajuster les seuils d'une spécification existante.", bullet: { level: 0 } }),
        new Paragraph({ text: "Supprimer une spécification : L'icône de corbeille permet de supprimer une règle qui n'est plus d'actualité.", bullet: { level: 0 } }),

        new Paragraph({ text: "2. Importance et Impact dans l'Application", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Les spécifications que vous définissez ici ne sont pas juste des données informatives. Elles sont activement utilisées par d'autres modules de l'application pour automatiser le contrôle qualité :"),
        new Paragraph({ text: "Page Calculateur PCI : Lorsque vous saisissez une nouvelle analyse, les champs (% H₂O, % Cl-, % Cendres) et le résultat du PCI changent de couleur (vert pour conforme, rouge pour non-conforme) en se basant sur les spécifications du couple combustible-fournisseur sélectionné.", bullet: { level: 0 } }),
        new Paragraph({ text: "Page Résultats des Analyses : La colonne \"Alertes\" affiche une icône verte ou rouge pour chaque analyse, vous permettant d'identifier en un coup d'œil les lots non-conformes. Le survol de l'icône rouge vous donne le détail de la ou des non-conformités.", bullet: { level: 0 } }),
        new Paragraph({ text: "Fiabilité des données : En centralisant les règles de qualité, vous assurez une cohérence dans l'évaluation des combustibles à travers toute l'application et pour tous les utilisateurs.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Page_Specifications_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          Fonctionnement de la Page Spécifications
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment définir les seuils de qualité pour chaque couple combustible-fournisseur et l'impact de ces règles dans l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Spécifications" est le centre de contrôle de la qualité des combustibles. C'est ici que vous définissez les standards attendus pour chaque couple combustible-fournisseur.
          </p>
          <p>
            L'objectif est de créer un cahier des charges interne qui servira de référence dans toute l'application pour valider la conformité des lots reçus. Une spécification bien définie est la clé pour un suivi de qualité efficace et automatisé.
          </p>
          
          <h2>1. L'Interface de Gestion des Spécifications</h2>
          <p>
            L'interface se présente sous la forme d'un tableau qui liste toutes les spécifications que vous avez créées. Chaque ligne représente une règle unique pour un combustible et un fournisseur donné.
          </p>
          <ul>
            <li><strong>Visualisation :</strong> Le tableau affiche clairement les seuils définis pour chaque indicateur : PCI Minimum, Humidité (H₂O) Maximum, Chlore (Cl-) Maximum, Cendres Maximum, et Soufre Maximum.</li>
            <li><strong>Ajouter une spécification :</strong> Le bouton "Ajouter une spécification" ouvre une fenêtre modale où vous pouvez sélectionner un combustible, un fournisseur, puis définir les valeurs seuils pour la qualité attendue. Vous n'êtes pas obligé de remplir tous les champs, uniquement ceux qui sont pertinents.</li>
            <li><strong>Modifier une spécification :</strong> En cliquant sur l'icône d'édition (crayon) sur une ligne, vous pouvez ajuster les seuils d'une spécification existante.</li>
            <li><strong>Supprimer une spécification :</strong> L'icône de corbeille permet de supprimer une règle qui n'est plus d'actualité.</li>
          </ul>

          <h2>2. Importance et Impact dans l'Application</h2>
          <p>
            Les spécifications que vous définissez ici ne sont pas juste des données informatives. Elles sont activement utilisées par d'autres modules de l'application pour automatiser le contrôle qualité :
          </p>
          <ul>
            <li><strong>Page Calculateur PCI :</strong> Lorsque vous saisissez une nouvelle analyse, les champs (% H₂O, % Cl-, % Cendres) et le résultat du PCI changent de couleur (vert pour conforme, rouge pour non-conforme) en se basant sur les spécifications du couple combustible-fournisseur sélectionné.</li>
            <li><strong>Page Résultats des Analyses :</strong> La colonne "Alertes" affiche une icône verte ou rouge pour chaque analyse, vous permettant d'identifier en un coup d'œil les lots non-conformes. Le survol de l'icône rouge vous donne le détail de la ou des non-conformités.</li>
            <li><strong>Fiabilité des données :</strong> En centralisant les règles de qualité, vous assurez une cohérence dans l'évaluation des combustibles à travers toute l'application et pour tous les utilisateurs.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
