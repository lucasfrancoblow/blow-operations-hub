import { describe, expect, test } from "bun:test";
import { calcPeriodo, tituloPeriodo } from "./periodo";
import { calcCusto, calcTaxa, tomTaxa, tomVariacao, variacaoPct } from "./variacao";
import { agruparGastoPorDia, classificarGasto, investimentoGeral, somarGasto } from "./gasto";
import {
  canalPorOrigem,
  canalPorUtm,
  classificarCanal,
  indexarBackup,
  normalizarNome,
} from "./canais";
import { construirEventos, ehCardDeTeste, type LinhaHistorico } from "./eventos";
import { contarGeral, montarRelatorio } from "./relatorio";
import { CANAIS_GERAL, type EventoFunil } from "./tipos";

describe("periodo", () => {
  test("dia comum: ontem", () => {
    const p = calcPeriodo("2026-11-21")!; // sábado
    expect(p.from).toBe("2026-11-20");
    expect(p.to).toBe("2026-11-20");
    expect(p.media7From).toBe("2026-11-13");
    expect(p.media7To).toBe("2026-11-19");
    expect(p.mesFrom).toBe("2026-11-01");
  });
  test("segunda: sábado + domingo", () => {
    const p = calcPeriodo("2026-11-23")!;
    expect(p.dias).toEqual(["2026-11-21", "2026-11-22"]);
    expect(p.fimDeSemana).toBe(true);
    expect(p.media7To).toBe("2026-11-20");
    expect(tituloPeriodo(p)).toBe("Sáb + Dom — 21/11 a 22/11");
  });
  test("domingo não roda", () => {
    expect(calcPeriodo("2026-11-22")).toBeNull();
  });
});

describe("variacao e cores", () => {
  test("variação", () => {
    expect(variacaoPct(12, 10)).toBeCloseTo(0.2);
    expect(variacaoPct(0, 0.3)).toBe(-1);
    expect(variacaoPct(1, 0)).toBeNull();
    expect(variacaoPct(null, 3)).toBeNull();
  });
  test("custo menor é verde", () => {
    expect(tomVariacao(-0.1, "custo")).toBe("bom");
    expect(tomVariacao(0.1, "custo")).toBe("ruim");
    expect(tomVariacao(0.1, "volume")).toBe("bom");
    expect(tomVariacao(0.1, "neutro")).toBe("neutro");
  });
  test("denominador < 5 fica cinza; sem denominador é sem dado", () => {
    expect(tomTaxa(calcTaxa(2, 4), 0.25)).toBe("cinza");
    expect(tomTaxa(calcTaxa(2, 5), 0.25)).toBe("verde");
    expect(tomTaxa(calcTaxa(1, 8), 0.25)).toBe("laranja");
    expect(calcTaxa(0, 0).valor).toBeNull();
  });
  test("custo sem volume ou sem investimento é null", () => {
    expect(calcCusto(100, 0)).toBeNull();
    expect(calcCusto(null, 4)).toBeNull();
    expect(calcCusto(100, 4)).toBe(25);
  });
});

describe("gasto", () => {
  test("atribuição RAPHA / LIVE / WEBINAR", () => {
    expect(
      classificarGasto({ canal: "meta", campanha: "BLOW-MO-LEA-ABO-META-LP-RAPHA-MATTOS-VIDEOS" }),
    ).toBe("rapha");
    expect(
      classificarGasto({ canal: "meta", campanha: "BLOW-MO-LEA-ABO-META-LIVE-WEBINAR-23-11" }),
    ).toBe("excluido");
    expect(
      classificarGasto({ canal: "meta", campanha: "BLOW-MO-LEA-ABO-META-LP-WEBINAR-BLACK" }),
    ).toBe("excluido");
    expect(
      classificarGasto({ canal: "google", campanha: "BLOW-MO-LEA-GOO-LP-GERACAO-DEMANDA-MIX" }),
    ).toBe("google");
    expect(
      classificarGasto({ canal: "meta", campanha: "BLOW-MO-LEA-ABO-META-FORM-LAL-VIDEOS" }),
    ).toBe("facebook");
  });
  test("soma por janela, FORM vs LP e dados faltando", () => {
    const m = agruparGastoPorDia([
      { data_referencia: "2026-11-20", canal: "meta", campanha: "X-META-FORM-A", valor_usado: 10 },
      { data_referencia: "2026-11-20", canal: "meta", campanha: "X-META-LP-A", valor_usado: 5 },
      { data_referencia: "2026-11-20", canal: "meta", campanha: "X-META-LP-RAPHA", valor_usado: 2 },
      { data_referencia: "2026-11-20", canal: "meta", campanha: "X-META-LIVE", valor_usado: 7 },
      { data_referencia: "2026-11-20", canal: "google", campanha: "G-LP", valor_usado: 3 },
    ]);
    const g = somarGasto(m, ["2026-11-20"], true);
    expect(g).toMatchObject({
      facebook: 15,
      google: 3,
      rapha: 2,
      excluido: 7,
      metaForm: 10,
      metaLp: 7,
    });
    expect(investimentoGeral(g)).toBe(20);
    const faltando = somarGasto(m, ["2026-11-20", "2026-11-21"], true);
    expect(faltando.facebook).toBeNull();
    expect(investimentoGeral(faltando)).toBeNull();
  });
});

describe("canais", () => {
  test("normalizar nome", () => {
    expect(normalizarNome("José  Ávila - ROBO")).toBe("jose avila");
  });
  test("utm", () => {
    expect(canalPorUtm("meta", "")).toBe("Facebook Ads");
    expect(canalPorUtm("adsword", "x")).toBe("Google");
    expect(canalPorUtm("meta", "LP-RAPHA")).toBe("Rapha Mattos");
    expect(canalPorUtm("portaldofranchising", "x")).toBe("Orgânico");
  });
  test("origin_id e sem origem", () => {
    expect(canalPorOrigem(739347).canal).toBe("Facebook Ads");
    expect(canalPorOrigem(733040).canal).toBe("Google");
    expect(canalPorOrigem(733048).canal).toBe("Outbound");
    expect(canalPorOrigem(null)).toEqual({ canal: "Orgânico", semOrigem: true });
  });
  test("backup só vale com data <= criação do card", () => {
    const idx = indexarBackup([
      { nome: "Maria Exemplo", data: "2026-11-20 10:00:00", utmSource: "meta", utmCampaign: "" },
    ]);
    const base = { titulo: "Maria Exemplo - ROBO", originId: 733040 };
    expect(classificarCanal({ ...base, criadoEm: "2026-11-20 10:00:30" }, idx).canal).toBe(
      "Facebook Ads",
    );
    expect(classificarCanal({ ...base, criadoEm: "2026-11-19 10:00:00" }, idx).canal).toBe(
      "Google",
    );
  });
});

const hist = (
  dealId: number,
  inStageId: number,
  inDate: string,
  outStageId: number | null = null,
  outDate: string | null = null,
): LinhaHistorico => ({ dealId, inStageId, outStageId, inDate, outDate });

describe("eventos", () => {
  const resolver = (id: number) =>
    id === 99
      ? ({ excluir: "teste" } as const)
      : { canal: "Facebook Ads" as const, semOrigem: false };
  test("teste", () => {
    expect(ehCardDeTeste("Lead Teste")).toBe(true);
    expect(ehCardDeTeste("BL Company")).toBe(true);
    expect(ehCardDeTeste("Maria Exemplo")).toBe(false);
  });
  test("bounce < 2 min volta para Reunião Realizada é ignorado", () => {
    const r = construirEventos(
      [
        hist(1, 628988, "2026-11-20 09:00:00", 646802, "2026-11-20 09:30:00"),
        hist(1, 646802, "2026-11-20 09:30:00", 628988, "2026-11-20 09:31:00"),
        hist(1, 628988, "2026-11-20 09:31:00"),
      ],
      resolver,
    );
    expect(r.eventos.map((e) => e.metrica)).toEqual(["realizada"]);
    expect(r.excluidos).toEqual([{ day: "2026-11-20", motivo: "bounce" }]);
  });
  test("conta uma vez por etapa/dia e exclui teste", () => {
    const r = construirEventos(
      [
        hist(1, 624603, "2026-11-20 09:00:00"),
        hist(1, 624603, "2026-11-20 15:00:00"),
        hist(99, 624603, "2026-11-20 10:00:00"),
      ],
      resolver,
    );
    expect(r.eventos).toHaveLength(1);
    expect(r.excluidos).toEqual([{ day: "2026-11-20", motivo: "teste" }]);
  });
});

describe("relatório", () => {
  const ev = (
    canal: EventoFunil["canal"],
    day: string,
    metrica: EventoFunil["metrica"] = "leads",
  ): EventoFunil => ({ dealId: Math.random(), stageId: 0, metrica, day, canal, semOrigem: false });
  const eventos = [
    ev("Facebook Ads", "2026-11-20"),
    ev("Google", "2026-11-20"),
    ev("Orgânico", "2026-11-20", "sql"),
    ev("Rapha Mattos", "2026-11-20"),
    ev("Outbound", "2026-11-20"),
    ev("Facebook Ads", "2026-11-15"),
  ];
  test("Geral = soma dos 4 canais (sem Outbound) em todas as colunas", () => {
    const rel = montarRelatorio({
      periodo: calcPeriodo("2026-11-21")!,
      eventos,
      excluidos: [],
      gasto: null,
      backupDisponivel: true,
    });
    const geral = rel.canais.find((c) => c.canal === "Geral")!;
    for (const m of Object.keys(geral.contagens) as Array<keyof typeof geral.contagens>) {
      const soma = rel.canais
        .filter((c) => (CANAIS_GERAL as readonly string[]).includes(c.canal))
        .reduce((a, c) => a + c.contagens[m], 0);
      expect(geral.contagens[m]).toBe(soma);
    }
    expect(geral.contagens.leads).toBe(3);
    expect(rel.funil.find((l) => l.rotulo === "Leads")!.ontem).toBe(3);
    expect(contarGeral(eventos, new Set(["2026-11-20"])).leads).toBe(3);
  });
  test("sem fonte de gasto: investimento e custos sem dado, nunca 0", () => {
    const rel = montarRelatorio({
      periodo: calcPeriodo("2026-11-21")!,
      eventos,
      excluidos: [],
      gasto: null,
      backupDisponivel: true,
    });
    expect(rel.funil[0]!.ontem).toBeNull();
    expect(rel.custos[0]!.ontem).toBeNull();
    expect(rel.avisos.some((a) => a.includes("Investimento indisponível"))).toBe(true);
  });
});
