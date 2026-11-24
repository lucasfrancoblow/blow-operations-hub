// Relatório diário do funil B2B Expansão -> PDF -> Slack.
//
// Uso: bun run scripts/relatorio-funil-b2b.ts [--date AAAA-MM-DD] [--dry-run] [--out caminho.pdf]
//   --date     dia em que o relatório "roda" (padrão: hoje em America/Sao_Paulo). O período é o
//              dia anterior; na segunda-feira, sábado + domingo. Domingo não roda.
//   --dry-run  grava o PDF e NÃO posta no Slack.
//   --out      caminho do PDF (padrão: relatorio-funil-b2b-AAAA-MM-DD.pdf).
// Variáveis: PIPERUN_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID.

import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  comentarioSlack,
  gerarRelatorio,
  mensagemFalha,
  tituloSlack,
} from "@/lib/relatorio-funil-b2b/gerar";
import { hojeSaoPaulo } from "@/lib/relatorio-funil-b2b/periodo";
import { htmlParaPdf } from "@/lib/relatorio-funil-b2b/pdf";
import { configuracaoSlack, enviarMensagem, enviarPdf } from "@/lib/relatorio-funil-b2b/slack";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    out: { type: "string" },
  },
});

const runDate = values.date || hojeSaoPaulo();
if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
  console.error(`--date inválida: "${runDate}". Use AAAA-MM-DD.`);
  process.exit(1);
}
const dryRun = values["dry-run"] === true;

// Falha fechado: sem credencial do Slack não adianta gerar (só no envio real).
if (!dryRun) configuracaoSlack();

const resultado = await gerarRelatorio(runDate);
if (resultado === null) {
  console.log(`${runDate} é domingo: o relatório não roda.`);
  process.exit(0);
}

if (!resultado.ok) {
  const msg = mensagemFalha(resultado.periodo, resultado.motivo);
  console.error(msg);
  if (!dryRun) await enviarMensagem(msg);
  process.exit(1);
}

const pdf = await htmlParaPdf(resultado.html);
const saida = values.out || `relatorio-funil-b2b-${runDate}.pdf`;
await writeFile(saida, pdf);
console.log(`PDF gravado em ${saida} (${pdf.byteLength} bytes).`);

if (dryRun) {
  console.log("--dry-run: nada foi postado no Slack.");
  process.exit(0);
}

await enviarPdf({
  pdf,
  nomeArquivo: `funil-b2b-expansao-${resultado.periodo.to}.pdf`,
  titulo: tituloSlack(resultado.periodo),
  comentario: comentarioSlack(resultado.periodo),
});
console.log("PDF enviado ao Slack.");
