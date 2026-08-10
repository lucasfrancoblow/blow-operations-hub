import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Workflow,
  AlertTriangle,
  Plug,
  KeyRound,
  BookOpen,
  Rocket,
  Settings,
  Snowflake,
  Zap,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getN8nStatus } from "@/services/n8n-service";

const items = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Automações", url: "/automacoes", icon: Workflow },
  { title: "Incidentes", url: "/incidentes", icon: AlertTriangle },
  { title: "Leads em risco", url: "/leads", icon: Snowflake },
  { title: "Sistemas e integrações", url: "/sistemas", icon: Plug },
  { title: "Credenciais", url: "/credenciais", icon: KeyRound },
  { title: "Documentação", url: "/documentacao", icon: BookOpen },
  { title: "Roadmap", url: "/roadmap", icon: Rocket },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname.startsWith(url);

  const n8nStatus = useQuery({
    queryKey: ["n8n", "status"],
    queryFn: () => getN8nStatus(),
    staleTime: 30_000,
  });
  const n8nLive = n8nStatus.data?.configured && n8nStatus.data.ok;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">hubLOw</p>
              <p className="truncate text-[11px] text-muted-foreground">Operações BLOW</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border">
          <p className="px-2 py-1 text-[11px] leading-relaxed text-muted-foreground">
            {n8nLive
              ? "Automações, incidentes, credenciais e documentação: dados reais do n8n."
              : "Ambiente de demonstração com dados mockados."}
          </p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
