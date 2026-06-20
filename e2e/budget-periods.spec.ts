import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('budget periods migrate and work through the Electron bridge', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'budgeto-periods-'))
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...cleanEnv } = process.env
  void _electronRunAsNode
  const launchEnv = { ...cleanEnv, ELECTRON_RENDERER_URL: pathToFileURL(path.resolve('dist/index.html')).href } as Record<string, string>
  let electronApp = await electron.launch({
    args: [path.resolve('dist-electron/main/index.cjs'), `--user-data-dir=${userData}`],
    env: launchEnv
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    const result = await page.evaluate(async () => {
      const api = (window as any).api.budgetPeriods
      const initial = await api.config.get()
      await api.upsert({ cadence: 'ANNUAL', year: 2028, amount: 12000, description: 'Jahresplan' })
      await api.upsert({ cadence: 'MONTHLY', year: 2028, month: 2, amount: 1500, description: 'Testmonat' })
      await api.config.set({ cadence: 'MONTHLY' })
      await api.fillYear({ year: 2028, amount: 100, overwrite: false })
      const period = await api.get({ cadence: 'MONTHLY', year: 2028, month: 2 })
      const annual = await api.get({ cadence: 'ANNUAL', year: 2028 })
      const usage = await api.usage({ cadence: 'MONTHLY', year: 2028, month: 2 })
      const yearUsage = await api.yearUsage({ year: 2028 })
      await api.fillYear({ year: 2029, amount: 1000, overwrite: true })
      await (window as any).api.vouchers.create({ date: '2029-01-15', type: 'OUT', sphere: 'IDEELL', description: 'Übertragstest', netAmount: 1200, vatRate: 0 })
      await api.config.set({ carryDeficit: true, carrySurplus: false })
      const februaryWithDeficit = await api.usage({ cadence: 'MONTHLY', year: 2029, month: 2 })
      await api.config.set({ carryDeficit: false })
      const februaryWithoutDeficit = await api.usage({ cadence: 'MONTHLY', year: 2029, month: 2 })
      return { initial, period, annual, usage, yearUsage, februaryWithDeficit, februaryWithoutDeficit }
    })

    expect(result.initial.cadence).toBe('ANNUAL')
    expect(result.period).toMatchObject({ cadence: 'MONTHLY', year: 2028, month: 2, startDate: '2028-02-01', endDate: '2028-02-29', amount: 1500 })
    expect(result.annual).toMatchObject({ cadence: 'ANNUAL', year: 2028, amount: 12000 })
    expect(result.usage).toMatchObject({ budgeted: 1500, remaining: 1500 })
    expect(result.yearUsage).toMatchObject({ cadence: 'MONTHLY', budgeted: 2600, configuredPeriods: 12 })
    expect(result.februaryWithDeficit).toMatchObject({ baseBudgeted: 1000, carryover: -200, budgeted: 800, remaining: 800 })
    expect(result.februaryWithoutDeficit).toMatchObject({ baseBudgeted: 1000, carryover: 0, budgeted: 1000, remaining: 1000 })

    await page.evaluate(async () => {
      const settings = (window as any).api.settings
      await settings.set({ key: 'backup.auto', value: 'OFF' })
      await settings.set({ key: 'setup.completed', value: true })
      await settings.set({ key: 'ui.workYear', value: 2029 })
      await settings.set({ key: 'ui.workMonth', value: 2 })
      await settings.set({ key: 'ui.showArchived', value: false })
    })
    await electronApp.close()
    electronApp = await electron.launch({
      args: [path.resolve('dist-electron/main/index.cjs'), `--user-data-dir=${userData}`],
      env: launchEnv
    })
    const uiPage = await electronApp.firstWindow()
    await uiPage.waitForLoadState('domcontentloaded')
    await expect(uiPage.locator('.work-year-indicator')).toHaveAttribute('aria-label', /Arbeitsmonat Feb 2029/)
    await uiPage.getByRole('button', { name: 'Buchungen', exact: true }).click()
    await expect(uiPage.getByText('Übertragstest')).toHaveCount(0)
    const pageErrors: string[] = []
    uiPage.on('pageerror', (error) => pageErrors.push(error.message))
    await uiPage.getByRole('button', { name: 'Dashboard', exact: true }).click()
    await uiPage.waitForTimeout(800)
    expect(pageErrors).toEqual([])
    await expect(uiPage.locator('.dashboard-card')).toBeVisible()
    await uiPage.getByRole('button', { name: 'Buchungen', exact: true }).click()

    await uiPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await uiPage.keyboard.press('Space')
    await uiPage.keyboard.press('e')
    await expect(uiPage.getByText('Tags …')).toBeVisible()
    await uiPage.keyboard.press('t')
    await uiPage.keyboard.press('n')
    await expect(uiPage.getByRole('heading', { name: 'Neuer Tag' })).toBeVisible()
    await uiPage.locator('.modal-overlay button[aria-label="Schließen"]').click()

    await uiPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await uiPage.keyboard.press('Space')
    await uiPage.keyboard.press('e')
    await uiPage.keyboard.press('k')
    await uiPage.keyboard.press('n')
    await expect(uiPage.getByRole('heading', { name: 'Neue Kategorie' })).toBeVisible()

  } finally {
    await electronApp.close()
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
