"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reassignWaitlistAction } from "@/app/actions/admin/participants";
import { Button } from "@/components/ui/Button";

export function ReassignWaitlistButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setSummary(null);
    const result = await reassignWaitlistAction();
    setPending(false);
    setSummary(
      result.promotedCount === 0
        ? "Niemand konnte nachrücken - aktuell keine freie Kapazität."
        : `${result.promotedCount} Teilnehmer nachgerückt · ${result.stillWaitlistedCount} weiterhin auf der Warteliste.`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button onClick={handleClick} disabled={pending} variant="secondary">
        {pending ? "Wird nachgerückt…" : "Kollegen von der Warteliste neu zuordnen"}
      </Button>
      {summary && <p className="text-xs text-adesso-warmgrey">{summary}</p>}
    </div>
  );
}
