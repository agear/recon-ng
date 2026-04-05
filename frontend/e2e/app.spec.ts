import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('dashboard loads and shows harvested data', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Harvested Data')).toBeVisible()
  })

  test('sidebar links navigate to correct pages', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: /marketplace/i }).click()
    await expect(page).toHaveURL(/marketplace/)
    await expect(page.getByRole('heading', { name: /marketplace/i })).toBeVisible()
  })

  test('data section shows table list', async ({ page }) => {
    await page.goto('/data')
    await expect(page.getByText('domains')).toBeVisible()
    await expect(page.getByText('hosts')).toBeVisible()
  })

  test('clicking a table in data section loads it', async ({ page }) => {
    await page.goto('/data')
    await page.getByRole('button', { name: 'domains' }).click()
    await expect(page).toHaveURL(/\/data\/domains/)
  })

  test('modules page lists installed modules', async ({ page }) => {
    await page.goto('/modules')
    await expect(page.getByText(/modules loaded/i)).toBeVisible()
  })

  test('footer contains wiki and quick start links', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Wiki' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quick Start' })).toBeVisible()
  })
})

test.describe('Marketplace', () => {
  test('shows module list', async ({ page }) => {
    await page.goto('/marketplace')
    // At least one module row should be present
    await expect(page.locator('.card').first()).toBeVisible()
  })

  test('search filters modules', async ({ page }) => {
    await page.goto('/marketplace')
    const search = page.getByPlaceholder(/search/i)
    await search.fill('brute')
    await expect(page.getByText(/brute/i).first()).toBeVisible()
  })
})
