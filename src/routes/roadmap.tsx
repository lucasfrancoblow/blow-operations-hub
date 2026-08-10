import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Gauge, Lightbulb, Link2, Rocket, Search, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/hub/primitives";
import { PlatformBadge } from "@/components/hub/badges";
import {
  roadmapItems,
  type RoadmapArea,
  type RoadmapItem,
  type RoadmapLevel,
  type RoadmapStatus,
} from "@/data/roadmap";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap de inovação — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Backlog de novas automações propostas para a operação BLOW, priorizado por impacto e esforço.",
      },
      { property: "og:title", content: "Roadmap de inovação — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Ideias de automação para Marketing, Comercial, Implantação, People e Operações.",
      },
    ],
  }),
  component: RoadmapPage,
});

const AREAS: RoadmapArea[] = ["Marketing", "Comercial", "Implantação", "People", "Operações"];
const STATUSES: RoadmapStatus[] = ["Ideia", "Em avaliação", "Planejado", "Em construção"];
const IMPACT_ROWS: RoadmapLevel[] = ["Alto", "Médio", "Baixo"];
const EFFORT_COLS: RoadmapLevel[] = ["Baixo", "Médio", "Alto"];

const LEVEL_WEIGHT: Record<RoadmapLevel, number> = { Alto: 2, Médio: 1, Baixo: 0 };

// Uma escala só (laranja da marca), do quadrante "quick win" até neutro — em vez de
// misturar 5 cores semânticas distintas, que ficava com cara de tabela de status
// em vez de mapa de prioridade. O único destaque fora da escala é o pior quadrante
// (baixo impacto + alto esforço), sinalizado sutilmente.
function cellTone(impact: RoadmapLevel, effort: RoadmapLevel): string {
  const impactScore = LEVEL_WEIGHT[impact];
  const effortScore = 2 - LEVEL_WEIGHT[effort]; // baixo esforço = pontuação alta
  const score = impactScore + effortScore; // 0..4

  if (score === 0) return "border-destructive/25 bg-destructive/[0.06]";
  if (score >= 3) return "border-primary/35 bg-primary/[0.09]";
  if (score === 2) return "border-border/70 bg-muted/10";
  return "border-border/50 bg-transparent";
}

const AREA_DOT: Record<RoadmapArea, string> = {
  Marketing: "bg-info",
  Comercial: "bg-primary",
  Implantação: "bg-warning",
  People: "bg-success",
  Operações: "bg-critical",
};

const STATUS_TONE: Record<RoadmapStatus, string> = {
  Ideia: "border-border bg-muted/40 text-muted-foreground",
  "Em avaliação": "border-info/30 bg-info/12 text-info",
  Planejado: "border-warning/30 bg-warning/12 text-warning",
  "Em construção": "border-success/30 bg-success/12 text-success",
};

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ImpactEffortMatrix({
  items,
  onSelect,
}: {
  items: RoadmapItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Matriz de priorização</h3>
          <p className="text-xs text-muted-foreground">
            Impacto × esforço estimado — clique num item pra ver o detalhe.
          </p>
        </div>
        <Tag className="border-primary/30 bg-primary/10 text-primary">
          <Sparkles className="h-3 w-3" /> Quick wins no topo-esquerda
        </Tag>
      </div>

      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 border-b border-border/60 pb-4 pt-3">
        {AREAS.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", AREA_DOT[a])} />
            {a}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[600px] gap-3">
          <div className="flex w-4 shrink-0 items-center justify-center pb-8">
            <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground [writing-mode:vertical-rl]">
              Impacto ↑
            </span>
          </div>

          <div className="flex-1">
            <div className="flex">
              <div className="w-16 shrink-0" />
              <div className="flex-1 pb-2 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Esforço de construção →
              </div>
            </div>

            {IMPACT_ROWS.map((impact) => (
              <div key={impact} className="mb-3 flex items-stretch gap-3 last:mb-0">
                <div className="flex w-16 shrink-0 items-center justify-end pr-1 text-right text-sm font-medium text-muted-foreground">
                  {impact}
                </div>
                {EFFORT_COLS.map((effort) => {
                  const cellItems = items.filter((i) => i.impact === impact && i.effort === effort);
                  return (
                    <div
                      key={effort}
                      className={cn(
                        "flex min-h-[84px] flex-1 flex-wrap content-start items-start gap-2 rounded-xl border p-2.5 transition-colors",
                        cellTone(impact, effort),
                      )}
                    >
                      {cellItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onSelect(item.id)}
                          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card/90 px-2.5 py-1.5 text-left text-[11px] font-medium leading-tight shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
                        >
                          <span
                            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", AREA_DOT[item.area])}
                          />
                          <span className="text-foreground/90 group-hover:text-primary">
                            {item.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex gap-3 pl-16">
              {EFFORT_COLS.map((effort) => (
                <div
                  key={effort}
                  className="flex-1 text-center text-sm font-medium text-muted-foreground"
                >
                  {effort}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoadmapCard({ item, onSelect }: { item: RoadmapItem; onSelect: (id: string) => void }) {
  return (
    <Card
      className="cursor-pointer border-border/70 bg-card/70 transition-colors hover:border-primary/40"
      onClick={() => onSelect(item.id)}
    >
      <CardContent className="flex h-full flex-col gap-3 py-5">
        <div className="flex items-start justify-between gap-2">
          <PlatformBadge value={item.area} />
          <Tag className={STATUS_TONE[item.status]}>{item.status}</Tag>
        </div>
        <div>
          <p className="font-medium leading-snug">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.pitch}</p>
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Impacto {item.impact}
          </span>
          <span className="inline-flex items-center gap-1">
            <Gauge className="h-3 w-3" /> Esforço {item.effort}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RoadmapDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: RoadmapItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {item && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <PlatformBadge value={item.area} />
                <Tag className={STATUS_TONE[item.status]}>{item.status}</Tag>
              </div>
              <DialogTitle className="text-xl leading-snug">{item.title}</DialogTitle>
              <DialogDescription className="text-sm">{item.pitch}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Tag className="border-border bg-muted/40 text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Impacto {item.impact}
              </Tag>
              <Tag className="border-border bg-muted/40 text-muted-foreground">
                <Gauge className="h-3 w-3" /> Esforço {item.effort}
              </Tag>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold">Por que faz sentido</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>

            {item.buildsOn && (
              <div className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/8 p-3">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Conecta com
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.buildsOn}</p>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoadmapPage() {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      roadmapItems.filter((i) => {
        if (search && !`${i.title} ${i.pitch}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (area !== "todas" && i.area !== area) return false;
        if (status !== "todos" && i.status !== status) return false;
        return true;
      }),
    [search, area, status],
  );

  const quickWins = roadmapItems.filter((i) => i.impact === "Alto" && i.effort === "Baixo").length;
  const inMotion = roadmapItems.filter(
    (i) => i.status === "Em avaliação" || i.status === "Planejado" || i.status === "Em construção",
  ).length;
  const areasCovered = new Set(roadmapItems.map((i) => i.area)).size;

  const selected = roadmapItems.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roadmap de inovação"
        subtitle="Backlog de automações propostas para a operação BLOW — priorizado, não decidido"
        actions={
          <Tag className="border-primary/30 bg-primary/10 text-primary">
            <Rocket className="h-3 w-3" /> {roadmapItems.length} ideias mapeadas
          </Tag>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ideias mapeadas" value={roadmapItems.length} hint="Backlog atual" />
        <StatCard label="Quick wins" value={quickWins} hint="Alto impacto, baixo esforço" />
        <StatCard label="Em movimento" value={inMotion} hint="Além do estágio de ideia" />
        <StatCard label="Áreas cobertas" value={areasCovered} hint="De Marketing a Operações" />
      </div>

      <ImpactEffortMatrix items={roadmapItems} onSelect={setSelectedId} />

      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ideia"
            className="pl-9"
          />
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as áreas</SelectItem>
            {AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5" />}
          title="Nenhuma ideia encontrada"
          description="Ajuste os filtros ou a busca."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <RoadmapCard key={item.id} item={item} onSelect={setSelectedId} />
          ))}
        </div>
      )}

      <RoadmapDetailDialog
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}
