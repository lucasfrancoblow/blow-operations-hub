import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/hub/motion";

/** Card de KPI com barra de destaque colorida no topo e número animado — usado nas
 * telas de Visão Geral, Radar de Leads e Incidentes pra manter o mesmo tratamento visual. */
export function StatCard({
  label,
  value,
  accent,
  tone,
  loading,
}: {
  label: string;
  value: number;
  accent: "primary" | "warning" | "critical" | "success";
  tone?: "default" | "warning" | "critical" | "success";
  loading?: boolean;
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "critical"
        ? "text-critical"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  const accentClass =
    accent === "warning"
      ? "bg-warning"
      : accent === "critical"
        ? "bg-critical"
        : accent === "success"
          ? "bg-success"
          : "bg-primary";

  return (
    <Card className="relative h-full overflow-hidden border-border/60 bg-card transition-shadow hover:shadow-lg hover:shadow-black/5">
      <div className={cn("absolute inset-x-0 top-0 h-1", accentClass)} />
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-14" />
        ) : (
          <p className={cn("mt-0.5 font-display text-3xl font-semibold tabular-nums", toneClass)}>
            <AnimatedNumber value={value} />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
  collapsible,
  defaultCollapsed,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Quando true, o cabeçalho vira um botão que recolhe/expande o conteúdo. */
  collapsible?: boolean;
  /** Só tem efeito com collapsible — começa fechado, usuário expande sob demanda
   * (usado no Funil de Marketing pra não jogar 5 tabelas gigantes na cara de cara). */
  defaultCollapsed?: boolean;
}) {
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = useState(Boolean(collapsible && defaultCollapsed));

  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -2 }}
      className={cn("h-full", className)}
    >
      <Card className="h-full border-border/60 bg-card backdrop-blur transition-shadow hover:shadow-lg hover:shadow-black/5">
        <CardHeader
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2",
            collapsible && "cursor-pointer select-none",
          )}
          onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
        >
          <CardTitle className="flex items-center gap-2 truncate text-base font-semibold">
            {collapsible && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  collapsed && "-rotate-90",
                )}
              />
            )}
            <span className="truncate">{title}</span>
          </CardTitle>
          {action && (
            <div onClick={collapsible ? (e) => e.stopPropagation() : undefined}>{action}</div>
          )}
        </CardHeader>
        {!collapsed && <CardContent>{children}</CardContent>}
      </Card>
    </motion.div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

function buildPageWindow(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

/** Paginação com janela de números (evita renderizar uma página por botão em listas grandes). */
export function TablePagination({
  current,
  totalPages,
  totalItems,
  itemLabel,
  onPageChange,
}: {
  current: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {totalItems} {itemLabel} · página {current} de {totalPages}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Página anterior"
              className={current === 1 ? "pointer-events-none opacity-40" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (current > 1) onPageChange(current - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
          {buildPageWindow(current, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={current === p}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Próxima página"
              className={current === totalPages ? "pointer-events-none opacity-40" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (current < totalPages) onPageChange(current + 1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
