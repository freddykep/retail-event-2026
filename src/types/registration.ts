import { z } from "zod";
import type { SessionAssignment } from "@/lib/allocation/session-slots";

export type RegistrationOutcomeStatus = "confirmed" | "waitlisted";

export interface RegistrationDoc {
  participantId: string;
  /** Rangfolge der bevorzugten Workshop-IDs, beste zuerst (1-3 Eintraege, kann 60-
   * und 120-Minuten-Workshops mischen - siehe lib/allocation/bundles.ts). */
  preferences: string[];
  submittedAt: number;
  updatedAt: number;
  status: RegistrationOutcomeStatus;
  /** Tatsaechlich reserviertes Buendel, leer wenn status === "waitlisted". */
  confirmedWorkshopIds: string[];
  /** Fuer Workshops mit session === "both" in confirmedWorkshopIds: welche der beiden
   * Sessions tatsaechlich belegt wurde (noetig, um bei einer spaeteren Aenderung die
   * richtige Session-Kapazitaet wieder freizugeben). */
  confirmedSessionAssignment?: SessionAssignment;
}

export interface WaitlistEntryDoc {
  participantId: string;
  /** Gewuenschtes Buendel, fuer das gewartet wird. */
  workshopIds: string[];
  position: number;
  createdAt: number;
}

export const registrationSubmitSchema = z.object({
  preferences: z
    .array(z.string().min(1))
    .min(1, "Bitte waehle mindestens einen Workshop")
    .max(3, "Maximal 3 Praeferenzen moeglich")
    .refine((prefs) => new Set(prefs).size === prefs.length, {
      message: "Praeferenzen muessen unterschiedliche Workshops sein",
    }),
});

export type RegistrationSubmitInput = z.infer<typeof registrationSubmitSchema>;
