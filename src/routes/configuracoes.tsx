import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader, SectionCard } from "@/components/hub/primitives";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — hubLOw BLOW" },
      {
        name: "description",
        content: "Preferências do hub, alertas operacionais e pontos de integração futura.",
      },
      { property: "og:title", content: "Configurações — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Ajuste alertas, ciclos de revisão e conexões planejadas do hub de operações.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências operacionais do hub" />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Alertas">
          <div className="space-y-4">
            {[
              { id: "slack", label: "Notificar incidentes críticos no Slack", def: true },
              { id: "email", label: "Resumo diário por e-mail", def: false },
              { id: "cred", label: "Alertar credenciais próximas da revisão", def: true },
            ].map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4">
                <Label htmlFor={o.id} className="text-sm font-normal">
                  {o.label}
                </Label>
                <Switch
                  id={o.id}
                  defaultChecked={o.def}
                  onCheckedChange={() => toast.success("Preferência atualizada (simulado).")}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Ciclo de revisão">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rev">Intervalo padrão de revisão de credenciais (dias)</Label>
              <Input id="rev" defaultValue="90" type="number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sla">SLA de resposta a incidente crítico (horas)</Label>
              <Input id="sla" defaultValue="4" type="number" />
            </div>
            <Button onClick={() => toast.success("Configurações salvas (simulado).")}>
              Salvar alterações
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Integrações planejadas">
        {/* Futuro: conectar Supabase (dados), n8n API (execuções) e Notion API (documentação). */}
        <div className="space-y-3 text-sm">
          {[
            { name: "Lovable Cloud / Supabase", desc: "Persistência de automações, incidentes e credenciais." },
            { name: "n8n API", desc: "Leitura de workflows, nós e execuções em tempo real." },
            { name: "Make API", desc: "Status e histórico de cenários." },
            { name: "Notion API", desc: "Sincronização bidirecional da base de documentação." },
          ].map((i, idx, arr) => (
            <div key={i.name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-muted-foreground">{i.desc}</p>
                </div>
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                  Não conectado
                </span>
              </div>
              {idx < arr.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Nenhuma chave de API, token ou senha é armazenada nesta etapa.
        </p>
      </SectionCard>
    </div>
  );
}
