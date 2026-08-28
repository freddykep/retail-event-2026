"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateParticipantAccessCode } from "@/app/actions/admin/participants";

export function RegenerateCodeButton({ participantId }: { participantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm("Neuen Zugangscode erzeugen? Der bisherige Code wird dadurch ungültig.")) return;
    setPending(true);
    await regenerateParticipantAccessCode(participantId);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-adesso-primary underline disabled:opacity-50"
    >
      Code neu erzeugen
    </button>
  );
}
