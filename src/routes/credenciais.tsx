import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KeyRound, Search, ShieldCheck } from "lucide-react";

import { hubService, queryKeys } from "@/services/hub-service";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/hub/primitives";
import { CredentialStatusBadge } from "@/components/hub/badges";

export const Route = createFileRoute("/credenciais")({
  head: () => ({
    meta: [
      { title: "Credenciais — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Registro de referência das credenciais operacionais da BLOW, sem exibir segredos ou tokens.",
      },
      { property: "og:title", content: "Credenciais — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Metadados de credenciais: sistema, tipo, local de configuração e ciclo de revisão.",
      },
    ],
  }),
  component: CredentialsPage,
});

function CredentialsPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.credentials,
    queryFn: hubService.listCredentials,
  });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");

  const filtered = useMemo(
    () =>
      (data ?? []).filter((c) => {
        if (search && !`${c.name} ${c.system}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (type !== "todos" && c.type !== type) return false;
        return true;
      }),
    [data, search, type],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credenciais"
        subtitle="Referência operacional — nenhum segredo é exibido ou armazenado"
      />

      <div className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/8 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p>
          Este hub guarda apenas metadados: onde a credencial está configurada, quem responde por
          ela e quando deve ser revisada. Senhas, tokens, API keys e client secrets permanecem
          exclusivamente na plataforma de origem.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar credencial ou sistema"
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {["OAuth2", "API Key", "Basic Auth", "Webhook"].map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-5 w-5" />}
          title="Nenhuma credencial encontrada"
          description="Ajuste a busca ou o filtro de tipo."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nome</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="min-w-[220px]">Local de configuração</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última revisão</TableHead>
                  <TableHead>Próxima revisão</TableHead>
                  <TableHead className="min-w-[200px]">Automações relacionadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.system}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            {c.type}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {c.type === "OAuth2"
                            ? "Autorização delegada com token renovável."
                            : c.type === "API Key"
                              ? "Chave estática emitida pelo sistema de origem."
                              : c.type === "Basic Auth"
                                ? "Autenticação por usuário e senha via header."
                                : "Endpoint de recebimento de eventos assinados."}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.location}</TableCell>
                    <TableCell className="text-muted-foreground">{c.owner}</TableCell>
                    <TableCell>
                      <CredentialStatusBadge value={c.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.lastReview}</TableCell>
                    <TableCell className="text-muted-foreground">{c.nextReview}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.relatedAutomations.length} automações
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
