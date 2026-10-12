import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

export const HOME = '/home/tester'
export const SESSION = 'session-a'
export const pathFor = (session: string): string => `${HOME}/.claude/to-do/sessions/${session}.json`
export const SAVED_PATH = pathFor(SESSION)

/**
 * Answers `$.fs` from files held in memory, `HOME`, and the session's id
 * (`session.current` names it; change it to stand for another session).
 * Returns the files, so a test can read what was written.
 */
export function fakeFs(
  on: On,
  files: Record<string, string> = {},
  session: { current: string } = { current: SESSION },
): Record<string, string> {
  mock.env(on, { HOME })
  on('session.id', async () => ({ value: session.current }))
  on('fs.exists', async ($, e) => ({ value: e.path in files }))
  on('fs.read', async ($, e) => {
    const text = files[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('fs.write', async ($, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  return files
}
