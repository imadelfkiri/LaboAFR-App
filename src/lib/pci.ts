import { H_MAP } from './data';

export function calculerPCI(pcs: number, humidite: number, type_combustible: string, chlore: number): number | null {
  const H = H_MAP[type_combustible];

  // Chlore is now optional, default to 0 if not provided
  const chloreValue = chlore || 0;

  if (H === undefined || isNaN(pcs) || pcs < 0 || isNaN(humidite) || humidite < 0 || humidite > 100 || isNaN(chloreValue) || chloreValue < 0) {
    return null;
  }
  
  // La formule originale semble être pour le PCI sec, puis ajustée pour l'humidité. 
  // Ici nous calculons directement le PCI sur brut.
  // PCI sur sec = PCS - 5.86 * (%H + %Cl)
  // Formule simplifiée pour PCI sur brut: ((PCS - 50.635 * H) * (1 - Hum/100)) - (Hum * 5.86)
  // La constante 5.86 ou ~6 vient de la chaleur latente de vaporisation de l'eau.
  // 583.26 / 100 est ~5.83, ce qui est proche. On garde votre constante.
  // 50.635 vient de 9 * 5.6 (approximativement), où 9 est le ratio molaire H2O/H2.

  const pci_brut = ((pcs - 50.6353308 * H) * (1 - humidite / 100)) - (humidite * 583.2616878 / 100) - (chloreValue * 5.86);

  if (isNaN(pci_brut) || !isFinite(pci_brut)) {
    return null;
  }

  return Math.round(pci_brut);
}
