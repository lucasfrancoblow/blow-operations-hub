// Ferramentas de ESCRITA do conector MCP — uso exclusivo da líder da área (o link do
// conector só é entregue a ela). Toda escrita é em dois passos: sem `confirmar: true` a
// ferramenta só mostra a prévia do que faria; com ele executa. Tudo fica no mcp_audit_log
// (com o negócio como estava antes — o que permite recriar um card excluído).

import {
  createDeal,
  deleteDeal,
  addDealNote,
  fetchDealById,
  fetchDealWithCustomFields,
  fetchStages,
  piperunApi,
  updateDeal,
} from "@/lib/piperun-client";
import { supabaseInsertReturning, isSupabaseConfigured } from "@/lib/supabase-client";
import {
  ToolError,
  dealIdFrom,
  optionalId,
  requiredId,
  type Tool,
  type ToolAccess,
} from "@/lib/mcp-tool-kit";

const CONFIRMAR = {
  type: "boolean",
  description:
    "Só envie true DEPOIS de mostrar a prévia à pessoa e ela confirmar. Sem isso nada é alterado.",
};

async function audit(
  tool: string,
  dealId: number | null,
  args: Record<string, unknown>,
  before: unknown,
  outcome: "executado" | "erro",
  detail?: string,
): Promise<void> {
  console.warn("[mcp-audit]", JSON.stringify({ tool, dealId, args, outcome, detail }));
  if (!isSupabaseConfigured()) return;
  try {
    await supabaseInsertReturning("mcp_audit_log", [
      { tool, deal_id: dealId, args, before: before ?? null, outcome, detail: detail ?? null },
    ]);
  } catch (error) {
    // A tabela vem da migration 0033; sem ela o rastro fica só nos logs do servidor.
    console.error("[mcp-audit] não gravou no Supabase", error);
  }
}

/** Executa a escrita só com confirmação; sempre registra o resultado. */
async function guarded(opts: {
  tool: string;
  args: Record<string, unknown>;
  dealId: number | null;
  before: unknown;
  preview: Record<string, unknown>;
  run: () => Promise<unknown>;
}): Promise<unknown> {
  if (opts.args["confirmar"] !== true) {
    return {
      executado: false,
      previa: opts.preview,
      aviso:
        "Nada foi alterado. Mostre a prévia à pessoa e, se ela confirmar, chame de novo com confirmar=true.",
    };
  }
  try {
    const result = await opts.run();
    await audit(opts.tool, opts.dealId, opts.args, opts.before, "executado");
    return { executado: true, ...(result as object) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    await audit(opts.tool, opts.dealId, opts.args, opts.before, "erro", detail);
    throw new ToolError(`Falhou: ${detail}`);
  }
}

async function currentDeal(dealId: number) {
  const deal = await fetchDealById(dealId);
  if (!deal) throw new ToolError("Negócio não encontrado.");
  return deal;
}

async function stageName(pipelineId: number, stageId: number): Promise<string> {
  return (
    (await fetchStages(pipelineId).catch(() => [])).find((s) => s.id === stageId)?.name ??
    `etapa ${stageId}`
  );
}

const STATUS_NAME: Record<number, string> = { 0: "aberto", 1: "ganho", 3: "perdido" };

const dealIdProp = { deal_id: { type: "integer", description: "ID do negócio no PipeRun." } };
const schema = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: { ...properties, confirmar: CONFIRMAR },
  required,
  additionalProperties: false,
});

function tool(access: ToolAccess, t: Omit<Tool, "access">): Tool {
  return { ...t, access };
}

/** Confere, depois da escrita, que o PipeRun realmente aplicou o que pedimos. */
async function verify(
  dealId: number,
  check: (d: Awaited<ReturnType<typeof currentDeal>>) => boolean,
) {
  const after = await currentDeal(dealId);
  if (!check(after)) throw new Error("o PipeRun respondeu OK mas não aplicou a mudança");
  return after;
}

export const WRITE_TOOLS: Tool[] = [
  tool("write", {
    name: "mover_negocio",
    description:
      "Move um negócio para outra etapa (do mesmo funil, ou de outro se informar funil_id). " +
      "Use listar_funis para achar os ids. Sem confirmar=true só mostra a prévia.",
    inputSchema: schema(
      {
        ...dealIdProp,
        etapa_id: { type: "integer", description: "ID da etapa de destino." },
        funil_id: { type: "integer", description: "Só se for mudar de funil. Opcional." },
      },
      ["deal_id", "etapa_id"],
    ),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const stageId = requiredId(args, "etapa_id");
      const deal = await currentDeal(dealId);
      const pipelineId = optionalId(args, "funil_id") ?? deal.pipeline_id;
      return guarded({
        tool: "mover_negocio",
        args,
        dealId,
        before: deal,
        preview: {
          negocio: `${deal.title} (#${deal.id})`,
          de: await stageName(deal.pipeline_id, deal.stage_id),
          para: await stageName(pipelineId, stageId),
        },
        run: async () => {
          await updateDeal(dealId, { pipeline_id: pipelineId, stage_id: stageId });
          await verify(dealId, (d) => d.stage_id === stageId);
          return { mensagem: "Negócio movido." };
        },
      });
    },
  }),
  tool("write", {
    name: "adicionar_nota",
    description: "Adiciona uma nota (comentário) no card de um negócio.",
    inputSchema: schema(
      { ...dealIdProp, texto: { type: "string", description: "Texto da nota." } },
      ["deal_id", "texto"],
    ),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const texto = String(args["texto"] ?? "").trim();
      if (!texto) throw new ToolError("texto é obrigatório.");
      const deal = await currentDeal(dealId);
      return guarded({
        tool: "adicionar_nota",
        args,
        dealId,
        before: null,
        preview: { negocio: `${deal.title} (#${deal.id})`, nota: texto },
        run: async () => {
          await addDealNote(dealId, texto.replace(/</g, "&lt;"));
          return { mensagem: "Nota adicionada." };
        },
      });
    },
  }),
  tool("write", {
    name: "atualizar_negocio",
    description:
      "Altera título, valor ou responsável de um negócio. Informe só o que quer mudar. " +
      "Para achar o id de um responsável, use piperun_api com GET /users.",
    inputSchema: schema(
      {
        ...dealIdProp,
        titulo: { type: "string", description: "Novo título." },
        valor: { type: "number", description: "Novo valor (R$)." },
        responsavel_id: { type: "integer", description: "ID do novo responsável." },
      },
      ["deal_id"],
    ),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const changes: Record<string, unknown> = {};
      if (args["titulo"] !== undefined) changes["title"] = String(args["titulo"]).trim();
      if (args["valor"] !== undefined) {
        const v = Number(args["valor"]);
        if (!Number.isFinite(v) || v < 0) throw new ToolError("valor inválido.");
        changes["value"] = v;
      }
      if (args["responsavel_id"] !== undefined)
        changes["owner_id"] = requiredId(args, "responsavel_id");
      if (Object.keys(changes).length === 0)
        throw new ToolError("Informe ao menos um campo para alterar.");
      const deal = await currentDeal(dealId);
      return guarded({
        tool: "atualizar_negocio",
        args,
        dealId,
        before: deal,
        preview: {
          negocio: `${deal.title} (#${deal.id})`,
          antes: { titulo: deal.title, valor: deal.value, responsavel_id: deal.owner_id },
          depois: changes,
        },
        run: async () => {
          await updateDeal(dealId, changes);
          return { mensagem: "Negócio atualizado." };
        },
      });
    },
  }),
  tool("write", {
    name: "ganhar_negocio",
    description: "Marca um negócio como GANHO.",
    inputSchema: schema(dealIdProp, ["deal_id"]),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const deal = await currentDeal(dealId);
      return guarded({
        tool: "ganhar_negocio",
        args,
        dealId,
        before: deal,
        preview: {
          negocio: `${deal.title} (#${deal.id})`,
          status_atual: STATUS_NAME[deal.status],
          novo_status: "ganho",
        },
        run: async () => {
          await updateDeal(dealId, { status: 1 });
          await verify(dealId, (d) => d.status === 1);
          return { mensagem: "Negócio ganho." };
        },
      });
    },
  }),
  tool("write", {
    name: "perder_negocio",
    description:
      "Marca um negócio como PERDIDO. Precisa do motivo_id (veja piperun_api GET /lostReasons).",
    inputSchema: schema(
      { ...dealIdProp, motivo_id: { type: "integer", description: "ID do motivo de perda." } },
      ["deal_id", "motivo_id"],
    ),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const reasonId = requiredId(args, "motivo_id");
      const deal = await currentDeal(dealId);
      return guarded({
        tool: "perder_negocio",
        args,
        dealId,
        before: deal,
        preview: {
          negocio: `${deal.title} (#${deal.id})`,
          status_atual: STATUS_NAME[deal.status],
          novo_status: "perdido",
          motivo_id: reasonId,
        },
        run: async () => {
          await updateDeal(dealId, { status: 3, lost_reason_id: reasonId });
          await verify(dealId, (d) => d.status === 3);
          return { mensagem: "Negócio perdido." };
        },
      });
    },
  }),
  tool("write", {
    name: "reabrir_negocio",
    description: "Reabre um negócio ganho ou perdido (volta para aberto).",
    inputSchema: schema(dealIdProp, ["deal_id"]),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const deal = await currentDeal(dealId);
      return guarded({
        tool: "reabrir_negocio",
        args,
        dealId,
        before: deal,
        preview: {
          negocio: `${deal.title} (#${deal.id})`,
          status_atual: STATUS_NAME[deal.status],
          novo_status: "aberto",
        },
        run: async () => {
          await updateDeal(dealId, { status: 0 });
          await verify(dealId, (d) => d.status === 0);
          return { mensagem: "Negócio reaberto." };
        },
      });
    },
  }),
  tool("write", {
    name: "criar_negocio",
    description:
      "Cria um negócio novo numa etapa de um funil. Use listar_funis para achar funil_id e etapa_id.",
    inputSchema: schema(
      {
        titulo: { type: "string", description: "Título do negócio." },
        funil_id: { type: "integer" },
        etapa_id: { type: "integer" },
        contato_id: {
          type: "integer",
          description: "ID de um contato (person) já existente. Opcional.",
        },
        responsavel_id: { type: "integer", description: "ID do responsável. Opcional." },
        valor: { type: "number", description: "Valor (R$). Opcional." },
      },
      ["titulo", "funil_id", "etapa_id"],
    ),
    run: async (args) => {
      const titulo = String(args["titulo"] ?? "").trim();
      if (!titulo) throw new ToolError("titulo é obrigatório.");
      const pipelineId = requiredId(args, "funil_id");
      const stageId = requiredId(args, "etapa_id");
      const body: Record<string, unknown> = {
        title: titulo,
        pipeline_id: pipelineId,
        stage_id: stageId,
      };
      const person = optionalId(args, "contato_id");
      const owner = optionalId(args, "responsavel_id");
      if (person) body["person_id"] = person;
      if (owner) body["owner_id"] = owner;
      if (args["valor"] !== undefined) body["value"] = Number(args["valor"]);
      return guarded({
        tool: "criar_negocio",
        args,
        dealId: null,
        before: null,
        preview: { titulo, etapa: await stageName(pipelineId, stageId), ...body },
        run: async () => {
          const created = await createDeal(body);
          return { mensagem: "Negócio criado.", id: created.id, titulo: created.title };
        },
      });
    },
  }),
  tool("destroy", {
    name: "excluir_negocio",
    description:
      "EXCLUI um negócio do PipeRun (não tem como desfazer pelo PipeRun). Exige confirmar=true E " +
      "titulo_confirmacao igual ao título atual do negócio. O estado anterior fica no registro de auditoria.",
    inputSchema: schema(
      {
        ...dealIdProp,
        titulo_confirmacao: {
          type: "string",
          description: "Título exato do negócio, digitado pela pessoa.",
        },
      },
      ["deal_id", "titulo_confirmacao"],
    ),
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const full = (await fetchDealWithCustomFields(dealId)) ?? (await currentDeal(dealId));
      const typed = String(args["titulo_confirmacao"] ?? "").trim();
      if (typed !== full.title.trim()) {
        throw new ToolError(
          `titulo_confirmacao não confere. O título atual é "${full.title}". Peça à pessoa para confirmar esse título.`,
        );
      }
      return guarded({
        tool: "excluir_negocio",
        args,
        dealId,
        before: full,
        preview: {
          negocio: `${full.title} (#${full.id})`,
          status: STATUS_NAME[full.status],
          acao: "EXCLUIR definitivamente",
        },
        run: async () => {
          await deleteDeal(dealId);
          return { mensagem: "Negócio excluído." };
        },
      });
    },
  }),
  tool("destroy", {
    name: "piperun_api",
    description:
      "Chamada livre à API v1 do PipeRun para o que as outras ferramentas não cobrem (atividades, " +
      "contatos, usuários, motivos de perda, notas...). GET executa direto; POST/PUT/DELETE só com " +
      "confirmar=true. Exemplos: GET /users, GET /lostReasons, POST /activities.",
    inputSchema: schema(
      {
        metodo: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
        caminho: { type: "string", description: "Ex.: /users ou /notes?deal_id=123 (sem host)." },
        corpo: { type: "object", description: "JSON enviado em POST/PUT. Opcional." },
      },
      ["metodo", "caminho"],
    ),
    run: async (args) => {
      const method = String(args["metodo"]) as "GET" | "POST" | "PUT" | "DELETE";
      if (!["GET", "POST", "PUT", "DELETE"].includes(method))
        throw new ToolError("metodo inválido.");
      const path = String(args["caminho"] ?? "");
      const body = (args["corpo"] ?? undefined) as Record<string, unknown> | undefined;
      try {
        if (method === "GET") return await piperunApi("GET", path);
        return guarded({
          tool: "piperun_api",
          args,
          dealId: null,
          before: null,
          preview: { metodo: method, caminho: path, corpo: body ?? null },
          run: async () => ({ resposta: await piperunApi(method, path, body) }),
        });
      } catch (error) {
        if (error instanceof ToolError) throw error;
        throw new ToolError(
          error instanceof Error ? error.message : "Falha na chamada ao PipeRun.",
        );
      }
    },
  }),
];
