import { createServerFn } from "@tanstack/react-start";

import { requireTasksAccess } from "@/lib/session";
import { callClaudeJson } from "@/lib/claude-client";
import { TASK_PRIORITIES, type TaskPriority } from "@/types/tasks";

interface TaskContextInput {
  title: string;
  description?: string | undefined;
}

function contextPrompt(input: TaskContextInput): string {
  return `Título da tarefa: ${input.title}\nDescrição: ${input.description || "(sem descrição)"}`;
}

export const suggestSubtasksFn = createServerFn({ method: "POST" })
  .validator((input: TaskContextInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    const result = await callClaudeJson<{ subtasks: string[] }>({
      system:
        "Você ajuda um time de operações a quebrar tarefas técnicas em subtarefas pequenas e acionáveis. Responda em português, com títulos curtos e diretos.",
      prompt: `Sugira de 3 a 6 subtarefas para esta tarefa:\n\n${contextPrompt(data)}`,
      schema: {
        type: "object",
        properties: {
          subtasks: { type: "array", items: { type: "string" } },
        },
        required: ["subtasks"],
        additionalProperties: false,
      },
    });
    return result.subtasks;
  });

export const suggestPriorityFn = createServerFn({ method: "POST" })
  .validator((input: TaskContextInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    return callClaudeJson<{ priority: TaskPriority; justification: string }>({
      system: `Você ajuda um time de operações a priorizar tarefas técnicas. Escolha uma prioridade entre exatamente estes valores: ${TASK_PRIORITIES.join(", ")}. Justifique em 1 frase curta, em português.`,
      prompt: `Sugira a prioridade desta tarefa:\n\n${contextPrompt(data)}`,
      schema: {
        type: "object",
        properties: {
          priority: { type: "string", enum: TASK_PRIORITIES },
          justification: { type: "string" },
        },
        required: ["priority", "justification"],
        additionalProperties: false,
      },
      maxTokens: 300,
    });
  });

export const summarizeTaskFn = createServerFn({ method: "POST" })
  .validator((input: TaskContextInput) => input)
  .handler(async ({ data }) => {
    await requireTasksAccess();
    const result = await callClaudeJson<{ summary: string }>({
      system:
        "Você resume tarefas técnicas de um time de operações em 1 a 2 frases curtas e objetivas, em português.",
      prompt: `Resuma esta tarefa:\n\n${contextPrompt(data)}`,
      schema: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
        additionalProperties: false,
      },
      maxTokens: 200,
    });
    return result.summary;
  });
