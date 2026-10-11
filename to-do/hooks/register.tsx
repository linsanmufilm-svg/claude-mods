import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { TodoItem, TodoStatus } from '../types'
import { TASK_TOOLS, applyCall } from './tasks'

const PANE = 'to-do'
const TITLE = 'To-do'
const items = atom({ plugin: 'to-do', key: 'items' } as const, [])

const SECTIONS: { status: TodoStatus; label: string; mark: string; color?: string }[] = [
  { status: 'in_progress', label: '進行中', mark: '▸', color: 'warning' },
  { status: 'pending', label: '待辦', mark: '○' },
  { status: 'completed', label: '已完成', mark: '✓', color: 'success' },
]

// Opens the pane; where no surface can show one, there is nothing to do.
function openPane($: EngineInterface): void {
  $.ui.open({ id: PANE, title: TITLE }).catch(() => {})
}

async function record(
  $: EngineInterface,
  call: { readonly tool: string },
  ran: ToolCallResult,
): Promise<void> {
  if ('deny' in ran && ran.deny !== undefined) return
  if (ran.isError) return
  try {
    let wasEmpty = false
    await update($, items, list => {
      wasEmpty = list.length === 0
      return applyCall(list, call.tool, call as Record<string, unknown>, ran.result)
    })
    if (wasEmpty && (await read($, items)).length > 0) openPane($)
  } catch {
    // Keep the tool's result whatever became of the list.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'to-do',
      description: 'Show the task list (done and pending) in a side pane',
    })

    // Rebuild the list from the transcript, so a resumed session or a reload
    // of this mod shows the tasks made before it loaded.
    try {
      let list: TodoItem[] = []
      let found = false
      for (const message of await $.session.messages()) {
        for (const use of message.toolUses) {
          if (!(TASK_TOOLS as readonly string[]).includes(use.tool) || use.isError) continue
          found = true
          list = applyCall(list, use.tool, use.input, use.result)
        }
      }
      if (found) await update($, items, () => list)
    } catch {
      // No transcript to read: start from what the state holds.
    }

    openPane($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, items, () => [])

    return next(e)
  })

  on('command.run', { command: 'to-do' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'To-do pane opened.' }
  })

  // Each call runs first, then what it answered is folded into the list. The
  // hooks never refuse a call: the list is a view, so a failure passes it on.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    await record($, e, ran)
    return ran
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    await record($, e, ran)
    return ran
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'TaskList' }, async ($, e, next) => {
    const ran = await next(e)
    await record($, e, ran)
    return ran
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    // A subagent's TodoWrite is its own list, not the session's.
    if (!e.agentId) await record($, e, ran)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, items)

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>還沒有任務。</Text>
          <Text dimColor>Claude 排出任務後會列在這裡。</Text>
        </Box>
      )
    }

    const done = list.filter(item => item.status === 'completed').length

    return (
      <Box flexDirection="column">
        <Text bold>
          完成 {done}/{list.length}
        </Text>
        {SECTIONS.map(section => {
          const rows = list.filter(item => item.status === section.status)
          if (rows.length === 0 && section.status === 'in_progress') return null
          const isDone = section.status === 'completed'

          return (
            <Box key={section.status} flexDirection="column" marginTop={1}>
              <Text bold color={section.color}>
                {section.label} ({rows.length})
              </Text>
              {rows.length === 0 && <Text dimColor>（無）</Text>}
              {rows.map(item => (
                <Text key={item.id} dimColor={isDone} color={isDone ? undefined : section.color}>
                  {section.mark} {item.subject}
                </Text>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })
}
