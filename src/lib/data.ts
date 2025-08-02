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
  "DMB": 6.5,
  "Mélange": 6.0,
  "RDF": 6.0,
};

export const FUEL_TYPES = Object.keys(H_MAP).sort();

export const FOURNISSEURS = [
    "Ain Seddeine",
    "Aliapur",
    "Bichara",
    "Géocycle",
    "MTR",
    "NAJD",
    "Polluclean",
    "SMBRM",
    "Sotraforest",
    "Ssardi",
    "ValRecete",
    "Valtradec"
].sort();
