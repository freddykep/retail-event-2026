import { describe, expect, it } from "vitest";
import {
  canSubmitSelection,
  isWorkshopDisabled,
  type SelectableWorkshop,
} from "@/lib/participant-selection";

function w(id: string, durationMinutes: 60 | 120, capacity: number, confirmedCount = 0): SelectableWorkshop {
  return { id, durationMinutes, capacity, confirmedCount };
}

const byId = (list: SelectableWorkshop[]) => new Map(list.map((x) => [x.id, x]));

describe("isWorkshopDisabled", () => {
  it("blendet nichts aus, solange nichts ausgewaehlt ist", () => {
    const all = [w("A", 60, 10), w("X", 120, 10)];
    const map = byId(all);
    expect(isWorkshopDisabled(all[0], [], map)).toBe(false);
    expect(isWorkshopDisabled(all[1], [], map)).toBe(false);
  });

  it("blendet alles andere aus, wenn 1. Wahl ein freier 2-Stunden-Workshop ist", () => {
    const X = w("X", 120, 10, 0);
    const A = w("A", 60, 10, 0);
    const map = byId([X, A]);
    expect(isWorkshopDisabled(A, ["X"], map)).toBe(true);
    expect(isWorkshopDisabled(X, ["X"], map)).toBe(false); // ausgewaehlte Kachel bleibt sichtbar
  });

  it("blendet nichts aus, wenn der gewaehlte 2-Stunden-Workshop ausgebucht ist", () => {
    const X = w("X", 120, 1, 1); // voll
    const A = w("A", 60, 10, 0);
    const Y = w("Y", 120, 10, 0);
    const map = byId([X, A, Y]);
    expect(isWorkshopDisabled(A, ["X"], map)).toBe(false);
    expect(isWorkshopDisabled(Y, ["X"], map)).toBe(false);
  });

  it("blendet 120min-Workshops aus, sobald ein 60min-Workshop gewaehlt ist", () => {
    const A = w("A", 60, 10, 0);
    const X = w("X", 120, 10, 0);
    const map = byId([A, X]);
    expect(isWorkshopDisabled(X, ["A"], map)).toBe(true);
  });

  it("blendet verbleibende 60min-Workshops aus, sobald ein voller 120er + ein 60er gewaehlt sind (Alt-Pfad wird 60+60)", () => {
    const X = w("X", 120, 1, 1); // voll, 1. Wahl
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const Y = w("Y", 120, 10, 0);
    const map = byId([X, A, B, Y]);
    expect(isWorkshopDisabled(Y, ["X", "A"], map)).toBe(true); // 120er raus
    expect(isWorkshopDisabled(B, ["X", "A"], map)).toBe(false); // zweiter 60er noch waehlbar
  });

  it("blendet alles ab 3 Praeferenzen aus", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const C = w("C", 60, 10, 0);
    const D = w("D", 60, 10, 0);
    const map = byId([A, B, C, D]);
    expect(isWorkshopDisabled(D, ["A", "B", "C"], map)).toBe(true);
  });

  it("im strict-fcfs-Modus: blendet einen 3. 1-Stunden-Workshop aus, sobald zwei mit freiem Platz gewaehlt sind", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const C = w("C", 60, 10, 0);
    const map = byId([A, B, C]);
    // Im "fair"-Modus (Default) bliebe C waehlbar (3. Praeferenz weiterhin moeglich/noetig).
    expect(isWorkshopDisabled(C, ["A", "B"], map)).toBe(false);
    expect(isWorkshopDisabled(C, ["A", "B"], map, "strict-fcfs")).toBe(true);
  });

  it("im strict-fcfs-Modus: laesst einen 3. Workshop waehlbar, wenn einer der beiden gewaehlten schon ausgebucht ist", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 1, 1); // ausgebucht
    const C = w("C", 60, 10, 0);
    const map = byId([A, B, C]);
    expect(isWorkshopDisabled(C, ["A", "B"], map, "strict-fcfs")).toBe(false);
  });
});

describe("canSubmitSelection", () => {
  it("erlaubt Absenden bei genau einem freien 2-Stunden-Workshop", () => {
    const X = w("X", 120, 10, 0);
    expect(canSubmitSelection(["X"], byId([X]))).toBe(true);
  });

  it("verbietet Absenden bei genau einem ausgebuchten 2-Stunden-Workshop ohne Alternative", () => {
    const X = w("X", 120, 1, 1);
    expect(canSubmitSelection(["X"], byId([X]))).toBe(false);
  });

  it("erlaubt Absenden bei zwei 1-Stunden-Workshops, wenn insgesamt nur 2 existieren (3. nicht moeglich)", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    expect(canSubmitSelection(["A", "B"], byId([A, B]))).toBe(true);
  });

  it("verlangt eine 3. Praeferenz bei zwei 1-Stunden-Workshops, wenn genug Workshops zur Auswahl stehen", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const C = w("C", 60, 10, 0);
    const pool = byId([A, B, C]);
    expect(canSubmitSelection(["A", "B"], pool)).toBe(false); // nur 2 von 3 moeglichen
    expect(canSubmitSelection(["A", "B", "C"], pool)).toBe(true);
  });

  it("verlangt eine 3. Praeferenz bei vollem 2-Stunden-Workshop plus 1-Stunden-Alternative, wenn genug Workshops existieren", () => {
    const X = w("X", 120, 1, 1);
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const C = w("C", 60, 10, 0);
    const pool = byId([X, A, B, C]);
    expect(canSubmitSelection(["X", "A"], pool)).toBe(false); // nur 1 von 2 noetigen 60ern
    expect(canSubmitSelection(["X", "A", "B"], pool)).toBe(true);
  });

  it("verlangt bei mehreren 2-Stunden-Workshops als reine Alternativen zueinander KEINE 3. Praeferenz - ein weiterer Slot genuegt", () => {
    const X = w("X", 120, 1, 1); // voll
    const Y = w("Y", 120, 10, 0);
    const Z = w("Z", 120, 10, 0);
    const pool = byId([X, Y, Z]);
    expect(canSubmitSelection(["X", "Y"], pool)).toBe(true);
  });

  it("verbietet Absenden bei nur einem einzelnen 1-Stunden-Workshop", () => {
    const A = w("A", 60, 10, 0);
    expect(canSubmitSelection(["A"], byId([A]))).toBe(false);
  });
});

describe("canSubmitSelection im strict-fcfs-Modus", () => {
  it("verlangt KEINE 3. Praeferenz bei zwei 1-Stunden-Workshops mit freiem Platz, auch wenn ein 3. Workshop existieren wuerde", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const C = w("C", 60, 10, 0);
    const pool = byId([A, B, C]);
    // Im "fair"-Modus (Default) waere hier eine 3. Praeferenz Pflicht (siehe Test oben).
    expect(canSubmitSelection(["A", "B"], pool, "strict-fcfs")).toBe(true);
  });

  it("verlangt weiterhin eine 3. Praeferenz, wenn einer der beiden gewaehlten 1-Stunden-Workshops schon ausgebucht ist (Warteliste droht)", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 1, 1); // ausgebucht
    const C = w("C", 60, 10, 0);
    const pool = byId([A, B, C]);
    expect(canSubmitSelection(["A", "B"], pool, "strict-fcfs")).toBe(false);
    expect(canSubmitSelection(["A", "B", "C"], pool, "strict-fcfs")).toBe(true);
  });

  it("bleibt im 'fair'-Modus (Default) beim bisherigen Verhalten - 3. Praeferenz weiterhin Pflicht", () => {
    const A = w("A", 60, 10, 0);
    const B = w("B", 60, 10, 0);
    const C = w("C", 60, 10, 0);
    const pool = byId([A, B, C]);
    expect(canSubmitSelection(["A", "B"], pool, "fair")).toBe(false);
    expect(canSubmitSelection(["A", "B"], pool)).toBe(false);
  });
});
