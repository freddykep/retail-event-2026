"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdmin } from "@/app/actions/admin-auth";
import { AdessoLogo } from "@/components/ui/AdessoLogo";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/participants", label: "Teilnehmer" },
  { href: "/admin/workshops", label: "Workshops" },
  { href: "/admin/allocation", label: "Zuteilung" },
];

export function AdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    <header className="bg-adesso-blue-4 relative text-white">
      <div className="bg-event-gradient absolute inset-x-0 top-0 h-1" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="flex items-center gap-2.5">
            <AdessoLogo className="h-4 w-auto text-white" />
            <span className="h-4 w-px bg-white/25" />
            <span className="font-heading text-sm font-bold tracking-tight text-white/90">
              Event Admin
            </span>
          </div>
          <nav className="flex gap-1 text-sm">
            {LINKS.map((link) => {
              const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {email && <span className="hidden text-white/70 sm:inline">{email}</span>}
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-white/50 hover:text-white sm:text-sm"
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
