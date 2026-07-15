import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('login page persists a default-on private browser preference', async () => {
  const [loginPage, settingsContext, browserSettings] = await Promise.all([
    readFile(new URL('./index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../contexts/AppSettingsContext.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../Settings/SettingsGeneral.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(loginPage, /useAppSettings/)
  assert.match(loginPage, /browserIncognito/)
  assert.match(loginPage, /updateSettings\(\{ browserIncognito: checked \}\)/)
  assert.match(loginPage, /<Switch/)
  assert.match(settingsContext, /browserIncognito: true/)
  assert.match(browserSettings, /setBrowserPath\(`"\$\{browser\.path\}"`\)/)
  assert.doesNotMatch(browserSettings, /setBrowserPath\([^\n]*incognitoArg/)
})
