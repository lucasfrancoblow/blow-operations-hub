// Nota de BANT (+ SPIN, quando preenchido) nos cards novos da Reunião Prevista do funil
// Closer. O PipeRun já copia os campos pro card do Closer, mas eles ficam escondidos no
// painel de detalhes; a nota deixa a qualificação do SDR visível na aba Notas.

import {
  addDealNote,
  fetchDealNoteTexts,
  fetchDealWithCustomFields,
  type PipeRunCustomField,
} from "@/lib/piperun-client";

const CLOSER_PIPELINE_ID = 98248;
const REUNIAO_PREVISTA_STAGE_ID = 703267;

// Marca a nota pra reconhecer que ela já existe (evita duplicar se o webhook repetir).
const NOTE_MARKER = "<b>BANT</b>";

const BANT_FIELDS: Array<[label: string, fieldName: string]> = [
  ["Orçamento", "Qual o Orçamento (Budget)"],
  ["Autoridade", "Qual a Autonomia (Authority)"],
  ["Necessidade", "Qual a Necessidade Chave (Necessity)"],
  ["Prazo", "Qual a Expectativa de Compra (Time)"],
];

const SPIN_FIELDS: Array<[label: string, fieldName: string]> = [
  ["Desafio", "Qual o Desafio?"],
  ["Objetivos", "Quais os Objetivos?"],
  ["Problemas", "Quais os Problemas?"],
  ["Implicações da compra", "Quais as Implicações da Compra"],
  ["Necessidades do lead", "Quais as Necessidades do Lead"],
];

// O PipeRun copia os campos junto com o card, mas o webhook pode chegar um instante antes.
const FIELD_RETRIES = 3;
const FIELD_RETRY_DELAY_MS = 2000;

export type BantResult = { status: "ignorado"; reason: string } | { status: "nota_criada" };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function filled(fields: PipeRunCustomField[] | undefined, name: string): string | null {
  const value = fields?.find((f) => f.name === name)?.value;
  return value && value.trim() !== "" ? value.trim() : null;
}

function line(label: string, value: string | null): string {
  return `<b>${label}:</b> ${value === null ? "<i>não informado</i>" : escapeHtml(value)}`;
}

/** `anyStage`: usado só pra preencher cards antigos à mão (scripts/backfill-bant-note.ts);
 * o webhook sempre confere a etapa. */
export async function addBantNoteIfNeeded(
  dealId: number,
  { anyStage = false }: { anyStage?: boolean } = {},
): Promise<BantResult> {
  let deal = await fetchDealWithCustomFields(dealId);
  if (!deal) return { status: "ignorado", reason: "negócio não encontrado no PipeRun" };
  if (
    !anyStage &&
    (deal.pipeline_id !== CLOSER_PIPELINE_ID || deal.stage_id !== REUNIAO_PREVISTA_STAGE_ID)
  ) {
    return { status: "ignorado", reason: "não é um card novo da Reunião Prevista do Closer" };
  }
  if (deal.status !== 0) return { status: "ignorado", reason: "negócio não está aberto" };

  const hasBant = (d: typeof deal) =>
    BANT_FIELDS.some(([, name]) => filled(d?.customFields, name) !== null);
  for (let attempt = 0; !hasBant(deal) && attempt < FIELD_RETRIES; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, FIELD_RETRY_DELAY_MS));
    deal = (await fetchDealWithCustomFields(dealId)) ?? deal;
  }
  if (!hasBant(deal)) return { status: "ignorado", reason: "BANT ainda não preenchido" };

  const notes = await fetchDealNoteTexts(dealId);
  if (notes.some((text) => text.includes(NOTE_MARKER))) {
    return { status: "ignorado", reason: "o card já tem nota de BANT" };
  }

  const fields = deal.customFields;
  const parts = [NOTE_MARKER, ...BANT_FIELDS.map(([l, n]) => line(l, filled(fields, n)))];

  const spin = SPIN_FIELDS.map(([l, n]) => [l, filled(fields, n)] as const).filter(
    (entry): entry is readonly [string, string] => entry[1] !== null,
  );
  if (spin.length > 0) {
    parts.push("", "<b>SPIN</b>", ...spin.map(([l, v]) => line(l, v)));
  }

  await addDealNote(dealId, parts.join("<br>"));
  return { status: "nota_criada" };
}
