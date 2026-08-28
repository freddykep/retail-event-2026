import { describe, expect, it } from "vitest";
import { reassignWaitlist } from "@/lib/allocation/reassign-waitlist";
import type { AllocParticipant, AllocWorkshop } from "@/types/allocation";

function workshop(id: string, capacity: number): AllocWorkshop {
  return { id, durationMinutes: 120, session: null, capacity };
}

function participant(participantId: string, preferences: string[], submittedAt: number): AllocParticipant {
  return { participantId, preferences, submittedAt };
}

describe("reassignWaitlist", () => {
  it("rueckt einen wartenden Teilnehmer in frei gewordene Kapazitaet nach", () => {
    const workshops = [workshop("X", 5)];
    const usage = new Map([["X", 4]]); // 4 von 5 Plaetzen bereits belegt -> 1 frei
    const waitlisted = [participant("p1", ["X"], 1)];
    const result = reassignWaitlist(waitlisted, workshops, usage, "strict-fcfs");
    expect(result.assigned).toEqual([{ participantId: "p1", workshopIds: ["X"], score: 100, sessionAssignment: undefined }]);
    expect(result.stillWaitlisted).toEqual([]);
  });

  it("laesst jemanden auf der Warteliste, wenn weiterhin keine Kapazitaet frei ist", () => {
    const workshops = [workshop("X", 5)];
    const usage = new Map([["X", 5]]); // voll
    const waitlisted = [participant("p1", ["X"], 1)];
    const result = reassignWaitlist(waitlisted, workshops, usage, "strict-fcfs");
    expect(result.assigned).toEqual([]);
    expect(result.stillWaitlisted).toEqual(["p1"]);
  });

  it("strict-fcfs: bei nur einem freien Platz gewinnt, wer zuerst auf der Warteliste stand", () => {
    const workshops = [workshop("X", 5)];
    const usage = new Map([["X", 4]]); // 1 frei
    const waitlisted = [
      participant("p_late", ["X"], 200),
      participant("p_early", ["X"], 100),
    ];
    const result = reassignWaitlist(waitlisted, workshops, usage, "strict-fcfs");
    expect(result.assigned.map((a) => a.participantId)).toEqual(["p_early"]);
    expect(result.stillWaitlisted).toEqual(["p_late"]);
  });

  it("fair: bei Kapazitaetsknappheit gewinnt der hoehere Score, nicht die fruehere Wartelistenposition", () => {
    const workshops = [workshop("X", 5), workshop("Y", 5)];
    const usage = new Map([["X", 5]]); // X voll, Y frei
    // p_early (frueh auf der Warteliste) will NUR X (voll). p_late will X als 2. Wahl,
    // hat aber Y als bessere 1. Wahl - im "fair"-Modus zaehlt der Score, nicht wer zuerst wartete.
    const waitlisted = [
      participant("p_early", ["X"], 1),
      participant("p_late", ["Y", "X"], 999),
    ];
    const result = reassignWaitlist(waitlisted, workshops, usage, "fair");
    const late = result.assigned.find((a) => a.participantId === "p_late");
    expect(late?.workshopIds).toEqual(["Y"]);
    expect(result.stillWaitlisted).toEqual(["p_early"]);
  });

  it("veraendert nie bereits bestaetigte Kapazitaet - fuellt nur additiv auf, kein Verdraengen", () => {
    // Zwei wartende Teilnehmer wollen denselben letzten Platz - nur EINER darf ihn
    // bekommen, der andere bleibt auf der Warteliste (kein Teilerfolg, kein Tausch).
    const workshops = [workshop("X", 1)];
    const usage = new Map([["X", 0]]);
    const waitlisted = [participant("p1", ["X"], 1), participant("p2", ["X"], 2)];
    const result = reassignWaitlist(waitlisted, workshops, usage, "strict-fcfs");
    expect(result.assigned).toHaveLength(1);
    expect(result.stillWaitlisted).toHaveLength(1);
  });
});
