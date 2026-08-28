import type { SessionAssignment } from "@/lib/allocation/session-slots";

/** Reine Domain-Typen fuer den Zuteilungsalgorithmus - keine Firestore-Abhaengigkeit. */

export interface AllocWorkshop {
  id: string;
  durationMinutes: 60 | 120;
  /**
   * null bei 120-Minuten-Workshops (belegen implizit beide Sessions). "both" bei
   * 60-Minuten-Workshops, die identisch in beiden Sessions laufen (je eigene
   * Kapazitaet - `capacity` gilt dann PRO Session, siehe lib/allocation/session-slots.ts).
   */
  session: 1 | 2 | "both" | null;
  capacity: number;
}

export interface AllocParticipant {
  participantId: string;
  /**
   * Rangfolge der Workshop-IDs, beste Praeferenz zuerst - kann 60- und
   * 120-Minuten-Workshops frei mischen. Es gibt keinen festen "Track" mehr: die
   * Buendel-Bildung (siehe lib/allocation/bundles.ts) leitet gueltige Kombinationen
   * ausschliesslich aus der Dauer/Session der tatsaechlich gewaehlten Workshops ab.
   */
  preferences: string[];
  submittedAt: number;
}

export interface Bundle {
  workshopIds: string[];
  score: number;
  /** Nur gesetzt, wenn mindestens einer der Workshops session === "both" ist - ordnet
   * diesem Workshop die fuer DIESES Buendel konkret gewaehlte Session zu. */
  sessionAssignment?: SessionAssignment;
}

export interface BundleCandidate {
  participantId: string;
  submittedAt: number;
  bundle: Bundle;
}

export interface ParticipantAssignment {
  participantId: string;
  workshopIds: string[];
  score: number;
  sessionAssignment?: SessionAssignment;
}

export interface AllocationResult {
  assigned: ParticipantAssignment[];
  waitlisted: Array<{ participantId: string; workshopIds: string[] }>;
  /** Teilnehmer, fuer die aus ihren Praeferenzen keine gueltige Kombination gebildet werden kann. */
  conflicts: string[];
}

export const PREFERENCE_SCORES = [100, 60, 30] as const;
