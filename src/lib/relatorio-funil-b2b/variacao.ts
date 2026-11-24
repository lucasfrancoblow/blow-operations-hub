// Variação, cores e taxas de conversão.

export type Tom = "bom" | "ruim" | "neutro";
export type TomTaxa = "verde" | "laranja" | "cinza";

/** (dia − média) / média. Média 0 -> null (sem base de comparação). Dia 0 com média > 0 -> −100%. */
export function variacaoPct(dia: number | null, media: number | null): number | null {
  if (dia === null || media === null) return null;
  if (media === 0) return null;
  return (dia - media) / media;
}

/** Volume: subir é bom. Custo: menor é verde (lógica invertida). Neutro (ex.: investimento): sem cor. */
export function tomVariacao(pct: number | null, tipo: "volume" | "custo" | "neutro"): Tom {
  if (pct === null || tipo === "neutro" || Math.abs(pct) < 1e-9) return "neutro";
  const subiu = pct > 0;
  if (tipo === "volume") return subiu ? "bom" : "ruim";
  return subiu ? "ruim" : "bom";
}

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
