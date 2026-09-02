import { createFileRoute, Link } from "@tanstack/react-router";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Headphones,
  Inbox,
  ListTodo,
  Phone,
  Ticket,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { canAccessPage, type PageKey } from "@/lib/page-access";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/hub/motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "hubLOw — Operações BLOW" },
      {
        name: "description",
        content:
          "Mapa do hub de operações BLOW: o que cada aba mostra e de onde vêm os dados — PipeRun, Meta/Google Ads, 3C Plus, n8n, planilhas do Drive.",
      },
      { property: "og:title", content: "hubLOw — Operações BLOW" },
      {
        property: "og:description",
        content: "O que cada aba do hub faz, direto da fonte — sem planilha manual no meio.",
      },
    ],
  }),
  component: Overview,
});

interface HubFeature {
  title: string;
  url: string;
  pageKey: PageKey | null;
  icon: LucideIcon;
  accent:
    "primary" | "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "critical" | "info";
  description: string;
  source: string;
}

interface HubCategory {
  label: string;
  items: HubFeature[];
}

const CATEGORIES: HubCategory[] = [
  {
    label: "Marketing & Vendas",
    items: [
      {
        title: "Radar de Leads",
        url: "/leads-recentes",
        pageKey: "leads-recentes",
        icon: Inbox,
        accent: "primary",
        description:
          "Leads chegando ao vivo, com origem (UTM), destino e a etapa real em que cada um está no funil.",
        source: "PipeRun",
      },
      {
        title: "Funil de MKT",
        url: "/funil-marketing",
        pageKey: "funil-marketing",
        icon: TrendingUp,
        accent: "chart-2",
        description:
          "Funil semanal por canal — investimento, CPL, CPQL e CPRA calculados sozinhos, sem planilha manual.",
        source: "PipeRun + Meta/Google Ads",
      },
    ],
  },
  {
    label: "Time de Expansão",
    items: [
      {
        title: "Daily Expansão",
        url: "/daily-expansao",
        pageKey: "daily-expansao",
        icon: Headphones,
        accent: "chart-1",
        description:
          "Números diários de Allana, Júlia e Andrey (SDR/Closer), lidos direto da planilha do time.",
        source: "Google Drive",
      },
      {
        title: "Ligações",
        url: "/ligacoes",
        pageKey: "ligacoes",
        icon: Phone,
        accent: "chart-4",
        description:
          "Toda ligação do discador, por agente e por campanha — taxa de conexão e qualificação de cada chamada.",
        source: "3C Plus",
      },
    ],
  },
  {
    label: "Operação interna",
    items: [
      {
        title: "Automações",
        url: "/automacoes",
        pageKey: "automacoes",
        icon: Workflow,
        accent: "chart-3",
        description:
          "Inventário de todo workflow n8n e Make da BLOW, com status e saúde num lugar só.",
        source: "n8n + Make",
      },
      {
        title: "Incidentes",
        url: "/incidentes",
        pageKey: "incidentes",
        icon: AlertTriangle,
        accent: "critical",
        description:
          "Quando uma automação quebra, aparece aqui — com severidade, diagnóstico e correção sugerida.",
        source: "n8n",
      },
      {
        title: "Tarefas",
        url: "/tarefas",
        pageKey: "tarefas",
        icon: ListTodo,
        accent: "chart-5",
        description: "Board estilo Azure Boards pro time de operações organizar o backlog.",
        source: "hubLOw",
      },
      {
        title: "Chamados",
        url: "/chamados",
        pageKey: "chamados",
        icon: Ticket,
        accent: "info",
        description: "Abre e acompanha chamados técnicos sem sair do hub.",
        source: "hubLOw",
      },
    ],
  },
];

const ACCENT_CLASSES: Record<
  HubFeature["accent"],
  { bar: string; badgeBg: string; badgeText: string; cssVar: string }
> = {
  primary: {
    bar: "bg-primary",
    badgeBg: "bg-primary/10",
    badgeText: "text-primary",
    cssVar: "var(--color-primary)",
  },
  "chart-1": {
    bar: "bg-chart-1",
    badgeBg: "bg-chart-1/10",
    badgeText: "text-chart-1",
    cssVar: "var(--color-chart-1)",
  },
  "chart-2": {
    bar: "bg-chart-2",
    badgeBg: "bg-chart-2/10",
    badgeText: "text-chart-2",
    cssVar: "var(--color-chart-2)",
  },
  "chart-3": {
    bar: "bg-chart-3",
    badgeBg: "bg-chart-3/10",
    badgeText: "text-chart-3",
    cssVar: "var(--color-chart-3)",
  },
  "chart-4": {
    bar: "bg-chart-4",
    badgeBg: "bg-chart-4/10",
    badgeText: "text-chart-4",
    cssVar: "var(--color-chart-4)",
  },
  "chart-5": {
    bar: "bg-chart-5",
    badgeBg: "bg-chart-5/10",
    badgeText: "text-chart-5",
    cssVar: "var(--color-chart-5)",
  },
  critical: {
    bar: "bg-critical",
    badgeBg: "bg-critical/10",
    badgeText: "text-critical",
    cssVar: "var(--color-critical)",
  },
  info: {
    bar: "bg-info",
    badgeBg: "bg-info/10",
    badgeText: "text-info",
    cssVar: "var(--color-info)",
  },
};

const heroVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/** Selo "ao vivo" com pulso — mesma linguagem visual do ticker do Radar de Leads,
 * aqui só decorativo (a home não busca dado nenhum, é o mapa do hub). */
function LiveBadge() {
  const reduce = useReducedMotion();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <span className="relative flex h-1.5 w-1.5">
        {!reduce && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Direto da fonte — sem planilha no meio
    </span>
  );
}

// Tilt 3D + spotlight que segue o cursor — o card "olha" pro mouse (rotateX/Y em cima
// da posição relativa do ponteiro) e um brilho radial na cor do canal acompanha junto.
// Springs em vez de transição fixa: o card acelera com o mouse e assenta sozinho
// quando o cursor sai, sem parecer robótico.
function FeatureCard({ item }: { item: HubFeature }) {
  const reduce = useReducedMotion();
  const accent = ACCENT_CLASSES[item.accent];
  const cardRef = useRef<HTMLDivElement>(null);

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const springConfig = { stiffness: 260, damping: 22, mass: 0.4 };
  const springX = useSpring(pointerX, springConfig);
  const springY = useSpring(pointerY, springConfig);

  const rotateX = useTransform(springY, [0, 1], [7, -7]);
  const rotateY = useTransform(springX, [0, 1], [-7, 7]);
  const spotlightX = useTransform(springX, (v) => `${v * 100}%`);
  const spotlightY = useTransform(springY, (v) => `${v * 100}%`);
  const spotlightBackground = useMotionTemplate`radial-gradient(240px circle at ${spotlightX} ${spotlightY}, color-mix(in oklab, ${accent.cssVar} 22%, transparent), transparent 72%)`;

  function handlePointerMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (reduce || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  }

  function handlePointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <Link to={item.url} className="block h-full [perspective:1200px]">
      <motion.div
        ref={cardRef}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={reduce ? undefined : { scale: 1.015 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", ...springConfig }}
        className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-lg hover:shadow-black/5"
      >
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: spotlightBackground }}
          />
        )}

        <div className={cn("absolute inset-x-0 top-0 h-1 opacity-80", accent.bar)} />

        <div className="relative flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
              accent.badgeBg,
              accent.badgeText,
            )}
          >
            <item.icon className="h-5 w-5" />
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>

        <div className="relative flex-1 space-y-1.5">
          <h3 className="font-display text-base font-semibold">{item.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </div>

        <div className="relative flex items-center gap-1.5 border-t border-border/60 pt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", accent.bar)} />
          {item.source}
        </div>
      </motion.div>
    </Link>
  );
}

// Duas manchas de luz que derivam devagar em loop (aurora) — troca o fundo estático
// do hero por algo que continua vivo mesmo parado na tela, sem chamar atenção
// demais (respira em ~9-11s, bem mais lento que qualquer outra animação da página).
function AuroraBackground() {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 45%), radial-gradient(circle at 85% 15%, color-mix(in oklab, var(--color-info) 10%, transparent), transparent 40%)",
        }}
      />
    );
  }
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full opacity-25 blur-[90px]"
        style={{ background: "var(--color-primary)" }}
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 80, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full opacity-20 blur-[90px]"
        style={{ background: "var(--color-info)" }}
        animate={{ x: [0, -50, 30, 0], y: [0, 50, -30, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function Overview() {
  const { user } = Route.useRouteContext();
  const reduce = useReducedMotion();

  const categories = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => item.pageKey === null || canAccessPage(user, item.pageKey)),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-10">
      <motion.div
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "show"}
        variants={heroVariants}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 px-6 py-10 sm:px-10 sm:py-12"
      >
        <AuroraBackground />
        <div className="relative z-10 max-w-2xl">
          <LiveBadge />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            hubLOw
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Cada aba abaixo lê direto da fonte — PipeRun, Meta/Google Ads, 3C Plus, n8n, a planilha
            do time — pra ninguém precisar atualizar nada à mão. Clica num card pra abrir.
          </p>
        </div>
      </motion.div>

      {categories.map((cat) => (
        <div key={cat.label} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {cat.label}
          </h2>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cat.items.map((item) => (
              <StaggerItem key={item.url} className="h-full">
                <FeatureCard item={item} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      ))}
    </div>
  );
}
