export const H_MAP: Record<string, number> = {
  "Pneus": 6.5,
  "Bois": 6.0,
  "CSR": 6.0,
  "Grignons": 6.0,
  "Boues": 5.5,
  "Pet Coke": 3.5,
  "Charbon": 4.5,
  "Caoutchouc": 6.8,
  "Textile": 6.0,
  "Plastiques": 7.0,
  "DMB": 6.5
};

export const FUEL_TYPES = Object.keys(H_MAP);

export function calculerPCI(pcs_sec: number, humidite: number, type_combustible: string): number | null {
  const H = H_MAP[type_combustible];

  if (H === undefined || isNaN(pcs_sec) || pcs_sec < 0 || isNaN(humidite) || humidite < 0 || humidite > 100) {
    return null;
  }

  const pci_brut = ((pcs_sec - 50.6353308 * H) * (1 - humidite / 100)) - (humidite * 583.2616878 / 100);

  if (isNaN(pci_brut) || !isFinite(pci_brut)) {
    return null;
  }

  return Math.round(pci_brut);
}
