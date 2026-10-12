import { describe, expect, mock, test } from 'claude-code/testing'

import { SAVED_PATH, fakeFs, pathFor } from './fake-fs'

import { EMPTY, addNote, addPin, describe as describeSaved, parseSaved, remove, setDone } from '../hooks/saved'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

const PANE = {
  component: 'Pane',
  requestId: 'to-do',
  props: {
    title: 'To-do',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

describe('saved list', () => {
  test('ids count up per kind and survive a removal', async () => {
    let s = addNote(EMPTY, 'one').saved
    s = addNote(s, 'two').saved
    s = addPin(s, 'A pin', 'body').saved
    expect(s.notes.map(n => n.id)).toEqual(['n1', 'n2'])
    expect(s.pins.map(p => p.id)).toEqual(['p1'])

    s = remove(s, 'n1')
    expect(addNote(s, 'three').note.id).toBe('n3')
  })

  test('done flips only the named to-do', async () => {
    let s = addNote(addNote(EMPTY, 'a').saved, 'b').saved
    s = setDone(s, 'n2', true)
    expect(s.notes.map(n => n.isDone)).toEqual([false, true])
  })

  test('a damaged store reads as what it still holds', async () => {
    expect(parseSaved(undefined)).toEqual(EMPTY)
    expect(parseSaved({ notes: [{ id: 'n1', text: 'ok', isDone: false }, { id: 3 }], pins: 'no' })).toEqual({
      notes: [{ id: 'n1', text: 'ok', isDone: false }],
      pins: [],
    })
  })

  test('the list reads with ids for Claude', async () => {
    const s = addPin(setDone(addNote(EMPTY, 'Reply').saved, 'n1', true), 'Mods', 'x').saved
    expect(describeSaved(s)).toBe('To-dos:\n- n1 [x] Reply\nPins:\n- p1 Mods')
  })
})

test('a to-do Claude adds shows in the pane and ticks and removes from it', async ($, on) => {
  fakeFs(on)
  const added = await $.tool.call({ tool: 'mcp__to-do__add_todo', text: '回覆影展信' })
  expect(added.result).toBe('已加入待辦 n1：回覆影展信')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'to-do', surface, ...PANE })
    expect((await ui.find({ key: 'toggle-n1' }))?.text).toMatch(/☐ 回覆影展信/)
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'to-do', surface: 'terminal', ...PANE })
  await ui.press({ key: 'toggle-n1' })
  // Ticked, it moves into the folded list of finished items.
  expect(await ui.find({ key: 'toggle-n1' })).toBeUndefined()
  expect((await ui.find({ key: 'done-toggle' }))?.text).toMatch(/已完成 \(1\)/)

  await ui.press({ key: 'done-toggle' })
  expect((await ui.find({ key: 'toggle-n1' }))?.text).toMatch(/☑ 回覆影展信/)

  // Unticked, it is a to-do again.
  await ui.press({ key: 'toggle-n1' })
  expect((await ui.find({ key: 'toggle-n1' }))?.text).toMatch(/☐ 回覆影展信/)
  expect(await ui.find({ key: 'done-toggle' })).toBeUndefined()

  await ui.press({ key: 'remove-n1' })
  expect(await ui.find({ key: 'toggle-n1' })).toBeUndefined()
  await ui.unmount()
})

test('a pin opens to its full text in the pane', async ($, on) => {
  fakeFs(on)
  const pinned = await $.tool.call({
    tool: 'mcp__to-do__pin',
    title: '建議安裝的 mods',
    body: '- `claude-transcribe`：影片轉逐字稿\n- `hyperframes-by-heygen`：HTML 轉影片',
  })
  expect(pinned.result).toBe('已釘選 p1：建議安裝的 mods')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'to-do', surface, ...PANE })
    expect((await ui.find({ key: 'open-p1' }))?.text).toMatch(/▸ 建議安裝的 mods/)
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()

    await ui.press({ key: 'open-p1' })
    expect((await ui.find({ key: 'open-p1' }))?.text).toMatch(/▾ 建議安裝的 mods/)
    expect((await ui.find({ type: 'Markdown' }))?.text).toMatch(/claude-transcribe/)

    await ui.press({ key: 'open-p1' })
    await ui.unmount()
  }
})

test('Claude can mark, list and remove items by id', async ($, on) => {
  fakeFs(on)
  await $.tool.call({ tool: 'mcp__to-do__add_todo', text: 'Book flights' })
  await $.tool.call({ tool: 'mcp__to-do__pin', title: 'Decision', body: 'Go with plan B.' })

  expect((await $.tool.call({ tool: 'mcp__to-do__update_item', id: 'n1', action: 'done' })).result).toBe('n1: done.')
  expect((await $.tool.call({ tool: 'mcp__to-do__list_items' })).result).toBe(
    'To-dos:\n- n1 [x] Book flights\nPins:\n- p1 Decision',
  )
  expect((await $.tool.call({ tool: 'mcp__to-do__update_item', id: 'p1', action: 'remove' })).result).toBe(
    'p1: remove.',
  )
  expect(String((await $.tool.call({ tool: 'mcp__to-do__update_item', id: 'p9', action: 'done' })).result)).toMatch(
    /^No item p9\./,
  )
})

test('/to-do add puts a to-do on the list, and pin without a selection says how', async ($, on) => {
  fakeFs(on)
  const added = await $.command.run({ command: 'to-do', args: 'add 買機票', ...RUN })
  expect(added.text).toBe('已加入待辦 n1：買機票')

  const pinned = await $.command.run({ command: 'to-do', args: 'pin', ...RUN })
  expect(pinned.text).toMatch(/沒有選取的文字/)

  const ui = await $.ui.mount({ plugin: 'to-do', surface: 'terminal', ...PANE })
  expect((await ui.find({ key: 'toggle-n1' }))?.text).toMatch(/買機票/)
  await ui.unmount()
})

test('a change keeps what the session had already saved', async ($, on) => {
  fakeFs(on, {
    [SAVED_PATH]: JSON.stringify({ notes: [{ id: 'n1', text: 'Saved earlier', isDone: false }], pins: [] }),
  })
  await $.tool.call({ tool: 'mcp__to-do__add_todo', text: 'From this one' })
  expect((await $.tool.call({ tool: 'mcp__to-do__list_items' })).result).toBe(
    'To-dos:\n- n1 [ ] Saved earlier\n- n2 [ ] From this one',
  )
})

test('work Claude logs lands, ticked, in the folded completed list', async ($, on) => {
  fakeFs(on)
  expect((await $.tool.call({ tool: 'mcp__to-do__log_done', text: '把 to-do mod 推上 GitHub' })).result).toBe(
    '已記進已完成 n1：把 to-do mod 推上 GitHub',
  )

  const ui = await $.ui.mount({ plugin: 'to-do', surface: 'terminal', ...PANE })
  expect(await ui.find({ key: 'toggle-n1' })).toBeUndefined()
  expect((await ui.find({ key: 'done-toggle' }))?.text).toMatch(/已完成 \(1\)/)

  await ui.press({ key: 'done-toggle' })
  expect((await ui.find({ key: 'toggle-n1' }))?.text).toMatch(/☑ 把 to-do mod 推上 GitHub/)

  await ui.press({ key: 'clear-done' })
  expect(await ui.find({ key: 'toggle-n1' })).toBeUndefined()
  expect(await ui.find({ key: 'done-toggle' })).toBeUndefined()
  await ui.unmount()
})

const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['terminal'],
  tools: ['Read', 'mcp__to-do__log_done'],
  outputStyle: null,
  traits: [],
} as const

test('the system prompt tells Claude to log finished work', async ($, on) => {
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'Hi', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections.map(s => s.id)).toEqual(['intro', 'to-do:auto-log'])
  expect(sections[1]?.text).toMatch(/mcp__to-do__log_done/)

  // Not where the tool is not offered (a subagent, say).
  const without = await $.prompt.compose({ ...COMPOSE, tools: ['Read'] })
  expect(without.sections.map(s => s.id)).toEqual(['intro'])
})

test('autoLog off leaves the system prompt alone', { options: { autoLog: false } }, async ($, on) => {
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'Hi', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections.map(s => s.id)).toEqual(['intro'])
})

test("the list is kept in the session's own file, whatever copy of the mod wrote it", async ($, on) => {
  const files = fakeFs(on)
  await $.tool.call({ tool: 'mcp__to-do__add_todo', text: 'Call the lab' })
  await $.tool.call({ tool: 'mcp__to-do__pin', title: 'Plan', body: 'B' })
  expect(JSON.parse(files[SAVED_PATH] ?? 'null')).toEqual({
    notes: [{ id: 'n1', text: 'Call the lab', isDone: false }],
    pins: [{ id: 'p1', title: 'Plan', body: 'B' }],
  })
})

test('each session keeps its own list', async ($, on) => {
  const session = { current: 'session-a' }
  const files = fakeFs(on, {}, session)
  await $.tool.call({ tool: 'mcp__to-do__add_todo', text: 'Only in A' })

  session.current = 'session-b'
  expect((await $.tool.call({ tool: 'mcp__to-do__list_items' })).result).toBe('No saved to-dos or pins.')
  await $.tool.call({ tool: 'mcp__to-do__add_todo', text: 'Only in B' })

  expect(JSON.parse(files[pathFor('session-a')] ?? 'null').notes.map((n: { text: string }) => n.text)).toEqual([
    'Only in A',
  ])
  expect(JSON.parse(files[pathFor('session-b')] ?? 'null').notes.map((n: { text: string }) => n.text)).toEqual([
    'Only in B',
  ])

  // Coming back to A (a resume keeps the id) finds A's list as it was.
  session.current = 'session-a'
  expect((await $.tool.call({ tool: 'mcp__to-do__list_items' })).result).toBe('To-dos:\n- n1 [ ] Only in A')
})

test('a file that does not parse is left alone, not overwritten', async ($, on) => {
  const files = fakeFs(on, { [SAVED_PATH]: '{ broken' })
  const added = await $.tool.call({ tool: 'mcp__to-do__add_todo', text: 'Lost?' })
  expect(added.result).toBe('The To-do pane could not save this; nothing changed.')
  expect(files[SAVED_PATH]).toBe('{ broken')
})
