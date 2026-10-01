import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  PanelLeft,
  Phone,
  Settings,
  Sun,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { BlowMark } from "@/components/layout/BlowMark";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { ROLE_LABELS, type SessionUser } from "@/lib/user-role";
import { canAccessPage, type PageKey } from "@/lib/page-access";
import { logoutFn } from "@/services/auth-service";
import { getNotificationsFn } from "@/services/notifications-service";
import { Button } from "@/components/ui/button";
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
} from "@/components/ui/animated-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
  pageKey: PageKey | null;
}

// Visão geral não tem pageKey: é a home, sempre visível pra quem está logado.
const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Expansão",
    items: [
      { title: "Visão geral", url: "/", icon: LayoutDashboard, exact: true, pageKey: null },
      { title: "Radar de Leads", url: "/leads-recentes", icon: Inbox, pageKey: "leads-recentes" },
      {
        title: "Funil de MKT",
        url: "/funil-marketing",
        icon: TrendingUp,
        pageKey: "funil-marketing",
      },
    ],
  },
  {
    label: "Aquisição e time",
    items: [
      { title: "Campanhas", url: "/campanhas", icon: Megaphone, pageKey: "campanhas" },
      { title: "Ligações", url: "/ligacoes", icon: Phone, pageKey: "ligacoes" },
    ],
  },
];

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

function SidebarNav({ user }: { user: SessionUser }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.url : pathname.startsWith(item.url);

  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.pageKey === null || canAccessPage(user, i.pageKey)),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      {sections.map((section) => (
        <div key={section.label} className="px-1 py-1.5">
          <AnimatedSidebarGroupLabel>{section.label}</AnimatedSidebarGroupLabel>
          <AnimatedSidebarMenu>
            {section.items.map((item) => (
              <AnimatedSidebarMenuItem key={item.url}>
                <AnimatedSidebarMenuButton
                  to={item.url}
                  isActive={isActive(item)}
                  icon={<item.icon className="size-4" />}
                >
                  {item.title}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </AnimatedSidebarMenu>
        </div>
      ))}
      {user.role === "super_admin" && (
        <div className="px-1 py-1.5">
          <AnimatedSidebarGroupLabel>Admin</AnimatedSidebarGroupLabel>
          <AnimatedSidebarMenu>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                to="/usuarios"
                isActive={pathname.startsWith("/usuarios")}
                icon={<Users className="size-4" />}
              >
                Usuários
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          </AnimatedSidebarMenu>
        </div>
      )}
    </>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  async function handleLogout() {
    await logoutFn();
    // Redirect completo (não navigate client-side): evita corrida com o redirect
    // automático do beforeLoad da rota raiz — ver comentário equivalente em login.tsx.
    window.location.assign("/login");
  }

  return (
    <AnimatedSidebarProvider>
      <AnimatedSidebar ariaLabel="Navegação do hubLOw">
        <AnimatedSidebarHeader className="p-3 pb-2">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-3 overflow-hidden px-1.5 max-md:pr-12"
          >
            <BlowMark className="size-9" />
            <div className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
              <p className="truncate text-sm font-semibold leading-tight">bLOw</p>
              <p className="truncate text-[11px] text-muted-foreground">Hub da Expansão</p>
            </div>
          </Link>
          <AnimatedSidebarClose className="absolute right-2 top-3 text-muted-foreground hover:bg-muted md:hidden">
            <X className="size-4" />
          </AnimatedSidebarClose>
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent>
          <SidebarNav user={user} />
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl p-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">
                    {initialsFor(displayName(user))}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
                  <span className="block truncate text-sm font-medium">{displayName(user)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">
                  <Settings className="mr-2 size-4" /> Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </AnimatedSidebarFooter>
      </AnimatedSidebar>

      <AnimatedSidebarInset className="bg-background surface-grid">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur sm:px-5">
          <AnimatedSidebarTrigger className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <PanelLeft className="size-4" />
          </AnimatedSidebarTrigger>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  );
}
