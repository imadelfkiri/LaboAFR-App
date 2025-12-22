
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as jspdf from "jspdf";
import "jspdf-autotable";

// Correction : Initialiser l'application admin
admin.initializeApp();

const bucket = admin.storage().bucket();

// Extend jsPDF for autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jspdf.jsPDF;
  }
}

const formatNumber = (num: number | null | undefined, digits = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0,00';
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const generateAndSaveReport = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "L'utilisateur doit être authentifié.");
  }
  
  const { reportData } = data;
  if (!reportData) {
    throw new functions.https.HttpsError("invalid-argument", "Les données du rapport sont manquantes.");
  }

  try {
    const doc = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const date = reportData.date || "N/A";
    let yPos = 20;

    // --- Title ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Rapport de Synthèse du Mélange", 105, yPos, { align: "center" });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(date, 105, yPos, { align: "center" });
    yPos += 15;

    // --- Global Indicators ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Indicateurs du Mélange AFs", 14, yPos);
    yPos += 8;
    (doc as any).autoTable({
        startY: yPos,
        body: [
            ["PCI moyen", `${formatNumber(reportData.afIndicators?.pci, 0)} kcal/kg`],
            ["% Humidité", `${formatNumber(reportData.afIndicators?.humidity, 2)} %`],
            ["% Cendres", `${formatNumber(reportData.afIndicators?.ash, 2)} %`],
            ["% Chlore", `${formatNumber(reportData.afIndicators?.chlorine, 3)} %`],
            ["Taux de pneus", `${formatNumber(reportData.afIndicators?.tireRate, 1)} %`],
        ],
        theme: 'striped',
        styles: { fontSize: 10 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

     // --- Hall & ATS Composition ---
    const generateCompositionTable = (title: string, composition: any[], flowRate: number) => {
        if (composition.length === 0) return;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`${title} (Débit: ${formatNumber(flowRate, 1)} t/h)`, 14, yPos);
        yPos += 8;
        (doc as any).autoTable({
            startY: yPos,
            head: [['Combustible', 'Nb. Godets', '% Poids']],
            body: composition.map(c => [c.name, c.buckets, `${formatNumber(c.percentage, 1)}%`]),
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 9 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 12;
    };

    generateCompositionTable("Composition Hall des AF", reportData.hallData?.composition || [], reportData.hallData?.flowRate || 0);
    if(yPos > 250) { doc.addPage(); yPos = 20; }
    generateCompositionTable("Composition ATS", reportData.atsData?.composition || [], reportData.atsData?.flowRate || 0);

    const pdfBuffer = doc.output('arraybuffer');
    const fileBuffer = Buffer.from(pdfBuffer);
    
    const fileName = `rapports/Rapport_Melange_${Date.now()}.pdf`;
    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
      metadata: {
        contentType: 'application/pdf',
      },
    });
    
    // Use getSignedUrl for a secure, temporary download link
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 15, // 15 minutes
    });

    return { downloadUrl: url };

  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Une erreur est survenue lors de la création du rapport PDF.");
  }
});
