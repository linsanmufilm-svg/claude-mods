import type { TodoStatus } from '../types'

export type Labels = {
  sections: Record<TodoStatus, string>
  progress: (done: number, total: number) => string
  empty: [string, string]
  none: string
  notes: string
  pins: string
  tasks: string
  added: (id: string, text: string) => string
  pinned: (id: string, title: string) => string
  logged: (id: string, text: string) => string
  clearDone: string
  nothingSelected: string
  usage: string
}

const LABELS: Record<'zh' | 'en', Labels> = {
  zh: {
    sections: { in_progress: '進行中', pending: '待辦', completed: '已完成' },
    progress: (done, total) => `完成 ${done}/${total}`,
    empty: ['還沒有任務。', '跟 Claude 說「加一個待辦：…」或「把…釘選起來」，或等 Claude 排出任務。'],
    none: '（無）',
    notes: '我的待辦',
    pins: '釘選',
    tasks: 'Claude 的任務',
    added: (id, text) => `已加入待辦 ${id}：${text}`,
    pinned: (id, title) => `已釘選 ${id}：${title}`,
    logged: (id, text) => `已記進已完成 ${id}：${text}`,
    clearDone: '清除已完成的待辦',
    nothingSelected: '沒有選取的文字。先在對話裡選取要釘選的段落，或直接跟 Claude 說「把…釘選起來」。',
    usage: '用法：/to-do（打開窗格）、/to-do add <待辦>、/to-do pin [標題]（釘選目前選取的文字）',
  },
  en: {
    sections: { in_progress: 'In progress', pending: 'Pending', completed: 'Completed' },
    progress: (done, total) => `${done}/${total} done`,
    empty: ['No tasks yet.', 'Ask Claude to "add a to-do: …" or "pin …", or wait for Claude to plan tasks.'],
    none: '(none)',
    notes: 'My to-dos',
    pins: 'Pinned',
    tasks: "Claude's tasks",
    added: (id, text) => `Added to-do ${id}: ${text}`,
    pinned: (id, title) => `Pinned ${id}: ${title}`,
    logged: (id, text) => `Logged as done ${id}: ${text}`,
    clearDone: 'Clear finished to-dos',
    nothingSelected: 'Nothing is selected. Select a part of the conversation first, or ask Claude to "pin …".',
    usage: 'Usage: /to-do (open the pane), /to-do add <to-do>, /to-do pin [title] (pin the selected text)',
  },
}

/** The labels for the `language` option; anything but `en` reads as Chinese. */
export const labelsFor = (language: unknown): Labels => (language === 'en' ? LABELS.en : LABELS.zh)
