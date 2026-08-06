import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";

import { hubService, queryKeys } from "@/services/hub-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState, KeyValue, PageHeader } from "@/components/hub/primitives";
import { PlatformBadge } from "@/components/hub/badges";
import type { Documentation } from "@/types/hub";

export const Route = createFileRoute("/documentacao")({
  head: () => ({
    meta: [
      { title: "Documentação — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Base de conhecimento das automações BLOW: objetivo, fluxo, dependências e contingência.",
      },
      { property: "og:title", content: "Documentação — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Documentos operacionais por área, plataforma e sistema.",
      },
    ],
  }),
  component: DocumentationPage,
});

function DocumentationPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.documentation,
    queryFn: hubService.listDocumentation,
  });

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("todas");
  const [platform, setPlatform] = useState("todas");
  const [system, setSystem] = useState("todos");
  const [selected, setSelected] = useState<Documentation | null>(null);

  const systems = Array.from(new Set((data ?? []).flatMap((d) => d.systems)));

  const filtered = useMemo(
    () =>
      (data ?? []).filter((d) => {
        if (search && !`${d.title} ${d.objective}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (area !== "todas" && d.area !== area) return false;
        if (platform !== "todas" && d.platform !== platform) return false;
        if (system !== "todos" && !d.systems.includes(system)) return false;
        return true;
      }),
    [data, search, area, platform, system],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentação"
        subtitle="Base de conhecimento operacional das automações"
      />

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar documento"
            className="pl-9"
          />
        </div>
        <DocFilter value={area} onChange={setArea} all="todas" allLabel="Todas as áreas" options={["Marketing", "Comercial", "Implantação", "People", "Operações"]} />
        <DocFilter value={platform} onChange={setPlatform} all="todas" allLabel="Todas as plataformas" options={["n8n", "Make"]} />
        <DocFilter value={system} onChange={setSystem} all="todos" allLabel="Todos os sistemas" options={systems} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Nenhum documento encontrado"
          description="Ajuste os filtros ou crie um novo documento na base."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.id} className="border-border/70 bg-card/70 transition-colors hover:border-primary/40">
              <CardContent className="flex h-full flex-col gap-3 py-5">
                <div>
                  <p className="text-xs text-muted-foreground">{d.code}</p>
                  <p className="font-medium leading-snug">{d.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlatformBadge value={d.platform} />
                  <PlatformBadge value={d.area} />
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{d.objective}</p>
                <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="text-xs text-muted-foreground">
                    {d.owner} · {d.updatedAt}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(d)}>
                    Abrir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Futuro: conteúdo sincronizado com as páginas do Notion */}
      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">{selected.title}</SheetTitle>
                <SheetDescription className="text-left">{selected.objective}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-8">
                <KeyValue label="Fluxo" value={selected.flowSummary} />
                <KeyValue
                  label="Dependências"
                  value={
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {selected.dependencies.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  }
                />
                <KeyValue
                  label="Credenciais de referência"
                  value={
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {selected.referencedCredentials.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  }
                />
                <KeyValue
                  label="Testes Postman"
                  value={
                    <ul className="list-disc pl-4 font-mono text-xs text-muted-foreground">
                      {selected.postmanTests.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  }
                />
                <KeyValue label="Plano de contingência" value={selected.contingencyPlan} />
                <KeyValue label="Responsável" value={selected.owner} />
                <KeyValue label="Atualizado em" value={selected.updatedAt} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DocFilter({
  value,
  onChange,
  options,
  all,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  all: string;
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={all}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
