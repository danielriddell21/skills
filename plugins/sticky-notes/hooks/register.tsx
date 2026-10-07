import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Task } from '../types'

const PANE = 'sticky'
const tasks = atom({ plugin: 'sticky-notes', key: 'tasks' } as const, [])
const TOOL = 'mcp__sticky-notes__tasks'

export type TaskInput = { action: string; text?: string; id?: number }

/** Apply a tool action to the list; list/unknown actions leave it unchanged. */
export const applyTask = (list: Task[], input: TaskInput): Task[] => {
  if (input.action === 'add' && input.text?.trim()) {
    const id = list.reduce((m, t) => Math.max(m, t.id), 0) + 1
    return [...list, { id, text: input.text.trim(), isDone: false }]
  }
  if (input.action === 'done') return list.map(t => (t.id === input.id ? { ...t, isDone: true } : t))
  return list
}

export const renderTasks = (list: Task[]): string =>
  list.map(t => `${t.isDone ? '[x]' : '[ ]'} ${t.id} ${t.text}`).join('\n') || '(empty)'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sticky', description: 'Open the task checklist pane' })
    await $.tool.register({
      name: 'tasks',
      description: 'Shared checklist with the user. action: add (text) | done (id) | list. Keep items short.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'done', 'list'] },
          text: { type: 'string' },
          id: { type: 'number' },
        },
        required: ['action'],
      },
    })
    return next(e)
  })

  on('command.run', { command: 'sticky' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Tasks' })
    return { text: 'Tasks pane opened.' }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = e as unknown as TaskInput
    const list = await update($, tasks, l => applyTask(l, input))
    const out = renderTasks(list)
    return { result: out }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const list = await read($, tasks)
    const done = list.filter(t => t.isDone).length

    return (
      <Box flexDirection="column">
        <Text bold color="blue">
          ◌ Sticky notes{list.length > 0 ? `  ${done}/${list.length} done` : ''}
        </Text>
        <Text dimColor>{'─'.repeat(40)}</Text>
        {list.length === 0 && <Text dimColor>Nothing yet. Add a note below, or ask Claude to keep a checklist.</Text>}
        {list.map(t => (
          <Box key={`t${t.id}`}>
            <Text color={t.isDone ? 'green' : undefined} dimColor={t.isDone} strikethrough={t.isDone}>
              {t.isDone ? '☑' : '☐'} {t.text}
              {'  '}
            </Text>
            {!t.isDone && (
              <Button
                key={`d${t.id}`}
                label="Done"
                onPress={() => update($, tasks, l => l.map(x => (x.id === t.id ? { ...x, isDone: true } : x)))}
              />
            )}
          </Box>
        ))}
        <Text> </Text>
        <Input
          key="add"
          label="add a note:"
          placeholder="then Enter"
          submitLabel="add"
          onSubmit={text => update($, tasks, l => applyTask(l, { action: 'add', text }))}
        />
        {done > 0 && <Button key="clear" label="Clear done" onPress={() => update($, tasks, l => l.filter(x => !x.isDone))} />}
      </Box>
    )
  })
}
