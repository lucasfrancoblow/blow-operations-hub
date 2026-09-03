import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader, SectionCard } from "@/components/hub/primitives";
import {
  getHubSettingsFn,
  getIntegrationStatusFn,
  updateHubSettingsFn,
} from "@/services/hub-settings-service";
import type { HubSettings } from "@/lib/hub-settings-store";

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
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["hub-settings"],
    queryFn: () => getHubSettingsFn(),
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => getIntegrationStatusFn(),
  });

  const [rev, setRev] = useState("90");
  const [sla, setSla] = useState("4");

  useEffect(() => {
    if (settings) {
      setRev(String(settings.credentialReviewDays));
      setSla(String(settings.criticalIncidentSlaHours));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<HubSettings>) => updateHubSettingsFn({ data: patch }),
    onSuccess: () => {
      toast.success("Preferência salva.");
      queryClient.invalidateQueries({ queryKey: ["hub-settings"] });
    },
    onError: (error: Error) => toast.error(`Não foi possível salvar: ${error.message}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências operacionais do hub" />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Alertas">
          <div className="space-y-4">
            {(
              [
                {
                  id: "slack",
                  key: "slackCriticalIncidents",
                  label: "Notificar incidentes críticos no Slack",
                },
                { id: "email", key: "dailyEmailSummary", label: "Resumo diário por e-mail" },
                {
                  id: "cred",
                  key: "credentialReviewAlerts",
                  label: "Alertar credenciais próximas da revisão",
                },
              ] as const
            ).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4">
                <Label htmlFor={o.id} className="text-sm font-normal">
                  {o.label}
                </Label>
                <Switch
                  id={o.id}
                  checked={settings?.[o.key] ?? false}
                  disabled={!settings || updateMutation.isPending}
                  onCheckedChange={(checked) => updateMutation.mutate({ [o.key]: checked })}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              As integrações de Slack e do resumo por e-mail ainda não existem — a preferência aqui
              já é salva de verdade, mas ainda não dispara nada automaticamente.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Ciclo de revisão">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rev">Intervalo padrão de revisão de credenciais (dias)</Label>
              <Input id="rev" value={rev} onChange={(e) => setRev(e.target.value)} type="number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sla">SLA de resposta a incidente crítico (horas)</Label>
              <Input id="sla" value={sla} onChange={(e) => setSla(e.target.value)} type="number" />
            </div>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  credentialReviewDays: Number(rev) || 90,
                  criticalIncidentSlaHours: Number(sla) || 4,
                })
              }
            >
              Salvar alterações
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Integrações">
        <div className="space-y-3 text-sm">
          {integrations.map((i, idx) => (
            <div key={i.name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-muted-foreground">{i.description}</p>
                </div>
                <span
                  className={
                    i.connected
                      ? "rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs text-success"
                      : "rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {i.connected ? "Conectado" : "Não conectado"}
                </span>
              </div>
              {idx < integrations.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Nenhuma chave de API, token ou senha é armazenada nesta tela.
        </p>
      </SectionCard>
    </div>
  );
}
