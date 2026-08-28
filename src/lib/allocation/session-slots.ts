export type SessionAssignment = Record<string, 1 | 2>;

/**
 * Ermittelt alle gueltigen (Session-fuer-A, Session-fuer-B)-Kombinationen fuer ein Paar
 * 60-Minuten-Workshops. "both" (Workshop laeuft identisch in beiden Sessions, je eigene
 * Kapazitaet) kann wahlweise Session 1 oder 2 einnehmen, muss aber von der Session des
 * jeweils anderen Workshops abweichen - der Teilnehmer kann nicht zwei Workshops in
 * derselben Session besuchen.
 */
export function allowedSessionPairs(
  sessionA: 1 | 2 | "both",
  sessionB: 1 | 2 | "both"
): Array<[1 | 2, 1 | 2]> {
  const options = (s: 1 | 2 | "both"): Array<1 | 2> => (s === "both" ? [1, 2] : [s]);
  const pairs: Array<[1 | 2, 1 | 2]> = [];
  for (const sa of options(sessionA)) {
    for (const sb of options(sessionB)) {
      if (sa !== sb) pairs.push([sa, sb]);
    }
  }
  return pairs;
}

/**
 * Schluessel fuer die Kapazitaets-/Belegungszaehlung eines Workshops. Bei "both" hat
 * jede Session ihren eigenen, unabhaengigen Kapazitaetstopf (siehe README) - der
 * Schluessel muss daher die tatsaechlich zugewiesene Session mit einschliessen. Bei
 * fester Session oder 120-Minuten-Workshops (belegen implizit beide Sessions als
 * Einheit) genuegt die Workshop-ID allein.
 */
export function slotKey(
  workshopId: string,
  workshopSession: 1 | 2 | "both" | null,
  sessionAssignment?: SessionAssignment
): string {
  if (workshopSession === "both") {
    return `${workshopId}:${sessionAssignment?.[workshopId]}`;
  }
  return workshopId;
}
