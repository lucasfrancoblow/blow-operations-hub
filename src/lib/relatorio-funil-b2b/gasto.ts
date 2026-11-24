// Atribuição do gasto de anúncios (tabela ad_metrics_daily) aos canais do relatório.
//  - nome com LIVE ou WEBINAR: fora de todos os canais (aparece só no aviso);
//  - nome com RAPHA: canal Rapha Mattos (sai de Facebook Ads/Google);
//  - o restante: Facebook Ads (meta) ou Google (google).
// Outbound e Orgânico valem 0.

export interface LinhaAd {
  data_referencia: string;
  canal: "meta" | "google";
  campanha: string | null;
  valor_usado: number;
}

export type TipoGasto = "facebook" | "google" | "rapha" | "excluido";

function tokens(nome: string): string[] {
  return nome
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

export function classificarGasto(linha: Pick<LinhaAd, "canal" | "campanha">): TipoGasto {
  const t = tokens(linha.campanha ?? "");
  if (t.includes("LIVE") || t.includes("WEBINAR")) return "excluido";
  if (t.includes("RAPHA")) return "rapha";
  return linha.canal === "google" ? "google" : "facebook";
}

/** Meta: "FORM" (lead nativo) ou "LP" (landing page). */
export function origemMeta(campanha: string | null): "form" | "lp" | "outro" {
  const t = tokens(campanha ?? "");
  if (t.some((x) => x.startsWith("FORM"))) return "form";
  if (t.includes("LP")) return "lp";
  return "outro";
}

export interface GastoDia {
  facebook: number;
  google: number;
  rapha: number;
  excluido: number;
  /** Gasto Meta que entrou nos canais (Facebook + Rapha), separado por tipo de captação. */
  metaForm: number;
  metaLp: number;
  metaOutro: number;
  /** Houve alguma linha da fonte neste dia (zero só vale quando a fonte confirma). */
  temMeta: boolean;
  temGoogle: boolean;
}

export function gastoVazio(): GastoDia {
  return {
    facebook: 0,
    google: 0,
    rapha: 0,
    excluido: 0,
    metaForm: 0,
    metaLp: 0,
    metaOutro: 0,
    temMeta: false,
    temGoogle: false,
  };
}

/** Agrupa as linhas por dia. */
export function agruparGastoPorDia(linhas: LinhaAd[]): Map<string, GastoDia> {
  const porDia = new Map<string, GastoDia>();
  for (const l of linhas) {
    const g = porDia.get(l.data_referencia) ?? gastoVazio();
    porDia.set(l.data_referencia, g);
    const valor = Number(l.valor_usado) || 0;
    if (l.canal === "meta") g.temMeta = true;
    else g.temGoogle = true;
    const tipo = classificarGasto(l);
    g[tipo] += valor;
    if (l.canal === "meta" && tipo !== "excluido") {
      const o = origemMeta(l.campanha);
      if (o === "form") g.metaForm += valor;
      else if (o === "lp") g.metaLp += valor;
      else g.metaOutro += valor;
    }
  }
  return porDia;
}

export interface GastoJanela {
  facebook: number | null;
  google: number | null;
  rapha: number | null;
  excluido: number | null;
  metaForm: number;
  metaLp: number;
  metaOutro: number;
  /** Dias da janela sem dado de alguma fonte. */
  diasSemMeta: string[];
  diasSemGoogle: string[];
}

/**
 * Soma o gasto numa janela de dias. `estrito` (período do relatório): se faltar dado de uma
 * fonte em qualquer dia, o valor dela é null ("—") em vez de um total parcial. Fora do modo
 * estrito (média 7 dias e mês) somam-se os dias disponíveis; só é null quando nenhum dia tem dado.
 * Rapha depende das duas fontes (campanhas Rapha existem no Meta e no Google).
 */
export function somarGasto(
  porDia: Map<string, GastoDia>,
  dias: string[],
  estrito: boolean,
): GastoJanela {
  const diasSemMeta = dias.filter((d) => !porDia.get(d)?.temMeta);
  const diasSemGoogle = dias.filter((d) => !porDia.get(d)?.temGoogle);
  const metaOk = estrito ? diasSemMeta.length === 0 : diasSemMeta.length < dias.length;
  const googleOk = estrito ? diasSemGoogle.length === 0 : diasSemGoogle.length < dias.length;
  const soma = (campo: keyof GastoDia) =>
    dias.reduce((acc, d) => acc + ((porDia.get(d)?.[campo] as number | undefined) ?? 0), 0);
  return {
    facebook: metaOk ? soma("facebook") : null,
    google: googleOk ? soma("google") : null,
    rapha: metaOk && googleOk ? soma("rapha") : null,
    excluido: metaOk && googleOk ? soma("excluido") : null,
    metaForm: soma("metaForm"),
    metaLp: soma("metaLp"),
    metaOutro: soma("metaOutro"),
    diasSemMeta,
    diasSemGoogle,
  };
}

/** Investimento do Geral = Facebook + Google + Rapha (Orgânico = 0). null se algum for desconhecido. */
export function investimentoGeral(g: GastoJanela): number | null {
  if (g.facebook === null || g.google === null || g.rapha === null) return null;
  return g.facebook + g.google + g.rapha;
}
