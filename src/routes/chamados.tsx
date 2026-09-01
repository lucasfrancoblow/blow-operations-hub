import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/hub/primitives";
import { TaskPriorityBadge } from "@/components/hub/badges";
import { TaskDetailSheet } from "@/components/hub/tasks/TaskDetailSheet";
import { TaskComments } from "@/components/hub/tasks/TaskComments";
import { STATUS_DOT } from "@/components/hub/tasks/TaskColumn";
import { UNASSIGNED_PROJECT_ID } from "@/components/hub/tasks/ProjectSwitcher";
import { canAccessPage } from "@/lib/page-access";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { getMyProfileFn } from "@/services/auth-service";
import { listProjectsFn } from "@/services/tasks-service";
import { createTicketFn, listTicketsFn, updateTicketDetailsFn } from "@/services/tickets-service";
import type { Ticket } from "@/types/tickets";

export const Route = createFileRoute("/chamados")({
  beforeLoad: ({ context }) => {
    if (!canAccessPage(context.user, "chamados")) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    ticket: typeof search["ticket"] === "string" ? (search["ticket"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chamados — hubLOw BLOW" },
      {
        name: "description",
        content: "Abertura e acompanhamento de chamados técnicos.",
      },
    ],
  }),
  component: ChamadosPage,
});

function ChamadosPage() {
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const { ticket: ticketParam } = Route.useSearch();
  const isAdminLike = user?.role === "admin" || user?.role === "super_admin";

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => listTicketsFn(),
    refetchInterval: 30_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["task-projects"],
    queryFn: () => listProjectsFn(),
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfileFn(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [projectId, setProjectId] = useState(UNASSIGNED_PROJECT_ID);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [autoOpenedFor, setAutoOpenedFor] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTicket) {
      setEditTitle(selectedTicket.task.title);
      setEditDescription(selectedTicket.task.description);
    }
  }, [selectedTicket]);

  // Deep-link do e-mail (/chamados?ticket=7) — mesma lógica de tarefas.tsx.
  useEffect(() => {
    if (!ticketParam || ticketParam === autoOpenedFor) return;
    const found = tickets.find((t) => String(t.ticketNumber) === ticketParam);
    if (found) {
      setSelectedTicket(found);
      setAutoOpenedFor(ticketParam);
    }
  }, [ticketParam, tickets, autoOpenedFor]);

  const updateDetailsMutation = useMutation({
    mutationFn: () =>
      updateTicketDetailsFn({
        data: { id: selectedTicket!.id, title: editTitle.trim(), description: editDescription },
      }),
    onSuccess: () => {
      toast.success("Chamado atualizado.");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (error: Error) => toast.error(`Não foi possível salvar: ${error.message}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTicketFn({
        data: {
          projectId: projectId === UNASSIGNED_PROJECT_ID ? null : projectId,
          title: title.trim(),
          description: description.trim(),
          requesterName: requesterName.trim(),
          requesterEmail: requesterEmail.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Chamado aberto.");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (error: Error) => toast.error(`Não foi possível abrir o chamado: ${error.message}`),
  });

  function openCreate() {
    setProjectId(UNASSIGNED_PROJECT_ID);
    setTitle("");
    setDescription("");
    setRequesterName(profile?.fullName ?? user?.username ?? "");
    setRequesterEmail(profile?.email ?? "");
    setCreateOpen(true);
  }

  const canSubmit = title.trim().length > 0 && requesterName.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chamados"
        subtitle="Abra um chamado técnico — vira uma tarefa dentro da User Story certa na hora."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo chamado
          </Button>
        }
      />

      {!isLoading && tickets.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="h-5 w-5" />}
          title="Nenhum chamado ainda"
          description="Abra o primeiro chamado pra começar a acompanhar por aqui."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo chamado
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>User Story</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Aberto em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelectedTicket(t)}>
                <TableCell className="font-medium">
                  <span className="text-muted-foreground">#{t.ticketNumber}</span> {t.task.title}
                </TableCell>
                <TableCell>{t.task.project?.name ?? "Sem User Story"}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[t.task.status])} />
                    {t.task.status}
                  </span>
                </TableCell>
                <TableCell>{t.requesterName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>User Story</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_PROJECT_ID}>Sem User Story</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-title">Assunto</Label>
              <Input
                id="ticket-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumo do problema"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-description">Descrição</Label>
              <Textarea
                id="ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes, prints, links..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-name">Seu nome</Label>
                <Input
                  id="ticket-name"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-email">Seu e-mail</Label>
                <Input
                  id="ticket-email"
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
            >
              Abrir chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdminLike ? (
        <TaskDetailSheet
          task={selectedTicket?.task ?? null}
          open={selectedTicket !== null}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
        />
      ) : (
        <Sheet
          open={selectedTicket !== null}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
        >
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="text-left">Chamado #{selectedTicket?.ticketNumber}</SheetTitle>
              <SheetDescription className="text-left">
                Você pode ajustar o assunto e a descrição — o resto (status, prioridade, responsável
                etc.) é atualizado pelo time.
              </SheetDescription>
            </SheetHeader>
            {selectedTicket && (
              <div className="space-y-4 px-4 pb-8">
                <div className="flex items-center gap-2">
                  <span
                    className={cn("h-2 w-2 rounded-full", STATUS_DOT[selectedTicket.task.status])}
                  />
                  <span className="text-sm font-medium">{selectedTicket.task.status}</span>
                  <TaskPriorityBadge value={selectedTicket.task.priority} />
                </div>
                {selectedTicket.task.project && (
                  <p className="text-xs text-muted-foreground">
                    User Story: {selectedTicket.task.project.name}
                  </p>
                )}
                {selectedTicket.task.assignee && (
                  <p className="text-xs text-muted-foreground">
                    Responsável: {displayName(selectedTicket.task.assignee)}
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="ticket-edit-title">Assunto</Label>
                  <Input
                    id="ticket-edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-edit-description">Descrição</Label>
                  <Textarea
                    id="ticket-edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={5}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => updateDetailsMutation.mutate()}
                  disabled={!editTitle.trim() || updateDetailsMutation.isPending}
                >
                  Salvar
                </Button>

                <TaskComments taskId={selectedTicket.task.id} />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
