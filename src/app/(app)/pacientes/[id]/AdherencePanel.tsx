import type { MealCheckin } from "@/lib/types";
import { MEAL_SCHEDULE } from "@/lib/types";

const DAYS_TRACKED = 7;

const STATUS_STYLE: Record<string, string> = {
  feito: "bg-success",
  parcial: "bg-warning",
  pulado: "bg-danger",
};

/** Aderência do paciente nos últimos 7 dias, a partir do diário alimentar do portal. */
export function AdherencePanel({ checkins }: { checkins: MealCheckin[] }) {
  const days = Array.from({ length: DAYS_TRACKED }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS_TRACKED - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  const byKey = new Map(checkins.map((c) => [`${c.checkin_date}|${c.meal_key}`, c.status]));
  const answered = checkins.filter((c) => days.includes(c.checkin_date));
  const done = answered.filter((c) => c.status === "feito").length;
  const adherence = answered.length ? Math.round((done / answered.length) * 100) : null;

  return (
    <div className="mb-6 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Aderência — últimos 7 dias</h3>
        {adherence !== null ? (
          <span className="font-mono-data text-sm font-bold text-accent-strong">{adherence}%</span>
        ) : (
          <span className="text-xs text-[var(--ink-faint)]">sem registros ainda</span>
        )}
      </div>

      {answered.length === 0 ? (
        <p className="text-xs text-[var(--ink-soft)]">
          O paciente ainda não marcou nenhuma refeição no portal. O diário aparece pra ele junto do cardápio do dia.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="px-1.5 py-1" />
                  {days.map((d) => (
                    <th key={d} className="px-1.5 py-1 font-semibold text-[var(--ink-faint)]">
                      {new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_SCHEDULE.map((meal) => (
                  <tr key={meal.key}>
                    <td className="whitespace-nowrap px-1.5 py-1 text-[var(--ink-soft)]">{meal.label}</td>
                    {days.map((d) => {
                      const status = byKey.get(`${d}|${meal.key}`);
                      return (
                        <td key={d} className="px-1.5 py-1">
                          <span
                            title={status ? `${meal.label}: ${status}` : "sem registro"}
                            className={`block h-3.5 w-3.5 rounded ${
                              status ? STATUS_STYLE[status] : "bg-[var(--surface-2)]"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] text-[var(--ink-soft)]">
            <Legend className="bg-success" label="fez" />
            <Legend className="bg-warning" label="em parte" />
            <Legend className="bg-danger" label="pulou" />
            <Legend className="bg-[var(--surface-2)]" label="sem registro" />
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded ${className}`} />
      {label}
    </span>
  );
}
