"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelParticipantRegistration } from "@/app/actions/admin/participants";

export function CancelRegistrationButton({ participantId }: { participantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        "Anmeldung wirklich stornieren? Reservierte Workshop-Plätze werden sofort wieder freigegeben."
      )
    ) {
      return;
    }
    setPending(true);
    await cancelParticipantRegistration(participantId);
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
      {pending ? "Wird storniert…" : "Stornieren"}
    </button>
  );
}
