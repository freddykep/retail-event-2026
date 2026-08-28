import { z } from "zod";

export type WorkshopDuration = 60 | 120;
export type WorkshopSession = 1 | 2;
/** "both": 60-Minuten-Workshop laeuft identisch (zwei unabhaengige Durchlaeufe) in
 * beiden Sessions - `capacity` gilt dann PRO Session (z.B. 20 -> 40 Plaetze gesamt,
 * fest getrennt je Session, keine flexible Umverteilung). */
export type WorkshopSessionSetting = WorkshopSession | "both";

export interface WorkshopDoc {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  durationMinutes: WorkshopDuration;
  /** Nur bei durationMinutes === 60 gesetzt. 120min-Workshops belegen implizit beide Sessions. */
  session: WorkshopSessionSetting | null;
  /** Bei session === "both": Kapazitaet PRO Session (Gesamtkapazitaet = capacity * 2). */
  capacity: number;
  /** Gesamtzahl bestaetigter Teilnehmer (bei "both": Summe aus beiden Sessions). */
  confirmedCount: number;
  waitlistCount: number;
  /** Nur bei session === "both" gepflegt - Aufteilung von confirmedCount auf die
   * beiden unabhaengigen Session-Durchlaeufe. */
  session1ConfirmedCount: number;
  session2ConfirmedCount: number;
  room: string;
  speaker: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export const workshopInputSchema = z
  .object({
    title: z.string().trim().min(1, "Titel ist erforderlich"),
    description: z.string().trim().min(1, "Beschreibung ist erforderlich"),
    durationMinutes: z.union([z.literal(60), z.literal(120)]),
    session: z.union([z.literal(1), z.literal(2), z.literal("both")]).nullable(),
    capacity: z.number().int().min(1, "Kapazitaet muss mindestens 1 sein"),
    room: z.string().trim().default(""),
    speaker: z.string().trim().default(""),
    active: z.boolean().default(true),
  })
  .refine((data) => (data.durationMinutes === 60 ? data.session !== null : true), {
    message: "60-Minuten-Workshops benoetigen eine Session (1, 2 oder beide)",
    path: ["session"],
  });

export type WorkshopInput = z.infer<typeof workshopInputSchema>;

/** Kapazitaet aus Teilnehmer-/Uebersichtssicht: bei "both" die Summe beider
 * unabhaengiger Session-Toepfe (2x capacity), sonst die Kapazitaet selbst. */
export function effectiveCapacity(workshop: Pick<WorkshopDoc, "session" | "capacity">): number {
  return workshop.session === "both" ? workshop.capacity * 2 : workshop.capacity;
}

export function capacityStatus(
  workshop: Pick<WorkshopDoc, "session" | "capacity" | "confirmedCount">
): "available" | "few" | "full" {
  const total = effectiveCapacity(workshop);
  const remaining = total - workshop.confirmedCount;
  if (remaining <= 0) return "full";
  if (remaining <= Math.max(2, Math.ceil(total * 0.15))) return "few";
  return "available";
}
