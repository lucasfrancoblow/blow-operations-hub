// Tipos e constantes do relatório diário do funil B2B Expansão (ver briefing de
// 23/11/2026). A lógica de cálculo (periodo, variacao, canais, gasto, agregar) é pura e
// não depende de rede; a coleta de dados fica em coleta.ts.

export const METRICAS = [
  "leads",
  "sql",
  "agendada",
  "realizada",
  "rogaMarcado",
  "rogaRealizado",
  "documentacao",
  "contrato",
  "venda",
] as const;
export type Metrica = (typeof METRICAS)[number];
export type Contagens = Record<Metrica, number>;

/** Os quatro canais que compõem o Geral. */
export const CANAIS_GERAL = ["Facebook Ads", "Google", "Orgânico", "Rapha Mattos"] as const;
export type CanalGeral = (typeof CANAIS_GERAL)[number];
/** Outbound fica fora do Geral (decisão de 05/11/2026). */
export const CANAL_OUTBOUND = "Outbound" as const;
export type Canal = CanalGeral | typeof CANAL_OUTBOUND;
export const TODOS_CANAIS: readonly Canal[] = [...CANAIS_GERAL, CANAL_OUTBOUND];

export type Funil = "inbound" | "closer" | "outbound";

export const PIPELINE_IDS = { inbound: 97638, closer: 98248, outbound: 108495 } as const;

/** Etapa (id no PipeRun) -> métrica e funil. Fonte: briefing, seção 6. */
export const ETAPAS: Record<number, { metrica: Metrica; funil: Funil }> = {
  624603: { metrica: "leads", funil: "inbound" },
  629005: { metrica: "sql", funil: "inbound" },
  629006: { metrica: "agendada", funil: "inbound" },
  628988: { metrica: "realizada", funil: "closer" },
  646802: { metrica: "rogaMarcado", funil: "closer" },
  628989: { metrica: "rogaRealizado", funil: "closer" },
  628990: { metrica: "documentacao", funil: "closer" },
  628991: { metrica: "contrato", funil: "closer" },
  628992: { metrica: "venda", funil: "closer" },
  702298: { metrica: "leads", funil: "outbound" }, // Levantou a mão
  701806: { metrica: "sql", funil: "outbound" },
  701807: { metrica: "agendada", funil: "outbound" },
};

export const ETAPA_REUNIAO_REALIZADA = 628988;

export function contagensVazias(): Contagens {
  return {
    leads: 0,
    sql: 0,
    agendada: 0,
    realizada: 0,
    rogaMarcado: 0,
    rogaRealizado: 0,
    documentacao: 0,
    contrato: 0,
    venda: 0,
  };
}

/** Uma entrada em etapa já filtrada, com dia (Brasília) e canal atribuídos. */
export interface EventoFunil {
  dealId: number;
  stageId: number;
  metrica: Metrica;
  day: string; // YYYY-MM-DD
  canal: Canal;
  /** Lead sem backup nem origem reconhecível (caiu em Orgânico por padrão). */
  semOrigem: boolean;
}
