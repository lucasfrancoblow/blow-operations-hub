// Período do relatório. Seg-sáb; domingo não roda. Na segunda o período é sábado+domingo.

export interface Periodo {
  /** Primeiro e último dia do período (YYYY-MM-DD, Brasília). */
  from: string;
  to: string;
  /** Todos os dias do período. */
  dias: string[];
  /** true quando é segunda-feira (sábado + domingo). */
  fimDeSemana: boolean;
  /** Últimos 7 dias até o fim do período (inclui ontem). */
  seteDiasFrom: string;
  seteDiasTo: string;
  /** Mês de calendário do último dia do período, até esse dia. */
  mesFrom: string;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function diasEntre(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Data de hoje em America/Sao_Paulo (YYYY-MM-DD). */
export function hojeSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function horaSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/** Período coberto pelo relatório que "roda" em `runDate`. null no domingo (não roda). */
export function calcPeriodo(runDate: string): Periodo | null {
  const dow = diaDaSemana(runDate);
  if (dow === 0) return null;
  const fimDeSemana = dow === 1;
  const to = addDays(runDate, -1);
  const from = fimDeSemana ? addDays(runDate, -2) : to;
  return {
    from,
    to,
    dias: diasEntre(from, to),
    fimDeSemana,
    seteDiasFrom: addDays(to, -6),
    seteDiasTo: to,
    mesFrom: `${to.slice(0, 7)}-01`,
  };
}

export function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatarDiaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const NOMES_DIA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
export function nomeDoDia(iso: string): string {
  return NOMES_DIA[diaDaSemana(iso)]!;
}

export function tituloPeriodo(p: Periodo): string {
  return p.fimDeSemana
    ? `Sáb + Dom — ${formatarDiaMes(p.from)} a ${formatarDiaMes(p.to)}`
    : formatarDataBR(p.to);
}
