import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('KSK IDE uses a persistent route and keeps manual KSK behind the page', async () => {
  const [routes, page, accountManager, accountHeader, accountCard, accountListView, accountTable, app, layout] = await Promise.all([
    readFile(new URL('../../../routes.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../AccountManager/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../AccountManager/AccountHeader.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../AccountManager/AccountCard.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../AccountManager/AccountListView.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../AccountManager/AccountTable.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../Layout/index.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(routes, /id: 'kskIde'/)
  assert.match(routes, /platforms: \['windows'\]/)
  assert.match(app, /availableRoutes/)
  assert.match(layout, /availableRoutes/)
  assert.match(page, /startKskIdeFromAccount/)
  assert.match(page, /高级入口：使用已有 KSK 手工启动/)
  assert.doesNotMatch(page, /DialogRoot/)
  assert.doesNotMatch(accountManager, /KskIsolatedIdeModal|showKskIdeModal/)
  assert.match(accountManager, /emit\('accounts-updated'\)/)
  for (const source of [accountManager, accountHeader, accountCard, accountListView, accountTable]) {
    assert.match(source, /isKskIdeSupported/)
  }
})

test('KSK IDE requires an explicit account selection before managed launch', async () => {
  const page = await readFile(new URL('./index.tsx', import.meta.url), 'utf8')

  assert.match(page, /if \(!selectedAccountId\) return/)
  assert.doesNotMatch(page, /const firstEligible/)
  assert.match(page, /!selectedAccount\s*\|\|\s*!selectedAccount\.eligibility\.eligible/)
})

test('KSK IDE exposes the shared Kiro executable path setting', async () => {
  const page = await readFile(new URL('./index.tsx', import.meta.url), 'utf8')

  assert.match(page, /checkIdeInstallation/)
  assert.match(page, /getCustomKiroPath/)
  assert.match(page, /setCustomKiroPath/)
  assert.match(page, /clearCustomKiroPath/)
  assert.match(page, /选择 Kiro\.exe/)
  assert.match(page, /恢复自动检测/)
})
