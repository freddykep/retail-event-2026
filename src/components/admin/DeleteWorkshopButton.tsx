"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkshopAction } from "@/app/actions/admin/workshops";

export function DeleteWorkshopButton({ workshopId }: { workshopId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirm("Diesen Workshop wirklich löschen?")) return;
    setPending(true);
    const result = await deleteWorkshopAction(workshopId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-adesso-error underline disabled:opacity-50"
      >
        Löschen
      </button>
      {error && <p className="mt-1 text-xs text-adesso-error">{error}</p>}
    </div>
  );
}
