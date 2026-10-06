// Servidor MCP (Streamable HTTP, sem estado) com ferramentas SÓ DE LEITURA do PipeRun.
// JSON-RPC 2.0 escrito à mão: o servidor não guarda sessão, então cabe em função serverless.

import { timingSafeEqual } from "node:crypto";

import { fetchDealById, fetchDealStageHistory, fetchStages } from "@/lib/piperun-client";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "blow-piperun", version: "0.1.0" };

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

function dealIdFrom(args: Record<string, unknown>): number {
  const n = Number(args["deal_id"]);
  if (!Number.isInteger(n) || n <= 0) throw new ToolError("deal_id deve ser um número inteiro positivo.");
  return n;
}

/** Erro mostrado ao Claude como resultado da ferramenta (não derruba o protocolo). */
class ToolError extends Error {}

const DEAL_ID_SCHEMA = {
  type: "object",
  properties: { deal_id: { type: "integer", description: "ID do negócio (card) no PipeRun." } },
  required: ["deal_id"],
  additionalProperties: false,
};

const TOOLS: Tool[] = [
  {
    name: "buscar_negocio",
    description:
      "Mostra o estado atual de um negócio do PipeRun pelo ID: título, funil, etapa, status " +
      "(aberto/ganho/perdido), responsável, valor e datas.",
    inputSchema: DEAL_ID_SCHEMA,
    run: async (args) => {
      const deal = await fetchDealById(dealIdFrom(args));
      if (!deal) throw new ToolError("Negócio não encontrado.");
      const stage = (await fetchStages(deal.pipeline_id).catch(() => [])).find(
        (s) => s.id === deal.stage_id,
      );
      return {
        id: deal.id,
        titulo: deal.title,
        funil_id: deal.pipeline_id,
        etapa: stage?.name ?? `etapa ${deal.stage_id}`,
        status: deal.status === 0 ? "aberto" : deal.status === 1 ? "ganho" : "perdido",
        responsavel: deal.owner?.name ?? null,
        valor: deal.value,
        criado_em: deal.created_at,
        atualizado_em: deal.updated_at,
        entrou_na_etapa_em: deal.stage_changed_at ?? null,
        fechado_em: deal.closed_at ?? null,
      };
    },
  },
  {
    name: "historico_etapas",
    description:
      "Lista, em ordem cronológica, por quais etapas um negócio do PipeRun passou " +
      "(entrada e saída de cada uma). Útil para ver se o card pulou alguma etapa.",
    inputSchema: DEAL_ID_SCHEMA,
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const deal = await fetchDealById(dealId);
      if (!deal) throw new ToolError("Negócio não encontrado.");
      const [history, stages] = await Promise.all([
        fetchDealStageHistory(dealId),
        fetchStages(deal.pipeline_id).catch(() => []),
      ]);
      const names = new Map(stages.map((s) => [s.id, s.name]));
      return [...history]
        .sort((a, b) => a.in_date.localeCompare(b.in_date))
        .map((h) => ({
          etapa: names.get(h.in_stage_id) ?? `etapa ${h.in_stage_id}`,
          entrou_em: h.in_date,
          saiu_em: h.out_date,
        }));
    },
  },
];

function ok(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** Responde uma mensagem JSON-RPC. `null` = notificação (sem resposta, HTTP 202). */
export async function handleRpc(message: unknown): Promise<unknown | null> {
  if (!message || typeof message !== "object") return fail(null, -32600, "Requisição inválida.");
  const req = message as RpcRequest;
  const isNotification = req.id === undefined;

  switch (req.method) {
    case "initialize": {
      const asked = String(req.params?.["protocolVersion"] ?? "");
      return ok(req.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }
    case "ping":
      return ok(req.id, {});
    case "tools/list":
      return ok(req.id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
          annotations: { readOnlyHint: true },
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === req.params?.["name"]);
      if (!tool) return fail(req.id, -32602, "Ferramenta desconhecida.");
      const args = (req.params?.["arguments"] ?? {}) as Record<string, unknown>;
      try {
        const data = await tool.run(args);
        return ok(req.id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
      } catch (error) {
        if (!(error instanceof ToolError)) console.error("[mcp] falha em", tool.name, error);
        const text = error instanceof ToolError ? error.message : "Falha ao consultar o PipeRun.";
        return ok(req.id, { isError: true, content: [{ type: "text", text }] });
      }
    }
    default:
      if (isNotification) return null; // ex.: notifications/initialized
      return fail(req.id, -32601, "Método não suportado.");
  }
}

/** Compara o link pessoal com o segredo do servidor (tempo constante). */
export function linkTokenMatches(received: string): boolean {
  const expected = process.env["MCP_LINK_TOKEN"];
  if (!expected || expected.length < 32) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
