// Formatação pt-BR dos números do relatório. Sem dado = "—" (nunca 0 inventado).

export const SEM_DADO = "—";

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

export function moeda(valor: number | null, casas: 0 | 2 = 0): string {
  if (valor === null) return SEM_DADO;
  return `R$ ${nf(casas, casas).format(valor)}`;
}

/** Inteiro, ou 1 casa decimal quando a média não é inteira ("1,6"). */
export function numero(valor: number | null): string {
  if (valor === null) return SEM_DADO;
  const arred = Math.round(valor * 10) / 10;
  return nf(0, 1).format(arred);
}

/** Percentual de variação com sinal: "+7,9%", "−100,0%" (sinal de menos tipográfico). */
export function variacao(pct: number | null): string {
  if (pct === null) return SEM_DADO;
  const v = Math.round(pct * 1000) / 10;
  const abs = nf(1, 1).format(Math.abs(v));
  if (v > 0) return `+${abs}%`;
  if (v < 0) return `−${abs}%`;
  return `${abs}%`;
}

/** Taxa: "25,0%"; 100% exato sem casas. */
export function taxa(valor: number | null): string {
  if (valor === null) return SEM_DADO;
  if (Math.abs(valor - 1) < 1e-9) return "100%";
  return `${nf(1, 1).format(valor * 100)}%`;
}

export function benchmark(valor: number): string {
  return `${nf(0, 1).format(valor * 100)}%`;
}
