import { cn } from "@/lib/utils";
import type {
  AutomationStatus,
  CredentialStatus,
  HealthStatus,
  IncidentSeverity,
  IncidentStatus,
  SystemStatus,
} from "@/types/hub";
import type { TaskPriority, TaskStatus } from "@/types/tasks";

const tone = {
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/30 bg-warning/12 text-warning",
  critical: "border-critical/35 bg-critical/15 text-critical",
  brand: "border-primary/35 bg-primary/12 text-primary",
  info: "border-info/30 bg-info/12 text-info",
  neutral: "border-border bg-muted/60 text-muted-foreground",
} as const;

type Tone = keyof typeof tone;

function Pill({
  children,
  variant,
  dot = true,
}: {
  children: React.ReactNode;
  variant: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone[variant],
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function HealthBadge({ value }: { value: HealthStatus }) {
  const map: Record<HealthStatus, Tone> = {
    Saudável: "success",
    Atenção: "warning",
    Crítica: "critical",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function AutomationStatusBadge({ value }: { value: AutomationStatus }) {
  const map: Record<AutomationStatus, Tone> = {
    Ativa: "success",
    Pausada: "warning",
    "Em manutenção": "info",
    Descontinuada: "neutral",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function SeverityBadge({ value }: { value: IncidentSeverity }) {
  const map: Record<IncidentSeverity, Tone> = {
    Crítica: "critical",
    Alta: "brand",
    Média: "warning",
    Baixa: "info",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function IncidentStatusBadge({ value }: { value: IncidentStatus }) {
  const map: Record<IncidentStatus, Tone> = {
    Aberto: "critical",
    Investigando: "warning",
    Resolvido: "success",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function SystemStatusBadge({ value }: { value: SystemStatus }) {
  const map: Record<SystemStatus, Tone> = {
    Operacional: "success",
    Degradado: "warning",
    "Fora do ar": "critical",
    "Não verificado": "neutral",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function CredentialStatusBadge({ value }: { value: CredentialStatus }) {
  const map: Record<CredentialStatus, Tone> = {
    Ativa: "success",
    "Revisão pendente": "warning",
    Expirada: "critical",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function TaskPriorityBadge({ value }: { value: TaskPriority }) {
  const map: Record<TaskPriority, Tone> = {
    Crítica: "critical",
    Alta: "brand",
    Média: "warning",
    Baixa: "info",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function TaskStatusBadge({ value }: { value: TaskStatus }) {
  const map: Record<TaskStatus, Tone> = {
    "Aguardando aceite": "brand",
    Backlog: "neutral",
    "Em andamento": "info",
    Bloqueado: "critical",
    "Em revisão": "warning",
    Concluído: "success",
  };
  return <Pill variant={map[value]}>{value}</Pill>;
}

export function PlatformBadge({ value }: { value: string }) {
  return (
    <Pill variant="neutral" dot={false}>
      {value}
    </Pill>
  );
}
