import { describe, expect, it } from "vitest";
import { allocate } from "@/lib/allocation/allocate";
import { enumerateBundles } from "@/lib/allocation/bundles";
import type { AllocParticipant, AllocWorkshop } from "@/types/allocation";

function workshop(
  id: string,
  durationMinutes: 60 | 120,
  session: 1 | 2 | "both" | null,
  capacity: number
): AllocWorkshop {
  return { id, durationMinutes, session, capacity };
}

function participant(
  participantId: string,
  preferences: string[],
  submittedAt: number
): AllocParticipant {
  return { participantId, preferences, submittedAt };
}

describe("enumerateBundles", () => {
  const workshops = new Map<string, AllocWorkshop>([
    ["A", workshop("A", 60, 1, 10)],
    ["B", workshop("B", 60, 2, 10)],
    ["C", workshop("C", 60, 1, 10)],
    ["X", workshop("X", 120, null, 10)],
  ]);

  it("bildet nur 60min-Paare aus unterschiedlichen Sessions", () => {
    const p = participant("p1", ["A", "B", "C"], 1);
    const bundles = enumerateBundles(p, workshops);
    // A+B (Session 1+2) und B+C (Session 2+1) sind gueltig, A+C (beide Session 1) nicht
    expect(bundles.map((b) => [...b.workshopIds].sort())).toEqual(
      expect.arrayContaining([
        ["A", "B"].sort(),
        ["B", "C"].sort(),
      ])
    );
    expect(bundles.some((b) => b.workshopIds.includes("A") && b.workshopIds.includes("C"))).toBe(
      false
    );
  });

  it("bewertet Praeferenz 1+2 hoeher als 1+3", () => {
    const p = participant("p1", ["A", "B", "C"], 1);
    const bundles = enumerateBundles(p, workshops);
    const ab = bundles.find(
      (b) => b.workshopIds.includes("A") && b.workshopIds.includes("B")
    )!;
    const bc = bundles.find(
      (b) => b.workshopIds.includes("B") && b.workshopIds.includes("C")
    )!;
    expect(ab.score).toBe(160); // 100 + 60
    expect(bc.score).toBe(90); // 60 + 30
  });

  it("liefert fuer 120min-Praeferenzen einzelne Buendel", () => {
    const p = participant("p1", ["X"], 1);
    const bundles = enumerateBundles(p, workshops);
    expect(bundles).toEqual([{ workshopIds: ["X"], score: 100 }]);
  });

  it("mischt 120min- und 60min-Praeferenzen frei (kein fester Track mehr)", () => {
    // 1. Wunsch: 2-Stunden-Workshop X. Alternative: zwei 1-Stunden-Workshops A+B.
    const p = participant("p1", ["X", "A", "B"], 1);
    const bundles = enumerateBundles(p, workshops);
    expect(bundles).toContainEqual({ workshopIds: ["X"], score: 100 });
    expect(bundles).toContainEqual({ workshopIds: ["A", "B"], score: 90 }); // 60 + 30
  });

  it("liefert leere Liste bei ungueltiger Kombination (alle gleiche Session)", () => {
    const sameSession = new Map<string, AllocWorkshop>([
      ["A", workshop("A", 60, 1, 10)],
      ["D", workshop("D", 60, 1, 10)],
    ]);
    const p = participant("p1", ["A", "D"], 1);
    expect(enumerateBundles(p, sameSession)).toEqual([]);
  });

  describe("Workshops mit session 'both' (laufen identisch in beiden Sessions)", () => {
    it("erzwingt bei Paarung mit fester Session die jeweils andere Session fuer den 'both'-Workshop", () => {
      const withBoth = new Map<string, AllocWorkshop>([
        ["A", workshop("A", 60, 1, 10)],
        ["Z", workshop("Z", 60, "both", 10)],
      ]);
      const p = participant("p1", ["A", "Z"], 1);
      const bundles = enumerateBundles(p, withBoth);
      expect(bundles).toHaveLength(1);
      expect(bundles[0].sessionAssignment).toEqual({ Z: 2 });
    });

    it("erzeugt bei zwei 'both'-Workshops beide moeglichen Session-Zuordnungen", () => {
      const bothBoth = new Map<string, AllocWorkshop>([
        ["Y", workshop("Y", 60, "both", 10)],
        ["Z", workshop("Z", 60, "both", 10)],
      ]);
      const p = participant("p1", ["Y", "Z"], 1);
      const bundles = enumerateBundles(p, bothBoth);
      expect(bundles).toHaveLength(2);
      const assignments = bundles.map((b) => b.sessionAssignment).sort((a, b) => (a!.Y > b!.Y ? 1 : -1));
      expect(assignments).toEqual([
        { Y: 1, Z: 2 },
        { Y: 2, Z: 1 },
      ]);
    });
  });
});

describe("allocate", () => {
  it("respektiert harte Kapazitaetsgrenzen (60+60)", () => {
    const workshops: AllocWorkshop[] = [
      workshop("A", 60, 1, 1),
      workshop("B", 60, 2, 1),
    ];
    const participants: AllocParticipant[] = [
      participant("p1", ["A", "B"], 1),
      participant("p2", ["A", "B"], 2),
    ];
    const result = allocate(participants, workshops);
    expect(result.assigned).toHaveLength(1);
    expect(result.waitlisted).toHaveLength(1);
  });

  it("120+120 und 120+60 sind niemals das Ergebnis (immer genau 1 oder 2 Workshops gueltiger Kombination)", () => {
    const workshops: AllocWorkshop[] = [
      workshop("X", 120, null, 5),
      workshop("Y", 120, null, 5),
      workshop("A", 60, 1, 5),
      workshop("B", 60, 2, 5),
    ];
    const participants: AllocParticipant[] = [
      participant("p1", ["X", "Y"], 1),
      participant("p2", ["A", "B"], 2),
    ];
    const result = allocate(participants, workshops);
    for (const a of result.assigned) {
      expect([1, 2]).toContain(a.workshopIds.length);
    }
  });

  it("erlaubt spaeteren Teilnehmern mit besserer Verfuegbarkeit, frueheren mit ueberlaufenen Wuenschen vorzugehen (kein reines Serial-Dictatorship)", () => {
    const workshops: AllocWorkshop[] = [workshop("Popular", 120, null, 1), workshop("Other", 120, null, 5)];
    // p1 (frueh) will nur den knappen Workshop; p2 (spaet) hat ihn nur als 2. Wahl und
    // eine gut verfuegbare Alternative als 1. Wahl.
    const participants: AllocParticipant[] = [
      participant("p1_early", ["Popular"], 1),
      participant("p2_late", ["Other", "Popular"], 100),
    ];
    const result = allocate(participants, workshops);
    const p2 = result.assigned.find((a) => a.participantId === "p2_late");
    expect(p2?.workshopIds).toEqual(["Other"]);
  });

  it("Swap-Repair versorgt zusaetzlichen Teilnehmer vollstaendig, wenn ein Tausch moeglich ist", () => {
    // A hat 1 Platz. p1 bekommt A+B per Greedy. p2 will ebenfalls A (als Teil von A+B),
    // hat aber B+C als gueltige Ausweichoption. Der Swap-Repair-Pass sollte p1 auf B+C
    // umsetzen und p2 A+B zuteilen (oder umgekehrt) - beide vollversorgt, niemand wartet.
    const workshops: AllocWorkshop[] = [
      workshop("A", 60, 1, 1),
      workshop("B", 60, 2, 2),
      workshop("C", 60, 1, 2),
    ];
    const participants: AllocParticipant[] = [
      participant("p1", ["A", "B"], 1),
      participant("p2", ["A", "B", "C"], 2),
    ];
    const result = allocate(participants, workshops);
    const p1 = result.assigned.find((a) => a.participantId === "p1");
    const p2 = result.assigned.find((a) => a.participantId === "p2");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(result.waitlisted).toHaveLength(0);
  });

  it("versorgt Teilnehmer mit ausgebuchtem 120min-Erstwunsch ueber die 60+60-Alternative", () => {
    const workshops: AllocWorkshop[] = [
      workshop("X", 120, null, 0), // bereits ausgebucht
      workshop("A", 60, 1, 5),
      workshop("B", 60, 2, 5),
    ];
    const participants: AllocParticipant[] = [participant("p1", ["X", "A", "B"], 1)];
    const result = allocate(participants, workshops);
    expect(result.assigned).toEqual([{ participantId: "p1", workshopIds: ["A", "B"], score: 90 }]);
    expect(result.waitlisted).toHaveLength(0);
  });

  it("garantiert: wer nur EINE Praeferenz angibt und dafuer noch Platz war, wird nicht durch spaetere Teilnehmer verdraengt", () => {
    // p1 (frueh) und p2 (spaet) wollen beide ausschliesslich Workshop X (Kapazitaet 1) - ohne
    // jede Alternative. Der Swap-Repair-Pass darf p1 niemals zugunsten von p2 verdraengen, weil
    // p1 kein Ausweich-Buendel hat (einzige Praeferenz) - das ist die Sicherheitsgarantie fuer
    // Teilnehmer, die bewusst nur einen 2-Stunden-Workshop ohne Alternative angeben.
    const workshops: AllocWorkshop[] = [workshop("X", 120, null, 1)];
    const participants: AllocParticipant[] = [
      participant("p1_early", ["X"], 1),
      participant("p2_late", ["X"], 999),
    ];
    const result = allocate(participants, workshops);
    expect(result.assigned).toEqual([{ participantId: "p1_early", workshopIds: ["X"], score: 100 }]);
    expect(result.waitlisted.map((w) => w.participantId)).toEqual(["p2_late"]);
  });

  it("garantiert: wer zwei 1-Stunden-Workshops ohne Alternative gewaehlt hat, bekommt NIE nur einen davon - entweder beide oder Warteliste", () => {
    // p_early bekommt A+B (einzige Praeferenzen, kein Ausweich-Buendel). p_late will
    // ebenfalls A (als Teil von A+D), was den Repair-Pass dazu bringt, p_early testweise
    // zu verdraengen. Da p_early keine Alternative hat, muss der Tausch vollstaendig
    // zurueckgerollt werden - p_early behaelt A+B komplett, p_late landet auf der
    // Warteliste (nicht etwa nur mit D "halb" versorgt).
    const workshops: AllocWorkshop[] = [
      workshop("A", 60, 1, 1),
      workshop("B", 60, 2, 5),
      workshop("D", 60, 2, 5),
    ];
    const participants: AllocParticipant[] = [
      participant("p_early", ["A", "B"], 1),
      participant("p_late", ["A", "D"], 999),
    ];
    const result = allocate(participants, workshops);
    const early = result.assigned.find((a) => a.participantId === "p_early");
    expect(early?.workshopIds.slice().sort()).toEqual(["A", "B"]);
    expect(result.assigned.find((a) => a.participantId === "p_late")).toBeUndefined();
    expect(result.waitlisted.map((w) => w.participantId)).toEqual(["p_late"]);
  });

  it("behandelt session 'both' als zwei unabhaengige Kapazitaetstoepfe (je 1 Platz -> 2 Teilnehmer insgesamt, nie 3)", () => {
    // Z laeuft in beiden Sessions, capacity=1 PRO Session (siehe types/workshop.ts).
    // A/B liegen fest in Session 1/2, sodass jeder Teilnehmer Z in der jeweils
    // komplementaeren Session belegt - beide Sessions von Z muessen unabhaengig
    // ausgeschoepft werden koennen (2 Teilnehmer), aber nicht mehr als das.
    const workshops: AllocWorkshop[] = [
      workshop("Z", 60, "both", 1),
      workshop("A", 60, 1, 5),
      workshop("B", 60, 2, 5),
    ];
    const participants: AllocParticipant[] = [
      participant("p1", ["A", "Z"], 1),
      participant("p2", ["B", "Z"], 2),
      participant("p3", ["A", "Z"], 3),
    ];
    const result = allocate(participants, workshops);
    expect(result.assigned).toHaveLength(2);
    expect(result.waitlisted).toHaveLength(1);
    const p1 = result.assigned.find((a) => a.participantId === "p1");
    const p2 = result.assigned.find((a) => a.participantId === "p2");
    expect(p1?.sessionAssignment).toEqual({ Z: 2 });
    expect(p2?.sessionAssignment).toEqual({ Z: 1 });
  });

  it("markiert Teilnehmer ohne gueltige Kombination als Konflikt statt sie stillschweigend zu verwerfen", () => {
    const workshops: AllocWorkshop[] = [workshop("A", 60, 1, 5), workshop("D", 60, 1, 5)];
    const participants: AllocParticipant[] = [participant("p1", ["A", "D"], 1)];
    const result = allocate(participants, workshops);
    expect(result.conflicts).toEqual(["p1"]);
    expect(result.assigned).toHaveLength(0);
    expect(result.waitlisted).toHaveLength(0);
  });
});
