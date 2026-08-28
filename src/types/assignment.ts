import type { SessionAssignment } from "@/lib/allocation/session-slots";

export interface DraftAssignmentDoc {
  participantId: string;
  workshopIds: string[];
  score: number;
  sessionAssignment?: SessionAssignment;
}

export interface DraftMeta {
  waitlisted: Array<{ participantId: string; workshopIds: string[] }>;
  conflicts: string[];
  generatedAt: number;
}

export interface AssignmentDoc {
  participantId: string;
  workshopIds: string[];
  session1WorkshopId: string | null;
  session2WorkshopId: string | null;
  status: "published";
  publishedAt: number;
}

/**
 * "fair": score-basierte Zuteilung mit Swap-Repair-Ausgleich (lib/allocation/allocate.ts).
 * "strict-fcfs": striktes First-Come-First-Served ohne Score und ohne Ausgleich
 * (lib/allocation/allocate-fcfs.ts). Vor Anmeldeschluss admin-waehlbar.
 */
export type AllocationMode = "fair" | "strict-fcfs";

export interface EventConfig {
  registrationOpen: boolean;
  assignmentPublished: boolean;
  allocationMode: AllocationMode;
  draftMeta: DraftMeta | null;
}
