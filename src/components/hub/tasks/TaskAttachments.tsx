import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, ImageIcon, Loader2, Paperclip, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/display-name";
import {
  confirmAttachmentFn,
  createAttachmentUploadFn,
  deleteAttachmentFn,
  getAttachmentUrlFn,
  listAttachmentsFn,
} from "@/services/task-attachments-service";
import type { TaskAttachment } from "@/types/tasks";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function openAttachment(attachmentId: string) {
  try {
    const url = await getAttachmentUrlFn({ data: { attachmentId } });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    toast.error(`Não foi possível abrir o anexo: ${(error as Error).message}`);
  }
}

function AttachmentThumbnail({ attachment }: { attachment: TaskAttachment }) {
  const isImage = attachment.contentType.startsWith("image/");
  const { data: previewUrl } = useQuery({
    queryKey: ["task-attachment-preview", attachment.id],
    queryFn: () => getAttachmentUrlFn({ data: { attachmentId: attachment.id } }),
    enabled: isImage,
    staleTime: 4 * 60 * 1000,
  });

  if (isImage && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={attachment.fileName}
        className="h-9 w-9 shrink-0 rounded-md object-cover"
      />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
      {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
    </span>
  );
}

function AttachmentRow({
  attachment,
  onDelete,
  deleting,
}: {
  attachment: TaskAttachment;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/60 p-2.5">
      <button type="button" onClick={() => openAttachment(attachment.id)} className="shrink-0">
        <AttachmentThumbnail attachment={attachment} />
      </button>
      <button
        type="button"
        onClick={() => openAttachment(attachment.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(attachment.sizeBytes)}
          {attachment.uploadedBy ? ` · ${displayName(attachment.uploadedBy)}` : ""}
        </p>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-critical"
        disabled={deleting}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryKey = ["task-attachments", taskId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listAttachmentsFn({ data: { taskId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttachmentFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(`Não foi possível excluir: ${error.message}`),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const contentType = file.type || "application/octet-stream";
        const { storagePath, uploadUrl } = await createAttachmentUploadFn({
          data: { taskId, fileName: file.name, contentType, sizeBytes: file.size },
        });
        const putResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!putResponse.ok) throw new Error(`Upload falhou (HTTP ${putResponse.status})`);
        await confirmAttachmentFn({
          data: { taskId, storagePath, fileName: file.name, contentType, sizeBytes: file.size },
        });
      }
      invalidate();
    } catch (error) {
      toast.error(`Não foi possível anexar o arquivo: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Anexos</label>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando anexos...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo ainda.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              deleting={deleteMutation.isPending}
              onDelete={() => deleteMutation.mutate(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
