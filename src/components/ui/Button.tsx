import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-adesso-primary text-white shadow-sm shadow-adesso-primary/20 hover:bg-adesso-blue-2 hover:shadow-md hover:shadow-adesso-primary/25 active:scale-[0.98] disabled:bg-adesso-grey disabled:shadow-none disabled:active:scale-100",
  secondary:
    "bg-white text-adesso-primary border border-adesso-primary/40 hover:border-adesso-primary hover:bg-adesso-grey-lighter active:scale-[0.98] disabled:text-adesso-grey disabled:border-adesso-grey disabled:active:scale-100",
  danger:
    "bg-adesso-error text-white shadow-sm shadow-adesso-error/20 hover:opacity-90 active:scale-[0.98] disabled:bg-adesso-grey disabled:active:scale-100",
  ghost: "bg-transparent text-adesso-blue-4 hover:bg-adesso-grey-lighter active:scale-[0.98]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
