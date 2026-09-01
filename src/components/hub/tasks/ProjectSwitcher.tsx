import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listActiveUsersFn } from "@/services/auth-service";
import {
  createProjectFn,
  grantProjectAccessFn,
  listProjectMembersFn,
  revokeProjectAccessFn,
  updateProjectFn,
} from "@/services/tasks-service";
import type { TaskProject } from "@/types/tasks";

export const UNASSIGNED_PROJECT_ID = "none";

export const PROJECT_COLORS = [
  { id: "orange", label: "Laranja", dot: "bg-primary" },
  { id: "info", label: "Azul", dot: "bg-info" },
  { id: "success", label: "Verde", dot: "bg-success" },
  { id: "warning", label: "Amarelo", dot: "bg-warning" },
  { id: "critical", label: "Vermelho", dot: "bg-critical" },
  { id: "neutral", label: "Cinza", dot: "bg-muted-foreground" },
] as const;

export function projectColorDot(color: string): string {
  return PROJECT_COLORS.find((c) => c.id === color)?.dot ?? "bg-muted-foreground";
}

const PROJECTS_QUERY_KEY = ["task-projects"];

export function ProjectSwitcher({
  projects,
  selected,
  onSelect,
  canManageAccess,
}: {
  projects: TaskProject[];
  selected: string;
  onSelect: (id: string) => void;
  /** Só super_admin gerencia quem vê qual projeto — "admin" não. */
  canManageAccess: boolean;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TaskProject | null>(null);
  const [accessTarget, setAccessTarget] = useState<TaskProject | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0].id);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: () => createProjectFn({ data: { name: name.trim(), color } }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
    },
    onError: (error: Error) => toast.error(`Não foi possível criar a User Story: ${error.message}`),
  });

  const renameMutation = useMutation({
    mutationFn: () =>
      updateProjectFn({ data: { id: renameTarget!.id, patch: { name: name.trim() } } }),
    onSuccess: () => {
      invalidate();
      setRenameTarget(null);
    },
    onError: (error: Error) => toast.error(`Não foi possível renomear: ${error.message}`),
  });

  const archiveMutation = useMutation({
    mutationFn: (project: TaskProject) =>
      updateProjectFn({ data: { id: project.id, patch: { archived: !project.archived } } }),
    onSuccess: invalidate,
    onError: (error: Error) =>
      toast.error(`Não foi possível atualizar a User Story: ${error.message}`),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: () => listActiveUsersFn(),
    enabled: accessTarget !== null,
  });

  const { data: memberIds = [] } = useQuery({
    queryKey: ["project-access", accessTarget?.id],
    queryFn: () => listProjectMembersFn({ data: { projectId: accessTarget!.id } }),
    enabled: accessTarget !== null,
  });

  const accessMutation = useMutation({
    mutationFn: ({ userId, grant }: { userId: string; grant: boolean }) =>
      grant
        ? grantProjectAccessFn({ data: { projectId: accessTarget!.id, userId } })
        : revokeProjectAccessFn({ data: { projectId: accessTarget!.id, userId } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["project-access", accessTarget?.id] }),
    onError: (error: Error) => toast.error(`Não foi possível atualizar o acesso: ${error.message}`),
  });

  const visibleProjects = projects.filter((p) => !p.archived || p.id === selected);

  function openCreateDialog() {
    setName("");
    setColor(PROJECT_COLORS[0].id);
    setCreateOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => onSelect(UNASSIGNED_PROJECT_ID)}
          className={cn(
            "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            selected === UNASSIGNED_PROJECT_ID
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Sem User Story
        </button>

        {visibleProjects.map((project) => (
          <div key={project.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect(project.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                selected === project.id
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                project.archived && "opacity-60",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", projectColorDot(project.color))} />
              {project.name}
              {project.archived && <span className="text-[10px]">(arquivado)</span>}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "-ml-1 h-6 w-6 shrink-0",
                    selected === project.id ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameTarget(project);
                    setName(project.name);
                  }}
                >
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => archiveMutation.mutate(project)}>
                  {project.archived ? "Reativar" : "Arquivar"}
                </DropdownMenuItem>
                {canManageAccess && (
                  <DropdownMenuItem onClick={() => setAccessTarget(project)}>
                    Gerenciar acesso
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova User Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                      color === c.id ? "border-foreground" : "border-transparent",
                    )}
                    aria-label={c.label}
                  >
                    <span className={cn("h-4 w-4 rounded-full", c.dot)} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
            >
              Criar User Story
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear User Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="project-rename">Nome</Label>
            <Input
              id="project-rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => renameMutation.mutate()}
              disabled={!name.trim() || renameMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accessTarget !== null} onOpenChange={(open) => !open && setAccessTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quem vê "{accessTarget?.name}"</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Oculto por padrão — marque quem, além do super admin, pode ver esta User Story.
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {users.map((u) => {
              const checked = memberIds.includes(u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      accessMutation.mutate({ userId: u.id, grant: value === true })
                    }
                  />
                  <span className="text-sm">{displayName(u)}</span>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
