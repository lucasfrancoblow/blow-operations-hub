import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plug } from "lucide-react";

import { hubService, queryKeys } from "@/services/hub-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, KeyValue, PageHeader } from "@/components/hub/primitives";
import { SystemStatusBadge } from "@/components/hub/badges";
import type { Integration } from "@/types/hub";

export const Route = createFileRoute("/sistemas")({
  head: () => ({
    meta: [
      { title: "Sistemas e integrações — hubLOw BLOW" },
      {
        name: "description",
        content:
          "Status dos sistemas integrados às automações da BLOW: n8n, Make, PipeRun, Google Ads e mais.",
      },
      { property: "og:title", content: "Sistemas e integrações — hubLOw BLOW" },
      {
        property: "og:description",
        content: "Monitore dependências, incidentes e última verificação de cada sistema.",
      },
    ],
  }),
  component: SystemsPage,
});

function SystemsPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.integrations,
    queryFn: hubService.listIntegrations,
  });
  const [selected, setSelected] = useState<Integration | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistemas e integrações"
        subtitle="Dependências externas das automações BLOW"
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<Plug className="h-5 w-5" />} title="Nenhum sistema cadastrado" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(data ?? []).map((s) => (
            <Card key={s.id} className="border-border/70 bg-card/70">
              <CardContent className="flex h-full flex-col gap-3 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                  </div>
                  <SystemStatusBadge value={s.status} />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{s.dependentAutomations} automações dependentes</p>
                  <p>{s.openIncidents} incidentes abertos</p>
                  <p>
                    Última verificação: {new Date(s.lastCheck).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto"
                  onClick={() => setSelected(s)}
                >
                  Ver detalhes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <KeyValue label="Status" value={<SystemStatusBadge value={selected.status} />} />
                <KeyValue label="Categoria" value={selected.category} />
                <KeyValue label="Ambiente" value={selected.environment} />
                <KeyValue label="Responsável" value={selected.owner} />
                <KeyValue label="Automações dependentes" value={selected.dependentAutomations} />
                <KeyValue label="Incidentes abertos" value={selected.openIncidents} />
                <KeyValue
                  label="Última verificação"
                  value={new Date(selected.lastCheck).toLocaleString("pt-BR")}
                />
              </div>
              {/* Futuro: health check real via API de cada sistema */}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
