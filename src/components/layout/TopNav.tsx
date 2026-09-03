import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Headphones,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Menu,
  Moon,
  Phone,
  Sun,
  Ticket,
  TrendingUp,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { ROLE_LABELS, type SessionUser } from "@/lib/user-role";
import { canAccessPage, type PageKey } from "@/lib/page-access";
import { logoutFn } from "@/services/auth-service";
import { getNotificationsFn } from "@/services/notifications-service";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Visão Geral não tem pageKey: é a home, sempre visível pra quem está logado.
const NAV_ITEMS = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard, exact: true, pageKey: null },
  { title: "Radar de Leads", url: "/leads-recentes", icon: Inbox, pageKey: "leads-recentes" },
  { title: "Funil de MKT", url: "/funil-marketing", icon: TrendingUp, pageKey: "funil-marketing" },
  { title: "Daily Expansão", url: "/daily-expansao", icon: Headphones, pageKey: "daily-expansao" },
  { title: "Ligações", url: "/ligacoes", icon: Phone, pageKey: "ligacoes" },
  { title: "Automações", url: "/automacoes", icon: Workflow, pageKey: "automacoes" },
  { title: "Incidentes", url: "/incidentes", icon: AlertTriangle, pageKey: "incidentes" },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo, pageKey: "tarefas" },
  { title: "Chamados", url: "/chamados", icon: Ticket, pageKey: "chamados" },
] as const satisfies ReadonlyArray<{
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
  pageKey: PageKey | null;
}>;

const ADMIN_NAV_ITEM = { title: "Usuários", url: "/usuarios", icon: Users } as const;

function initialsFor(name: string): string {
  const parts = name.split(/[.\s]+/).filter(Boolean);
  const chars = parts.length > 1 ? [parts[0]![0], parts[1]![0]] : [name.slice(0, 2)];
  return chars.join("").toUpperCase();
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative shrink-0 overflow-hidden rounded-full"
      aria-label="Alternar tema claro/escuro"
      onClick={toggleTheme}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex"
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

function NavPills({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname.startsWith(url);
  const items = [
    ...NAV_ITEMS.filter((item) => item.pageKey === null || canAccessPage(user, item.pageKey)),
    ...(user.role === "super_admin" ? [ADMIN_NAV_ITEM] : []),
  ];

  return (
    <>
      {items.map((item) => {
        const active = isActive(item.url, "exact" in item ? item.exact : false);
        return (
          <Link
            key={item.url}
            to={item.url}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </>
  );
}

/** Sino de notificações de verdade — antes era um toast fixo sempre igual.
 * `staleTime`/`refetchInterval` de 1min: o TopNav monta uma vez só e persiste
 * entre navegações (ver __root.tsx), então não custa recontar de tempos em
 * tempos sem virar um refetch a cada clique de link. */
function NotificationBell() {
  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotificationsFn(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0 rounded-full"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-critical-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" /> Tudo em ordem por aqui.
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link to={item.href} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    item.tone === "critical" ? "bg-critical" : "bg-warning",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNav({ user }: { user: SessionUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logoutFn();
    // Redirect completo (não navigate client-side): evita corrida com o redirect
    // automático do beforeLoad da rota raiz — ver comentário equivalente em login.tsx.
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 items-center gap-2 px-3 sm:px-6">
        <Link to="/" className="mr-1 flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold leading-tight">hubLOw</p>
            <p className="truncate text-[11px] text-muted-foreground">Operações BLOW</p>
          </div>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full bg-muted/50 p-1 lg:flex">
          <NavPills user={user} />
        </nav>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto shrink-0 lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetTitle className="px-4 pt-4">Navegação</SheetTitle>
            <nav className="mt-4 flex flex-col gap-1 px-3">
              <NavPills user={user} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">
                    {initialsFor(displayName(user))}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{displayName(user)}</p>
                <p className="text-xs font-normal text-muted-foreground">
                  {ROLE_LABELS[user.role]} · BLOW
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/documentacao">Documentação</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">Configurações</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
