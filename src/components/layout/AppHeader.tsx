import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const labels: Record<string, string> = {
  automacoes: "Automações",
  incidentes: "Incidentes",
  sistemas: "Sistemas e integrações",
  credenciais: "Credenciais",
  documentacao: "Documentação",
  roadmap: "Roadmap",
  configuracoes: "Configurações",
};

function useCrumbs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((part, i) => ({
    label: labels[part] ?? decodeURIComponent(part).toUpperCase(),
    href: "/" + parts.slice(0, i + 1).join("/"),
    last: i === parts.length - 1,
  }));
}

export function AppHeader() {
  const crumbs = useCrumbs();

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-6">
        <SidebarTrigger className="shrink-0" />

        <div className="hidden min-w-0 flex-1 md:block">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {crumbs.length === 0 ? (
                  <BreadcrumbPage>Visão geral</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to="/">Visão geral</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {crumbs.map((c) => (
                <span key={c.href} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {c.last ? (
                      <BreadcrumbPage className="max-w-[220px] truncate">{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={c.href as "/"}>{c.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="relative ml-auto hidden w-full max-w-xs sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar automações, incidentes..."
            className="h-9 border-border/70 bg-muted/40 pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") toast.info("Busca global disponível na próxima etapa.");
            }}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Notificações"
          onClick={() => toast.warning("3 incidentes abertos exigem atenção.")}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
              <Avatar className="h-7 w-7">
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
              <Link to="/configuracoes">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Sessão simulada — sem autenticação real.")}>
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
