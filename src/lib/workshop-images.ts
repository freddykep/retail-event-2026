export interface WorkshopImageOption {
  id: string;
  label: string;
  path: string;
}

/**
 * Feste Bild-Galerie statt Firebase Storage (siehe README/Plan): Firebase Storage
 * erfordert seit 2024 zwingend den kostenpflichtigen Blaze-Tarif, auch bei minimaler
 * Nutzung. Da fuer dieses Event ohnehin eine feste, kleine Anzahl an Sujets verwendet
 * wird, liegen die Bilder stattdessen als Asset im Repo (`public/workshop-images/`)
 * und der Admin waehlt beim Anlegen eines Workshops eines davon aus.
 */
export const WORKSHOP_IMAGES: WorkshopImageOption[] = [
  { id: "okr-ki", label: "KI & OKR", path: "/workshop-images/okr-ki.jpg" },
  { id: "pet-pitch", label: "PET Pitch-Workshop", path: "/workshop-images/pet-pitch.jpg" },
  {
    id: "freiraeume-handeln",
    label: "Vom Zögern zum Handeln",
    path: "/workshop-images/freiraeume-handeln.jpg",
  },
  {
    id: "context-engineering",
    label: "Context Engineering 101",
    path: "/workshop-images/context-engineering.jpg",
  },
  { id: "multi-agent", label: "Multi-Agent-Architekturen", path: "/workshop-images/multi-agent.jpg" },
  { id: "ki-handel-lego", label: "KI im Handel mit LEGO", path: "/workshop-images/ki-handel-lego.jpg" },
  { id: "adessogpt-tag", label: "Ein Tag mit adessoGPT", path: "/workshop-images/adessogpt-tag.jpg" },
];

export function findWorkshopImage(id: string | null | undefined): WorkshopImageOption | null {
  if (!id) return null;
  return WORKSHOP_IMAGES.find((img) => img.id === id) ?? null;
}

export function workshopImageIdFromUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return WORKSHOP_IMAGES.find((img) => img.path === imageUrl)?.id ?? null;
}
