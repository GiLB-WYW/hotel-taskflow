export type PreparationScopeItem = {
  id: string;
  building: string;
  title: string;
  plannedFor?: string;
  supplierName?: string;
  category: string;
  tradeName: string;
  estimatedCost?: string;
  quantity?: string;
  invoiceNumber?: string;
  invoiceAmount?: string;
};

const item = (
  id: string,
  building: string,
  title: string,
  plannedFor: string | undefined,
  supplierName: string | undefined,
  category: string,
  tradeName: string,
  extras: Partial<Pick<PreparationScopeItem, "estimatedCost" | "quantity" | "invoiceNumber" | "invoiceAmount">> = {},
): PreparationScopeItem => ({ id, building, title, plannedFor, supplierName, category, tradeName, ...extras });

// Transcribed from "Travaux 2026 - Cahier de charges". Blank source values
// intentionally remain blank: the register must not invent procurement data.
export const preparationScope2026: PreparationScopeItem[] = [
  item("g-electric", "La Guinguette", "Mis en fonction électricité", "Mai 2026", "Bat'elec", "Electrical", "Electrical"),
  item("g-kitchen-floor", "La Guinguette", "Revêtement de sol de la cuisine existant en carreaux norme HCCP", "Mai 2026", "SMTR", "Kitchen Equipment", "Kitchen Equipment"),
  item("g-kitchen-walls", "La Guinguette", "Revêtement des murs de la cuisine existant norme HCCP", "Mai 2026", "SMTR", "Kitchen Equipment", "Kitchen Equipment"),
  item("g-bar-water", "La Guinguette", "Arrivée et évacuation eau bar", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("g-bar-electric", "La Guinguette", "Électricité bar", "Mai 2026", "Bat'elec", "Electrical", "Electrical"),
  item("g-toilets", "La Guinguette", "Remise en état des toilettes (peinture, aération)", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("g-urinal", "La Guinguette", "Ajouter urinoire", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("g-plancha", "La Guinguette", "Plan de travail plancha", "Mai 2026", "SMTR", "Kitchen Equipment", "Kitchen Equipment"),
  item("g-opening", "La Guinguette", "Ouverture avec marches", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("g-fan", "La Guinguette", "Ventilateur plafond en cuisine", "Mai 2026", "SMTR", "Climate Control", "Climate Control"),
  item("g-tank-roof", "La Guinguette", "Toiture citerne avec un ventilateur central et éclairage", "Novembre 2026", "SMTR", "General Works", "General Works"),
  item("a-hood", "Batiment A", "Évacuation aération depuis la hotte existante", "Novembre 2026", "CSE Climatisation", "Climate Control", "Climate Control"),
  item("a-facade", "Batiment A", "Façade rue", "Novembre 2026", "SMTR", "Finishes", "Painting"),
  item("a-roof", "Batiment A", "Rénové toiture", "Novembre 2026", "SMTR", "General Works", "General Works"),
  item("a-toilet-drain", "Batiment A", "Évacuation toilettes restau", "Novembre 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("a-stonework", "Batiment A", "Marbrier ou inox", "Novembre 2026", undefined, "Kitchen Equipment", "Kitchen Equipment"),
  item("a-kitchen-material", "Batiment A", "Matériel cuisine (inox, étagère, sol)", "Novembre 2026", undefined, "Kitchen Equipment", "Kitchen Equipment"),
  item("a-window", "Batiment A", "Porte fenêtre étage", "Novembre 2026", "SMTR", "General Works", "General Works"),
  item("a-kitchen-floor", "Batiment A", "Sol cuisine", "Novembre 2026", "SMTR", "Kitchen Equipment", "Kitchen Equipment"),
  item("a-heatpump", "Batiment A", "Chaudière vers pompe à chaleur", "Novembre 2026", "Aria plomberie", "Climate Control", "Climate Control"),
  item("b-three-phase", "Batiment B", "3 phases pour machine à laver et sèche-linge", "Mai 2026", "Bat'elec", "Electrical", "Electrical"),
  item("b-corridor-toilet", "Batiment B", "Installer toilettes couloir B", "Novembre 2026", "SMTR / Aria", "Plumbing", "Plumbing"),
  item("c-wall", "Batiment C", "Enduire le petit muret à l’entrée", "Mai 2026", "SMTR", "Finishes", "Painting"),
  item("c-wine-door", "Batiment C", "Porte cave à vin / code pour porte", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("c-wine-light", "Batiment C", "Éclairage cave à vin (avec réseaux existants)", "Mai 2026", "Nicolas elec", "Electrical", "Electrical"),
  item("c-store-door", "Batiment C", "Porte pour la réserve du C / code pour porte", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("c-gate", "Batiment C", "Portail (pour client)", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("c-softener", "Batiment C", "Adoucisseurs", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("c-car-charger", "Batiment C", "Borne pour voitures", "Novembre 2026", "Bat'elec", "Electrical", "Electrical"),
  item("c-awning", "Batiment C", "Auvent à l’entrée de C3", "Novembre 2026", "SMTR", "General Works", "General Works"),
  item("c-acoustic", "Batiment C", "Doublage acoustique C4 - local", "Novembre 2026", "SMTR", "General Works", "General Works"),
  item("c-climate", "Batiment C", "Repositionnement climatisation (pour doublage mur)", "Non défini", "CSE Climatisation", "Climate Control", "Climate Control"),
  item("h-circuit", "Batiment H", "Créer un circuit entre les ballons des 4 suites", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("h-water-heater", "Batiment H", "Ajouter un ballon chauffe-eau pour H1 et le raccorder", "Novembre 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("h-softener", "Batiment H", "Adoucisseurs", "Novembre 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("i-circuit", "Batiment I", "Créer un circuit entre les ballons des 3 suites", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("i-softener", "Batiment I", "Adoucisseurs Vulcan", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("i-cart", "Batiment I", "Vérifier la borne pour la voiturette", "Novembre 2026", "Bat'elec", "Electrical", "Electrical"),
  item("i-stock", "Batiment I", "Réaménager le stock / plus acoustique pour la I2 (bruit)", "Novembre 2026", "SMTR", "General Works", "General Works"),
  item("j-garage-walls", "Batiment J", "Murs garage", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("j-garage-floor", "Batiment J", "Sol garage", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("j-three-phase", "Batiment J", "Mise en fonction électricité 3 phases pour machine à laver et sèche-linge", "Mai 2026", "Bat'elec", "Electrical", "Electrical"),
  item("j-vmc", "Batiment J", "VMC", "Mai 2026", "Aria plomberie", "Climate Control", "Climate Control"),
  item("j-clock-light", "Batiment J", "Prévoir un système d’éclairage horloge", "Mai 2026", "Bat'elec", "Electrical", "Electrical"),
  item("j-light", "Batiment J", "Éclairage", "Mai 2026", "Bat'elec", "Electrical", "Electrical"),
  item("j-garage-door", "Batiment J", "Porte entre les deux pièces", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("j-water-drain", "Batiment J", "Vérifier et réparer les évacuations d’eau", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("j-extractor", "Batiment J", "Installer un ventilateur/extracteur", "Mai 2026", "Aria plomberie", "Climate Control", "Climate Control"),
  item("j-softener", "Batiment J", "Adoucisseurs", "Mai 2026", "Aria plomberie", "Plumbing", "Plumbing"),
  item("j-gate", "Batiment J", "Portail coulissant", "Mai 2026", "SMTR", "General Works", "General Works"),
  item("j-wellness", "Batiment J", "Création d’un espace bien-être", "Novembre 2026", undefined, "General Works", "General Works", { estimatedCost: "100000.00", quantity: "1" }),
  item("invoice-0435", "Retard de paiement", "Facture CSE Climatisation F-2026-0435", "Décembre 2025", "CSE Climatisation", "Climate Control", "Climate Control", { invoiceNumber: "F-2026-0435", invoiceAmount: "12660.00" }),
  item("invoice-0430", "Retard de paiement", "Facture CSE Climatisation F-2026-0430", "Décembre 2025", "CSE Climatisation", "Climate Control", "Climate Control", { invoiceNumber: "F-2026-0430", invoiceAmount: "1100.00" }),
  item("landscape-j", "Paysage", "Création escalier paysager J", "Novembre 2026", "Yvan Musa", "Landscaping", "Landscaping"),
  item("landscape-g", "Paysage", "Création escalier paysager Guinguette", "Mai 2026", "Yvan Musa", "Landscaping", "Landscaping"),
  item("landscape-parking", "Paysage", "Réaménagement parking G", "Mai 2026", "Yvan Musa", "Landscaping", "Landscaping"),
];