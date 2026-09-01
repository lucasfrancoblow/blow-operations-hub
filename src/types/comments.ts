// Espelha supabase/migrations/0018_create_task_comments.sql.

import type { TaskAssignee } from "@/types/tasks";

export interface TaskComment {
  id: string;
  taskId: string;
  author: TaskAssignee | null;
  body: string;
  createdAt: string;
}
