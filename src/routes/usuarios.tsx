import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import {
  createUserFn,
  listUsersFn,
  resetPasswordFn,
  setUserActiveFn,
} from "@/services/auth-service";
import type { UserRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/hub/primitives";
import { FadeIn } from "@/components/hub/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
    if (context.user?.role !== "admin") {
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
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createUserFn({ data: { username, password, role } }),
    onSuccess: () => {
      toast.success(`Usuário "${username}" criado.`);
      setUsername("");
      setPassword("");
      setRole("member");
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (input: { id: string; active: boolean }) => setUserActiveFn({ data: input }),
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
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_1fr_160px_auto]">
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
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
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
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "Admin" : "Membro"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.active}
                        onCheckedChange={(active) =>
                          toggleActiveMutation.mutate({ id: u.id, active })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
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
    </div>
  );
}
