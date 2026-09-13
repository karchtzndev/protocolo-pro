import { parseMealItems } from "@/lib/diet/mealItems";

/** Mesma lógica de exibição do PDF: um item por linha, quantidade em destaque, aviso se faltar gramatura. */
export function MealItemsList({ descricao, className = "" }: { descricao: string; className?: string }) {
  const items = parseMealItems(descricao);
  if (!items.length) return <span className="text-[var(--ink-faint)]">—</span>;

  return (
    <ul className={className}>
      {items.map((item, i) => (
        <li key={i} className="leading-snug">
          {item.name}
          {item.grams ? (
            <b className="ml-1 font-mono-data text-accent-strong">{item.grams}g</b>
          ) : (
            <span className="ml-1 font-semibold text-warning">quantidade não especificada</span>
          )}
        </li>
      ))}
    </ul>
  );
}
