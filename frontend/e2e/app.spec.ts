import { test, expect } from '@playwright/test'

// Verify the recon-ng server is actually running before any test runs.
// On macOS, AirPlay Receiver occupies port 5000 and will answer HTTP
// requests with empty pages — causing all tests to silently mis-pass or fail.
test.beforeAll(async ({ request }) => {
  let ok = false
  try {
    const resp = await request.get('/api/workspaces/')
    ok = resp.ok() && (await resp.json()).workspaces !== undefined
  } catch { /* server not reachable */ }
  if (!ok) {
    throw new Error(
      'recon-ng server is not running at http://127.0.0.1:5000. ' +
      'Start it with ./start.sh before running E2E tests.'
    )
  }
})

// Suppress the QuickStart modal and capture console errors for debugging.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('recon_ng_quickstart_v1', 'seen')
  })
  page.on('pageerror', err => console.error('[page error]', err.message))
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console]', msg.text()) })
})

test('page loads and React mounts', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const rootEmpty = await page.evaluate(() => {
    const root = document.getElementById('root')
    return !root || root.children.length === 0
  })
  expect(rootEmpty, 'React did not mount — #root is empty').toBe(false)
})

test.describe('Navigation', () => {
  test('dashboard loads and shows harvested data', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Harvested Data')).toBeVisible({ timeout: 10000 })
  })

  test('sidebar links navigate to correct pages', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: 'Marketplace' }).click()
    await expect(page).toHaveURL(/marketplace/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible()
  })

  test('data section shows table list', async ({ page }) => {
    await page.goto('/data')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('domains')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('hosts')).toBeVisible()
  })

  test('clicking a table in data section loads it', async ({ page }) => {
    await page.goto('/data')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'domains' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'domains' }).click()
    await expect(page).toHaveURL(/\/data\/domains/)
  })

  test('modules page lists installed modules', async ({ page }) => {
    await page.goto('/modules')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/modules loaded/i)).toBeVisible({ timeout: 10000 })
  })

  test('footer contains wiki and quick start links', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: 'Wiki' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quick Start' })).toBeVisible()
  })
})

test.describe('Marketplace', () => {
  test('shows module list', async ({ page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 })
  })

  test('search filters modules', async ({ page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    const search = page.getByPlaceholder('Search modules...')
    await expect(search).toBeVisible({ timeout: 10000 })
    await search.fill('brute')
    await expect(page.getByText(/brute/i).first()).toBeVisible()
  })
})
