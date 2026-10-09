// Tipos e helpers comuns das ferramentas do conector MCP (leitura e escrita).

export type ToolAccess = "read" | "write" | "destroy";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** read = só consulta; write = altera dados; destroy = apaga/ação sem volta. Padrão: read. */
  access?: ToolAccess;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Erro mostrado ao Claude como resultado da ferramenta (não derruba o protocolo). */
export class ToolError extends Error {}

export function dealIdFrom(args: Record<string, unknown>): number {
  const n = Number(args["deal_id"]);
  if (!Number.isInteger(n) || n <= 0)
    throw new ToolError("deal_id deve ser um número inteiro positivo.");
  return n;
}

export function optionalId(args: Record<string, unknown>, key: string): number | null {
  if (args[key] === undefined) return null;
  const n = Number(args[key]);
  if (!Number.isInteger(n) || n <= 0)
    throw new ToolError(`${key} deve ser um número inteiro positivo.`);
  return n;
}

export function requiredId(args: Record<string, unknown>, key: string): number {
  const n = optionalId(args, key);
  if (n === null) throw new ToolError(`${key} é obrigatório.`);
  return n;
}

/** Hoje no horário de Brasília (YYYY-MM-DD). */
export function todayBrt(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function dateArg(args: Record<string, unknown>, key: string, fallback: string): string {
  const value = args[key] === undefined ? fallback : String(args[key]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ToolError(`${key} deve estar no formato AAAA-MM-DD.`);
  return value;
}

export function periodFrom(args: Record<string, unknown>): { since: string; until: string } {
  const today = todayBrt();
  const since = dateArg(args, "data_inicio", today);
  const until = dateArg(args, "data_fim", since);
  if (since > until) throw new ToolError("data_inicio não pode ser depois de data_fim.");
  return { since, until };
}
