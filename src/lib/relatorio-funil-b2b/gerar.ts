// Orquestra a geração: coleta -> cálculo -> HTML. Falha de fonte não inventa número:
// bloco indisponível + aviso; falha do PipeRun vira resultado { ok: false }.

import type { IndiceBackup } from "./canais";
import { coletarEventosPipeRun, coletarGasto, lerBackupLeads } from "./coleta";
import { agruparGastoPorDia, type GastoDia } from "./gasto";
import { calcPeriodo, formatarDataBR, horaSaoPaulo, type Periodo } from "./periodo";
import { montarRelatorio, type Relatorio } from "./relatorio";
import { renderizarHtml } from "./template";

export type ResultadoGeracao =
  | { ok: true; periodo: Periodo; relatorio: Relatorio; html: string }
  | { ok: false; periodo: Periodo; motivo: string };

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function gerarRelatorio(
  runDate: string,
  agora: Date = new Date(),
): Promise<ResultadoGeracao | null> {
  const periodo = calcPeriodo(runDate);
  if (!periodo) return null; // domingo: não roda

  // Backup Leads e gasto são independentes do PipeRun; falha deles vira aviso.
  const [backupR, gastoR] = await Promise.allSettled([lerBackupLeads(), coletarGasto(periodo)]);
  let backup: IndiceBackup | null = null;
  if (backupR.status === "fulfilled") backup = backupR.value;
  else console.warn(`Backup Leads indisponível: ${mensagemErro(backupR.reason)}`);

  let gasto: Map<string, GastoDia> | null = null;
  if (gastoR.status === "fulfilled") gasto = agruparGastoPorDia(gastoR.value);
  else console.warn(`Gasto indisponível: ${mensagemErro(gastoR.reason)}`);

  let resultado;
  try {
    resultado = await coletarEventosPipeRun(periodo, backup);
  } catch (e) {
    return { ok: false, periodo, motivo: mensagemErro(e) };
  }

  const relatorio = montarRelatorio({
    periodo,
    eventos: resultado.eventos,
    excluidos: resultado.excluidos,
    gasto,
    backupDisponivel: backup !== null,
  });
  const html = renderizarHtml(relatorio, horaSaoPaulo(agora));
  return { ok: true, periodo, relatorio, html };
}

export function tituloSlack(periodo: Periodo): string {
  return `Funil B2B Expansão — ${formatarDataBR(periodo.to)}`;
}

export const MENCAO_DIEGO = "<@U097RGWMR7F>";

export function comentarioSlack(periodo: Periodo): string {
  return `${MENCAO_DIEGO} ${tituloSlack(periodo)}`;
}

export function mensagemFalha(periodo: Periodo, motivo: string): string {
  const quando = periodo.fimDeSemana
    ? `${formatarDataBR(periodo.from).slice(0, 5)} a ${formatarDataBR(periodo.to).slice(0, 5)}`
    : formatarDataBR(periodo.to).slice(0, 5);
  return `O relatório do funil B2B Expansão de ${quando} não foi gerado: falha ao consultar o PipeRun (${motivo.slice(0, 200)}).`;
}
