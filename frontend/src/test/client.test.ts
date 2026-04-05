import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboard, uploadFile } from '../api/client'

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const response = {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  return response
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('resolves with parsed JSON on success', async () => {
    mockFetch(200, { workspace: 'default', records: [], activity: [] })
    const result = await getDashboard()
    expect(result.workspace).toBe('default')
  })

  it('throws on non-ok response', async () => {
    mockFetch(404, 'Not Found', false)
    await expect(getDashboard()).rejects.toThrow('404')
  })

  it('sends Content-Type: application/json header', async () => {
    mockFetch(200, { workspace: 'default', records: [], activity: [] })
    await getDashboard()
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json')
  })
})

describe('uploadFile', () => {
  it('POSTs to /api/files/upload and returns path', async () => {
    mockFetch(200, { path: '/home/user/.recon-ng/uploads/list.txt' })
    const file = new File(['one\ntwo\n'], 'list.txt', { type: 'text/plain' })
    const path = await uploadFile(file)
    expect(path).toBe('/home/user/.recon-ng/uploads/list.txt')
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toBe('/api/files/upload')
    expect(fetchCall[1].method).toBe('POST')
  })

  it('throws when upload fails', async () => {
    mockFetch(500, 'Server Error', false)
    const file = new File(['data'], 'x.txt')
    await expect(uploadFile(file)).rejects.toThrow('Upload failed')
  })
})
