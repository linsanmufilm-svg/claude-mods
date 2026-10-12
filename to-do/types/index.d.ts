export type TodoStatus = 'pending' | 'in_progress' | 'completed'

/** One task, from the TaskCreate/TaskUpdate tools (`task`) or TodoWrite (`todo`). */
export type TodoItem = {
  id: string
  subject: string
  status: TodoStatus
  source: 'task' | 'todo'
}

/** A to-do the person asked for; kept with the session. */
export type NoteItem = {
  id: string
  text: string
  isDone: boolean
}

/** A part of a conversation the person pinned; kept with the session. */
export type PinItem = {
  id: string
  title: string
  body: string
}

/** What the mod keeps per session in ~/.claude/to-do/sessions/<session id>.json. */
export type Saved = {
  notes: NoteItem[]
  pins: PinItem[]
}

declare module 'claude-code' {
  interface PluginState {
    'to-do': {
      items: TodoItem[]
      saved: Saved
      expanded: string[]
      /** Whether the pane shows its folded list of finished items. */
      showDone: boolean
    }
  }
}
