import { expect, test } from 'claude-code/testing'

import { classify } from './register'

test('risky commands', () => {
  for (const c of ['rm -rf /tmp/x', 'rm -fr build', 'rm -r -f dir', 'rm --recursive x', 'git push --force origin main', 'git push -f', 'git reset --hard HEAD~1', 'git clean -fd', 'psql -c "DROP TABLE users"', 'dd if=/dev/zero of=/dev/sda']) {
    expect(classify(c)).toBe('risky')
  }
})

test('noisy commands are noisy unless capped', () => {
  expect(classify('cat big.log')).toBe('noisy')
  expect(classify('ls -R')).toBe('noisy')
  expect(classify('npm test')).toBe('noisy')
  expect(classify('cat big.log | head -50')).toBe('ok')
  expect(classify('git log --oneline')).toBe('ok')
})

test('ordinary commands pass', () => {
  for (const c of ['ls -la', 'git status', 'go build ./...', 'rm file.txt', 'echo hi']) expect(classify(c)).toBe('ok')
})
