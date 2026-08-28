import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-adesso-grey-light bg-white shadow-sm shadow-adesso-blue-4/5 ${className}`}
      {...props}
    />
  );
}
