import type { AllocationMode } from "@/types/assignment";

export interface SelectableWorkshop {
  id: string;
  durationMinutes: 60 | 120;
  capacity: number;
  confirmedCount: number;
}

const MAX_PREFERENCES = 3;

function hasRoom(w: SelectableWorkshop): boolean {
  return w.confirmedCount < w.capacity;
}

function resolve(selectedIds: string[], workshopsById: Map<string, SelectableWorkshop>): SelectableWorkshop[] {
  return selectedIds.map((id) => workshopsById.get(id)).filter((w): w is SelectableWorkshop => Boolean(w));
}

function poolCount(workshopsById: Map<string, SelectableWorkshop>, durationMinutes: 60 | 120): number {
  return [...workshopsById.values()].filter((w) => w.durationMinutes === durationMinutes).length;
}

/**
 * Es gibt keine vorab gewaehlte "Art" (Track) mehr - Teilnehmer sehen alle Workshops
 * auf einer Uebersichtsseite und waehlen per Klick. Diese Funktion bestimmt, welche
 * Kacheln angesichts der aktuellen Auswahl deaktiviert (ausgegraut, nicht anklickbar,
 * aber weiterhin sichtbar) werden:
 *
 * - 1. Wahl ist ein 2-Stunden-Workshop MIT freiem Platz -> alles andere deaktivieren
 *   (die Wahl ist bereits vollstaendig, kein weiterer Workshop noetig).
 * - 1. Wahl ist ein 2-Stunden-Workshop OHNE freien Platz -> nichts deaktivieren, der
 *   Teilnehmer muss noch Alternativen angeben (weitere 2-Stunden-Workshops ODER
 *   zwei 1-Stunden-Workshops).
 * - 1. Wahl ist ein 1-Stunden-Workshop -> 2-Stunden-Workshops deaktivieren.
 * - Sobald mindestens ein 1-Stunden-Workshop in der Auswahl ist -> alle noch nicht
 *   gewaehlten 2-Stunden-Workshops deaktivieren.
 * - Sind nur 2-Stunden-Workshops gewaehlt (>= 2, Alternativen zueinander) -> alle
 *   noch nicht gewaehlten 1-Stunden-Workshops deaktivieren.
 * - Maximal 3 Praeferenzen insgesamt - danach wird der Rest deaktiviert.
 * - Bereits ausgewaehlte Kacheln werden nie deaktiviert (abwaehlbar).
 */
export function isWorkshopDisabled(
  workshop: SelectableWorkshop,
  selectedIds: string[],
  workshopsById: Map<string, SelectableWorkshop>
): boolean {
  if (selectedIds.includes(workshop.id)) return false;
  if (selectedIds.length === 0) return false;
  if (selectedIds.length >= MAX_PREFERENCES) return true;

  const selected = resolve(selectedIds, workshopsById);

  if (selected.length === 1) {
    const only = selected[0];
    if (only.durationMinutes === 120) {
      if (hasRoom(only)) return true; // Fast-Path: alles andere ausblenden
      return false; // ausgebucht -> Alternativen zeigen
    }
    return workshop.durationMinutes === 120; // 60er zuerst -> 120er ausblenden
  }

  const sixtyCount = selected.filter((w) => w.durationMinutes === 60).length;
  if (sixtyCount > 0) return workshop.durationMinutes === 120;
  return workshop.durationMinutes === 60;
}

/**
 * Wie viele Praeferenzen insgesamt fuer eine absendbare Auswahl noetig sind. Der
 * garantierte Fast-Path (einzelner freier 2-Stunden-Workshop) braucht nur 1. Sind
 * ausschliesslich 2-Stunden-Workshops gewaehlt (voller Erstwunsch + Alternative(n)
 * zueinander), genuegt ein einziger weiterer 2-Stunden-Workshop (2 insgesamt) - hier
 * wird keine 3. Pflichtpraeferenz verlangt.
 *
 * Sobald mindestens ein 1-Stunden-Workshop beteiligt ist, haengt die Anforderung vom
 * Zuteilungsmodus ab:
 * - "fair": die 3. Praeferenz ist verpflichtend (nicht nur empfohlen), weil die
 *   spaetere score-basierte Stapelverarbeitung (siehe lib/allocation/allocate.ts) einen
 *   bei Absenden noch freien Wunsch nachtraeglich an einen hoeher bewerteten, spaeteren
 *   Teilnehmer verlieren kann - ohne Alternative landet man dann komplett auf der
 *   Warteliste.
 * - "strict-fcfs": sind GENAU zwei 1-Stunden-Workshops gewaehlt und haben BEIDE bei
 *   Absenden noch freie Plaetze, reicht das - die Echtzeit-Buchung ist hier
 *   deterministisch (reine Ankunftsreihenfolge, kein Score, kein nachtraeglicher
 *   Ausgleich), die spaetere Stapelverarbeitung reproduziert exakt dasselbe Ergebnis.
 *   Eine 3. Praeferenz ist nur noetig, wenn die Wunsch-Kombination selbst schon nicht
 *   mehr frei ist (dann landet man auf der Warteliste und braucht eine Absicherung).
 *
 * Ist die insgesamt verfuegbare Anzahl an Workshops einer Dauer kleiner als gefordert,
 * wird die Anforderung entsprechend abgesenkt (nie mehr verlangen, als ueberhaupt
 * waehlbar ist).
 */
function requiredCount(
  selected: SelectableWorkshop[],
  workshopsById: Map<string, SelectableWorkshop>,
  mode: AllocationMode
): number {
  const oneTwenty = selected.filter((w) => w.durationMinutes === 120).length;

  if (selected.every((w) => w.durationMinutes === 120)) {
    return Math.min(2, poolCount(workshopsById, 120));
  }

  if (mode === "strict-fcfs" && selected.length === 2 && selected.every(hasRoom)) {
    return 2;
  }

  // Enthaelt mindestens einen 60min-Workshop (reiner 60er-Pfad oder voller
  // 2-Stunden-Erstwunsch + 60+60-Alternative): so viele 60min-Praeferenzen wie der
  // verbleibende Platz im 3er-Kontingent erlaubt (abzueglich eines evtl. 120min-
  // Erstwunsches), begrenzt durch die tatsaechlich verfuegbare Anzahl.
  return oneTwenty + Math.min(MAX_PREFERENCES - oneTwenty, poolCount(workshopsById, 60));
}

/** Kann die aktuelle Auswahl abgesendet werden (gueltige Endkombination erreichbar)? */
export function canSubmitSelection(
  selectedIds: string[],
  workshopsById: Map<string, SelectableWorkshop>,
  mode: AllocationMode = "fair"
): boolean {
  const selected = resolve(selectedIds, workshopsById);
  if (selected.length === 0) return false;

  if (selected.length === 1) {
    const only = selected[0];
    return only.durationMinutes === 120 && hasRoom(only);
  }

  const sixty = selected.filter((w) => w.durationMinutes === 60).length;
  const oneTwenty = selected.length - sixty;
  // Bei Mischung mit 60ern hoechstens 1 voller 120er als Primaerwunsch; reine
  // 120er-Alternativen zueinander (sixty === 0) duerfen beliebig viele sein.
  if (sixty > 0 && oneTwenty > 1) return false;

  return selected.length >= requiredCount(selected, workshopsById, mode);
}

/** Erklaerender Hinweistext, wenn die Auswahl noch nicht absendbar ist. */
export function selectionHint(
  selectedIds: string[],
  workshopsById: Map<string, SelectableWorkshop>,
  mode: AllocationMode = "fair"
): string | null {
  if (canSubmitSelection(selectedIds, workshopsById, mode)) return null;
  const selected = resolve(selectedIds, workshopsById);

  if (selected.length === 0) {
    return "Wähle einen 2-Stunden-Workshop oder zwei 1-Stunden-Workshops.";
  }
  if (selected.length === 1 && selected[0].durationMinutes === 120 && !hasRoom(selected[0])) {
    return "Dieser Workshop ist bereits ausgebucht. Bitte gib Alternativen an - weitere 2-Stunden-Workshops oder zwei 1-Stunden-Workshops.";
  }

  const required = requiredCount(selected, workshopsById, mode);
  const missing = required - selected.length;
  if (missing > 0) {
    return `Bitte wähle noch ${missing === 1 ? "eine weitere Präferenz" : `${missing} weitere Präferenzen`} als Absicherung, falls eine deiner Optionen nicht verfügbar ist.`;
  }
  return "Bitte vervollständige deine Auswahl.";
}
