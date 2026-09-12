"use client";

import { useTransition } from "react";
import { togglePlanActive } from "./actions";

export function PlanToggleButton({ planId, active }: { planId: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => togglePlanActive(planId, !active))}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? "border-danger text-danger" : "border-success text-success"
      }`}
    >
      {active ? "Desativar" : "Reativar"}
    </button>
  );
}
