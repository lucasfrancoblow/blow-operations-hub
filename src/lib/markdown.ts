// Subconjunto seguro de markdown pra Documentação de User Story: escapa TODO o
// texto primeiro (via escapeHtml) e só depois aplica as substituições — assim
// nenhum HTML/atributo digitado pelo usuário consegue escapar da tag que a
// gente gera. Sem lib nova (nada de rich-text editor): negrito, itálico,
// links http(s)/mailto, cabeçalhos # / ##, listas "- item" e parágrafos.

import { escapeHtml } from "@/lib/html";

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*]+)\*/g;

function inline(text: string): string {
  return text
    .replace(
      LINK_RE,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2">$1</a>',
    )
    .replace(BOLD_RE, "<strong>$1</strong>")
    .replace(ITALIC_RE, "<em>$1</em>");
}

export function renderSafeMarkdown(text: string): string {
  const lines = escapeHtml(text).split(/\r?\n/);
  const html: string[] = [];
  let listOpen = false;

  function closeList() {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      closeList();
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.*)$/);
    const h1 = trimmed.match(/^#\s+(.*)$/);
    const li = trimmed.match(/^-\s+(.*)$/);

    if (h2) {
      closeList();
      html.push(`<h4 class="mb-1 mt-3 text-sm font-semibold">${inline(h2[1]!)}</h4>`);
    } else if (h1) {
      closeList();
      html.push(`<h3 class="mb-1 mt-3 text-base font-semibold">${inline(h1[1]!)}</h3>`);
    } else if (li) {
      if (!listOpen) {
        html.push('<ul class="list-disc space-y-0.5 pl-5">');
        listOpen = true;
      }
      html.push(`<li>${inline(li[1]!)}</li>`);
    } else {
      closeList();
      html.push(`<p class="text-sm">${inline(trimmed)}</p>`);
    }
  }
  closeList();
  return html.join("");
}
