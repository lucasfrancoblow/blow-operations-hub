import { describe, expect, test } from "bun:test";
import { diasSemLigacao, duracao, porDono, resumirLigacoes, type InfoNegocio } from "./calculo";

const linha = (dia: string, agente: number, status: number, n: number, seg: number) => ({
  call_date: dia,
  agent_id: agente,
  agent_name: `A${agente}`,
  campaign_id: 1,
  campaign_name: "c",
  status_id: status,
  status_text: "-",
  total_calls: n,
  total_calling_seconds: 0,
  total_speaking_seconds: seg,
  recorded_count: 0,
});

describe("relatório comercial", () => {
  test("ligações: ignora discador (agente 0) e média só sobre atendidas", () => {
    const r = resumirLigacoes(
      [
        linha("2026-11-25", 1, 7, 4, 400),
        linha("2026-11-25", 1, 5, 6, 0),
        linha("2026-11-25", 0, 7, 99, 9),
      ],
      { from: "2026-11-25", to: "2026-11-25" },
    );
    expect(r).toEqual([
      { agente: "A1", ligacoes: 10, conversas: 4, segundosFalados: 400, mediaSegundos: 100 },
    ]);
  });
  test("login renomeado: separa por nome", () => {
    const r = resumirLigacoes(
      [
        { ...linha("2026-11-10", 5, 7, 3, 30), agent_name: "Julia" },
        { ...linha("2026-11-25", 5, 7, 2, 20), agent_name: "Alana" },
      ],
      { from: "2026-11-01", to: "2026-11-25" },
    );
    expect(r.map((a) => [a.agente, a.ligacoes])).toEqual([
      ["Julia", 3],
      ["Alana", 2],
    ]);
  });
  test("dias sem sync aparecem", () => {
    expect(diasSemLigacao([linha("2026-11-22", 1, 7, 1, 1)], ["2026-11-22", "2026-11-23"])).toEqual(
      ["2026-11-23"],
    );
  });
  test("por dono conta negócio único no período e no mês", () => {
    const neg = new Map<number, InfoNegocio>([[1, { funil: "closer", dono: "Andrey" }]]);
    const m = porDono(
      [
        { dealId: 1, stageId: 9, dia: "2026-11-25" },
        { dealId: 1, stageId: 9, dia: "2026-11-02" },
      ],
      neg,
      { realizada: [9] },
      { from: "2026-11-25", to: "2026-11-25" },
      { from: "2026-11-01", to: "2026-11-25" },
    );
    expect(m.get("Andrey")).toEqual({ realizada: { periodo: 1, mes: 1 } });
  });
  test("duração", () => {
    expect(duracao(45)).toBe("45s");
    expect(duracao(185)).toBe("3min 05s");
    expect(duracao(null)).toBe("—");
  });
});
