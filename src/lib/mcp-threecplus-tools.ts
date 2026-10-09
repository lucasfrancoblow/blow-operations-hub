// Ferramentas do conector MCP para a 3C Plus (discador). SÓ LEITURA: só há GET na API usada
// aqui. Senhas, tokens e documentos são mascarados antes de sair do servidor.

import {
  fetchCallsRange,
  isThreeCPlusConfigured,
  threeCPlusGet,
  type ThreeCPlusCallFull,
} from "@/lib/threecplus-client";
import { ToolError, periodFrom, type Tool } from "@/lib/mcp-tool-kit";

const MAX_LISTED_CALLS = 200;
const MAX_TRANSCRIPTION = 6000;

function ensureConfigured() {
  if (!isThreeCPlusConfigured()) throw new ToolError("A 3C Plus não está configurada no servidor.");
}

/** Converte "HH:MM:SS" em segundos. */
function seconds(hms: unknown): number {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(String(hms ?? ""));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

const hasQualification = (q: string) => Boolean(q) && q !== "-";

const CALL_FILTER_PROPERTIES = {
  data_inicio: { type: "string", description: "Data inicial AAAA-MM-DD (Brasília). Padrão: hoje." },
  data_fim: {
    type: "string",
    description: "Data final AAAA-MM-DD, inclusiva. Padrão: igual à inicial.",
  },
  agente: { type: "string", description: "Parte do nome do agente. Opcional." },
  campanha: { type: "string", description: "Parte do nome da campanha. Opcional." },
  status: {
    type: "string",
    description: "Parte do status (ex.: Atendida, Não Atendida). Opcional.",
  },
  qualificacao: { type: "string", description: "Parte do nome da qualificação. Opcional." },
  incluir_sem_agente: {
    type: "boolean",
    description:
      "Por padrão só entram chamadas em que um agente foi conectado (o resto é ruído do discador). true inclui tudo.",
  },
};

interface CallFilters {
  since: string;
  until: string;
  agente?: string;
  campanha?: string;
  status?: string;
  qualificacao?: string;
  semAgente: boolean;
}

function filtersFrom(args: Record<string, unknown>): CallFilters {
  const { since, until } = periodFrom(args);
  const text = (key: string) =>
    args[key] === undefined ? undefined : String(args[key]).toLowerCase();
  const agente = text("agente");
  const campanha = text("campanha");
  const status = text("status");
  const qualificacao = text("qualificacao");
  return {
    since,
    until,
    ...(agente ? { agente } : {}),
    ...(campanha ? { campanha } : {}),
    ...(status ? { status } : {}),
    ...(qualificacao ? { qualificacao } : {}),
    semAgente: args["incluir_sem_agente"] === true,
  };
}

async function loadCalls(f: CallFilters) {
  ensureConfigured();
  const { calls, truncado } = await fetchCallsRange(f.since, f.until);
  const has = (value: unknown, needle?: string) =>
    !needle ||
    String(value ?? "")
      .toLowerCase()
      .includes(needle);
  const filtered = calls.filter(
    (c) =>
      (f.semAgente || c.agent_id !== 0) &&
      has(c.agent, f.agente) &&
      has(c.campaign, f.campanha) &&
      has(c.readable_status_text, f.status) &&
      has(c.qualification, f.qualificacao),
  );
  return { calls: filtered, truncado, totalBruto: calls.length };
}

function summarizeCall(c: ThreeCPlusCallFull) {
  return {
    id: c.id,
    data: c.call_date,
    agente: c.agent || null,
    campanha: c.campaign,
    numero: c.number,
    status: c.readable_status_text,
    qualificacao: hasQualification(c.qualification) ? c.qualification : null,
    nota_qualificacao: c["qualification_note"] || null,
    duracao_chamada: c["calling_time"],
    tempo_falado: c.speaking_with_agent_time,
    gravada: c["recorded"] === true,
  };
}

function tally<T>(rows: T[], key: (r: T) => string, extra?: (r: T) => number) {
  const map = new Map<string, { ligacoes: number; segundos_falados: number }>();
  for (const r of rows) {
    const k = key(r) || "(sem valor)";
    const cur = map.get(k) ?? { ligacoes: 0, segundos_falados: 0 };
    cur.ligacoes += 1;
    cur.segundos_falados += extra ? extra(r) : 0;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].ligacoes - a[1].ligacoes)
    .map(([nome, v]) => ({ nome, ...v }));
}

const CADASTROS: Record<string, string> = {
  campanhas: "/campaigns",
  agentes: "/agents",
  usuarios: "/users",
  equipes: "/teams",
  rotas: "/routes",
  pausas: "/work_break_group",
  qualificacoes: "/qualification_lists",
};

const NO_ARGS = { type: "object", properties: {}, additionalProperties: false };

export const THREECPLUS_TOOLS: Tool[] = [
  {
    name: "tcp_ligacoes",
    description:
      "Lista ligações da 3C Plus (discador) num período, da mais nova para a mais antiga, com agente, " +
      "campanha, número, status, qualificação e tempos. Sem datas, traz hoje. Por padrão só chamadas em que " +
      "um agente falou/foi conectado. Até 200 por vez; o total filtrado vem sempre.",
    inputSchema: {
      type: "object",
      properties: {
        ...CALL_FILTER_PROPERTIES,
        limite: { type: "integer", description: "Quantas listar (padrão 50, máximo 200)." },
      },
      additionalProperties: false,
    },
    run: async (args) => {
      const f = filtersFrom(args);
      const limit = Math.min(Math.max(Number(args["limite"] ?? 50) || 50, 1), MAX_LISTED_CALLS);
      const { calls, truncado, totalBruto } = await loadCalls(f);
      const sorted = [...calls].sort((a, b) => (a.call_date < b.call_date ? 1 : -1));
      return {
        periodo: { de: f.since, ate: f.until },
        total_filtrado: sorted.length,
        total_bruto_no_periodo: totalBruto,
        mostrando: Math.min(sorted.length, limit),
        ...(truncado
          ? { aviso: "Período grande demais: resultado incompleto. Use um intervalo menor." }
          : {}),
        ligacoes: sorted.slice(0, limit).map(summarizeCall),
      };
    },
  },
  {
    name: "tcp_resumo_ligacoes",
    description:
      "Resume as ligações da 3C Plus num período: total, quantas tiveram conversa, tempo falado e quebra " +
      "por agente, campanha, status e qualificação. Mesmos filtros de tcp_ligacoes. Sem datas, usa hoje.",
    inputSchema: {
      type: "object",
      properties: CALL_FILTER_PROPERTIES,
      additionalProperties: false,
    },
    run: async (args) => {
      const f = filtersFrom(args);
      const { calls, truncado, totalBruto } = await loadCalls(f);
      const talk = (c: ThreeCPlusCallFull) => seconds(c.speaking_with_agent_time);
      return {
        periodo: { de: f.since, ate: f.until },
        total_filtrado: calls.length,
        total_bruto_no_periodo: totalBruto,
        com_conversa: calls.filter((c) => talk(c) > 0).length,
        segundos_falados_total: calls.reduce((n, c) => n + talk(c), 0),
        ...(truncado
          ? { aviso: "Período grande demais: resultado incompleto. Use um intervalo menor." }
          : {}),
        por_agente: tally(calls, (c) => c.agent, talk),
        por_campanha: tally(calls, (c) => c.campaign, talk),
        por_status: tally(calls, (c) => c.readable_status_text),
        por_qualificacao: tally(
          calls.filter((c) => hasQualification(c.qualification)),
          (c) => c.qualification,
        ),
      };
    },
  },
  {
    name: "tcp_ligacao",
    description:
      "Detalhes de UMA ligação da 3C Plus pelo id (de tcp_ligacoes): tempos, qualificação, nota, dados do " +
      "mailing, gravação e transcrição (se existir, cortada em 6000 caracteres).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID da ligação." } },
      required: ["id"],
      additionalProperties: false,
    },
    run: async (args) => {
      ensureConfigured();
      const id = String(args["id"] ?? "");
      if (!/^[A-Za-z0-9]{8,40}$/.test(id)) throw new ToolError("id inválido.");
      const body = (await threeCPlusGet(`/calls/${id}`)) as { data?: Record<string, unknown> };
      const call = body.data ?? (body as Record<string, unknown>);
      const transcription = call["transcription"];
      return {
        ...call,
        transcription:
          typeof transcription === "string" && transcription.length > MAX_TRANSCRIPTION
            ? `${transcription.slice(0, MAX_TRANSCRIPTION)}… (cortada)`
            : transcription,
      };
    },
  },
  {
    name: "tcp_cadastros",
    description:
      "Lista cadastros da 3C Plus: campanhas, agentes, usuarios, equipes, rotas, pausas ou qualificacoes. " +
      "Com id, traz o detalhe de um item (campanhas e rotas). Senhas e tokens são ocultados.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: Object.keys(CADASTROS) },
        id: { type: "integer", description: "Opcional: detalhe de um item." },
      },
      required: ["tipo"],
      additionalProperties: false,
    },
    run: async (args) => {
      ensureConfigured();
      const base = CADASTROS[String(args["tipo"])];
      if (!base)
        throw new ToolError(`tipo deve ser um destes: ${Object.keys(CADASTROS).join(", ")}.`);
      const id = args["id"] === undefined ? null : Number(args["id"]);
      if (id !== null && (!Number.isInteger(id) || id <= 0)) throw new ToolError("id inválido.");
      return threeCPlusGet(
        id === null ? base : `${base}/${id}`,
        id === null ? { per_page: "100" } : {},
      );
    },
  },
  {
    name: "tcp_campanha",
    description:
      "Detalhes de uma campanha da 3C Plus: parte = detalhe (configuração), listas (mailings, discadas, " +
      "atendidas, concluídas), agentes, agenda ou chamadas. Ache o id com tcp_cadastros tipo=campanhas.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "ID da campanha." },
        parte: { type: "string", enum: ["detalhe", "listas", "agentes", "agenda", "chamadas"] },
      },
      required: ["id"],
      additionalProperties: false,
    },
    run: async (args) => {
      ensureConfigured();
      const id = Number(args["id"]);
      if (!Number.isInteger(id) || id <= 0) throw new ToolError("id inválido.");
      const part: Record<string, string> = {
        detalhe: "",
        listas: "/lists",
        agentes: "/agents",
        agenda: "/schedules",
        chamadas: "/calls",
      };
      const suffix = part[String(args["parte"] ?? "detalhe")];
      if (suffix === undefined) throw new ToolError("parte inválida.");
      return threeCPlusGet(`/campaigns/${id}${suffix}`, suffix ? { per_page: "100" } : {});
    },
  },
  {
    name: "tcp_agentes_ao_vivo",
    description:
      "Situação AGORA dos agentes da 3C Plus: status atual (ocioso, em ligação, pausa...) e desde quando.",
    inputSchema: NO_ARGS,
    run: async () => {
      ensureConfigured();
      const [status, online] = await Promise.all([
        threeCPlusGet("/agents/status"),
        threeCPlusGet("/agents/online").catch(() => null),
      ]);
      return { status, online };
    },
  },
  {
    name: "tcp_api_get",
    description:
      "Consulta livre (GET) em qualquer endpoint de leitura da API v1 da 3C Plus que as outras ferramentas " +
      "não cobrem. Só leitura. Exemplo: caminho=/campaigns/123/lists, parametros={per_page:'50'}.",
    inputSchema: {
      type: "object",
      properties: {
        caminho: { type: "string", description: "Ex.: /teams (sem host, sem query)." },
        parametros: { type: "object", description: "Parâmetros de query (texto). Opcional." },
      },
      required: ["caminho"],
      additionalProperties: false,
    },
    run: async (args) => {
      ensureConfigured();
      const params = Object.fromEntries(
        Object.entries((args["parametros"] ?? {}) as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      );
      try {
        return await threeCPlusGet(String(args["caminho"] ?? ""), params);
      } catch (error) {
        throw new ToolError(
          error instanceof Error ? error.message : "Falha na consulta à 3C Plus.",
        );
      }
    },
  },
];
