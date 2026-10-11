import type { TodoItem, TodoStatus } from '../types'

/** The tools whose calls change the task list. */
export const TASK_TOOLS = ['TaskCreate', 'TaskUpdate', 'TaskList', 'TodoWrite'] as const

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null
const isStatus = (v: unknown): v is TodoStatus =>
  v === 'pending' || v === 'in_progress' || v === 'completed'
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/**
 * Folds one answered call into the list. `input` is what the model sent,
 * `result` the tool's record; a call that errored leaves the list as it was.
 */
export function applyCall(
  list: readonly TodoItem[],
  tool: string,
  input: Rec,
  result: unknown,
): TodoItem[] {
  const tasks = list.filter(item => item.source === 'task')
  const todos = list.filter(item => item.source === 'todo')

  switch (tool) {
    case 'TaskCreate': {
      const task = isRec(result) && isRec(result.task) ? result.task : undefined
      const id = str(task?.id)
      if (!id) return [...list]
      const subject = str(input.subject) ?? str(task?.subject) ?? id
      return [...list, { id: `task:${id}`, subject, status: 'pending', source: 'task' }]
    }
    case 'TaskUpdate': {
      if (isRec(result) && result.success === false) return [...list]
      const id = `task:${str(input.taskId) ?? ''}`
      if (input.status === 'deleted') return list.filter(item => item.id !== id)
      return list.map(item =>
        item.id === id
          ? {
              ...item,
              subject: str(input.subject) ?? item.subject,
              status: isStatus(input.status) ? input.status : item.status,
            }
          : item,
      )
    }
    case 'TaskList': {
      const listed = isRec(result) && Array.isArray(result.tasks) ? result.tasks : undefined
      if (!listed) return [...list]
      const fresh: TodoItem[] = listed.filter(isRec).flatMap(task => {
        const id = str(task.id)
        if (!id || !isStatus(task.status)) return []
        return [{ id: `task:${id}`, subject: str(task.subject) ?? id, status: task.status, source: 'task' as const }]
      })
      return [...fresh, ...todos]
    }
    case 'TodoWrite': {
      const written = Array.isArray(input.todos) ? input.todos : undefined
      if (!written) return [...list]
      const fresh: TodoItem[] = written.filter(isRec).flatMap((todo, i) => {
        const subject = str(todo.content)
        if (!subject || !isStatus(todo.status)) return []
        return [{ id: `todo:${i}`, subject, status: todo.status, source: 'todo' as const }]
      })
      return [...tasks, ...fresh]
    }
    default:
      return [...list]
  }
}
