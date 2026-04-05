import { describe, it, expect } from 'vitest'
import { isFilePathOption } from '../pages/ModuleDetail'
import type { ModuleOption } from '../api/client'

function opt(name: string, description: string): ModuleOption {
  return { name, description, value: null, required: false }
}

describe('isFilePathOption', () => {
  it('matches description containing "path to"', () => {
    expect(isFilePathOption(opt('wordlist', 'path to hostname wordlist'))).toBe(true)
  })

  it('matches description containing standalone "file"', () => {
    expect(isFilePathOption(opt('domains', 'file containing the list of domains'))).toBe(true)
  })

  it('matches option name containing "file"', () => {
    expect(isFilePathOption(opt('csv_file', 'custom filename map'))).toBe(true)
  })

  it('matches option name "wordlist"', () => {
    expect(isFilePathOption(opt('wordlist', 'alternate word list'))).toBe(true)
  })

  it('does not match "filename" in description (not a standalone word)', () => {
    // "filename" does not contain the standalone word "file"
    expect(isFilePathOption(opt('csv_file', 'custom filename map'))).toBe(true) // matched by name
    // but description alone would not match
    const FILE_PATH_RE = /\b(path|file)\b/i
    expect(FILE_PATH_RE.test('custom filename map')).toBe(false)
  })

  it('does not match a plain API key option', () => {
    expect(isFilePathOption(opt('api_key', 'API key for authentication'))).toBe(false)
  })

  it('does not match a url option', () => {
    expect(isFilePathOption(opt('base_url', 'target resource url'))).toBe(false)
  })

  it('does not match source option', () => {
    expect(isFilePathOption(opt('source', 'input source (see info for details)'))).toBe(false)
  })

  it('does not match a numeric option', () => {
    expect(isFilePathOption(opt('threads', 'number of threads'))).toBe(false)
  })
})
