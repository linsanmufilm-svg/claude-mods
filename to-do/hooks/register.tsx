import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, ToolCallResult } from 'claude-code'

import type { Saved, TodoItem, TodoStatus } from '../types'
import { labelsFor } from './labels'
import type { Labels } from './labels'
import { EMPTY, addNote, addPin, clearDone, describe, has, parseSaved, remove, setDone } from './saved'
import { TASK_TOOLS, applyCall } from './tasks'

const PANE = 'to-do'
const TITLE = 'To-do'
const items = atom({ plugin: 'to-do', key: 'items' } as const, [])
const saved = atom({ plugin: 'to-do', key: 'saved' } as const, EMPTY)
const expanded = atom({ plugin: 'to-do', key: 'expanded' } as const, [])
const showDone = atom({ plugin: 'to-do', key: 'showDone' } as const, false)

const SECTIONS: { status: TodoStatus; mark: string; color?: string }[] = [
  { status: 'in_progress', mark: '▸', color: 'warning' },
  { status: 'pending', mark: '○' },
  { status: 'completed', mark: '✓', color: 'success' },
]

// The tools Claude calls to change the person's own list, served below as
// mcp__to-do__<name>. Each only touches that list, so they run without asking.
const TOOL_SPECS = [
  {
    name: 'add_todo',
    description:
      "Add a to-do to the person's own list in the To-do side pane. Use it when the person asks you to add, " +
      'note or remember something they need to do. The list belongs to this session.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: "The to-do, short, in the person's own words and language." },
      },
      required: ['text'],
    },
    isDeferred: false,
  },
  {
    name: 'pin',
    description:
      'Pin an important part of this conversation to the To-do side pane, so the person can find it again ' +
      'without scrolling back; kept with this session. Use it when the person asks to pin, save or bookmark ' +
      'something said in the conversation (a recommendation, a decision, a command, a list).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: "A short name for what is pinned, in the person's language." },
        body: {
          type: 'string',
          description:
            'The pinned content itself in Markdown, faithful to what was said: keep names, commands, links ' +
            'and numbers. The person reads this instead of the conversation, so give the substance, not a ' +
            'pointer to it.',
        },
      },
      required: ['title', 'body'],
    },
    isDeferred: false,
  },
  {
    name: 'update_item',
    description:
      'Change an item in the To-do side pane by its id (n1, n2 … for to-dos, p1, p2 … for pins, as add_todo, ' +
      'pin and list_items report them): mark a to-do done or not done, or remove a to-do or a pin.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        action: { type: 'string', enum: ['done', 'undone', 'remove'] },
      },
      required: ['id', 'action'],
    },
    isDeferred: false,
  },
  {
    name: 'log_done',
    description:
      "Record a piece of work you finished for the person in the To-do side pane's completed list " +
      "(this session's). Call it once per finished request, as the system prompt describes.",
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: "What was done, one short line in the person's language (e.g. 「把 to-do mod 推上 GitHub」).",
        },
      },
      required: ['text'],
    },
    isDeferred: false,
  },
  {
    name: 'list_items',
    description: "List the person's saved to-dos and pins in the To-do side pane, with their ids.",
    inputSchema: { type: 'object', properties: {} },
    isDeferred: false,
  },
]

// What the model reads so the completed list fills itself: added to the
// system prompt while the autoLog option is on and log_done is offered.
const AUTO_LOG = {
  id: 'to-do:auto-log',
  scope: 'session',
  text: [
    '# To-do pane',
    "The person keeps a To-do side pane. Its completed list should show the work you finished for them, without their asking:",
    '- When you finish something the person asked for (a change made, a thing installed, set up, written, published, or researched and reported back), call mcp__to-do__log_done once with one short line in the person\'s language saying what was done, before your final reply. One call per finished request, not one per step.',
    "- If what you finished is one of the person's own open to-dos (mcp__to-do__list_items lists them), mark that to-do done with mcp__to-do__update_item instead of logging a new line.",
    '- Do not log answers to simple questions, plans not yet carried out, or work that failed or was left unfinished.',
  ].join('\n'),
} as const

// Opens the pane; where no surface can show one, there is nothing to do.
function openPane($: EngineInterface): void {
  $.ui.open({ id: PANE, title: TITLE }).catch(() => {})
}

// Each session has its own to-dos and pins: one file per session, named by
// the session's id (its transcript's name), which a resumed session keeps.
async function savedPath($: EngineInterface): Promise<string> {
  const home = await $.env.get('HOME')
  if (!home) throw new Error('HOME is not set: nowhere to keep the to-do list')
  return `${home}/.claude/to-do/sessions/${await $.session.id()}.json`
}

async function writeSaved($: EngineInterface, value: Saved): Promise<void> {
  await $.fs.write(await savedPath($), `${JSON.stringify(value, null, 2)}\n`)
}

/** Reads this session's list. A file that does not parse rejects rather than reads as empty, so it is never overwritten. */
async function loadSaved($: EngineInterface): Promise<Saved> {
  const path = await savedPath($)
  return (await $.fs.exists(path)) ? parseSaved(JSON.parse(await $.fs.read(path))) : EMPTY
}

/**
 * Applies a change to this session's to-dos and pins, read fresh from its
 * file so the state never drifts from what is saved.
 */
async function changeSaved($: EngineInterface, change: (s: Saved) => Saved): Promise<Saved> {
  const after = change(await loadSaved($))
  await writeSaved($, after)
  await update($, saved, () => after)
  return after
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

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

async function addTodo($: EngineInterface, labels: Labels, text: string, isDone = false): Promise<string> {
  let id = ''
  await changeSaved($, s => {
    const added = addNote(s, text, isDone)
    id = added.note.id
    return added.saved
  })
  openPane($)
  return isDone ? labels.logged(id, text) : labels.added(id, text)
}

async function pinText($: EngineInterface, labels: Labels, title: string, body: string): Promise<string> {
  let id = ''
  await changeSaved($, s => {
    const added = addPin(s, title, body)
    id = added.pin.id
    return added.saved
  })
  openPane($)
  return labels.pinned(id, title)
}

export const register: Register = (on, options) => {
  const labels = labelsFor(options.language)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'to-do',
      description: 'Show the To-do pane; add a to-do or pin the selected text',
      argumentHint: 'add <to-do> | pin [title]',
    })
    try {
      for (const spec of TOOL_SPECS) await $.tool.register(spec)
    } catch {
      // Without the tools the pane still shows Claude's tasks and the saved list.
    }

    try {
      const loaded = await loadSaved($)
      await update($, saved, () => loaded)
    } catch {
      // A file that does not parse: the pane starts empty and the file is
      // left alone until it is fixed.
    }

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
    // A /clear starts a new session, with a list of its own.
    if (e.reason === 'clear') {
      await update($, items, () => [])
      await update($, saved, () => EMPTY)
      await update($, expanded, () => [])
      await update($, showDone, () => false)
    }

    return next(e)
  })

  on('command.run', { command: 'to-do' }, async ($, e) => {
    const args = e.args.trim()
    const [verb = '', ...rest] = args.split(/\s+/)
    const tail = args.slice(verb.length).trim()

    if (args === '') {
      await $.ui.open({ id: PANE, title: TITLE })
      return { text: 'To-do pane opened.' }
    }
    if (verb === 'add' && tail !== '') return { text: await addTodo($, labels, tail) }
    if (verb === 'pin') {
      const selected = await $.ui.selection().catch(() => undefined)
      const body = selected?.text.trim() ?? ''
      if (body === '') return { text: labels.nothingSelected }
      const firstLine = body.split('\n')[0] ?? body
      const title = rest.length > 0 ? tail : firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine
      return { text: await pinText($, labels, title, body) }
    }

    return { text: labels.usage }
  })

  // Claude's own task tools. Each call runs first, then what it answered is
  // folded into the list. The hooks never refuse a call: the list is a view,
  // so a failure passes it on.
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

  // The mod's own tools.
  on('tool.call', { tool: 'mcp__to-do__add_todo' }, async ($, e) => {
    const text = str(e.text)
    if (text === '') return { result: 'Nothing added: text is empty.' }
    return { result: await addTodo($, labels, text) }
  }).catch(() => ({ result: 'The To-do pane could not save this; nothing changed.' }))
  on('tool.call', { tool: 'mcp__to-do__log_done' }, async ($, e) => {
    const text = str(e.text)
    if (text === '') return { result: 'Nothing logged: text is empty.' }
    return { result: await addTodo($, labels, text, true) }
  }).catch(() => ({ result: 'The To-do pane could not save this; nothing changed.' }))
  on('tool.call', { tool: 'mcp__to-do__pin' }, async ($, e) => {
    const title = str(e.title)
    const body = str(e.body)
    if (title === '' || body === '') return { result: 'Nothing pinned: title and body are both needed.' }
    return { result: await pinText($, labels, title, body) }
  }).catch(() => ({ result: 'The To-do pane could not save this; nothing changed.' }))
  on('tool.call', { tool: 'mcp__to-do__update_item' }, async ($, e) => {
    const id = str(e.id)
    const action = str(e.action)
    const before = await loadSaved($)
    if (!has(before, id)) return { result: `No item ${id}.\n${describe(before)}` }
    if (action === 'remove') await changeSaved($, s => remove(s, id))
    else if (action === 'done' || action === 'undone') await changeSaved($, s => setDone(s, id, action === 'done'))
    else return { result: `Unknown action ${action}: use done, undone or remove.` }
    return { result: `${id}: ${action}.` }
  }).catch(() => ({ result: 'The To-do pane could not save this; nothing changed.' }))
  on('tool.call', { tool: 'mcp__to-do__list_items' }, async $ => ({ result: describe(await loadSaved($)) })).catch(
    () => ({ result: 'The To-do list could not be read.' }),
  )

  // These tools change only the mod's own list: let them run without a prompt.
  on('tool.check', { tool: 'mcp__to-do__add_todo' }, () => ({ decision: 'allow' }))
  on('tool.check', { tool: 'mcp__to-do__log_done' }, () => ({ decision: 'allow' }))
  on('tool.check', { tool: 'mcp__to-do__pin' }, () => ({ decision: 'allow' }))

  // The completed list fills itself: the model is told to log what it finishes.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (options.autoLog === false || !e.tools.includes('mcp__to-do__log_done')) return composed
    return { sections: [...composed.sections, AUTO_LOG] }
  })
  on('tool.check', { tool: 'mcp__to-do__update_item' }, () => ({ decision: 'allow' }))
  on('tool.check', { tool: 'mcp__to-do__list_items' }, () => ({ decision: 'allow' }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const list = await read($, items)
    const { notes, pins } = await read($, saved)
    const open = await read($, expanded)
    const isDoneShown = await read($, showDone)

    if (list.length === 0 && notes.length === 0 && pins.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{labels.empty[0]}</Text>
          <Text dimColor>{labels.empty[1]}</Text>
        </Box>
      )
    }

    const done = list.filter(item => item.status === 'completed').length
    const sections: RenderChildren[] = []

    if (pins.length > 0) {
      sections.push(
        <Box key="pins" flexDirection="column">
          <Text bold color="claude">
            📌 {labels.pins} ({pins.length})
          </Text>
          {pins.map(p => {
            const isOpen = open.includes(p.id)
            return (
              <Box key={`pin-${p.id}`} flexDirection="column">
                <Box flexDirection="row" justifyContent="space-between">
                  <Button
                    key={`open-${p.id}`}
                    plain
                    onPress={() =>
                      update($, expanded, ids => (ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id]))
                    }
                  >
                    {isOpen ? '▾' : '▸'} {p.title}
                  </Button>
                  <Button key={`unpin-${p.id}`} plain dimColor label="×" onPress={() => changeSaved($, s => remove(s, p.id))} />
                </Box>
                {isOpen && (
                  <Box marginLeft={2} marginBottom={1}>
                    <Markdown text={p.body} />
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>,
      )
    }

    const openNotes = notes.filter(n => !n.isDone)
    const doneNotes = notes.filter(n => n.isDone)
    const doneTasks = list.filter(item => item.status === 'completed')

    if (openNotes.length > 0) {
      sections.push(
        <Box key="notes" flexDirection="column">
          <Text bold>
            {labels.notes} ({openNotes.length})
          </Text>
          {openNotes.map(n => (
            <Box key={`note-${n.id}`} flexDirection="row" justifyContent="space-between">
              <Button key={`toggle-${n.id}`} plain onPress={() => changeSaved($, s => setDone(s, n.id, true))}>
                ☐ {n.text}
              </Button>
              <Button key={`remove-${n.id}`} plain dimColor label="×" onPress={() => changeSaved($, s => remove(s, n.id))} />
            </Box>
          ))}
        </Box>,
      )
    }

    if (list.length > 0) {
      sections.push(
        <Box key="tasks" flexDirection="column">
          <Text bold>
            {labels.tasks} · {labels.progress(done, list.length)}
          </Text>
          {SECTIONS.filter(section => section.status !== 'completed').map(section => {
            const rows = list.filter(item => item.status === section.status)
            if (rows.length === 0 && section.status === 'in_progress') return null

            return (
              <Box key={section.status} flexDirection="column" marginTop={1}>
                <Text bold color={section.color}>
                  {labels.sections[section.status]} ({rows.length})
                </Text>
                {rows.length === 0 && <Text dimColor>{labels.none}</Text>}
                {rows.map(item => (
                  <Text key={item.id} color={section.color}>
                    {section.mark} {item.subject}
                  </Text>
                ))}
              </Box>
            )
          })}
        </Box>,
      )
    }

    // Everything finished, the person's to-dos and Claude's tasks alike, in one
    // list that stays folded until it is opened.
    const doneCount = doneNotes.length + doneTasks.length
    if (doneCount > 0) {
      sections.push(
        <Box key="done" flexDirection="column">
          <Button key="done-toggle" plain onPress={() => update($, showDone, isShown => !isShown)}>
            {isDoneShown ? '▾' : '▸'} <Text color="success">✓ {labels.sections.completed}</Text> ({doneCount})
          </Button>
          {isDoneShown && (
            <Box flexDirection="column" marginLeft={2}>
              {doneNotes.map(n => (
                <Box key={`note-${n.id}`} flexDirection="row" justifyContent="space-between">
                  <Button
                    key={`toggle-${n.id}`}
                    plain
                    dimColor
                    onPress={() => changeSaved($, s => setDone(s, n.id, false))}
                  >
                    ☑ {n.text}
                  </Button>
                  <Button key={`remove-${n.id}`} plain dimColor label="×" onPress={() => changeSaved($, s => remove(s, n.id))} />
                </Box>
              ))}
              {doneTasks.map(item => (
                <Text key={item.id} dimColor>
                  ✓ {item.subject}
                </Text>
              ))}
              {doneNotes.length > 0 && (
                <Box marginTop={1}>
                  <Button key="clear-done" plain dimColor onPress={() => changeSaved($, clearDone)}>
                    {labels.clearDone}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>,
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {sections}
      </Box>
    )
  })
}
