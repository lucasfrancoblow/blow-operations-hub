// Template HTML do relatório (renderizado em PDF pelo Chromium). Layout do modelo
// aprovado: cabeçalho verde escuro, destaques laranja, cards, tabelas zebradas e
// "badges" de variação.

import { benchmark, moeda, numero, SEM_DADO, taxa, variacao } from "./formato";
import { formatarDiaMes, nomeDoDia, tituloPeriodo } from "./periodo";
import type { Relatorio } from "./relatorio";
import type { Tom, TomTaxa } from "./variacao";

export function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CLASSE_TOM: Record<Tom, string> = { bom: "b-verde", ruim: "b-laranja", neutro: "b-cinza" };
const CLASSE_TAXA: Record<TomTaxa, string> = {
  verde: "b-verde",
  laranja: "b-laranja",
  cinza: "b-cinza",
};

function valorFunil(tipo: "moeda" | "inteiro", v: number | null): string {
  return tipo === "moeda" ? moeda(v) : numero(v);
}

const CSS = `
:root{--verde:#21473a;--laranja:#e5401a;--zebra:#f1f0e9;--cinza:#b5b5a9;--texto:#26302b;--suave:#7a8079;--caixa:#f3efe2}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:Inter,"Helvetica Neue",Arial,"Liberation Sans",sans-serif;color:var(--texto);width:794px;padding:22px 26px 18px;font-size:11px;line-height:1.3}
.topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.marca{font-weight:800;font-size:20px;letter-spacing:.5px;color:var(--verde)}
.marca b{color:var(--laranja)}
.marca span{font-weight:400;font-size:11px;color:var(--suave);margin-left:8px;letter-spacing:0}
.cab{background:var(--verde);color:#fff;border-radius:3px;padding:16px 22px 14px;margin-bottom:12px}
.cab .kicker{font-size:8.5px;letter-spacing:2.4px;font-weight:600;opacity:.8;text-transform:uppercase}
.cab h1{font-size:26px;font-weight:700;margin:6px 0 5px}
.cab p{font-size:10px;opacity:.85}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:16px}
.card{background:var(--zebra);border-top:3px solid var(--verde);padding:9px 11px 8px;border-radius:2px}
.card.laranja{border-top-color:var(--laranja)}
.card .r{font-size:10px;color:var(--suave)}
.card .v{font-size:23px;font-weight:700;margin:2px 0 1px}
.card .d{font-size:9px;color:var(--suave)}
.card .d b{font-weight:700}
.t-bom{color:#21473a}.t-ruim{color:#e5401a}
h2{font-size:17px;font-weight:700;color:var(--verde);display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--laranja);padding-bottom:4px;margin:0 0 7px}
h2 small{font-size:9px;font-weight:400;color:var(--suave)}
section{margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th{background:var(--verde);color:#fff;font-size:9.5px;font-weight:600;text-align:right;padding:6px 9px;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
td{font-size:10.5px;text-align:right;padding:5.5px 9px;white-space:nowrap}
tbody tr:nth-child(odd){background:var(--zebra)}
td:first-child{font-weight:600}
tr.geral td{font-weight:700}
.b{display:inline-block;min-width:58px;text-align:center;border-radius:2px;padding:2px 8px;font-size:9.5px;font-weight:700;color:#fff}
.b-verde{background:var(--verde)}.b-laranja{background:var(--laranja)}.b-cinza{background:var(--cinza)}
.dois th,.dois td{padding-left:6px;padding-right:6px}
.dois{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.18fr);gap:12px;align-items:start}
.canais th,.canais td{padding:5.5px 5px;font-size:9.5px}
.canais th:first-child,.canais td:first-child{padding-left:9px}
.nota{font-size:8.5px;color:var(--suave);margin-top:5px}
.caixas{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.caixa{background:var(--caixa);border-left:4px solid var(--laranja);padding:11px 14px}
.caixa h3{font-size:10.5px;margin-bottom:6px}
.caixa ul{padding-left:15px}
.caixa li{font-size:10px;margin-bottom:3px}
.rodape{display:flex;justify-content:space-between;font-size:8.5px;color:var(--suave);margin-top:9px}
`;

function cartao(c: Relatorio["cartoes"][number], laranja: boolean): string {
  const media =
    c.media7 === null ? SEM_DADO : c.tipoValor === "moeda" ? moeda(c.media7) : numero(c.media7);
  const detalhe =
    c.variacao === null
      ? `<b>${SEM_DADO}</b> média 7 dias: ${media}`
      : `<b class="t-${c.tom}">${variacao(c.variacao)}</b> vs média 7 dias`;
  return `<div class="card${laranja ? " laranja" : ""}"><div class="r">${esc(c.rotulo)}</div><div class="v">${valorFunil(c.tipoValor, c.valor)}</div><div class="d">${detalhe}</div></div>`;
}

function badgeVariacao(pct: number | null, tom: Tom): string {
  return `<span class="b ${pct === null ? "b-cinza" : CLASSE_TOM[tom]}">${variacao(pct)}</span>`;
}

function badgeTaxa(valor: number | null, tom: TomTaxa): string {
  return `<span class="b ${CLASSE_TAXA[tom]}">${taxa(valor)}</span>`;
}

export function renderizarHtml(r: Relatorio, geradoEm: string): string {
  const p = r.periodo;
  const titulo = `Funil B2B Expansão — ${tituloPeriodo(p)}`;
  const kicker = p.fimDeSemana
    ? "Franquias · Resultado diário · Sábado + domingo"
    : `Franquias · Resultado diário · Dia anterior · ${nomeDoDia(p.to)}`;
  const colOntem = p.fimDeSemana ? "Sáb + Dom" : "Ontem";
  const colMes = p.fimDeSemana ? "Mês até domingo" : "Mês até ontem";

  const funil = r.funil
    .map(
      (l) =>
        `<tr><td>${esc(l.rotulo)}</td><td>${valorFunil(l.tipoValor, l.ontem)}</td><td>${valorFunil(l.tipoValor, l.media7)}</td><td>${valorFunil(l.tipoValor, l.mes)}</td><td>${badgeVariacao(l.variacao, l.tom)}</td></tr>`,
    )
    .join("");

  const custos = r.custos
    .map(
      (c) =>
        `<tr><td>${esc(c.rotulo)}</td><td>${moeda(c.ontem, c.casas)}</td><td>${moeda(c.media7, c.casas)}</td><td>${moeda(c.mes, c.casas)}</td></tr>`,
    )
    .join("");

  const taxas = r.taxas
    .map(
      (t) =>
        `<tr><td>${esc(t.rotulo)}</td><td>${badgeTaxa(t.ontem.valor, t.tomOntem)}</td><td>${badgeTaxa(t.mes.valor, t.tomMes)}</td><td>${benchmark(t.benchmark)}</td></tr>`,
    )
    .join("");

  const canais = r.canais
    .map((c) => {
      const k = c.contagens;
      const nome = c.canal === "Outbound" ? "Outbound (fora do Geral)" : c.canal;
      return `<tr class="${c.canal === "Geral" ? "geral" : ""}"><td>${esc(nome)}</td><td>${moeda(c.investimento)}</td><td>${k.leads}</td><td>${k.sql}</td><td>${k.agendada}</td><td>${k.realizada}</td><td>${k.rogaMarcado}</td><td>${k.rogaRealizado}</td><td>${k.documentacao}</td><td>${k.contrato}</td><td>${k.venda}</td><td>${moeda(c.cpl, 2)}</td><td>${moeda(c.custoSql)}</td></tr>`;
    })
    .join("");

  const lista = (itens: string[], vazio: string) =>
    `<ul>${(itens.length ? itens : [vazio]).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

  const periodoTxt = p.fimDeSemana ? "sábado e domingo" : "o dia anterior";
  const comparacao = p.fimDeSemana
    ? "média dos 7 dias anteriores (×2) e mês até domingo"
    : "média dos últimos 7 dias e mês até ontem";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="topo"><div class="marca">BL<b>O</b>w<span>escova inteligente · @meublow</span></div></div>
<div class="cab"><div class="kicker">${esc(kicker)}</div><h1>${esc(titulo)}</h1><p>Fonte: PipeRun (entradas por etapa) e Meta Ads/Google Ads · comparado com a ${comparacao} · Outbound fora do Geral</p></div>
<div class="cards">${r.cartoes.map((c, i) => cartao(c, i === r.cartoes.length - 1)).join("")}</div>
<section><h2>1. Funil ${p.fimDeSemana ? "do período" : "do dia"} <small>entradas na etapa · horário de Brasília · ${esc(periodoTxt)}</small></h2>
<table><thead><tr><th>Etapa</th><th>${colOntem}</th><th>Média 7 dias</th><th>${colMes}</th><th>Variação</th></tr></thead><tbody>${funil}</tbody></table></section>
<section><h2>2. Custos e taxas <small>verde = melhor que o benchmark · laranja = pior · cinza = menos de 5 casos</small></h2>
<div class="dois"><table><thead><tr><th>Custo</th><th>${colOntem}</th><th>Média 7 dias</th><th>Mês</th></tr></thead><tbody>${custos}</tbody></table>
<table><thead><tr><th>Taxa</th><th>${colOntem}</th><th>Mês</th><th>Bench.</th></tr></thead><tbody>${taxas}</tbody></table></div></section>
<section><h2>3. Por canal <small>${p.fimDeSemana ? "sáb + dom" : "ontem"} · Geral = soma dos quatro primeiros canais</small></h2>
<table class="canais"><thead><tr><th>Canal</th><th>Invest.</th><th>Leads</th><th>SQL</th><th>Agend.</th><th>Realiz.</th><th>RoGa M.</th><th>RoGa R.</th><th>Doc.</th><th>Contr.</th><th>Vendas</th><th>CPL</th><th>Custo/SQL</th></tr></thead><tbody>${canais}</tbody></table></section>
<section><h2>4. Destaques e pontos de atenção</h2>
<div class="caixas"><div class="caixa"><h3>Destaques ${p.fimDeSemana ? "do período" : "do dia"}</h3>${lista(r.destaques, "Sem destaques calculáveis neste período.")}</div>
<div class="caixa"><h3>Avisos</h3>${lista(r.avisos, "Nenhum aviso.")}</div></div></section>
<div class="rodape"><span>Gerado às ${esc(geradoEm)} (Brasília)</span><span>bLOw · B2B Expansão · ${formatarDiaMes(p.from)}${p.from === p.to ? "" : ` a ${formatarDiaMes(p.to)}`}</span></div>
</body></html>`;
}
