import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const editModal = await readFile(new URL('./EditAccountModal.tsx', import.meta.url), 'utf8')
const groupTagManager = await readFile(new URL('./GroupTagManager.tsx', import.meta.url), 'utf8')
const tagSelectorStart = groupTagManager.indexOf('export function TagSelector')
const tagSelectorEnd = groupTagManager.indexOf('// 标签管理弹窗')
assert.ok(tagSelectorStart >= 0, 'TagSelector export should exist')
assert.ok(tagSelectorEnd > tagSelectorStart, 'TagSelector block should be isolated')
const tagSelector = groupTagManager.slice(tagSelectorStart, tagSelectorEnd)

assert.match(editModal, /grid grid-cols-1 md:grid-cols-2 gap-3[\s\S]*border-border[\s\S]*bg-muted\/20/)
assert.doesNotMatch(editModal, /<GroupSelector[\s\S]*?compact[\s\S]*?\/>/)
assert.match(editModal, /const inputClass = `flex-1 px-4 py-2\.5 border rounded-xl/)
assert.match(tagSelector, /className=\{`w-full px-4 py-2\.5 border rounded-xl/)
assert.match(editModal, /<Tag size=\{14\} \/>[\s\S]*?\{t\('tags\.title'\) \|\| '标签'\}/)
assert.doesNotMatch(tagSelector, /tags\.title/)
assert.doesNotMatch(tagSelector, /tags\.hint/)
assert.doesNotMatch(editModal, /<TagSelector[\s\S]*?compact[\s\S]*?\/>/)
assert.doesNotMatch(tagSelector, /compact/)
assert.match(tagSelector, /\{selectedTagIds\.length > 0 && \(/)
assert.doesNotMatch(tagSelector, /tags\.noTags/)
assert.doesNotMatch(tagSelector, /min-h-\[/)

console.log('EditAccountModal keeps group/tag compact without an empty tag placeholder row')
