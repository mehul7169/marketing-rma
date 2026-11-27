import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-95",
  secondary:
    "border border-subtle bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-danger-fg hover:brightness-95"
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "pressable inline-flex items-center justify-center gap-1.5 rounded-control font-medium disabled:opacity-60",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    />
  );
});

export default Button;
