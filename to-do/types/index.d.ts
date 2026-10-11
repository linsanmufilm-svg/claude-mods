export type TodoStatus = 'pending' | 'in_progress' | 'completed'

/** One task, from the TaskCreate/TaskUpdate tools (`task`) or TodoWrite (`todo`). */
export type TodoItem = {
  id: string
  subject: string
  status: TodoStatus
  source: 'task' | 'todo'
}

declare module 'claude-code' {
  interface PluginState {
    'to-do': { items: TodoItem[] }
  }
}
