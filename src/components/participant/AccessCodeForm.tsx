"use client";

import { useActionState } from "react";
import { verifyAccessCode, type VerifyCodeState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

const initialState: VerifyCodeState = {};

export function AccessCodeForm({ prefillCode }: { prefillCode?: string }) {
  const [state, formAction, pending] = useActionState(verifyAccessCode, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="code" className="mb-2 block text-sm font-medium text-adesso-blue-4">
          Persönlicher Zugangscode
        </label>
        <input
          id="code"
          name="code"
          type="text"
          autoComplete="one-time-code"
          placeholder="XXXX-XXXX"
          defaultValue={prefillCode}
          autoFocus
          className="w-full rounded-xl border border-adesso-grey px-4 py-3.5 text-center text-lg font-semibold tracking-widest uppercase text-adesso-blue-4 transition-shadow focus:border-adesso-primary focus:outline-none focus:ring-4 focus:ring-adesso-primary/15"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-adesso-error">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Wird geprüft…" : "Anmelden"}
      </Button>
    </form>
  );
}
