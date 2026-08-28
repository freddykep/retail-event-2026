"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateDraftAllocationAction,
  publishAssignmentsAction,
  setAllocationModeAction,
  setRegistrationOpenAction,
} from "@/app/actions/admin/allocation";
import type { AllocationMode } from "@/types/assignment";
import { Button } from "@/components/ui/Button";

interface Props {
  registrationOpen: boolean;
  assignmentPublished: boolean;
  allocationMode: AllocationMode;
  draftCount: number;
  waitlistCount: number;
  conflictCount: number;
}

const MODE_DESCRIPTIONS: Record<AllocationMode, string> = {
  fair:
    "Score-basiert mit Ausgleich: 1./2./3. Präferenz zählen unterschiedlich, spätere Teilnehmer können frühere bei knappen Wünschen überholen, wenn ihre Gesamt-Kombination besser bewertet ist. Ein Tausch-Ausgleich versucht danach, zusätzliche Teilnehmer vollständig zu versorgen.",
  "strict-fcfs":
    "Striktes First-Come-First-Served: ausschließlich der Anmeldezeitpunkt zählt, keine Score-Gewichtung, kein nachträglicher Ausgleich. Wer zuerst kommt, bekommt seine beste zu diesem Zeitpunkt verfügbare Kombination - das bleibt danach unangetastet.",
};

export function AllocationControls({
  registrationOpen,
  assignmentPublished,
  allocationMode,
  draftCount,
  waitlistCount,
  conflictCount,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggleRegistration() {
    setPending(true);
    await setRegistrationOpenAction(!registrationOpen);
    setPending(false);
    router.refresh();
  }

  async function handleModeChange(mode: AllocationMode) {
    if (mode === allocationMode) return;
    setPending(true);
    await setAllocationModeAction(mode);
    setPending(false);
    router.refresh();
  }

  async function handleGenerate() {
    setPending(true);
    await generateDraftAllocationAction();
    setPending(false);
    router.refresh();
  }

  async function handlePublish() {
    const message = `${draftCount} Teilnehmer werden vollständig zugeteilt, ${waitlistCount} bleiben auf der Warteliste${
      conflictCount > 0 ? `, ${conflictCount} haben ungelöste Konflikte` : ""
    }. Zuteilung wirklich veröffentlichen?`;
    if (!confirm(message)) return;
    setPending(true);
    await publishAssignmentsAction();
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-adesso-grey-light bg-white p-5">
        <label className="mb-2 block text-sm font-semibold text-adesso-blue-4">
          Zuteilungsmodus
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {(["fair", "strict-fcfs"] as AllocationMode[]).map((mode) => (
            <label
              key={mode}
              className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border p-4 text-sm transition-colors ${
                allocationMode === mode
                  ? "border-adesso-primary bg-adesso-grey-lighter"
                  : "border-adesso-grey"
              }`}
            >
              <input
                type="radio"
                name="allocationMode"
                className="mt-1"
                checked={allocationMode === mode}
                disabled={pending}
                onChange={() => handleModeChange(mode)}
              />
              <span>
                <span className="block font-medium text-adesso-blue-4">
                  {mode === "fair" ? "Fair (mit Ausgleich)" : "Striktes First-Come-First-Served"}
                </span>
                <span className="text-adesso-warmgrey">{MODE_DESCRIPTIONS[mode]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-adesso-warmgrey">
          Am besten vor Öffnung der Anmeldephase festlegen. Ein späterer Wechsel wirkt sich erst
          auf den nächsten "Zuteilungsvorschlag erstellen"-Lauf aus.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={handleToggleRegistration} disabled={pending}>
          Anmeldephase {registrationOpen ? "schließen" : "öffnen"}
        </Button>
        <Button onClick={handleGenerate} disabled={pending}>
          Zuteilungsvorschlag erstellen
        </Button>
        <Button
          variant="danger"
          onClick={handlePublish}
          disabled={pending || draftCount === 0 || assignmentPublished}
        >
          {assignmentPublished ? "Bereits veröffentlicht" : "Zuteilung veröffentlichen"}
        </Button>
      </div>
    </div>
  );
}
