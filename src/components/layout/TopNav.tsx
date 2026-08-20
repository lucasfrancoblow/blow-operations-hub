import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Menu,
  Moon,
  Search,
  Sun,
  TrendingUp,
  Workflow,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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

const NAV_ITEMS = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Radar de Leads", url: "/leads-recentes", icon: Inbox },
  { title: "Funil de MKT", url: "/funil-marketing", icon: TrendingUp },
  { title: "Automações", url: "/automacoes", icon: Workflow },
  { title: "Incidentes", url: "/incidentes", icon: AlertTriangle },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo },
] as const;

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

function NavPills({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname.startsWith(url);

  return (
    <>
      {NAV_ITEMS.map((item) => {
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

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:px-6">
        <Link to="/" className="mr-1 flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold leading-tight">hubLOw</p>
            <p className="truncate text-[11px] text-muted-foreground">Operações BLOW</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full bg-muted/50 p-1 lg:flex">
          <NavPills />
        </nav>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetTitle className="px-4 pt-4">Navegação</SheetTitle>
            <nav className="mt-4 flex flex-col gap-1 px-3">
              <NavPills onNavigate={() => setMobileOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>

        <div className="relative ml-auto hidden w-full max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar automações, incidentes..."
            className="h-9 rounded-full border-border/60 bg-muted/40 pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") toast.info("Busca global disponível na próxima etapa.");
            }}
          />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0 rounded-full"
            aria-label="Notificações"
            onClick={() => toast.warning("3 incidentes abertos exigem atenção.")}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">LF</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">Lucas Franco</p>
                <p className="text-xs font-normal text-muted-foreground">Operações · BLOW</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/documentacao">Documentação</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">Configurações</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toast.info("Sessão simulada — sem autenticação real.")}
              >
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
