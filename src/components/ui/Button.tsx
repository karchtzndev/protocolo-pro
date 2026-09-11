import { ButtonHTMLAttributes } from "react";

const variants = {
  brand: "bg-brand text-brand-on hover:brightness-110",
  accent: "bg-accent text-white hover:brightness-110",
  ghost: "bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:border-[var(--ink-faint)]",
  "danger-ghost": "bg-danger-soft text-danger hover:brightness-95",
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: "sm" | "md";
}

export function Button({ variant = "brand", size = "md", className = "", ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed ${
        size === "sm" ? "px-3 py-1.5 text-xs rounded-md" : "px-4 py-2.5 text-sm"
      } ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
