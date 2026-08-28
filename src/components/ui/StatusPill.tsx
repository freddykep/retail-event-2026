type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClasses: Record<Tone, string> = {
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-adesso-error border-red-200",
  neutral: "bg-adesso-grey-lighter text-adesso-warmgrey border-adesso-grey",
  info: "bg-blue-50 text-adesso-primary border-blue-200",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-adesso-error",
  neutral: "bg-adesso-warmgrey",
  info: "bg-adesso-primary",
};

export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} />
      {children}
    </span>
  );
}
