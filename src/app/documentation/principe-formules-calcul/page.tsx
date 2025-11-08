"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calculator } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const FormulaBlock = ({ title, formula, explanation, className }: { title: string; formula: string; explanation: string[], className?: string }) => (
  <div className={`not-prose my-6 p-4 rounded-lg border ${className}`}>
    <h4 className="font-semibold text-lg mb-2">{title}</h4>
    <pre className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 text-sm text-center font-mono text-emerald-300 overflow-x-auto">
        <code>{formula}</code>
    </pre>
    <div className="mt-3 text-xs space-y-1 text-gray-400">
        {explanation.map((line, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: line }}></p>
        ))}
    </div>
  </div>
);

export default function PrincipeFormulesCalculPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Principes des Formules de Calcul", page_width / 2, yPos, { align: "center" });
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
    const introText = "Ce document détaille les principales formules et logiques de calcul utilisées dans l'application FuelTrack AFR. Il sert de référence pour comprendre comment les données brutes sont transformées en indicateurs de performance.";
    const introLines = doc.splitTextToSize(introText, page_width - margin * 2);
    for (const line of introLines) { doc.text(line, margin, yPos); yPos += 6; }
    yPos += 10;
    
    const sections = [
      {
        title: "1. Calcul du Pouvoir Calorifique Inférieur (PCI)",
        content: "Le PCI sur produit brut est calculé à partir du PCS sur sec. Cette formule prend en compte l'énergie perdue pour l'évaporation de l'humidité du combustible et de l'eau formée par la combustion de l'hydrogène.",
        formula: "pci_brut = ((PCS - 50.635 * H) * (1 - H₂O/100)) - (H₂O * 5.83)",
        explanation: [
            "• <strong>PCS</strong> : Pouvoir Calorifique Supérieur sur sec (kcal/kg), corrigé du taux d'inertes.",
            "• <strong>H</strong> : Teneur en hydrogène (%) du combustible, récupérée depuis les données de référence.",
            "• <strong>H₂O</strong> : Taux d'humidité (%) du combustible."
        ]
      },
      {
        title: "2. Modules du Clinker (LSF, MS, AF)",
        content: "Ces modules sont des indicateurs fondamentaux de la composition et de la 'cuisabilité' du clinker.",
        subFormulas: [
          {
            title: "Facteur de Saturation en Chaux (LSF)",
            formula: "LSF = (100 * CaO) / (2.8 * SiO₂ + 1.18 * Al₂O₃ + 0.65 * Fe₂O₃)",
            explanation: ["• L'LSF mesure le rapport entre la chaux disponible et la chaux nécessaire pour saturer la silice, l'alumine et le fer. Un LSF autour de 95-98 est souvent visé."]
          },
          {
            title: "Module Siliceux (MS)",
            formula: "MS = SiO₂ / (Al₂O₃ + Fe₂O₃)",
            explanation: ["• Le MS influence la proportion de phase silicatée par rapport à la phase liquide dans le four."]
          },
          {
            title: "Module Alumino-Ferrique (AF)",
            formula: "AF = Al₂O₃ / Fe₂O₃",
            explanation: ["• L'AF influence la composition et la quantité de la phase liquide à haute température."]
          }
        ]
      },
       {
        title: "3. Calcul de l'Alite (C₃S)",
        content: "La teneur en C₃S (Alite) est un indicateur crucial de la résistance à court terme du ciment. La formule de Bogue corrigée est utilisée :",
        formula: "C₃S = 4.07 * (CaO - 0.7*SO₃ - (1.27*PF/2) - CaO_libre) - (7.6*SiO₂ + 6.72*Al₂O₃ + 1.43*Fe₂O₃)",
        explanation: [
            "• Toutes les valeurs d'oxydes (CaO, SiO₂, etc.) sont en %.",
            "• <strong>PF</strong> : Perte au Feu (%).",
            "• <strong>CaO_libre</strong> : Pourcentage de chaux libre dans le clinker (%)."
        ]
      },
       {
        title: "4. Calcul des Indicateurs du Mélange (Moyenne Pondérée)",
        content: "La caractéristique X (ex: PCI, % Cendres) d'un mélange de N combustibles est la moyenne des caractéristiques de chaque combustible, pondérée par leur poids respectif.",
        formula: "X_mélange = (Σ (Poids_i * X_i)) / (Σ Poids_i)",
        explanation: [
            "• <strong>Poids_i</strong> : Poids du combustible 'i' dans le mélange (calculé par : Nb de godets × Poids par godet).",
            "• <strong>X_i</strong> : Valeur de la caractéristique X pour le combustible 'i'."
        ]
      },
       {
        title: "5. Taux de Substitution Énergétique (TSR)",
        content: "Le TSR mesure la part d'énergie apportée par les combustibles de substitution par rapport à l'énergie totale.",
        formula: "TSR (%) = (Énergie_AFs + Énergie_Grignons) / Énergie_Totale * 100",
        explanation: [
            "• <strong>Énergie_X</strong> : Apport énergétique d'une famille de combustible (en Gcal/h), calculé par : Débit (t/h) × PCI moyen (kcal/kg) / 1000."
        ]
      },
       {
        title: "6. Consommation Calorifique (CC)",
        content: "La CC mesure l'efficacité énergétique du four.",
        formula: "CC (kcal/kg) = Énergie_Totale (kcal/h) / Production_Clinker (kg/h)",
        explanation: [
            "• <strong>Énergie_Totale (kcal/h)</strong> : Énergie totale (en Gcal/h) × 1,000,000.",
            "• <strong>Production_Clinker (kg/h)</strong> : Débit clinker (t/h) × 1,000."
        ]
      }
    ];

    for (const section of sections) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(section.title, margin, yPos); yPos += 7;
        doc.setFontSize(11); doc.setFont("helvetica", "normal");
        const contentLines = doc.splitTextToSize(section.content, page_width - margin * 2);
        for (const line of contentLines) { doc.text(line, margin, yPos); yPos += 6; }
        yPos += 4;
        
        if (section.formula) {
            doc.setFillColor(240, 240, 240); doc.rect(margin, yPos - 2, page_width - margin*2, 10, 'F');
            doc.setFont("courier", "normal"); doc.text(section.formula, page_width / 2, yPos + 5, { align: "center" });
            yPos += 14;
            doc.setFont("helvetica", "normal");
            for(const expl of section.explanation) {
                 if (yPos > 275) { doc.addPage(); yPos = 20; }
                 const lines = doc.splitTextToSize(expl.replace(/<strong>|<\/strong>/g, ''), page_width-margin*2);
                 for (const line of lines) { doc.text(line, margin+4, yPos); yPos += 6; }
            }
            yPos += 4;
        }

        if (section.subFormulas) {
            for (const sub of section.subFormulas) {
                if (yPos > 260) { doc.addPage(); yPos = 20; }
                doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(sub.title, margin, yPos); yPos += 7;
                doc.setFillColor(240, 240, 240); doc.rect(margin, yPos - 2, page_width - margin*2, 10, 'F');
                doc.setFont("courier", "normal"); doc.text(sub.formula, page_width / 2, yPos + 5, { align: "center" });
                yPos += 14;
                doc.setFont("helvetica", "normal"); doc.setFontSize(11);
                for(const expl of sub.explanation) {
                     if (yPos > 275) { doc.addPage(); yPos = 20; }
                     const lines = doc.splitTextToSize(expl.replace(/<strong>|<\/strong>/g, ''), page_width-margin*2);
                     for (const line of lines) { doc.text(line, margin+4, yPos); yPos += 6; }
                }
                yPos += 6;
            }
        }
        yPos += 8;
    }

    doc.save(`Principes_Formules_Calcul_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
     const sections = [
      {
        title: "1. Calcul du Pouvoir Calorifique Inférieur (PCI)",
        content: "Le PCI sur produit brut est calculé à partir du PCS sur sec. Cette formule prend en compte l'énergie perdue pour l'évaporation de l'humidité du combustible et de l'eau formée par la combustion de l'hydrogène.",
        formula: "pci_brut = ((PCS - 50.635 * H) * (1 - H₂O/100)) - (H₂O * 5.83)",
        explanation: [ "PCS : Pouvoir Calorifique Supérieur sur sec (kcal/kg), corrigé du taux d'inertes.", "H : Teneur en hydrogène (%) du combustible, récupérée depuis les données de référence.", "H₂O : Taux d'humidité (%) du combustible."]
      },
      {
        title: "2. Modules du Clinker (LSF, MS, AF)",
        content: "Ces modules sont des indicateurs fondamentaux de la composition et de la 'cuisabilité' du clinker.",
        subFormulas: [ { title: "Facteur de Saturation en Chaux (LSF)", formula: "LSF = (100 * CaO) / (2.8 * SiO₂ + 1.18 * Al₂O₃ + 0.65 * Fe₂O₃)", explanation: ["L'LSF mesure le rapport entre la chaux disponible et la chaux nécessaire pour saturer la silice, l'alumine et le fer. Un LSF autour de 95-98 est souvent visé."] }, { title: "Module Siliceux (MS)", formula: "MS = SiO₂ / (Al₂O₃ + Fe₂O₃)", explanation: ["Le MS influence la proportion de phase silicatée par rapport à la phase liquide dans le four."] }, { title: "Module Alumino-Ferrique (AF)", formula: "AF = Al₂O₃ / Fe₂O₃", explanation: ["L'AF influence la composition et la quantité de la phase liquide à haute température."] } ]
      },
      { title: "3. Calcul de l'Alite (C₃S)", content: "La teneur en C₃S (Alite) est un indicateur crucial de la résistance à court terme du ciment. La formule de Bogue corrigée est utilisée :", formula: "C₃S = 4.07 * (CaO - 0.7*SO₃ - (1.27*PF/2) - CaO_libre) - (7.6*SiO₂ + 6.72*Al₂O₃ + 1.43*Fe₂O₃)", explanation: [ "Toutes les valeurs d'oxydes (CaO, SiO₂, etc.) sont en %.", "PF : Perte au Feu (%).", "CaO_libre : Pourcentage de chaux libre dans le clinker (%)." ] },
      { title: "4. Calcul des Indicateurs du Mélange (Moyenne Pondérée)", content: "La caractéristique X (ex: PCI, % Cendres) d'un mélange de N combustibles est la moyenne des caractéristiques de chaque combustible, pondérée par leur poids respectif.", formula: "X_mélange = (Σ (Poids_i * X_i)) / (Σ Poids_i)", explanation: [ "Poids_i : Poids du combustible 'i' dans le mélange (calculé par : Nb de godets × Poids par godet).", "X_i : Valeur de la caractéristique X pour le combustible 'i'." ] },
      { title: "5. Taux de Substitution Énergétique (TSR)", content: "Le TSR mesure la part d'énergie apportée par les combustibles de substitution par rapport à l'énergie totale.", formula: "TSR (%) = (Énergie_AFs + Énergie_Grignons) / Énergie_Totale * 100", explanation: [ "Énergie_X : Apport énergétique d'une famille de combustible (en Gcal/h), calculé par : Débit (t/h) × PCI moyen (kcal/kg) / 1000." ] },
      { title: "6. Consommation Calorifique (CC)", content: "La CC mesure l'efficacité énergétique du four.", formula: "CC (kcal/kg) = Énergie_Totale (kcal/h) / Production_Clinker (kg/h)", explanation: [ "Énergie_Totale (kcal/h) : Énergie totale (en Gcal/h) × 1,000,000.", "Production_Clinker (kg/h) : Débit clinker (t/h) × 1,000." ] }
    ];

    const children = [
      new Paragraph({ text: "Principes des Formules de Calcul", heading: HeadingLevel.TITLE, alignment: "center" }),
      new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
      new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
      new Paragraph("Ce document détaille les principales formules et logiques de calcul utilisées dans l'application FuelTrack AFR. Il sert de référence pour comprendre comment les données brutes sont transformées en indicateurs de performance."),
    ];

    sections.forEach(section => {
        children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
        children.push(new Paragraph(section.content));
        if (section.formula) {
            children.push(new Paragraph({ text: section.formula, style: "code", spacing: { before: 100, after: 100 } }));
            section.explanation.forEach(expl => children.push(new Paragraph({ text: expl.replace(/<strong>|<\/strong>/g, ''), bullet: { level: 0 } })));
        }
        if (section.subFormulas) {
            section.subFormulas.forEach(sub => {
                children.push(new Paragraph({ text: sub.title, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
                children.push(new Paragraph({ text: sub.formula, style: "code", spacing: { before: 100, after: 100 } }));
                sub.explanation.forEach(expl => children.push(new Paragraph({ text: expl.replace(/<strong>|<\/strong>/g, ''), bullet: { level: 0 } })));
            });
        }
    });

    const doc = new Document({
      sections: [{ children }],
       styles: {
        paragraphStyles: [{
          id: "code",
          name: "Code Block",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Courier New", size: 20 },
          paragraph: { indentation: { left: 720 }, spacing: { before: 100, after: 100 } },
        }]
      }
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principes_Formules_Calcul_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <Calculator className="h-8 w-8 text-primary" />
          Principes des Formules de Calcul
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-h3:text-emerald-400 prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document détaille les principales formules et logiques de calcul utilisées dans l'application pour transformer les données brutes en indicateurs de performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <h2>1. Calcul du Pouvoir Calorifique</h2>
            <FormulaBlock
                title="PCI sur Brut"
                formula="pci_brut = ((PCS - 50.635 * H) * (1 - H₂O/100)) - (H₂O * 5.83)"
                explanation={["<strong>PCS</strong> : Pouvoir Calorifique Supérieur sur sec (kcal/kg), corrigé du taux d'inertes.", "<strong>H</strong> : Teneur en hydrogène (%) du combustible.", "<strong>H₂O</strong> : Taux d'humidité (%) du combustible."]}
                className="border-emerald-500/30"
            />
            <FormulaBlock
                title="PCS sur Sec (inverse)"
                formula="PCS = ((pci_brut + H₂O * 5.83) / (1 - H₂O/100)) + 50.635 * H"
                explanation={["Formule inversée pour retrouver le PCS à partir du PCI brut."]}
                className="border-sky-500/30"
            />
            
            <h2>2. Modules du Clinker</h2>
            <FormulaBlock
                title="Facteur de Saturation en Chaux (LSF)"
                formula="LSF = (100 * CaO) / (2.8 * SiO₂ + 1.18 * Al₂O₃ + 0.65 * Fe₂O₃)"
                explanation={["Mesure le rapport entre la chaux disponible et la chaux nécessaire pour saturer les autres oxydes."]}
                className="border-purple-500/30"
            />
             <FormulaBlock
                title="Module Siliceux (MS)"
                formula="MS = SiO₂ / (Al₂O₃ + Fe₂O₃)"
                explanation={["Influence la proportion de phase silicatée par rapport à la phase liquide."]}
                className="border-purple-500/30"
            />
             <FormulaBlock
                title="Module Alumino-Ferrique (AF)"
                formula="AF = Al₂O₃ / Fe₂O₃"
                explanation={["Influence la composition et la quantité de la phase liquide."]}
                className="border-purple-500/30"
            />

            <h2>3. Calcul de l'Alite (C₃S)</h2>
            <FormulaBlock
                title="Formule de Bogue Corrigée"
                formula="C₃S = 4.07 * (CaO - 0.7*SO₃ - (1.27*PF/2) - CaO_libre) - (7.6*SiO₂ + 6.72*Al₂O₃ + 1.43*Fe₂O₃)"
                explanation={["Toutes les valeurs d'oxydes (CaO, SiO₂, etc.) sont en %.", "<strong>PF</strong> : Perte au Feu (%).", "<strong>CaO_libre</strong> : Pourcentage de chaux libre dans le clinker (%)."]}
                className="border-amber-500/30"
            />
            
            <h2>4. Logique du Mélange</h2>
             <FormulaBlock
                title="Moyenne Pondérée"
                formula="X_mélange = (Σ (Poids_i * X_i)) / (Σ Poids_i)"
                explanation={["<strong>Poids_i</strong> : Poids du combustible 'i' dans le mélange (Nb de godets × Poids/godet).", "<strong>X_i</strong> : Valeur de la caractéristique (PCI, % Cendres, etc.) pour le combustible 'i'."]}
                className="border-cyan-500/30"
            />

            <h2>5. Indicateurs de Performance</h2>
            <FormulaBlock
                title="Taux de Substitution Énergétique (TSR)"
                formula="TSR (%) = (Énergie_AFs + Énergie_Grignons) / Énergie_Totale * 100"
                explanation={["<strong>Énergie_X</strong> : Apport énergétique (Gcal/h), calculé par : Débit (t/h) × PCI (kcal/kg) / 1000."]}
                className="border-rose-500/30"
            />
            <FormulaBlock
                title="Consommation Calorifique (CC)"
                formula="CC (kcal/kg) = Énergie_Totale (kcal/h) / Production_Clinker (kg/h)"
                explanation={["<strong>Énergie_Totale (kcal/h)</strong> : Apport énergétique total (en Gcal/h) × 1,000,000.", "<strong>Production_Clinker (kg/h)</strong> : Débit de clinker (en t/h) × 1,000."]}
                 className="border-rose-500/30"
            />
        </CardContent>
      </Card>
    </div>
  );
}
