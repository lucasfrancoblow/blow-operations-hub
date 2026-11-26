// Relatório comercial diário da Expansão para a diretoria (Diego Almada). Lógica pura:
// recebe o que a coleta trouxe (3C Plus via call_metrics_daily e PipeRun) e monta os
// números. Sem rede aqui, para dar para testar.

import type { CallMetricRow } from "@/lib/call-metrics";

export const FUNIS = {
  inbound: { id: 97638, nome: "Pré-vendas (Inbound)" },
  outbound: { id: 108495, nome: "Outbound" },
  closer: { id: 98248, nome: "Closer" },
} as const;
export type FunilChave = keyof typeof FUNIS;
export const FUNIL_POR_ID: Record<number, FunilChave> = {
  97638: "inbound",
  108495: "outbound",
  98248: "closer",
};

/** Etapas que viram coluna por pessoa (id no PipeRun). */
export const ETAPA = {
  novoLeadInbound: 624603,
  levantouMaoOutbound: 702298,
  sqlInbound: 629005,
  sqlOutbound: 701806,
  agendadaInbound: 629006,
  agendadaOutbound: 701807,
  noShowInbound: 682746,
  reuniaoPrevista: 703267,
  noShowCloser: 703269,
  reuniaoRealizada: 628988,
  rogaRealizado: 628989,
  documentacao: 628990,
  contrato: 628991,
  venda: 628992,
} as const;

/** status_id 7 ("Finalizada") com agente = conversa de verdade (mesma regra do hub). */
const STATUS_CONVERSA = 7;

export interface Janela {
  from: string;
  to: string;
}

const dentro = (dia: string, j: Janela) => dia >= j.from && dia <= j.to;

// --- Ligações (3C Plus) -------------------------------------------------------------

export interface LigacoesAgente {
  agente: string;
  ligacoes: number;
  conversas: number;
  segundosFalados: number;
  /** Média por conversa (s); null sem conversa. */
  mediaSegundos: number | null;
}

/** Agrupa por NOME do agente, não pelo id: a 3C reaproveita o login ao renomear (o id
 * 244167 era "Julia Garcia" e virou "Alana Ferrite" em 23/11/2026). Pelo nome, o histórico
 * de cada pessoa fica separado. */
export function resumirLigacoes(linhas: CallMetricRow[], j: Janela): LigacoesAgente[] {
  const porAgente = new Map<string, LigacoesAgente>();
  for (const l of linhas) {
    if (l.agent_id === 0 || !dentro(l.call_date, j)) continue;
    const a = porAgente.get(l.agent_name) ?? {
      agente: l.agent_name,
      ligacoes: 0,
      conversas: 0,
      segundosFalados: 0,
      mediaSegundos: null,
    };
    a.ligacoes += l.total_calls;
    a.segundosFalados += l.total_speaking_seconds;
    if (l.status_id === STATUS_CONVERSA) a.conversas += l.total_calls;
    porAgente.set(l.agent_name, a);
  }
  return [...porAgente.values()]
    .map((a) => ({
      ...a,
      mediaSegundos: a.conversas > 0 ? Math.round(a.segundosFalados / a.conversas) : null,
    }))
    .sort((a, b) => b.ligacoes - a.ligacoes);
}

/** Dias da janela sem nenhuma linha da 3C (sync não rodou): o número estaria incompleto. */
export function diasSemLigacao(linhas: CallMetricRow[], dias: string[]): string[] {
  const comDado = new Set(linhas.map((l) => l.call_date));
  return dias.filter((d) => !comDado.has(d));
}

// --- PipeRun ------------------------------------------------------------------------

export interface Entrada {
  dealId: number;
  stageId: number;
  dia: string; // YYYY-MM-DD
}

export interface InfoNegocio {
  funil: FunilChave;
  dono: string;
}

export interface EtapaContagem {
  etapa: string;
  periodo: number;
  mes: number;
}

/** Entradas por etapa de cada funil, na ordem do funil. Conta negócios únicos. */
export function entradasPorEtapa(
  entradas: Entrada[],
  etapasDoFunil: Array<{ id: number; nome: string }>,
  periodo: Janela,
  mes: Janela,
): EtapaContagem[] {
  return etapasDoFunil.map((e) => {
    const p = new Set<number>();
    const m = new Set<number>();
    for (const x of entradas) {
      if (x.stageId !== e.id) continue;
      if (dentro(x.dia, mes)) m.add(x.dealId);
      if (dentro(x.dia, periodo)) p.add(x.dealId);
    }
    return { etapa: e.nome, periodo: p.size, mes: m.size };
  });
}

export type Contagem = { periodo: number; mes: number };

/** Por dono do negócio: quantos negócios entraram em cada etapa pedida. */
export function porDono<K extends string>(
  entradas: Entrada[],
  negocios: Map<number, InfoNegocio>,
  colunas: Record<K, number[]>,
  periodo: Janela,
  mes: Janela,
): Map<string, Record<K, Contagem>> {
  const sets = new Map<string, Record<K, { p: Set<number>; m: Set<number> }>>();
  const chaves = Object.keys(colunas) as K[];
  for (const x of entradas) {
    const info = negocios.get(x.dealId);
    if (!info) continue;
    for (const k of chaves) {
      if (!colunas[k].includes(x.stageId)) continue;
      let linha = sets.get(info.dono);
      if (!linha) {
        linha = Object.fromEntries(
          chaves.map((c) => [c, { p: new Set<number>(), m: new Set<number>() }]),
        ) as Record<K, { p: Set<number>; m: Set<number> }>;
        sets.set(info.dono, linha);
      }
      if (dentro(x.dia, mes)) linha[k].m.add(x.dealId);
      if (dentro(x.dia, periodo)) linha[k].p.add(x.dealId);
    }
  }
  const out = new Map<string, Record<K, Contagem>>();
  for (const [dono, linha] of sets) {
    out.set(
      dono,
      Object.fromEntries(
        chaves.map((c) => [c, { periodo: linha[c].p.size, mes: linha[c].m.size }]),
      ) as Record<K, Contagem>,
    );
  }
  return out;
}

export interface Fechado {
  dealId: number;
  funil: FunilChave;
  dono: string;
  ganho: boolean;
  motivo: string | null;
  dia: string;
}

export interface ResumoFechados {
  funil: FunilChave;
  ganhos: Contagem;
  perdidos: Contagem;
}

export function resumirFechados(fechados: Fechado[], periodo: Janela): ResumoFechados[] {
  return (Object.keys(FUNIS) as FunilChave[]).map((funil) => {
    const r: ResumoFechados = {
      funil,
      ganhos: { periodo: 0, mes: 0 },
      perdidos: { periodo: 0, mes: 0 },
    };
    for (const f of fechados) {
      if (f.funil !== funil) continue;
      const alvo = f.ganho ? r.ganhos : r.perdidos;
      alvo.mes += 1;
      if (dentro(f.dia, periodo)) alvo.periodo += 1;
    }
    return r;
  });
}

/** Motivos de perda mais comuns no período (todos os funis), do maior para o menor. */
export function principaisMotivos(
  fechados: Fechado[],
  periodo: Janela,
  limite = 5,
): Array<{ motivo: string; total: number }> {
  const c = new Map<string, number>();
  for (const f of fechados) {
    if (f.ganho || !dentro(f.dia, periodo)) continue;
    const m = f.motivo ?? "Sem motivo";
    c.set(m, (c.get(m) ?? 0) + 1);
  }
  return [...c]
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo))
    .slice(0, limite);
}

/** Segundos -> "3min 05s" / "45s". */
export function duracao(segundos: number | null): string {
  if (segundos === null) return "—";
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min ${String(r).padStart(2, "0")}s`;
}
