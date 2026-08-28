import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { KeyRound, UserPen } from "lucide-react";
import { toast } from "sonner";

import {
  createUserFn,
  listUsersFn,
  resetPasswordFn,
  setUserActiveFn,
  setUserPageAccessFn,
  setUserProfileFn,
  setUserRoleFn,
} from "@/services/auth-service";
import {
  grantProjectAccessFn,
  listProjectsFn,
  listUserProjectAccessFn,
  revokeProjectAccessFn,
} from "@/services/tasks-service";
import type { UserRole } from "@/lib/auth";
import { PAGE_KEYS, PAGE_LABELS, type PageKey } from "@/lib/page-access";
import { PageHeader, SectionCard } from "@/components/hub/primitives";
import { FadeIn } from "@/components/hub/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/usuarios")({
  beforeLoad: ({ context }) => {
    if (context.user?.role !== "super_admin") {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Usuários — hubLOw BLOW" }] }),
  component: UsuariosPage,
});

const USERS_QUERY_KEY = ["auth", "users"];

function UsuariosPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => listUsersFn(),
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [profileTarget, setProfileTarget] = useState<{
    id: string;
    username: string;
    role: UserRole;
    pageAccess: string[];
  } | null>(null);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createUserFn({ data: { username, password, role, fullName, email, phone } }),
    onSuccess: () => {
      toast.success(`Usuário "${username}" criado.`);
      setUsername("");
      setPassword("");
      setRole("member");
      setFullName("");
      setEmail("");
      setPhone("");
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (input: { id: string; active: boolean }) => setUserActiveFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  const pageAccessMutation = useMutation({
    mutationFn: (input: { id: string; pageAccess: string[] }) =>
      setUserPageAccessFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  function togglePageAccess(key: PageKey, checked: boolean) {
    if (!profileTarget) return;
    const next = checked
      ? [...profileTarget.pageAccess, key]
      : profileTarget.pageAccess.filter((p) => p !== key);
    setProfileTarget({ ...profileTarget, pageAccess: next });
    pageAccessMutation.mutate({ id: profileTarget.id, pageAccess: next });
  }

  // Abas: só member/external têm restrição (admin sempre vê todas). Projetos:
  // todo mundo que não é super_admin é restrito — inclusive admin agora.
  const showsPageAccessSection =
    profileTarget?.role === "member" || profileTarget?.role === "external";
  const showsProjectAccessSection = profileTarget != null && profileTarget.role !== "super_admin";

  const { data: allProjects = [] } = useQuery({
    queryKey: ["task-projects"],
    queryFn: () => listProjectsFn(),
    enabled: showsProjectAccessSection,
  });

  const { data: memberProjectIds = [] } = useQuery({
    queryKey: ["user-project-access", profileTarget?.id],
    queryFn: () => listUserProjectAccessFn({ data: { userId: profileTarget!.id } }),
    enabled: showsProjectAccessSection,
  });

  const projectAccessMutation = useMutation({
    mutationFn: ({ projectId, grant }: { projectId: string; grant: boolean }) =>
      grant
        ? grantProjectAccessFn({ data: { projectId, userId: profileTarget!.id } })
        : revokeProjectAccessFn({ data: { projectId, userId: profileTarget!.id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["user-project-access", profileTarget?.id] }),
    onError: (error: Error) => toast.error(`Não foi possível atualizar o acesso: ${error.message}`),
  });

  const changeRoleMutation = useMutation({
    mutationFn: (input: { id: string; role: UserRole }) => setUserRoleFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetPasswordFn({ data: { id: resetTarget!.id, password: newPassword } }),
    onSuccess: () => {
      toast.success(`Senha de "${resetTarget?.username}" redefinida.`);
      setResetTarget(null);
      setNewPassword("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      setUserProfileFn({
        data: {
          id: profileTarget!.id,
          fullName: profileFullName,
          email: profileEmail,
          phone: profilePhone,
        },
      }),
    onSuccess: () => {
      toast.success(`Contato de "${profileTarget?.username}" atualizado.`);
      setProfileTarget(null);
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        subtitle="Só quem tem conta criada aqui entra no hub — sem cadastro público, sem e-mail."
      />

      <FadeIn className="space-y-6">
        <SectionCard title="Novo usuário">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Usuário</Label>
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nome.sobrenome"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-fullname">Nome</Label>
              <Input
                id="new-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">E-mail</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pra receber notificações"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-phone">Telefone</Label>
              <Input
                id="new-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Senha inicial</Label>
              <Input
                id="new-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="defina uma senha"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="external">Externo</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                Criar
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Contas existentes">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Abas liberadas</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.username}
                      {(u.fullName || u.email) && (
                        <p className="text-xs font-normal text-muted-foreground">
                          {[u.fullName, u.email].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(role) =>
                          changeRoleMutation.mutate({ id: u.id, role: role as UserRole })
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="external">Externo</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_admin">Super admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.active}
                        onCheckedChange={(active) =>
                          toggleActiveMutation.mutate({ id: u.id, active })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {u.role === "admin" || u.role === "super_admin"
                          ? "Todas (papel)"
                          : `${u.pageAccess.length} aba${u.pageAccess.length === 1 ? "" : "s"}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProfileTarget({
                            id: u.id,
                            username: u.username,
                            role: u.role,
                            pageAccess: u.pageAccess,
                          });
                          setProfileFullName(u.fullName ?? "");
                          setProfileEmail(u.email ?? "");
                          setProfilePhone(u.phone ?? "");
                        }}
                      >
                        <UserPen className="mr-1.5 h-3.5 w-3.5" />
                        Editar perfil
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResetTarget({ id: u.id, username: u.username });
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                        Redefinir senha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </FadeIn>

      <Dialog open={resetTarget !== null} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha de {resetTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="reset-password">Nova senha</Label>
            <Input
              id="reset-password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={!newPassword || resetPasswordMutation.isPending}
            >
              Salvar nova senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileTarget !== null}
        onOpenChange={(open) => !open && setProfileTarget(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar perfil de {profileTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-fullname">Nome</Label>
              <Input
                id="profile-fullname"
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input
                id="profile-email"
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Telefone</Label>
              <Input
                id="profile-phone"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => profileMutation.mutate()}
              disabled={profileMutation.isPending}
            >
              Salvar contato
            </Button>
          </div>

          {showsPageAccessSection && (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <Label>Abas que ele vê</Label>
              {PAGE_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={profileTarget?.pageAccess.includes(key) ?? false}
                    onCheckedChange={(checked) => togglePageAccess(key, checked === true)}
                  />
                  <span className="text-sm">{PAGE_LABELS[key]}</span>
                </label>
              ))}
            </div>
          )}

          {showsProjectAccessSection && (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <Label>Projetos de Tarefas que ele vê</Label>
              {allProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum projeto criado ainda.</p>
              ) : (
                allProjects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={memberProjectIds.includes(project.id)}
                      onCheckedChange={(checked) =>
                        projectAccessMutation.mutate({
                          projectId: project.id,
                          grant: checked === true,
                        })
                      }
                    />
                    <span className="text-sm">{project.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
