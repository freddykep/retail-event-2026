import Image from "next/image";
import { logoutParticipant } from "@/app/actions/auth";

function AccountControls({
  firstName,
  textClassName,
  buttonClassName,
}: {
  firstName: string;
  textClassName: string;
  buttonClassName: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={textClassName}>Hallo {firstName}</span>
      <form action={logoutParticipant}>
        <button type="submit" className={buttonClassName}>
          Abmelden
        </button>
      </form>
    </div>
  );
}

export function ParticipantHeader({ firstName }: { firstName: string }) {
  return (
    <header className="relative overflow-hidden bg-white">
      {/* Desktop/Tablet: Verlaufshintergrund mit schraegem Abschluss bei ca. 4/5 der
          Breite, rechts komplett weiss mit dem adesso-Logo. */}
      <div className="relative hidden h-[190px] sm:block md:h-[220px]">
        <div
          className="bg-event-gradient absolute inset-y-0 left-0 w-[81%]"
          style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 0 100%)" }}
        >
          <div className="flex h-full items-center pl-8 md:pl-14">
            <div className="relative h-[90px] w-[260px] drop-shadow-2xl md:h-[110px] md:w-[320px]">
              <Image
                src="/branding/team-retail-logo-mark.png"
                alt="Team Retail - Gemeinsam intelligenter handeln"
                fill
                sizes="320px"
                className="object-contain object-left"
                priority
              />
            </div>
          </div>
        </div>

        <div className="absolute right-6 top-5 md:right-10 md:top-6">
          <AccountControls
            firstName={firstName}
            textClassName="text-xs text-adesso-blue-4/70 md:text-sm"
            buttonClassName="rounded-lg border border-adesso-blue-4/20 px-3 py-1.5 text-xs font-medium text-adesso-blue-4 transition-colors hover:border-adesso-blue-4/40 md:text-sm"
          />
        </div>

        <div className="absolute inset-y-0 right-0 flex w-1/5 items-center justify-center px-4">
          <div className="relative h-10 w-full max-w-[130px] md:h-16 md:max-w-[190px]">
            <Image src="/branding/adesso-logo.svg" alt="adesso" fill sizes="190px" className="object-contain" />
          </div>
        </div>
      </div>

      {/* Mobile: gestapelt statt schraeg, damit beide Logos gut lesbar bleiben. */}
      <div className="sm:hidden">
        <div className="bg-event-gradient flex items-center justify-center px-4 py-6">
          <div className="relative h-[68px] w-[220px] drop-shadow-xl">
            <Image
              src="/branding/team-retail-logo-mark.png"
              alt="Team Retail - Gemeinsam intelligenter handeln"
              fill
              sizes="220px"
              className="object-contain"
              priority
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
          <div className="relative h-8 w-[100px]">
            <Image src="/branding/adesso-logo.svg" alt="adesso" fill sizes="100px" className="object-contain" />
          </div>
          <AccountControls
            firstName={firstName}
            textClassName="text-xs text-adesso-blue-4/70"
            buttonClassName="rounded-lg border border-adesso-blue-4/20 px-2.5 py-1 text-xs font-medium text-adesso-blue-4"
          />
        </div>
      </div>
    </header>
  );
}
