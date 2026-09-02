import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { displayName } from "@/lib/display-name";
import { createCommentFn, deleteCommentFn, listCommentsFn } from "@/services/task-comments-service";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskComments({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["task-comments", taskId];
  const [body, setBody] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listCommentsFn({ data: { taskId } }),
  });

  const createMutation = useMutation({
    mutationFn: () => createCommentFn({ data: { taskId, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(`Não foi possível comentar: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCommentFn({ data: { id, taskId } }),
    onSuccess: () => {
      setPendingDeleteId(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      setPendingDeleteId(null);
      toast.error(`Não foi possível excluir o comentário: ${error.message}`);
    },
  });

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-foreground">Comentários</label>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando comentários...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => (
            <div key={c.id} className="group rounded-lg border border-border/60 bg-muted/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{displayName(c.author)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </span>
                  <button
                    type="button"
                    aria-label="Excluir comentário"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-critical group-hover:opacity-100"
                    onClick={() => setPendingDeleteId(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={3}
        />
        <Button
          type="button"
          size="sm"
          disabled={!body.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Comentar
        </Button>
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Só o comentário é apagado — a tarefa e o resto da conversa continuam intactos. Essa
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-critical text-critical-foreground hover:bg-critical/90"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
            >
              Excluir comentário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
