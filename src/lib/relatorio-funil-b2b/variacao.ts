// Cores e taxas de conversão.

export type TomTaxa = "verde" | "laranja" | "cinza";

/** Denominador mínimo para a taxa do período ser considerada (abaixo disso fica cinza). */
export const DENOMINADOR_MINIMO = 5;

export interface Taxa {
  /** null = sem dado (denominador 0). Pode passar de 1 (100%). */
  valor: number | null;
  denominador: number;
}

export function calcTaxa(numerador: number, denominador: number): Taxa {
  return { valor: denominador > 0 ? numerador / denominador : null, denominador };
}

export function tomTaxa(taxa: Taxa, benchmark: number): TomTaxa {
  if (taxa.valor === null || taxa.denominador < DENOMINADOR_MINIMO) return "cinza";
  return taxa.valor >= benchmark ? "verde" : "laranja";
}

/** Custo = investimento / volume. Sem investimento conhecido, investimento 0 ou volume 0 -> null ("—"). */
export function calcCusto(investimento: number | null, volume: number): number | null {
  if (investimento === null || investimento <= 0 || volume <= 0) return null;
  return investimento / volume;
}
