import { test, expect } from '@playwright/test'

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
  // The root div must have children — if React failed to mount it stays empty
  const rootEmpty = await page.evaluate(() => document.getElementById('root')?.children.length === 0)
  if (rootEmpty) {
    await page.screenshot({ path: 'test-results/react-mount-failure.png', fullPage: true })
  }
  expect(rootEmpty).toBe(false)
})

test('debug: dump page state', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  const info = await page.evaluate(() => ({
    title: document.title,
    rootHTML: document.getElementById('root')?.innerHTML.slice(0, 2000),
    bodyClass: document.body.className,
    htmlClass: document.documentElement.className,
    styleSheets: Array.from(document.styleSheets).map(s => ({ href: s.href, rules: s.cssRules?.length ?? 'blocked' })),
  }))
  const fs = await import('fs')
  fs.writeFileSync('test-results/page-debug.json', JSON.stringify(info, null, 2))
  // Always pass — this test just collects info
  expect(true).toBe(true)
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
    // Wait for the sidebar table list to populate before clicking
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
    // At least one module row should be present after data loads
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
