import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const mainSource = await readFile(new URL('./main.tsx', import.meta.url), 'utf8')
const appSource = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')
const systemApiSource = await readFile(new URL('./api/systemApi.ts', import.meta.url), 'utf8')

assert.doesNotMatch(mainSource, /getCurrentWindow\(\)\.show\(\)/)
assert.doesNotMatch(mainSource, /window\.__TAURI_INTERNALS__\?\.metadata\?\.currentWindow/)
assert.doesNotMatch(mainSource, /invoke\('show_main_window'\)/)
assert.match(appSource, /dismissBootSplash\(\)/)
assert.match(appSource, /showMainWindow\(\)\.catch/)
assert.doesNotMatch(appSource, /invoke\('show_main_window'\)/)
assert.match(systemApiSource, /return invoke\('show_main_window'\)/)

console.log('main window reveal is deferred to App first paint stage')
