import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Zap } from "lucide-react";

import { loginFn } from "@/services/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search["redirect"];
    return typeof redirect === "string" ? { redirect } : {};
  },
  head: () => ({ meta: [{ title: "Entrar — hubLOw BLOW" }] }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => loginFn({ data: { username, password } }),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await router.invalidate();
      await navigate({ to: redirect ?? "/" });
    },
  });

  const error = mutation.isError
    ? "Não foi possível entrar agora. Tente de novo em instantes."
    : mutation.data && !mutation.data.ok
      ? mutation.data.error
      : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    mutation.mutate();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 surface-grid">
      <Card className="w-full max-w-sm border-border/60 bg-card shadow-lg">
        <CardContent className="pt-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">hubLOw</p>
              <p className="text-xs text-muted-foreground">Operações BLOW</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="lucas.franco"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-critical">{error}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Sem acesso? Peça pro admin criar seu usuário.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
