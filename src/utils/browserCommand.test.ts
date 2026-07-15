import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBrowserSelectionCommand } from './browserCommand'

test('detected browser selection preserves fixed and private arguments', () => {
  const command = resolveBrowserSelectionCommand({
    path: 'C:\\Browsers\\browser.exe',
    command: '"C:\\Browsers\\browser.exe" "--profile-directory=Portable User" --incognito',
  })

  assert.equal(command, '"C:\\Browsers\\browser.exe" "--profile-directory=Portable User" --incognito')
})

test('legacy detected browser without command falls back to the quoted path', () => {
  assert.equal(
    resolveBrowserSelectionCommand({ path: 'C:\\Program Files\\Browser\\browser.exe' }),
    '"C:\\Program Files\\Browser\\browser.exe"',
  )
})
