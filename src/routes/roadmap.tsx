import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Gauge, Lightbulb, Rocket, Search, Sparkles, TrendingUp } from "lucide-react";

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const TONE_CLASSES: Record<string, string> = {
  success: "border-success/25 bg-success/8 hover:border-success/50",
  info: "border-info/25 bg-info/8 hover:border-info/50",
  neutral: "border-border bg-muted/20 hover:border-primary/40",
  warning: "border-warning/25 bg-warning/8 hover:border-warning/50",
  critical: "border-critical/25 bg-critical/8 hover:border-critical/50",
};

const CELL_TONE: Record<RoadmapLevel, Record<RoadmapLevel, keyof typeof TONE_CLASSES>> = {
  Alto: { Baixo: "success", Médio: "success", Alto: "info" },
  Médio: { Baixo: "success", Médio: "neutral", Alto: "warning" },
  Baixo: { Baixo: "neutral", Médio: "warning", Alto: "critical" },
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Matriz de priorização</h3>
          <p className="text-xs text-muted-foreground">
            Impacto × esforço estimado — clique num item pra ver o detalhe.
          </p>
        </div>
        <Tag className="border-success/30 bg-success/10 text-success">
          <Sparkles className="h-3 w-3" /> Quick wins no topo-esquerda
        </Tag>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="flex">
            <div className="w-24 shrink-0" />
            <div className="flex-1 pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Esforço de construção
            </div>
          </div>
          {IMPACT_ROWS.map((impact, rowIdx) => (
            <div key={impact} className="mb-2 flex items-stretch gap-2 last:mb-0">
              <div className="flex w-24 shrink-0 flex-col items-end justify-center pr-2 text-right">
                <span className="text-sm font-medium leading-tight">{impact}</span>
                {rowIdx === 0 && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Impacto
                  </span>
                )}
              </div>
              {EFFORT_COLS.map((effort) => {
                const cellItems = items.filter((i) => i.impact === impact && i.effort === effort);
                const tone = CELL_TONE[impact][effort];
                return (
                  <div
                    key={effort}
                    className={cn(
                      "flex min-h-[76px] flex-1 flex-wrap content-start items-start gap-1.5 rounded-lg border p-2 transition-colors",
                      TONE_CLASSES[tone],
                    )}
                  >
                    {cellItems.length === 0 ? (
                      <span className="m-auto text-[11px] text-muted-foreground/40">—</span>
                    ) : (
                      cellItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onSelect(item.id)}
                          className="cursor-pointer rounded-full border border-border/80 bg-background/70 px-2 py-1 text-left text-[11px] font-medium leading-tight transition-colors hover:border-primary/60 hover:text-primary"
                        >
                          {item.title}
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex gap-2 pl-24 pt-1">
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

function RoadmapDetailSheet({
  item,
  open,
  onOpenChange,
}: {
  item: RoadmapItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left text-lg">{item.title}</SheetTitle>
              <SheetDescription className="text-left">{item.pitch}</SheetDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                <PlatformBadge value={item.area} />
                <Tag className={STATUS_TONE[item.status]}>{item.status}</Tag>
                <Tag className="border-border bg-muted/40 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> Impacto {item.impact}
                </Tag>
                <Tag className="border-border bg-muted/40 text-muted-foreground">
                  <Gauge className="h-3 w-3" /> Esforço {item.effort}
                </Tag>
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <section>
                <h4 className="text-sm font-semibold">Por que faz sentido</h4>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </section>

              {item.buildsOn && (
                <>
                  <Separator />
                  <section className="rounded-lg border border-primary/25 bg-primary/8 p-3">
                    <h4 className="text-sm font-semibold text-primary">Conecta com</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{item.buildsOn}</p>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
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

      <RoadmapDetailSheet
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}
