import { test, expect } from '@playwright/test'

// Suppress the QuickStart modal that opens automatically on a fresh browser
// context, and which blocks click/fill actions on covered elements.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('recon_ng_quickstart_v1', 'seen')
  })
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
