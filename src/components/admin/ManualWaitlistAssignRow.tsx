"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkshopDoc } from "@/types/workshop";
import { manuallyAssignWaitlistedAction } from "@/app/actions/admin/participants";
import { Button } from "@/components/ui/Button";

export function ManualWaitlistAssignRow({
  participantId,
  workshops,
}: {
  participantId: string;
  workshops: WorkshopDoc[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"120" | "60">("120");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const options120 = workshops.filter((w) => w.durationMinutes === 120);
  const options60 = workshops.filter((w) => w.durationMinutes === 60);

  async function handleAssign() {
    setPending(true);
    setError(null);
    const workshopIds = mode === "120" ? [a] : [a, b];
    const result = await manuallyAssignWaitlistedAction(participantId, workshopIds.filter(Boolean));
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs font-medium text-adesso-primary underline"
      >
        Manuell zuteilen
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-adesso-grey-light bg-adesso-grey-lighter p-3">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as "120" | "60")}
        className="rounded-lg border border-adesso-grey px-2.5 py-1.5 text-sm"
      >
        <option value="120">1x 120 Minuten</option>
        <option value="60">2x 60 Minuten</option>
      </select>

      {mode === "120" ? (
        <select
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="rounded-lg border border-adesso-grey px-2.5 py-1.5 text-sm"
        >
          <option value="">- wählen -</option>
          {options120.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      ) : (
        <>
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="rounded-lg border border-adesso-grey px-2.5 py-1.5 text-sm"
          >
            <option value="">- Workshop 1 -</option>
            {options60.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({w.session === "both" ? "beide Sessions" : `Session ${w.session}`})
              </option>
            ))}
          </select>
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="rounded-lg border border-adesso-grey px-2.5 py-1.5 text-sm"
          >
            <option value="">- Workshop 2 -</option>
            {options60.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({w.session === "both" ? "beide Sessions" : `Session ${w.session}`})
              </option>
            ))}
          </select>
        </>
      )}

      {error && <p className="text-xs text-adesso-error">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleAssign} disabled={pending} className="!px-3 !py-1.5 text-xs">
          Zuteilen
        </Button>
        <Button
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="!px-3 !py-1.5 text-xs"
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
