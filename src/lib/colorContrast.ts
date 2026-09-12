/** Contraste WCAG entre uma cor de marca e branco (fundo do cabeçalho do PDF/área do paciente). */
export function contrastRatioAgainstWhite(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const luminance = relativeLuminance(r, g, b);
  return (1 + 0.05) / (luminance + 0.05);
}

export function meetsWcagAA(hex: string): boolean {
  return contrastRatioAgainstWhite(hex) >= 4.5;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
