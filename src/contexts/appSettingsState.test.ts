import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeAppSettings, persistAppSettingsUpdate } from './appSettingsState'

interface TestSettings {
  browserIncognito: boolean
  browserPath: string
}

const defaults: TestSettings = {
  browserIncognito: true,
  browserPath: '',
}

test('persistAppSettingsUpdate returns a deterministic merged snapshot after saving', async () => {
  const savedUpdates: Array<Partial<TestSettings>> = []
  const current = { browserIncognito: true, browserPath: 'chrome.exe' }

  const next = await persistAppSettingsUpdate(
    current,
    defaults,
    { browserIncognito: false },
    async (updates) => { savedUpdates.push(updates) },
  )

  assert.deepEqual(savedUpdates, [{ browserIncognito: false }])
  assert.deepEqual(next, { browserIncognito: false, browserPath: 'chrome.exe' })
  assert.deepEqual(current, { browserIncognito: true, browserPath: 'chrome.exe' })
})

test('persistAppSettingsUpdate rejects without producing a success snapshot when saving fails', async () => {
  await assert.rejects(
    persistAppSettingsUpdate(
      defaults,
      defaults,
      { browserIncognito: false },
      async () => { throw new Error('save failed') },
    ),
    /save failed/,
  )
})

test('mergeAppSettings uses defaults when no settings have loaded yet', () => {
  assert.deepEqual(
    mergeAppSettings(null, defaults, { browserPath: 'edge.exe' }),
    { browserIncognito: true, browserPath: 'edge.exe' },
  )
})
