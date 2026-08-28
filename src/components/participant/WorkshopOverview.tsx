"use client";

import { useActionState, useMemo, useState } from "react";
import { effectiveCapacity, type WorkshopDoc } from "@/types/workshop";
import { submitPreferences, type SubmitState } from "@/app/actions/registrations";
import {
  canSubmitSelection,
  isWorkshopDisabled,
  selectionHint,
  type SelectableWorkshop,
} from "@/lib/participant-selection";
import { WorkshopTile } from "@/components/participant/WorkshopTile";
import { ReservedWorkshopTile } from "@/components/participant/ReservedWorkshopTile";
import { Lightbox } from "@/components/participant/Lightbox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Props {
  workshops: WorkshopDoc[];
  participantName: string;
  initialPreferences: string[];
}

const initialState: SubmitState = {};

export function WorkshopOverview({ workshops, participantName, initialPreferences }: Props) {
  const [selected, setSelected] = useState<string[]>(initialPreferences);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(submitPreferences, initialState);

  const workshopsById = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const selectableById = useMemo(() => {
    const map = new Map<string, SelectableWorkshop>();
    for (const w of workshops) {
      map.set(w.id, {
        id: w.id,
        durationMinutes: w.durationMinutes,
        capacity: effectiveCapacity(w),
        confirmedCount: w.confirmedCount,
      });
    }
    return map;
  }, [workshops]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const canSubmit = canSubmitSelection(selected, selectableById);
  const hint = selectionHint(selected, selectableById);

  if (state.success) {
    const reservedWorkshops = (state.workshopIds ?? [])
      .map((id) => workshopsById.get(id))
      .filter((w): w is WorkshopDoc => Boolean(w));
    const waitlisted = state.status === "waitlisted";

    return (
      <div className="mx-auto max-w-2xl">
        <Card className="bg-event-gradient overflow-hidden p-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-heading mb-2 text-xl font-bold">Vielen Dank, {participantName}!</h2>
          <p className="text-white/90">Deine Workshop-Präferenzen wurden erfolgreich gespeichert.</p>
          <p className="mt-3 text-sm text-white/75">
            {waitlisted
              ? "Deine Wunsch-Kombination ist aktuell ausgebucht - du stehst auf der Warteliste."
              : "Dein bevorzugtes Workshop-Paket ist aktuell vorläufig für dich reserviert."}
          </p>
        </Card>

        {reservedWorkshops.length > 0 && (
          <div className="mt-5 flex flex-col gap-3">
            {reservedWorkshops.map((w) => (
              <ReservedWorkshopTile key={w.id} workshop={w} waitlisted={waitlisted} />
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/result" className="inline-block">
            <Button variant="secondary">Meine Anmeldung ansehen</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-32">
      <h1 className="font-heading mb-2 text-2xl font-bold text-adesso-blue-4 sm:text-3xl">
        Wähle deine Workshops
      </h1>
      <p className="mb-4 text-sm text-adesso-warmgrey">
        Wähle entweder einen 2-Stunden-Workshop oder zwei 1-Stunden-Workshops. Ein Klick auf eine
        Kachel wählt sie aus, ein erneuter Klick hebt die Auswahl wieder auf.
      </p>
      <div className="border-adesso-primary/15 mb-6 rounded-2xl border bg-blue-50/70 p-4 text-sm text-adesso-blue-4">
        <p>
          Die Reihenfolge deiner Auswahl zählt: Wir versuchen zuerst, dir deine 1. Wahl zu
          ermöglichen, danach deine 2. Wahl usw.
        </p>
        <p className="mt-1">
          Ist dein bevorzugter 2-Stunden-Workshop bereits ausgebucht, benötigst du mindestens eine
          Alternative. Bitte gib nach Möglichkeit eine 3. Präferenz an - das schützt dich zusätzlich
          davor, auf der Warteliste zu landen, falls eine deiner Optionen ausgebucht ist.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {workshops.map((w) => {
          const selectable = selectableById.get(w.id)!;
          const disabled = isWorkshopDisabled(selectable, selected, selectableById);
          const rank = selected.includes(w.id) ? selected.indexOf(w.id) + 1 : null;
          return (
            <WorkshopTile
              key={w.id}
              workshop={w}
              rank={rank}
              disabled={disabled}
              onToggle={() => toggle(w.id)}
              onEnlarge={() => setLightboxSrc(w.imageUrl)}
            />
          );
        })}
      </div>

      {lightboxSrc && (
        <Lightbox src={lightboxSrc} alt="Workshop-Bild" onClose={() => setLightboxSrc(null)} />
      )}

      <form
        action={formAction}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-adesso-grey-light bg-white/90 shadow-[0_-8px_24px_-16px_rgba(6,45,71,0.25)] backdrop-blur-md"
      >
        {selected.map((id) => (
          <input key={id} type="hidden" name="preferences" value={id} />
        ))}
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-adesso-blue-4">
            {hint ?? "Deine Auswahl ist vollständig."}
            {state.error && (
              <p role="alert" className="mt-1 font-medium text-adesso-error">
                {state.error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={!canSubmit || pending} className="shrink-0">
            {pending ? "Wird gespeichert…" : "Auswahl verbindlich absenden"}
          </Button>
        </div>
      </form>
    </div>
  );
}
