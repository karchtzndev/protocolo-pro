import type { AnthropometryRecord, FoodCatalogItem, Patient, Protocol } from "@/lib/types";
import { MEAL_SCHEDULE } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProtocolEditorDialog } from "./ProtocolEditorDialog";
import { MealItemsList } from "@/components/diet/MealItemsList";

const STALE_AFTER_DAYS = 60;

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const DAYS: { key: keyof NonNullable<Protocol["weekly_menu"]>; label: string }[] = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const MEALS = MEAL_SCHEDULE;

export function ProtocoloTab({
  patient,
  protocol,
  foods,
  latestAnthropometry,
  history,
  preferredFoodIds,
  excludedFoodNames,
  enabledModules,
}: {
  patient: Patient;
  protocol: Protocol | null;
  foods: FoodCatalogItem[];
  latestAnthropometry: AnthropometryRecord | null;
  history: Protocol[];
  preferredFoodIds: string[];
  excludedFoodNames: string[];
  enabledModules: string[];
}) {
  if (!protocol) {
    return (
      <div>
        <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--ink-soft)]">
          <p className="mb-4">
            Nenhum protocolo alimentar ativo. Crie o cardápio de 7 dias e a antropometria para este paciente.
          </p>
          <ProtocolEditorDialog
            patient={patient}
            protocol={null}
            foods={foods}
            latestAnthropometry={latestAnthropometry}
            preferredFoodIds={preferredFoodIds}
            excludedFoodNames={excludedFoodNames}
            enabledModules={enabledModules}
          />
        </div>
        <ProtocolHistory history={history} />
      </div>
    );
  }

  return (
    <div>
      {excludedFoodNames.length > 0 && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          🚫 Excluídos por intolerância (anamnese): {excludedFoodNames.join(", ")}
        </p>
      )}

      <div className="mb-4 flex items-center justify-between">
        {daysSince(protocol.created_at) > STALE_AFTER_DAYS ? (
          <Badge tone="warning">⚠ protocolo com {daysSince(protocol.created_at)} dias — considere reavaliar</Badge>
        ) : (
          <span />
        )}
        <ProtocolEditorDialog
          patient={patient}
          protocol={protocol}
          foods={foods}
          latestAnthropometry={latestAnthropometry}
          preferredFoodIds={preferredFoodIds}
          excludedFoodNames={excludedFoodNames}
          enabledModules={enabledModules}
        />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        <AnthroTile value={protocol.weight_kg ? `${protocol.weight_kg} kg` : "—"} label="Peso" />
        <AnthroTile value={protocol.height_m ? `${protocol.height_m} m` : "—"} label="Altura" />
        <AnthroTile value={imc(protocol)} label="IMC" />
        <AnthroTile value={protocol.body_fat_pct ? `${protocol.body_fat_pct}%` : "—"} label="Gordura" />
        <AnthroTile value={protocol.waist_cm ? `${protocol.waist_cm} cm` : "—"} label="Cint. abdominal" />
      </div>

      <h3 className="mb-3 text-sm font-semibold">Cardápio — 7 dias</h3>
      <div className="mb-6 overflow-x-auto rounded-xl border border-[var(--border-soft)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 whitespace-nowrap bg-[var(--surface-2)] px-3 py-2.5 text-left font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                Refeição
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.key}
                  className="whitespace-nowrap bg-[var(--surface-2)] px-3 py-2.5 text-left font-bold uppercase tracking-wide text-[var(--ink-soft)]"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEALS.map((meal) => (
              <tr key={meal.key}>
                <td className="sticky left-0 whitespace-nowrap border-t border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2.5 font-bold">
                  {meal.label}
                  <span className="ml-1.5 font-normal text-[10px] text-[var(--ink-faint)]">{meal.time}</span>
                </td>
                {DAYS.map((d) => {
                  const slot = protocol.weekly_menu[d.key]?.[meal.key];
                  return (
                    <td key={d.key} className="border-t border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2.5">
                      {slot ? (
                        <>
                          <MealItemsList descricao={slot.descricao} />
                          <span className="mt-1 block font-mono-data text-[10.5px] font-semibold text-accent-strong">
                            {slot.kcal} kcal
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--ink-faint)]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-3 text-sm font-semibold">Lista de compras (gerada automaticamente)</h3>
      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {protocol.shopping_list.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-brand" />
            {item}
          </div>
        ))}
      </div>

      <a href={`/api/pdf/protocolo/${patient.id}`} target="_blank" rel="noreferrer">
        <Button variant="accent">⭳ Gerar PDF do protocolo</Button>
      </a>

      <ProtocolHistory history={history} />
    </div>
  );
}

function ProtocolHistory({ history }: { history: Protocol[] }) {
  if (!history.length) return null;

  return (
    <details className="mt-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4">
      <summary className="cursor-pointer text-sm font-semibold">Histórico de versões ({history.length})</summary>
      <div className="mt-3 space-y-2">
        {history.map((p) => (
          <div key={p.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <b>{new Date(p.created_at).toLocaleDateString("pt-BR")}</b>
              <span className="text-[var(--ink-faint)]">{p.is_draft ? "rascunho" : "publicado"}</span>
            </div>
            <span className="text-[var(--ink-soft)]">
              {p.weight_kg ? `${p.weight_kg} kg` : "—"} · {p.height_m ? `${p.height_m} m` : "—"} ·{" "}
              {p.shopping_list.length} itens na lista de compras
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

function imc(protocol: Protocol) {
  if (!protocol.weight_kg || !protocol.height_m) return "—";
  return (protocol.weight_kg / (protocol.height_m * protocol.height_m)).toFixed(1);
}

function AnthroTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-center">
      <div className="font-mono-data text-base font-semibold">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">{label}</div>
    </div>
  );
}
