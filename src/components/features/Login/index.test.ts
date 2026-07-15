import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_BROWSER_INCOGNITO,
  isPrivateBrowserLoginBlocked,
  persistBrowserIncognitoPreference,
} from '../../../utils/browserPreference'

test('private browser preference defaults to enabled', () => {
  assert.equal(DEFAULT_BROWSER_INCOGNITO, true)
})

test('successful preference save keeps the requested value', async () => {
  const updates: Array<{ browserIncognito: boolean }> = []
  const result = await persistBrowserIncognitoPreference(
    true,
    false,
    async (next) => {
      updates.push(next)
      return { browserIncognito: false }
    },
  )

  assert.deepEqual(updates, [{ browserIncognito: false }])
  assert.deepEqual(result, { saved: true, value: false })
})

test('failed preference save rolls back to the previous value', async () => {
  const result = await persistBrowserIncognitoPreference(
    true,
    false,
    async () => null,
  )

  assert.deepEqual(result, { saved: false, value: true })
})

test('private login is blocked while capability is loading or unsupported', () => {
  assert.equal(isPrivateBrowserLoginBlocked(true, null, true), true)
  assert.equal(isPrivateBrowserLoginBlocked(true, false, false), true)
  assert.equal(isPrivateBrowserLoginBlocked(true, true, false), false)
  assert.equal(isPrivateBrowserLoginBlocked(false, false, false), false)
})
