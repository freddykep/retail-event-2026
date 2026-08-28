"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteParticipantAction } from "@/app/actions/admin/participants";

export function DeleteParticipantButton({ participantId, name }: { participantId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        `${name} wirklich vollständig löschen? Das entfernt Zugangscode, Anmeldung und reservierte Workshop-Plätze unwiderruflich.`
      )
    ) {
      return;
    }
    setPending(true);
    await deleteParticipantAction(participantId);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-adesso-error underline disabled:opacity-50"
    >
      {pending ? "Wird gelöscht…" : "Löschen"}
    </button>
  );
}
