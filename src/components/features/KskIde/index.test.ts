import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('KSK IDE uses a persistent route and keeps manual KSK behind the page', async () => {
  const [routes, page, accountManager] = await Promise.all([
    readFile(new URL('../../../routes.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../AccountManager/index.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(routes, /id: 'kskIde'/)
  assert.match(page, /startKskIdeFromAccount/)
  assert.match(page, /高级入口：使用已有 KSK 手工启动/)
  assert.doesNotMatch(page, /DialogRoot/)
  assert.doesNotMatch(accountManager, /KskIsolatedIdeModal|showKskIdeModal/)
  assert.match(accountManager, /emit\('accounts-updated'\)/)
})
