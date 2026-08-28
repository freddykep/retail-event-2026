"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryWaitlistedParticipant } from "@/app/actions/admin/participants";

export function RetryWaitlistButton({ participantId }: { participantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);
    const result = await retryWaitlistedParticipant(participantId);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (!result.confirmed) {
      setMessage("Weiterhin keine Kapazität frei.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-adesso-primary underline disabled:opacity-50"
      >
        {pending ? "Wird geprüft…" : "Jetzt erneut versuchen"}
      </button>
      {message && <span className="text-xs text-adesso-warmgrey">{message}</span>}
    </div>
  );
}
