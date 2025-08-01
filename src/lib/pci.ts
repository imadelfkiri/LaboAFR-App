import { H_MAP } from './data';

export function calculerPCI(pcs: number, humidite: number, type_combustible: string): number | null {
  const H = H_MAP[type_combustible];

  if (H === undefined || isNaN(pcs) || pcs < 0 || isNaN(humidite) || humidite < 0 || humidite > 100) {
    return null;
  }
  
  // La formule de calcul du PCI sur brut est ajustée pour l'humidité et l'hydrogène.
  // PCI sur brut = (PCI sur sec) * (1 - Hum/100) - (Chaleur de vaporisation * Hum/100)
  // PCI sur sec = PCS - k * H
  // k est une constante liée à la chaleur de vaporisation de l'eau formée par la combustion de l'hydrogène.
  // Formule simplifiée utilisée : ((PCS - 50.635 * H) * (1 - Hum/100)) - (Hum * 5.86)
  
  const pci_brut = ((pcs - 50.6353308 * H) * (1 - humidite / 100)) - (humidite * 583.2616878 / 100);

  if (isNaN(pci_brut) || !isFinite(pci_brut)) {
    return null;
  }

  return Math.round(pci_brut);
}
