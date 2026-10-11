import type { TodoStatus } from '../types'

export type Labels = {
  sections: Record<TodoStatus, string>
  progress: (done: number, total: number) => string
  empty: [string, string]
  none: string
}

const LABELS: Record<'zh' | 'en', Labels> = {
  zh: {
    sections: { in_progress: '進行中', pending: '待辦', completed: '已完成' },
    progress: (done, total) => `完成 ${done}/${total}`,
    empty: ['還沒有任務。', 'Claude 排出任務後會列在這裡。'],
    none: '（無）',
  },
  en: {
    sections: { in_progress: 'In progress', pending: 'Pending', completed: 'Completed' },
    progress: (done, total) => `${done}/${total} done`,
    empty: ['No tasks yet.', 'Tasks Claude plans will show up here.'],
    none: '(none)',
  },
}

/** The labels for the `language` option; anything but `en` reads as Chinese. */
export const labelsFor = (language: unknown): Labels => (language === 'en' ? LABELS.en : LABELS.zh)
