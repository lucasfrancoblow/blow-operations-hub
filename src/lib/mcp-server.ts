// Servidor MCP (Streamable HTTP, sem estado) com ferramentas do PipeRun: leitura e, para a
// líder da área, escrita em dois passos (prévia + confirmação) — ver mcp-write-tools.ts.
// JSON-RPC 2.0 escrito à mão: o servidor não guarda sessão, então cabe em função serverless.

import { timingSafeEqual } from "node:crypto";

import {
  fetchDealById,
  fetchDealNoteTexts,
  fetchDealStageHistory,
  fetchDealWithCustomFields,
  fetchDealsInRange,
  fetchPipelines,
  fetchStageEntradasInRange,
  fetchStages,
  type PipeRunDeal,
} from "@/lib/piperun-client";
import { WRITE_TOOLS } from "@/lib/mcp-write-tools";
import { ToolError, dealIdFrom, optionalId, type Tool } from "@/lib/mcp-tool-kit";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "blow-piperun", version: "0.3.0" };

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const MAX_LISTED_DEALS = 100;

const STATUS_LABEL: Record<number, string> = { 0: "aberto", 1: "ganho", 3: "perdido" };
const statusLabel = (status: number) => STATUS_LABEL[status] ?? `status ${status}`;

/** Hoje no horário de Brasília (YYYY-MM-DD). */
function todayBrt(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function dateArg(args: Record<string, unknown>, key: string, fallback: string): string {
  const value = args[key] === undefined ? fallback : String(args[key]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ToolError(`${key} deve estar no formato AAAA-MM-DD.`);
  return value;
}

function periodFrom(args: Record<string, unknown>): { since: string; until: string } {
  const today = todayBrt();
  const since = dateArg(args, "data_inicio", today);
  const until = dateArg(args, "data_fim", since);
  if (since > until) throw new ToolError("data_inicio não pode ser depois de data_fim.");
  return { since, until };
}

const PERIOD_PROPERTIES = {
  data_inicio: {
    type: "string",
    description: "Data inicial AAAA-MM-DD (horário de Brasília). Padrão: hoje.",
  },
  data_fim: {
    type: "string",
    description: "Data final AAAA-MM-DD, inclusiva. Padrão: igual à data inicial.",
  },
  funil_id: { type: "integer", description: "Filtra por funil (veja listar_funis). Opcional." },
};

const DEAL_ID_SCHEMA = {
  type: "object",
  properties: { deal_id: { type: "integer", description: "ID do negócio (card) no PipeRun." } },
  required: ["deal_id"],
  additionalProperties: false,
};

const READ_TOOLS: Tool[] = [
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
  {
    name: "listar_funis",
    description:
      "Lista os funis do PipeRun com suas etapas (id e nome, na ordem). Use para descobrir funil_id e nomes de etapas.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () => {
      const pipelines = await fetchPipelines();
      return Promise.all(
        pipelines.map(async (p) => ({
          id: p.id,
          nome: p.name,
          etapas: (await fetchStages(p.id).catch(() => []))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((s) => ({ id: s.id, nome: s.name })),
        })),
      );
    },
  },
  {
    name: "listar_negocios",
    description:
      "Lista negócios (leads) CRIADOS num período, de qualquer status, do mais novo para o mais antigo. " +
      "Sem datas, traz os de hoje. Devolve o total e até 100 negócios com nome do contato, telefone, funil, etapa atual, status e responsável.",
    inputSchema: {
      type: "object",
      properties: {
        ...PERIOD_PROPERTIES,
        status: {
          type: "string",
          enum: ["aberto", "ganho", "perdido"],
          description: "Filtra por status. Opcional.",
        },
      },
      additionalProperties: false,
    },
    run: async (args) => {
      const { since, until } = periodFrom(args);
      const pipelineId = optionalId(args, "funil_id");
      const wanted = args["status"] === undefined ? null : String(args["status"]);
      if (wanted !== null && !["aberto", "ganho", "perdido"].includes(wanted)) {
        throw new ToolError("status deve ser aberto, ganho ou perdido.");
      }
      const deals = (await fetchDealsInRange(since, until)).filter(
        (d: PipeRunDeal) =>
          (pipelineId === null || d.pipeline_id === pipelineId) &&
          (wanted === null || statusLabel(d.status) === wanted),
      );
      const stageNames = new Map<number, string>();
      const funnelNames = new Map(
        (await fetchPipelines().catch(() => [])).map((p) => [p.id, p.name]),
      );
      for (const id of new Set(deals.map((d) => d.pipeline_id))) {
        for (const s of await fetchStages(id).catch(() => [])) stageNames.set(s.id, s.name);
      }
      return {
        periodo: { de: since, ate: until },
        total: deals.length,
        mostrando: Math.min(deals.length, MAX_LISTED_DEALS),
        negocios: deals.slice(0, MAX_LISTED_DEALS).map((d) => ({
          id: d.id,
          titulo: d.title,
          contato: d.person?.name ?? null,
          telefone:
            d.person?.contactPhones?.find((p) => p.is_main)?.phone ??
            d.person?.contactPhones?.[0]?.phone ??
            null,
          funil: funnelNames.get(d.pipeline_id) ?? `funil ${d.pipeline_id}`,
          etapa: stageNames.get(d.stage_id) ?? `etapa ${d.stage_id}`,
          status: statusLabel(d.status),
          responsavel: d.owner?.name ?? null,
          valor: d.value,
          criado_em: d.created_at,
        })),
      };
    },
  },
  {
    name: "entradas_por_etapa",
    description:
      "Conta quantos negócios ENTRARAM em cada etapa num período (mesma lógica do relatório 'Taxa de Conversão' do PipeRun). " +
      "Serve para contar SQL, RA, reunião agendada etc. Sem datas, usa hoje.",
    inputSchema: { type: "object", properties: PERIOD_PROPERTIES, additionalProperties: false },
    run: async (args) => {
      const { since, until } = periodFrom(args);
      const pipelineId = optionalId(args, "funil_id");
      const entries = await fetchStageEntradasInRange(since, until);
      const perStage = new Map<number, Set<number>>();
      for (const e of entries) {
        if (!perStage.has(e.in_stage_id)) perStage.set(e.in_stage_id, new Set());
        perStage.get(e.in_stage_id)!.add(e.deal_id);
      }
      const rows: {
        funil: string;
        etapa: string;
        ordem: number;
        entradas: number;
        negocios_unicos: number;
      }[] = [];
      for (const p of await fetchPipelines()) {
        if (pipelineId !== null && p.id !== pipelineId) continue;
        for (const s of await fetchStages(p.id).catch(() => [])) {
          const deals = perStage.get(s.id);
          if (!deals) continue;
          rows.push({
            funil: p.name,
            etapa: s.name,
            ordem: s.order ?? 0,
            entradas: entries.filter((e) => e.in_stage_id === s.id).length,
            negocios_unicos: deals.size,
          });
        }
      }
      rows.sort((a, b) => a.funil.localeCompare(b.funil) || a.ordem - b.ordem);
      return { periodo: { de: since, ate: until }, etapas: rows.map(({ ordem: _o, ...r }) => r) };
    },
  },
  {
    name: "detalhes_negocio",
    description:
      "Campos personalizados (BANT, SPIN, UTMs, origem etc.) e notas de um negócio do PipeRun pelo ID.",
    inputSchema: DEAL_ID_SCHEMA,
    run: async (args) => {
      const dealId = dealIdFrom(args);
      const deal = await fetchDealWithCustomFields(dealId);
      if (!deal) throw new ToolError("Negócio não encontrado.");
      const notes = await fetchDealNoteTexts(dealId).catch(() => []);
      return {
        id: deal.id,
        titulo: deal.title,
        campos: Object.fromEntries(
          (deal.customFields ?? []).filter((f) => f.value).map((f) => [f.name, f.value]),
        ),
        notas: notes.filter(Boolean).map((n) => n.slice(0, 2000)),
      };
    },
  },
];

const TOOLS: Tool[] = [...READ_TOOLS, ...WRITE_TOOLS];

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
        tools: TOOLS.map(({ name, description, inputSchema, access = "read" }) => ({
          name,
          description,
          inputSchema,
          annotations:
            access === "read"
              ? { readOnlyHint: true }
              : { readOnlyHint: false, destructiveHint: access === "destroy" },
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
