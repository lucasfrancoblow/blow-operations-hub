// Montagem dos eventos do funil a partir do histórico de etapas do PipeRun
// (/stageHistories): filtra as etapas do briefing, aplica as exclusões da seção 8
// (cards de teste, bounces) e conta cada card uma vez por etapa por dia.

import { ETAPAS, ETAPA_REUNIAO_REALIZADA, type Canal, type EventoFunil, type Funil } from "./tipos";

export interface LinhaHistorico {
  dealId: number;
  inStageId: number;
  outStageId: number | null;
  /** "YYYY-MM-DD HH:MM:SS", horário de Brasília. */
  inDate: string;
  outDate: string | null;
}

const BOUNCE_MS = 2 * 60_000;

function ms(data: string): number {
  return Date.parse(`${data.replace(" ", "T")}Z`);
}

/** Cards de teste: "teste"/"test", "Alana", "BL Company", "Leadnativo" e similares da agência. */
export function ehCardDeTeste(titulo: string): boolean {
  const t = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return (
    /\b(teste|test)\b/.test(t) ||
    /\balana\b/.test(t) ||
    /bl company/.test(t) ||
    /leadnativo/.test(t)
  );
}

/**
 * Bounce: o card entra numa etapa e volta para Reunião Realizada em menos de 2 minutos
 * (movimentação errada). Ignora a entrada na etapa errada E a entrada de retorno em
 * Reunião Realizada que o desfez.
 */
export function removerBounces(linhas: LinhaHistorico[]): {
  mantidas: LinhaHistorico[];
  bounces: LinhaHistorico[];
} {
  const ignoradas = new Set<LinhaHistorico>();
  const bounces: LinhaHistorico[] = [];
  for (const l of linhas) {
    if (
      l.inStageId === ETAPA_REUNIAO_REALIZADA ||
      l.outStageId !== ETAPA_REUNIAO_REALIZADA ||
      !l.outDate
    ) {
      continue;
    }
    if (ms(l.outDate) - ms(l.inDate) >= BOUNCE_MS) continue;
    ignoradas.add(l);
    bounces.push(l);
    const retorno = linhas.find(
      (r) =>
        r.dealId === l.dealId && r.inStageId === ETAPA_REUNIAO_REALIZADA && r.inDate === l.outDate,
    );
    if (retorno) ignoradas.add(retorno);
  }
  return { mantidas: linhas.filter((l) => !ignoradas.has(l)), bounces };
}

export type MotivoExclusao = "teste" | "bounce" | "lixeira";

export type ResolucaoCard =
  { canal: Canal; semOrigem: boolean } | { excluir: Exclude<MotivoExclusao, "bounce"> };

export interface ResultadoEventos {
  eventos: EventoFunil[];
  excluidos: Array<{ day: string; motivo: MotivoExclusao }>;
}

/**
 * Card na lixeira do PipeRun: o histórico de etapas continua lá, mas o card não existe mais
 * no funil. Ex.: em 09/11/2026 uma cópia de card foi criada direto em Venda e apagada 1 min
 * depois, e o relatório contou uma venda que não houve. A busca de deals por id não devolve
 * card excluído (`deal` undefined); se algum vier marcado como excluído, também sai.
 */
export function cardNaLixeira(deal: object | undefined): boolean {
  if (!deal) return true;
  const d = deal as { deleted?: unknown; deleted_at?: unknown };
  return Boolean(d.deleted_at) || d.deleted === true || Number(d.deleted) === 1;
}

/**
 * `resolver` devolve o canal do card (ou pede a exclusão). Cada card conta uma vez por
 * etapa por dia: reentradas no mesmo dia não duplicam.
 */
export function construirEventos(
  linhas: LinhaHistorico[],
  resolver: (dealId: number, funil: Funil) => ResolucaoCard,
): ResultadoEventos {
  const { mantidas, bounces } = removerBounces(linhas.filter((l) => ETAPAS[l.inStageId]));
  const excluidos: ResultadoEventos["excluidos"] = bounces
    .filter((b) => ETAPAS[b.inStageId])
    .map((b) => ({ day: b.inDate.slice(0, 10), motivo: "bounce" as const }));

  const vistos = new Set<string>();
  const eventos: EventoFunil[] = [];
  for (const l of mantidas) {
    const etapa = ETAPAS[l.inStageId];
    if (!etapa) continue;
    const day = l.inDate.slice(0, 10);
    const chave = `${l.dealId}:${l.inStageId}:${day}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const r = resolver(l.dealId, etapa.funil);
    if ("excluir" in r) {
      excluidos.push({ day, motivo: r.excluir });
      continue;
    }
    eventos.push({
      dealId: l.dealId,
      stageId: l.inStageId,
      metrica: etapa.metrica,
      day,
      canal: r.canal,
      semOrigem: r.semOrigem,
    });
  }
  return { eventos, excluidos };
}
