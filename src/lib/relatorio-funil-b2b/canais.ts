// Atribuição de canal a um card (briefing, seção 5) e normalização de nomes.

import type { Canal } from "./tipos";

/** Nome do card sem " - ROBO", sem acento e em minúsculas — chave de cruzamento com o Backup Leads. */
export function normalizarNome(nome: string): string {
  return nome
    .replace(/\s*-\s*ROBO\s*$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const ORIGENS_FACEBOOK = new Set([739347, 733042, 739353, 739359]);
export const ORIGENS_GOOGLE = new Set([739352, 739350, 733040]);
export const ORIGEM_OUTBOUND = 733048;
/** Origem orgânica reconhecida (não conta como "sem origem"). */
const ORIGENS_ORGANICAS_CONHECIDAS = new Set([739344]);

export interface LinhaBackup {
  /** "YYYY-MM-DD HH:MM:SS" (Brasília) — comparável com created_at do PipeRun. */
  data: string;
  utmSource: string;
  utmCampaign: string;
}

/** Nome normalizado -> linhas do backup (ordem cronológica). */
export type IndiceBackup = Map<string, LinhaBackup[]>;

export interface CardParaCanal {
  titulo: string;
  /** created_at do card ("YYYY-MM-DD HH:MM:SS", Brasília). */
  criadoEm: string;
  originId: number | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}

export interface ResultadoCanal {
  canal: Canal;
  /** Sem backup e sem origin_id/utm reconhecível: caiu em Orgânico por padrão. */
  semOrigem: boolean;
}

export function canalPorUtm(utmSource: string, utmCampaign: string): Canal {
  if (/rapha/i.test(utmCampaign)) return "Rapha Mattos";
  const src = utmSource.trim().toLowerCase();
  if (src === "meta" || src === "facebook") return "Facebook Ads";
  if (src === "adsword" || src === "google") return "Google";
  return "Orgânico";
}

export function canalPorOrigem(originId: number | null): ResultadoCanal {
  if (originId !== null) {
    if (ORIGENS_FACEBOOK.has(originId)) return { canal: "Facebook Ads", semOrigem: false };
    if (ORIGENS_GOOGLE.has(originId)) return { canal: "Google", semOrigem: false };
    if (originId === ORIGEM_OUTBOUND) return { canal: "Outbound", semOrigem: false };
    if (ORIGENS_ORGANICAS_CONHECIDAS.has(originId)) return { canal: "Orgânico", semOrigem: false };
  }
  return { canal: "Orgânico", semOrigem: true };
}

const TOLERANCIA_MS = 10 * 60_000;

function paraMs(dataBr: string): number {
  return Date.parse(`${dataBr.replace(" ", "T")}Z`);
}

/** Linha do backup mais recente com data igual ou anterior à criação do card (com 10 min de
 * tolerância: o card pode ser criado segundos antes da linha ser gravada na planilha). */
export function acharNoBackup(
  indice: IndiceBackup,
  titulo: string,
  criadoEm: string,
): LinhaBackup | null {
  const linhas = indice.get(normalizarNome(titulo));
  if (!linhas) return null;
  const limite = paraMs(criadoEm) + TOLERANCIA_MS;
  let achada: LinhaBackup | null = null;
  for (const l of linhas) {
    if (paraMs(l.data) <= limite) achada = l;
    else break;
  }
  return achada;
}

/** Ordem do briefing: Backup Leads (UTM) -> UTM do card no PipeRun -> origin_id -> Orgânico. */
export function classificarCanal(card: CardParaCanal, backup: IndiceBackup | null): ResultadoCanal {
  if (backup) {
    const linha = acharNoBackup(backup, card.titulo, card.criadoEm);
    if (linha) return { canal: canalPorUtm(linha.utmSource, linha.utmCampaign), semOrigem: false };
  }
  if (card.utmSource || card.utmCampaign) {
    return {
      canal: canalPorUtm(card.utmSource ?? "", card.utmCampaign ?? ""),
      semOrigem: false,
    };
  }
  return canalPorOrigem(card.originId);
}

/** Indexa as linhas do backup por nome normalizado, em ordem cronológica. */
export function indexarBackup(linhas: Array<LinhaBackup & { nome: string }>): IndiceBackup {
  const indice: IndiceBackup = new Map();
  for (const { nome, ...linha } of linhas) {
    const chave = normalizarNome(nome);
    if (!chave) continue;
    const lista = indice.get(chave);
    if (lista) lista.push(linha);
    else indice.set(chave, [linha]);
  }
  for (const lista of indice.values()) lista.sort((a, b) => a.data.localeCompare(b.data));
  return indice;
}
