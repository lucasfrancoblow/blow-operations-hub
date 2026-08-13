import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { KeyValue } from "@/components/hub/primitives";
import { validarLead } from "@/services/leads-recentes-service";
import type { LeadRecente } from "@/lib/leads-recentes";

function formatCurrency(value: number): string {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadRecente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [observacao, setObservacao] = useState("");
  const [validadoPor, setValidadoPor] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { dealId: number; validadoPor: string; observacao?: string | undefined }) =>
      validarLead({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piperun", "leads-recentes"] });
      setObservacao("");
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {lead && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-left text-lg">{lead.title}</DialogTitle>
              <DialogDescription className="text-left">
                {lead.pipelineName} · {lead.stageName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <KeyValue label="Responsável" value={lead.ownerName} />
                <KeyValue label="Origem" value={lead.origin} />
                <KeyValue label="Status" value={lead.status} />
                <KeyValue label="Valor" value={formatCurrency(lead.value)} />
                <KeyValue
                  label="Criado em"
                  value={new Date(lead.createdAt.replace(" ", "T")).toLocaleString("pt-BR")}
                />
                <KeyValue
                  label="Validação"
                  value={
                    lead.validado ? (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conferido
                        {lead.validadoPor ? ` por ${lead.validadoPor}` : ""}
                      </span>
                    ) : (
                      "Pendente"
                    )
                  }
                />
              </div>

              {lead.observacao && (
                <>
                  <Separator />
                  <section>
                    <h4 className="text-sm font-semibold">Observação registrada</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{lead.observacao}</p>
                  </section>
                </>
              )}

              {!lead.validado && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold">Marcar como conferido</h4>
                    <Input
                      value={validadoPor}
                      onChange={(e) => setValidadoPor(e.target.value)}
                      placeholder="Seu nome"
                    />
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Observação (opcional) — ex: parece teste, telefone inválido, duplicado..."
                      rows={3}
                    />
                    <Button
                      className="w-full"
                      disabled={!validadoPor.trim() || mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          dealId: lead.id,
                          validadoPor: validadoPor.trim(),
                          observacao: observacao.trim() || undefined,
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {mutation.isPending ? "Salvando..." : "Confirmar validação"}
                    </Button>
                    {mutation.isError && (
                      <p className="text-sm text-critical">
                        Não deu pra salvar: {(mutation.error as Error).message}
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
