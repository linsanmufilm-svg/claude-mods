import type { NoteItem, PinItem, Saved } from '../types'

export const EMPTY: Saved = { notes: [], pins: [] }

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Reads what `$.store` held, dropping anything that is not a note or a pin. */
export function parseSaved(raw: unknown): Saved {
  if (!isRec(raw)) return EMPTY
  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter(
        (n): n is NoteItem =>
          isRec(n) && typeof n.id === 'string' && typeof n.text === 'string' && typeof n.isDone === 'boolean',
      )
    : []
  const pins = Array.isArray(raw.pins)
    ? raw.pins.filter(
        (p): p is PinItem =>
          isRec(p) && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.body === 'string',
      )
    : []
  return { notes, pins }
}

/** The next id after the highest one with this prefix: n1, n2 … or p1, p2 … */
function nextId(prefix: 'n' | 'p', ids: readonly string[]): string {
  const top = ids.reduce((max, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(1)) : NaN
    return Number.isInteger(n) && n > max ? n : max
  }, 0)
  return `${prefix}${top + 1}`
}

export function addNote(saved: Saved, text: string, isDone = false): { saved: Saved; note: NoteItem } {
  const note: NoteItem = { id: nextId('n', saved.notes.map(n => n.id)), text, isDone }
  return { saved: { ...saved, notes: [...saved.notes, note] }, note }
}

export function addPin(saved: Saved, title: string, body: string): { saved: Saved; pin: PinItem } {
  const pin: PinItem = { id: nextId('p', saved.pins.map(p => p.id)), title, body }
  return { saved: { ...saved, pins: [...saved.pins, pin] }, pin }
}

export function setDone(saved: Saved, id: string, isDone: boolean): Saved {
  return { ...saved, notes: saved.notes.map(n => (n.id === id ? { ...n, isDone } : n)) }
}

export function remove(saved: Saved, id: string): Saved {
  return { notes: saved.notes.filter(n => n.id !== id), pins: saved.pins.filter(p => p.id !== id) }
}

/** Drops every ticked to-do; pins and open to-dos stay. */
export function clearDone(saved: Saved): Saved {
  return { ...saved, notes: saved.notes.filter(n => !n.isDone) }
}

export const has = (saved: Saved, id: string): boolean =>
  saved.notes.some(n => n.id === id) || saved.pins.some(p => p.id === id)

/** The saved list as the model reads it from list_items. */
export function describe(saved: Saved): string {
  if (saved.notes.length === 0 && saved.pins.length === 0) return 'No saved to-dos or pins.'
  const lines: string[] = []
  if (saved.notes.length > 0) {
    lines.push('To-dos:')
    for (const n of saved.notes) lines.push(`- ${n.id} [${n.isDone ? 'x' : ' '}] ${n.text}`)
  }
  if (saved.pins.length > 0) {
    lines.push('Pins:')
    for (const p of saved.pins) lines.push(`- ${p.id} ${p.title}`)
  }
  return lines.join('\n')
}
