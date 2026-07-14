import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url)

test('application and documentation do not expose donation surfaces', async () => {
  const sources = await Promise.all([
    readFile(new URL('../features/About/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./WelcomeModal.tsx', import.meta.url), 'utf8'),
    readFile(repoFile('locales/zh-CN.json'), 'utf8'),
    readFile(repoFile('locales/en.json'), 'utf8'),
    readFile(repoFile('locales/ru.json'), 'utf8'),
    readFile(repoFile('README.md'), 'utf8'),
    readFile(repoFile('README_EN.md'), 'utf8'),
    readFile(repoFile('README_RU.md'), 'utf8'),
  ])

  for (const source of sources) {
    assert.doesNotMatch(source, /assets\/donate|about\.donate|welcome\.buyMeCoffee/i)
  }
  await assert.rejects(access(repoFile('src/assets/donate/alipay.jpg')))
  await assert.rejects(access(repoFile('src/assets/donate/wechat.jpg')))
})
