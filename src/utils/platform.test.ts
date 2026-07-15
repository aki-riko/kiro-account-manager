import assert from 'node:assert/strict'
import test from 'node:test'

import { detectDesktopPlatform, isKskIdeSupported } from './platform'

test('detectDesktopPlatform recognizes supported desktop webviews', () => {
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32'), 'windows')
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel'), 'macos')
  assert.equal(detectDesktopPlatform('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), 'linux')
  assert.equal(detectDesktopPlatform('', ''), 'unknown')
})

test('KSK IDE is only supported on Windows', () => {
  assert.equal(isKskIdeSupported('windows'), true)
  assert.equal(isKskIdeSupported('macos'), false)
  assert.equal(isKskIdeSupported('linux'), false)
  assert.equal(isKskIdeSupported('unknown'), false)
})
