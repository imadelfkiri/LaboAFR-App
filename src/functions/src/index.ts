
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { jsPDF } from "jspdf";

admin.initializeApp();

const bucket = admin.storage().bucket(process.env.GCLOUD_STORAGE_BUCKET);

const formatNumber = (num: number | null | undefined, digits = 2) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
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
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
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

    const indicators = reportData.afIndicators;
    if (indicators) {
        doc.setFontSize(10);
        doc.text(`- PCI moyen: ${formatNumber(indicators.pci, 0)} kcal/kg`, 20, yPos); yPos += 7;
        doc.text(`- % Humidité: ${formatNumber(indicators.humidity, 2)} %`, 20, yPos); yPos += 7;
        doc.text(`- % Cendres: ${formatNumber(indicators.ash, 2)} %`, 20, yPos); yPos += 7;
        doc.text(`- % Chlore: ${formatNumber(indicators.chlorine, 3)} %`, 20, yPos); yPos += 7;
        doc.text(`- Taux de pneus: ${formatNumber(indicators.tireRate, 1)} %`, 20, yPos); yPos += 7;
    }
    yPos += 10;

     // --- Hall & ATS Composition ---
    const generateCompositionText = (title: string, compositionData: any) => {
        if (!compositionData || compositionData.composition.length === 0) return;
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`${title} (Débit: ${formatNumber(compositionData.flowRate, 1)} t/h)`, 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        compositionData.composition.forEach((c: any) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }
            doc.text(`- ${c.name}: ${c.buckets} godets (${formatNumber(c.percentage, 1)}%)`, 20, yPos);
            yPos += 6;
        });
        yPos += 8;
    };

    generateCompositionText("Composition Hall des AF", reportData.hallData);
    generateCompositionText("Composition ATS", reportData.atsData);

    const pdfBuffer = doc.output('arraybuffer');
    const fileBuffer = Buffer.from(pdfBuffer);
    
    const fileName = `rapports/Rapport_Melange_${Date.now()}.pdf`;
    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
      metadata: {
        contentType: 'application/pdf',
      },
      public: true, // Make file public
    });
    
    // Return the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return { downloadUrl: publicUrl };

  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Une erreur est survenue lors de la création du rapport PDF.");
  }
});
