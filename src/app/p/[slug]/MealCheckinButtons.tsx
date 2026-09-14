"use client";

import { useState, useTransition, useEffect } from "react";
import type { DayMenu, MealCheckinStatus } from "@/lib/types";
import { recordMealCheckin } from "./actions";
import { recordMealCheckinOffline, db } from "@/lib/db";

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

  // Carrega status salvo offline se houver
  useEffect(() => {
    let active = true;
    const loadOfflineStatus = async () => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const local = await db.checkins
          .where("[patientId+checkinDate+mealKey]")
          .equals([patientId, today, mealKey])
          .first();
        if (active && local) {
          setSelected(local.status);
        }
      } catch (err) {
        console.warn("Erro ao buscar checkin offline:", err);
      }
    };
    loadOfflineStatus();
    return () => { active = false; };
  }, [patientId, mealKey]);

  const handleCheckin = (status: MealCheckinStatus) => {
    setSelected(status);

    startTransition(async () => {
      try {
        // Tenta salvar localmente offline primeiro
        await recordMealCheckinOffline(patientId, new Date().toISOString().slice(0, 10), mealKey, status);

        // Dispara chamada para o servidor
        await recordMealCheckin(slug, patientId, mealKey, status);

        // Se deu tudo certo, atualiza o status de sincronização para "synced"
        const today = new Date().toISOString().slice(0, 10);
        await db.checkins
          .where("[patientId+checkinDate+mealKey]")
          .equals([patientId, today, mealKey])
          .modify({ syncStatus: "synced" });
      } catch (error) {
        // Se falhar (por exemplo, offline), o status permanece na fila pendente local
        console.warn("Checkin agendado offline devido a falha de conexão.");
      }
    });
  };

  return (
    <div className="mt-2 flex gap-1.5">
      {OPTIONS.map((opt) => {
        const active = selected === opt.status;
        return (
          <button
            key={opt.status}
            type="button"
            disabled={isPending}
            onClick={() => handleCheckin(opt.status)}
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
