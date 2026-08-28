// Métricas diárias de SDR/Closer do time de Expansão, lidas ao vivo da planilha "Daily
// Expansão" no Google Drive — ela é preenchida manualmente pelo time, não existe API.
//
// Layout fixo na aba "Preenchimento Diário" (conferido em 2026-08-27): cada bloco de
// pessoa ocupa um range fixo de colunas a partir do cabeçalho da linha 3 — A=Data,
// E..N=Allana, O..X=Júlia, Y..AJ=Andrey. Se o time inserir/reordenar colunas na
// planilha, o mapeamento abaixo (COLS) quebra silenciosamente e precisa ser atualizado.

import * as XLSX from "xlsx";

import {
  downloadDriveFile,
  getDriveFileModifiedTime,
  isGoogleDriveConfigured,
} from "@/lib/google-drive-client";
import { defaultDateRange, type DateRange } from "@/lib/leads-recentes";

const SHEET_NAME = "Preenchimento Diário";
// Linha 1-based onde os dados começam (linhas 1-3 são cabeçalho/grupo de colunas).
const DATA_START_ROW = 4;

function getFileId(): string | null {
  return process.env["GOOGLE_DAILY_EXPANSAO_FILE_ID"] || null;
}

export function isDailyExpansaoConfigured(): boolean {
  return isGoogleDriveConfigured() && getFileId() !== null;
}

/** Converte valores tipo "94+17WHATS" ou "4,35MIN" no número que interessa (o primeiro
 * número reconhecível na string) — o time digita anotações junto do valor na correria
 * da daily, então tratar a célula como texto puro faria a métrica sumir do gráfico. */
function parseFlexibleNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function rowDateString(row: unknown[]): string | null {
  const raw = row[0];
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

export interface SdrDayMetrics {
  date: string;
  leadsNovos: number | null;
  leadsTrabalhados: number | null;
  tentativas: number | null;
  tempoMedioLigacaoMin: number | null;
  contatosEfetivos: number | null;
  sqls: number | null;
  reunioesAgendadas: number | null;
  leadsQuentes: number | null;
  bloqueio: string | null;
  compromissoDoDia: string | null;
}

export interface CloserDayMetrics {
  date: string;
  reunioesPrevistas: number | null;
  reunioesRealizadas: number | null;
  noShows: number | null;
  oportunidadesGeradas: number | null;
  rogaRealizado: number | null;
  followUpsPrevistos: number | null;
  followUpsRealizados: number | null;
  vendas: number | null;
  forecastSemana: number | null;
  oportunidadesPrioritarias: number | null;
  bloqueio: string | null;
  compromissoDoDia: string | null;
}

interface SdrColumnMap {
  leadsNovos: number;
  leadsTrabalhados: number;
  tentativas: number;
  tempoMedio: number;
  contatosEfetivos: number;
  sqls: number;
  reunioesAgendadas: number;
  leadsQuentes: number;
  bloqueio: number;
  compromisso: number;
}

// Índices 0-based das colunas na aba (A=0). Ver comentário no topo do arquivo.
const SDR_COLS: { allana: SdrColumnMap; julia: SdrColumnMap } = {
  allana: {
    leadsNovos: 4,
    leadsTrabalhados: 5,
    tentativas: 6,
    tempoMedio: 7,
    contatosEfetivos: 8,
    sqls: 9,
    reunioesAgendadas: 10,
    leadsQuentes: 11,
    bloqueio: 12,
    compromisso: 13,
  },
  julia: {
    leadsNovos: 14,
    leadsTrabalhados: 15,
    tentativas: 16,
    tempoMedio: 17,
    contatosEfetivos: 18,
    sqls: 19,
    reunioesAgendadas: 20,
    leadsQuentes: 21,
    bloqueio: 22,
    compromisso: 23,
  },
} as const;

const CLOSER_COLS = {
  reunioesPrevistas: 24,
  reunioesRealizadas: 25,
  noShows: 26,
  oportunidadesGeradas: 27,
  rogaRealizado: 28,
  followUpsPrevistos: 29,
  followUpsRealizados: 30,
  vendas: 31,
  forecastSemana: 32,
  oportunidadesPrioritarias: 33,
  bloqueio: 34,
  compromisso: 35,
} as const;

function toSdrDayMetrics(row: unknown[], cols: SdrColumnMap, date: string): SdrDayMetrics {
  return {
    date,
    leadsNovos: parseFlexibleNumber(row[cols.leadsNovos]),
    leadsTrabalhados: parseFlexibleNumber(row[cols.leadsTrabalhados]),
    tentativas: parseFlexibleNumber(row[cols.tentativas]),
    tempoMedioLigacaoMin: parseFlexibleNumber(row[cols.tempoMedio]),
    contatosEfetivos: parseFlexibleNumber(row[cols.contatosEfetivos]),
    sqls: parseFlexibleNumber(row[cols.sqls]),
    reunioesAgendadas: parseFlexibleNumber(row[cols.reunioesAgendadas]),
    leadsQuentes: parseFlexibleNumber(row[cols.leadsQuentes]),
    bloqueio: parseText(row[cols.bloqueio]),
    compromissoDoDia: parseText(row[cols.compromisso]),
  };
}

function toCloserDayMetrics(row: unknown[], date: string): CloserDayMetrics {
  const c = CLOSER_COLS;
  return {
    date,
    reunioesPrevistas: parseFlexibleNumber(row[c.reunioesPrevistas]),
    reunioesRealizadas: parseFlexibleNumber(row[c.reunioesRealizadas]),
    noShows: parseFlexibleNumber(row[c.noShows]),
    oportunidadesGeradas: parseFlexibleNumber(row[c.oportunidadesGeradas]),
    rogaRealizado: parseFlexibleNumber(row[c.rogaRealizado]),
    followUpsPrevistos: parseFlexibleNumber(row[c.followUpsPrevistos]),
    followUpsRealizados: parseFlexibleNumber(row[c.followUpsRealizados]),
    vendas: parseFlexibleNumber(row[c.vendas]),
    forecastSemana: parseFlexibleNumber(row[c.forecastSemana]),
    oportunidadesPrioritarias: parseFlexibleNumber(row[c.oportunidadesPrioritarias]),
    bloqueio: parseText(row[c.bloqueio]),
    compromissoDoDia: parseText(row[c.compromisso]),
  };
}

export interface DailyExpansaoData {
  updatedAt: string | null;
  allana: SdrDayMetrics[];
  julia: SdrDayMetrics[];
  andrey: CloserDayMetrics[];
}

export async function loadDailyExpansaoData(
  range: DateRange = defaultDateRange(),
): Promise<DailyExpansaoData | null> {
  const fileId = getFileId();
  if (!isGoogleDriveConfigured() || !fileId) return null;

  const [buffer, updatedAt] = await Promise.all([
    downloadDriveFile(fileId),
    getDriveFileModifiedTime(fileId),
  ]);

  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Aba "${SHEET_NAME}" não encontrada na planilha "Daily Expansão".`);
  }

  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const dataRows = allRows.slice(DATA_START_ROW - 1);

  const allana: SdrDayMetrics[] = [];
  const julia: SdrDayMetrics[] = [];
  const andrey: CloserDayMetrics[] = [];

  for (const row of dataRows) {
    const date = rowDateString(row);
    if (!date || date < range.from || date > range.to) continue;
    allana.push(toSdrDayMetrics(row, SDR_COLS.allana, date));
    julia.push(toSdrDayMetrics(row, SDR_COLS.julia, date));
    andrey.push(toCloserDayMetrics(row, date));
  }

  return { updatedAt, allana, julia, andrey };
}
