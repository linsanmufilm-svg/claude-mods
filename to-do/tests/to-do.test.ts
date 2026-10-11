import { describe, expect, test } from 'claude-code/testing'

import { applyCall } from '../hooks/tasks'

const PANE = {
  component: 'Pane',
  requestId: 'to-do',
  props: {
    title: 'To-do',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

describe('applyCall', () => {
  test('follows a task from created to done, and drops a deleted one', async () => {
    let list = applyCall([], 'TaskCreate', { subject: 'Write tests' }, { task: { id: '1', subject: 'Write tests' } })
    list = applyCall(list, 'TaskCreate', { subject: 'Ship' }, { task: { id: '2', subject: 'Ship' } })
    expect(list.map(i => i.status)).toEqual(['pending', 'pending'])

    list = applyCall(list, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: true })
    expect(list[0]?.status).toBe('completed')

    list = applyCall(list, 'TaskUpdate', { taskId: '2', status: 'deleted' }, { success: true })
    expect(list.map(i => i.subject)).toEqual(['Write tests'])
  })

  test('TodoWrite replaces its own list and keeps the tasks', async () => {
    let list = applyCall([], 'TaskCreate', { subject: 'A task' }, { task: { id: '7', subject: 'A task' } })
    list = applyCall(list, 'TodoWrite', { todos: [{ content: 'Old', status: 'pending', activeForm: 'x' }] }, {})
    list = applyCall(
      list,
      'TodoWrite',
      {
        todos: [
          { content: 'Read', status: 'completed', activeForm: 'Reading' },
          { content: 'Write', status: 'in_progress', activeForm: 'Writing' },
        ],
      },
      {},
    )
    expect(list.map(i => `${i.subject}:${i.status}`)).toEqual(['A task:pending', 'Read:completed', 'Write:in_progress'])
  })

  test('a failed update leaves the list alone', async () => {
    const list = applyCall([], 'TaskCreate', { subject: 'A' }, { task: { id: '1', subject: 'A' } })
    expect(applyCall(list, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: false })).toEqual(list)
  })
})

test('the pane lists pending and completed tasks on every surface', async ($, on) => {
  let next = 0
  on('tool.call', { tool: 'TaskCreate' }, async () => ({ result: { task: { id: String(++next), subject: '' } } }))
  on('tool.call', { tool: 'TaskUpdate' }, async ($, e) => ({
    result: { success: true, taskId: e.taskId, updatedFields: ['status'] },
  }))

  await $.tool.call({ tool: 'TaskCreate', subject: 'Draft the outline', description: '' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Send the cut', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'to-do', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /完成 1\/2/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /○ Send the cut/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✓ Draft the outline/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the pane says so when there are no tasks', async $ => {
  const ui = await $.ui.mount({ plugin: 'to-do', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /還沒有任務/ })).toBeDefined()
  await ui.unmount()
})
