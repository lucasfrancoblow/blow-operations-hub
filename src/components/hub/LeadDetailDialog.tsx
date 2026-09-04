import { CheckCircle2, Clock, MessageCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyValue } from "@/components/hub/primitives";
import {
  formatPhoneBR,
  parsePipeRunDate,
  whatsappLink,
  type LeadRecente,
} from "@/lib/leads-recentes";

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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KeyValue
                label="Telefone"
                value={
                  lead.phone ? (
                    <a
                      href={whatsappLink(lead.phone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {formatPhoneBR(lead.phone)}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <KeyValue label="Responsável" value={lead.ownerName} />
              <KeyValue label="Origem" value={lead.origin} />
              <KeyValue label="Status" value={lead.status} />
              <KeyValue label="Valor" value={formatCurrency(lead.value)} />
              <KeyValue
                label="Criado em"
                value={parsePipeRunDate(lead.createdAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              />
              <KeyValue
                label="Progresso"
                value={
                  lead.emAndamento ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Em andamento ({lead.stageName})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warning">
                      <Clock className="h-3.5 w-3.5" /> Novo ({lead.stageName})
                    </span>
                  )
                }
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
