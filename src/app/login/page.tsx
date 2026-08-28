import Image from "next/image";
import { AccessCodeForm } from "@/components/participant/AccessCodeForm";
import { Card } from "@/components/ui/Card";
import { AdessoLogo } from "@/components/ui/AdessoLogo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="bg-event-gradient relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-event-mint/20 blur-3xl" />

      <div className="relative mb-8 flex flex-col items-center gap-4 text-center">
        <div className="relative h-16 w-48 overflow-hidden rounded-xl shadow-lg shadow-black/20 sm:h-20 sm:w-60">
          <Image
            src="/branding/team-retail-logo.jpg"
            alt="Team Retail - Gemeinsam intelligenter handeln"
            fill
            sizes="240px"
            priority
            className="object-cover"
          />
        </div>
        <AdessoLogo className="h-5 w-auto text-white/90" />
      </div>

      <Card className="relative w-full max-w-md border-white/40 p-8 shadow-xl">
        <h1 className="font-heading mb-2 text-2xl font-bold text-adesso-blue-4">
          Willkommen zur Workshop-Anmeldung
        </h1>
        <p className="mb-6 text-sm text-adesso-warmgrey">
          Bitte gib deinen persönlichen Zugangscode aus der Einladungs-Mail ein.
        </p>
        <AccessCodeForm prefillCode={code} />
      </Card>

      <p className="relative mt-6 max-w-md text-center text-xs text-white/80">
        Dein Zugangscode ist persönlich - bitte gib ihn nicht an andere Personen weiter.
      </p>
    </main>
  );
}
