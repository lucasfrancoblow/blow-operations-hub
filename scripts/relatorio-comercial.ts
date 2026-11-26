// Relatório comercial diário da Expansão -> DM no Slack (só para o destinatário).
// Pedido do Diego Almada (26/11/2026): ligações por SDR (3C Plus), reuniões do closer,
// entradas por etapa, leads novos, ganhos e perdidos, com o acumulado do mês.
//
// Uso: bun run scripts/relatorio-comercial.ts [--date AAAA-MM-DD] [--dry-run] [--to ID]
//   --date     dia em que roda (padrão: hoje, Brasília). Período = ontem; segunda = sáb+dom.
//   --dry-run  só imprime a mensagem, não envia.
//   --to       destino no Slack (ID de usuário ou canal). Padrão: SLACK_RELATORIO_COMERCIAL_DESTINO.
// Variáveis: PIPERUN_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLACK_BOT_TOKEN,
//   SLACK_RELATORIO_COMERCIAL_DESTINO.

import { parseArgs } from "node:util";
import { calcPeriodo, hojeSaoPaulo } from "@/lib/relatorio-funil-b2b/periodo";
import { enviarMensagemPara } from "@/lib/relatorio-funil-b2b/slack";
import { coletarLigacoes, coletarPipeRun } from "@/lib/relatorio-comercial/coleta";
import { montarMensagem } from "@/lib/relatorio-comercial/mensagem";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    to: { type: "string" },
  },
});

const runDate = values.date || hojeSaoPaulo();
if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
  console.error(`--date inválida: "${runDate}". Use AAAA-MM-DD.`);
  process.exit(1);
}
const dryRun = values["dry-run"] === true;
const destino = values.to || process.env["SLACK_RELATORIO_COMERCIAL_DESTINO"] || "";
if (!dryRun && (!destino || !process.env["SLACK_BOT_TOKEN"])) {
  console.error(
    "Faltam SLACK_BOT_TOKEN e/ou o destino (SLACK_RELATORIO_COMERCIAL_DESTINO ou --to).",
  );
  process.exit(1);
}

const periodo = calcPeriodo(runDate);
if (!periodo) {
  console.log(`${runDate} é domingo: o relatório não roda.`);
  process.exit(0);
}
const mes = { from: periodo.mesFrom, to: periodo.to };

const [pipe, ligacoes] = await Promise.allSettled([coletarPipeRun(mes), coletarLigacoes(mes)]);
if (pipe.status === "rejected") console.error("PipeRun falhou:", pipe.reason);
if (ligacoes.status === "rejected") console.error("Ligações (Supabase) falharam:", ligacoes.reason);
if (pipe.status === "rejected" && ligacoes.status === "rejected") process.exit(1);

const texto = montarMensagem(
  periodo,
  pipe.status === "fulfilled" ? pipe.value : null,
  ligacoes.status === "fulfilled" ? ligacoes.value : null,
);

if (dryRun) {
  console.log(texto);
  process.exit(0);
}
await enviarMensagemPara(destino, texto);
console.log(`Relatório enviado para ${destino}.`);
// Fonte parcial: avisa no Actions (job vermelho) mesmo tendo enviado o que deu.
if (pipe.status === "rejected" || ligacoes.status === "rejected") process.exit(1);
