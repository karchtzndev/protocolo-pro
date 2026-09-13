export interface EvolutionPoint {
  date: string;
  value: number;
}

const W = 300;
const H = 140;
const PAD_X = 10;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 100;

/**
 * Gráfico de linha de série única, em SVG puro (sem biblioteca) — serve tanto
 * em server component quanto em client.
 *
 * Cada métrica tem seu próprio gráfico e sua própria escala de propósito:
 * peso (kg), gordura (%) e cintura (cm) têm ordens de grandeza diferentes, e
 * empilhar as três num eixo só (ou usar dois eixos) inventaria correlação que
 * não existe nos dados.
 *
 * A cor da linha usa --color-accent, que mantém contraste >= 3:1 tanto sobre a
 * superfície clara quanto sobre a escura do tema.
 */
export function EvolutionChart({
  title,
  unit,
  points,
  decimals = 1,
}: {
  title: string;
  unit: string;
  points: EvolutionPoint[];
  decimals?: number;
}) {
  if (points.length < 2) {
    return (
      <figure className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
        <figcaption className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
          {title}
        </figcaption>
        <p className="py-6 text-center text-xs text-[var(--ink-faint)]">
          {points.length === 1
            ? `Só uma aferição registrada (${format(points[0].value, decimals)} ${unit}) — registre outra para ver a evolução.`
            : "Nenhuma aferição registrada."}
        </p>
      </figure>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Série constante: abre uma faixa artificial pra linha não colar na borda.
  const span = rawMax - rawMin || Math.max(rawMax * 0.1, 1);
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / (points.length - 1);
  const y = (v: number) => PLOT_BOTTOM - ((v - min) / (max - min)) * (PLOT_BOTTOM - PLOT_TOP);

  const path = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.value - first.value;

  return (
    <figure className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">{title}</span>
        <span className="font-mono-data text-[11px] font-semibold text-[var(--ink-soft)]">
          {delta > 0 ? "+" : ""}
          {format(delta, decimals)} {unit}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: evolução de ${format(first.value, decimals)} para ${format(last.value, decimals)} ${unit}`}>
        {/* Grade recessiva — linhas sólidas, um tom acima da superfície. */}
        {[0, 0.5, 1].map((t) => {
          const gy = PLOT_TOP + t * (PLOT_BOTTOM - PLOT_TOP);
          const gv = max - t * (max - min);
          return (
            <g key={t}>
              <line x1={PAD_X} y1={gy} x2={W - PAD_X} y2={gy} stroke="var(--border-soft)" strokeWidth="1" />
              <text x={PAD_X} y={gy - 3} fontSize="8" fill="var(--ink-faint)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {format(gv, decimals)}
              </text>
            </g>
          );
        })}

        <polyline
          points={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill="var(--color-accent)" stroke="var(--surface)" strokeWidth="2" />
            {/* Alvo de toque generoso — o ponto visível tem 5px, o alvo tem 20px. */}
            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent">
              <title>{`${p.date}: ${format(p.value, decimals)} ${unit}`}</title>
            </circle>
          </g>
        ))}

        {/* Rótulo direto só no ponto atual — os demais valores ficam no tooltip e na tabela de histórico.
            O contorno na cor da superfície evita que o texto se perca sobre a linha. */}
        <text
          x={Math.min(x(points.length - 1), W - PAD_X - 4)}
          y={Math.max(y(last.value) - 11, 10)}
          fontSize="10"
          fontWeight="700"
          textAnchor="end"
          fill="var(--ink)"
          stroke="var(--surface)"
          strokeWidth="3"
          paintOrder="stroke"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {format(last.value, decimals)} {unit}
        </text>

        <text x={PAD_X} y={H - 14} fontSize="9" fill="var(--ink-faint)">
          {first.date}
        </text>
        <text x={W - PAD_X} y={H - 14} fontSize="9" textAnchor="end" fill="var(--ink-faint)">
          {last.date}
        </text>
      </svg>
    </figure>
  );
}

function format(value: number, decimals: number) {
  return value.toFixed(decimals).replace(".", ",");
}
