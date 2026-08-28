import { describe, expect, it } from "vitest";
import { allocateStrictFcfs } from "@/lib/allocation/allocate-fcfs";
import { allocate } from "@/lib/allocation/allocate";
import type { AllocParticipant, AllocWorkshop } from "@/types/allocation";

function workshop(
  id: string,
  durationMinutes: 60 | 120,
  session: 1 | 2 | null,
  capacity: number
): AllocWorkshop {
  return { id, durationMinutes, session, capacity };
}

function participant(participantId: string, preferences: string[], submittedAt: number): AllocParticipant {
  return { participantId, preferences, submittedAt };
}

describe("allocateStrictFcfs", () => {
  it("dreht das Ergebnis im Vergleich zur fairen Zuteilung um: Ankunftsreihenfolge schlaegt Score", () => {
    // A ist knapp (1 Platz). p_early moechte A eigentlich nur als Teil einer schwaecheren
    // Kombination (seine staerkeren Optionen sind durch X blockiert), p_late moechte A als
    // klare 1. Wahl kombiniert mit B. Bei der FAIREN Zuteilung gewinnt p_late (spaeter, aber
    // hoeherer Score fuer die Kombination mit A) - siehe erste Assertion. Striktes FCFS muss
    // stattdessen p_early bevorzugen, weil er zuerst registriert war.
    const workshops: AllocWorkshop[] = [
      workshop("A", 60, 1, 1), // knapp, umkaempft
      workshop("X", 60, 1, 0), // fuer p_early bereits ausgebucht - blockiert seine bessere Kombi
      workshop("Y", 60, 2, 5),
      workshop("B", 60, 2, 5),
    ];
    const participants: AllocParticipant[] = [
      participant("p_early", ["X", "Y", "A"], 1), // X+Y waere die Wunschkombi, X ist aber voll
      participant("p_late", ["A", "B"], 999),
    ];

    const fair = allocate(participants, workshops);
    expect(fair.assigned.find((a) => a.participantId === "p_late")?.workshopIds.slice().sort()).toEqual([
      "A",
      "B",
    ]);
    expect(fair.assigned.find((a) => a.participantId === "p_early")).toBeUndefined();

    const strict = allocateStrictFcfs(participants, workshops);
    expect(strict.assigned.find((a) => a.participantId === "p_early")?.workshopIds.slice().sort()).toEqual([
      "A",
      "Y",
    ]);
    expect(strict.assigned.find((a) => a.participantId === "p_late")).toBeUndefined();
    expect(strict.waitlisted.map((w) => w.participantId)).toEqual(["p_late"]);
  });

  it("jeder Teilnehmer probiert nur die EIGENEN Praeferenzen der Reihe nach - keine Umverteilung fremder Buchungen", () => {
    // p1 bekommt A+B ueber seine einzige Praeferenz-Kombination. p2 kann A (bereits durch p1
    // belegt) nicht mehr bekommen, weicht aber selbststaendig auf die eigene 3. Praeferenz (C)
    // aus - das ist kein Tausch (p1 wird nie angetastet), sondern schlicht p2s naechstbeste
    // eigene Option.
    const workshops: AllocWorkshop[] = [
      workshop("A", 60, 1, 1),
      workshop("B", 60, 2, 5),
      workshop("C", 60, 1, 5),
    ];
    const participants: AllocParticipant[] = [
      participant("p1", ["A", "B"], 1),
      participant("p2", ["A", "B", "C"], 2),
    ];
    const result = allocateStrictFcfs(participants, workshops);
    const p1 = result.assigned.find((a) => a.participantId === "p1");
    const p2 = result.assigned.find((a) => a.participantId === "p2");
    expect(p1?.workshopIds.slice().sort()).toEqual(["A", "B"]);
    expect(p2?.workshopIds.slice().sort()).toEqual(["B", "C"]);
    expect(result.waitlisted).toHaveLength(0);
  });

  it("Buendel sind atomar - nie nur ein Teil einer 60+60-Kombination", () => {
    const workshops: AllocWorkshop[] = [workshop("A", 60, 1, 1), workshop("B", 60, 2, 5)];
    const participants: AllocParticipant[] = [participant("p1", ["A", "B"], 1)];
    const result = allocateStrictFcfs(participants, workshops);
    expect(result.assigned).toEqual([{ participantId: "p1", workshopIds: ["A", "B"], score: 160 }]);
  });

  it("markiert Teilnehmer ohne gueltige Kombination als Konflikt", () => {
    const workshops: AllocWorkshop[] = [workshop("A", 60, 1, 5), workshop("D", 60, 1, 5)];
    const participants: AllocParticipant[] = [participant("p1", ["A", "D"], 1)];
    const result = allocateStrictFcfs(participants, workshops);
    expect(result.conflicts).toEqual(["p1"]);
  });
});
