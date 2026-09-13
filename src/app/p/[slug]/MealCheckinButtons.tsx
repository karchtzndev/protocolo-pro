"use client";

import { useState, useTransition } from "react";
import type { DayMenu, MealCheckinStatus } from "@/lib/types";
import { recordMealCheckin } from "./actions";

const OPTIONS: { status: MealCheckinStatus; label: string; activeClass: string }[] = [
  { status: "feito", label: "✓ Fiz", activeClass: "border-success bg-success-soft text-success" },
  { status: "parcial", label: "~ Em parte", activeClass: "border-warning bg-warning-soft text-warning" },
  { status: "pulado", label: "✕ Pulei", activeClass: "border-danger bg-danger-soft text-danger" },
];

export function MealCheckinButtons({
  slug,
  patientId,
  mealKey,
  current,
}: {
  slug: string;
  patientId: string;
  mealKey: keyof DayMenu;
  current: MealCheckinStatus | null;
}) {
  const [selected, setSelected] = useState<MealCheckinStatus | null>(current);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-2 flex gap-1.5">
      {OPTIONS.map((opt) => {
        const active = selected === opt.status;
        return (
          <button
            key={opt.status}
            type="button"
            disabled={isPending}
            onClick={() => {
              setSelected(opt.status);
              startTransition(() => recordMealCheckin(slug, patientId, mealKey, opt.status));
            }}
            className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition disabled:opacity-60 ${
              active ? opt.activeClass : "border-[var(--border)] text-[var(--ink-faint)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
