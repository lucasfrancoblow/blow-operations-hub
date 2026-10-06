// Deixa a nota de BANT/SPIN num card específico do PipeRun, em qualquer etapa — pra
// cards criados antes do webhook deal_created existir.
//
// Uso: bun run scripts/backfill-bant-note.ts <dealId> [<dealId> ...]

import { addBantNoteIfNeeded } from "../src/lib/bant-note";

const ids = process.argv.slice(2).map(Number);
if (ids.length === 0 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
  console.error("Uso: bun run scripts/backfill-bant-note.ts <dealId> [<dealId> ...]");
  process.exit(1);
}

for (const id of ids) {
  const result = await addBantNoteIfNeeded(id, { anyStage: true });
  console.log(id, JSON.stringify(result));
}
