"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkshopDoc } from "@/types/workshop";
import {
  createWorkshopAction,
  updateWorkshopAction,
  type WorkshopFormState,
} from "@/app/actions/admin/workshops";
import { WORKSHOP_IMAGES, workshopImageIdFromUrl } from "@/lib/workshop-images";
import { WORKSHOP_IMAGE_INFO } from "@/lib/workshop-image-info";
import { Button } from "@/components/ui/Button";

const initialState: WorkshopFormState = {};

export function WorkshopForm({ workshop }: { workshop?: WorkshopDoc }) {
  const router = useRouter();
  const action = workshop ? updateWorkshopAction.bind(null, workshop.id) : createWorkshopAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [duration, setDuration] = useState<60 | 120>(workshop?.durationMinutes ?? 60);
  const [session, setSession] = useState<1 | 2 | "both">(
    workshop?.session === "both" ? "both" : workshop?.session === 2 ? 2 : 1
  );
  const [imageId, setImageId] = useState<string | null>(
    workshopImageIdFromUrl(workshop?.imageUrl ?? null)
  );
  const [title, setTitle] = useState(workshop?.title ?? "");
  const [description, setDescription] = useState(workshop?.description ?? "");
  const [speaker, setSpeaker] = useState(workshop?.speaker ?? "");
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedHint, setRecognizedHint] = useState(false);

  function handleSelectImage(newImageId: string | null) {
    setImageId(newImageId);
    setRecognizedHint(false);
    const info = newImageId ? WORKSHOP_IMAGE_INFO[newImageId] : undefined;
    if (!info) return;

    setRecognizing(true);
    window.setTimeout(() => {
      setRecognizing(false);
      let appliedAny = false;
      setTitle((current) => {
        if (current.trim() !== "") return current;
        appliedAny = true;
        return info.title;
      });
      setDescription((current) => {
        if (current.trim() !== "") return current;
        appliedAny = true;
        return info.description;
      });
      setSpeaker((current) => {
        if (current.trim() !== "") return current;
        appliedAny = true;
        return info.speaker;
      });
      if (appliedAny) setRecognizedHint(true);
    }, 500);
  }

  useEffect(() => {
    if (state.success) {
      router.push("/admin/workshops");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Titel</label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-adesso-grey px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Beschreibung</label>
        <textarea
          name="description"
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-adesso-grey px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Dauer</label>
          <select
            name="durationMinutes"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) as 60 | 120)}
            className="w-full rounded-xl border border-adesso-grey px-3 py-2"
          >
            <option value={60}>60 Minuten</option>
            <option value={120}>120 Minuten</option>
          </select>
        </div>

        {duration === 60 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Session</label>
            <select
              name="session"
              value={session}
              onChange={(e) => setSession(e.target.value === "both" ? "both" : (Number(e.target.value) as 1 | 2))}
              className="w-full rounded-xl border border-adesso-grey px-3 py-2"
            >
              <option value={1}>Session 1</option>
              <option value={2}>Session 2</option>
              <option value="both">Beide Sessions (2x Durchlauf)</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-adesso-blue-4">
            Kapazität{duration === 60 && session === "both" ? " (pro Session)" : ""}
          </label>
          <input
            type="number"
            name="capacity"
            min={1}
            required
            defaultValue={workshop?.capacity ?? 20}
            className="w-full rounded-xl border border-adesso-grey px-3 py-2"
          />
          {duration === 60 && session === "both" && (
            <p className="mt-1 text-xs text-adesso-warmgrey">
              Gilt je Session unabhängig (z.B. 20 → 20 Plätze in Session 1 UND 20 in Session 2, 40
              gesamt).
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Raum</label>
          <input
            name="room"
            defaultValue={workshop?.room}
            className="w-full rounded-xl border border-adesso-grey px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Referent</label>
          <input
            name="speaker"
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            className="w-full rounded-xl border border-adesso-grey px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-adesso-blue-4">Bild</label>
        <input type="hidden" name="imageId" value={imageId ?? ""} />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => handleSelectImage(null)}
            className={`flex h-20 items-center justify-center rounded-xl border text-xs text-adesso-warmgrey ${
              imageId === null ? "border-adesso-primary ring-2 ring-adesso-primary/40" : "border-adesso-grey"
            }`}
          >
            Kein Bild
          </button>
          {WORKSHOP_IMAGES.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => handleSelectImage(img.id)}
              title={img.label}
              className={`relative h-20 overflow-hidden rounded-xl border ${
                imageId === img.id
                  ? "border-adesso-primary ring-2 ring-adesso-primary/40"
                  : "border-adesso-grey"
              }`}
            >
              <Image src={img.path} alt={img.label} fill sizes="150px" className="object-cover" />
            </button>
          ))}
        </div>
        {recognizing && (
          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-adesso-primary">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-adesso-primary border-t-transparent" />
            Workshop-Informationen werden aus dem Bild übernommen …
          </p>
        )}
        {!recognizing && recognizedHint && (
          <p className="mt-2 text-xs font-medium text-adesso-success">
            Informationen aus Bild übernommen – bitte prüfen.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-adesso-blue-4">
        <input type="checkbox" name="active" defaultChecked={workshop?.active ?? true} />
        Aktiv (für Teilnehmer sichtbar)
      </label>

      {state.error && <p className="text-sm font-medium text-adesso-error">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : workshop ? "Änderungen speichern" : "Workshop anlegen"}
        </Button>
      </div>
    </form>
  );
}
