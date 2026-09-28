import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { gotoStable } from './helpers'
import { FakeSupabase } from './fakeSupabase'

/**
 * The public side of the editable content: /projects, /spare-parts and the
 * home teaser read their rows from the database, over the committed snapshot.
 *
 * Behaviour only, against tests/fakeSupabase.ts — no baselines, one viewport
 * (layout.spec sweeps these routes at every width).
 */

const PNG = { body: readFileSync('public/og-image.png'), contentType: 'image/png' }
const photo = (name: string) => ({ full: `x/${name}.png`, thumb: `x/${name}-thumb.png`, w: 1200, h: 630 })

function withFiles(fake: FakeSupabase, ...names: string[]) {
  for (const name of names) {
    fake.files.set(`x/${name}.png`, PNG)
    fake.files.set(`x/${name}-thumb.png`, PNG)
  }
}

const SNAPSHOT_TITLE = 'Blackouts traced to a generator synchronising fault'

test.describe('public content', () => {
  test.skip(({ viewport }) => viewport?.width !== 1366, 'behaviour is width-independent')

  test('the snapshot stands in when the backend is down', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.down = true
    await fake.install(page)

    const failed = page.waitForResponse((r) => r.url().includes('/rest/v1/projects'))
    await gotoStable(page, '/projects')
    expect((await failed).status()).toBe(503)

    await expect(page.getByRole('heading', { name: SNAPSHOT_TITLE })).toBeVisible()
    await expect(page.locator('main article')).toHaveCount(4)
  })

  test('live rows replace the snapshot; drafts never show; photos open full screen', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.seed('projects', [
      {
        scope: 'component',
        title_en: 'Live case from the database',
        title_el: 'Ζωντανό περιστατικό',
        vessel_en: 'Chemical tanker',
        location_en: 'Piraeus',
        problem_en: 'The problem.',
        solution_en: 'The solution.',
        downtime_en: '3 hours',
        photos: [photo('a'), photo('b')],
      },
      { title_en: 'A draft nobody may see', published: false },
    ])
    withFiles(fake, 'a', 'b')
    await fake.install(page)

    await gotoStable(page, '/projects')
    await expect(page.getByRole('heading', { name: 'Live case from the database' })).toBeVisible()
    await expect(page.getByRole('heading', { name: SNAPSHOT_TITLE })).toHaveCount(0)
    await expect(page.getByText('A draft nobody may see')).toHaveCount(0)
    // The badge comes from the dictionary, keyed by the stored scope.
    await expect(page.locator('main article').getByText('Component level')).toBeVisible()

    await page.getByRole('button', { name: 'View photo 2 — Live case from the database' }).click()
    const viewer = page.getByRole('dialog')
    await expect(viewer).toBeVisible()
    await expect(viewer.getByText('2 / 2')).toBeVisible()
    await expect(viewer.getByText('Chemical tanker · Piraeus')).toBeVisible()
    await expect
      .poll(() => viewer.getByRole('img', { name: 'Live case from the database' }).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)

    await page.keyboard.press('ArrowRight')
    await expect(viewer.getByText('1 / 2')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
    // The browser shuts the dialog on Esc before React hears of it; the
    // scroll lock lifts on the re-render that follows.
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
  })

  test('spare parts: grid, maker filter, viewer, and an enquiry that names the part', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.seed('spare_parts', [
      {
        title_en: 'ACS800 control board',
        title_el: 'Πλακέτα ελέγχου ACS800',
        manufacturer: 'ABB',
        model: 'RMIO-01C',
        description_en: 'Dead on arrival: shorted gate driver. Repaired and bench-tested.',
        photos: [photo('p1'), photo('p2')],
      },
      { title_en: 'Soft starter', manufacturer: 'ABB', photos: [photo('p3')] },
      { title_en: 'S5 CPU module', manufacturer: 'Siemens', model: '6ES5', photos: [photo('p4')] },
      { title_en: 'Unpublished part', manufacturer: 'Hidden Co', published: false, photos: [photo('p5')] },
    ])
    withFiles(fake, 'p1', 'p2', 'p3', 'p4', 'p5')
    await fake.install(page)

    await gotoStable(page, '/spare-parts')
    const grid = page.locator('main ul').first()
    await expect(grid.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByText('Unpublished part')).toHaveCount(0)

    // Filter chips come from the published makers only.
    const filters = page.getByRole('group', { name: 'Filter by manufacturer' })
    await expect(filters.getByRole('button')).toHaveText(['All', 'ABB', 'Siemens'])
    await filters.getByRole('button', { name: 'Siemens' }).click()
    await expect(grid.getByRole('listitem')).toHaveCount(1)
    await filters.getByRole('button', { name: 'All' }).click()
    await expect(grid.getByRole('listitem')).toHaveCount(3)

    await page.getByRole('button', { name: /ACS800 control board/ }).click()
    const viewer = page.getByRole('dialog')
    await expect(viewer.getByText('1 / 2')).toBeVisible()
    await expect(viewer.getByText('shorted gate driver')).toBeVisible()
    await viewer.getByRole('button', { name: 'Next photo' }).click()
    await expect(viewer.getByText('2 / 2')).toBeVisible()

    await viewer.getByRole('link', { name: 'Ask us about this' }).click()
    await expect(page).toHaveURL(/\/contact\?urgency=planned&system=/)
    await expect(page.getByLabel('System involved')).toHaveValue('ABB · RMIO-01C — ACS800 control board')
    await expect(page.getByRole('radio', { name: /Planned work/ })).toBeChecked()
    // Leaving through the viewer must give the page its scrolling back.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })

  test('capabilities: groups and makers come from the database', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.seed('capability_groups', [
      { title_en: 'Navigation', title_el: 'Ναυσιπλοΐα', brands: ['Furuno', 'JRC', 'Sperry Marine'] },
      { title_en: 'A hidden group', brands: ['Nobody'], published: false },
    ])
    await fake.install(page)

    await gotoStable(page, '/capabilities')
    await expect(page.getByRole('heading', { name: 'Navigation' })).toBeVisible()
    await expect(page.locator('main li')).toHaveText(['Furuno', 'JRC', 'Sperry Marine'])
    // Neither the snapshot's groups nor the unpublished one.
    await expect(page.getByRole('heading', { name: 'Automation & control' })).toHaveCount(0)
    await expect(page.getByText('A hidden group')).toHaveCount(0)

    await gotoStable(page, '/el/capabilities')
    await expect(page.getByRole('heading', { name: 'Ναυσιπλοΐα' })).toBeVisible()
  })

  test('capabilities: the snapshot stands in when the backend is down', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.down = true
    await fake.install(page)

    await gotoStable(page, '/capabilities')
    await expect(page.locator('main h2')).toHaveText([
      'Automation & control',
      'Alarm & monitoring',
      'Power & propulsion',
      'Drives & motors',
      // The call-to-action band's own heading.
      'Broken down right now?',
    ])
  })

  test('certifications: cards come from the database', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.seed('certifications', [
      { name: 'RINA', detail_en: 'Approved service supplier', detail_el: 'Αναγνωρισμένος πάροχος' },
      { name: 'Hidden Register', detail_en: 'Not yet', published: false },
    ])
    await fake.install(page)

    await gotoStable(page, '/certifications')
    await expect(page.locator('main li h2')).toHaveText(['RINA'])
    await expect(page.getByText('Approved service supplier')).toBeVisible()
    await expect(page.getByText('Hidden Register')).toHaveCount(0)

    await gotoStable(page, '/el/certifications')
    await expect(page.getByText('Αναγνωρισμένος πάροχος')).toBeVisible()
  })

  test('coverage: ports are listed under the heading chosen for each', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.seed('ports', [
      { title_en: 'Piraeus', title_el: 'Πειραιάς', tier: 'primary' },
      { title_en: 'Chania', title_el: 'Χανιά', tier: 'secondary' },
      { title_en: 'Volos', title_el: 'Βόλος', tier: 'primary' },
      { title_en: 'A hidden port', tier: 'secondary', published: false },
    ])
    await fake.install(page)

    await gotoStable(page, '/coverage')
    const permanent = page.locator('div', { has: page.getByRole('heading', { name: 'Permanent presence' }) }).last()
    const regular = page.locator('div', { has: page.getByRole('heading', { name: 'Regular coverage' }) }).last()
    await expect(permanent.getByRole('listitem')).toHaveText(['Piraeus', 'Volos'])
    await expect(regular.getByRole('listitem')).toHaveText(['Chania'])
    await expect(page.getByText('A hidden port')).toHaveCount(0)

    await gotoStable(page, '/el/coverage')
    await expect(page.getByText('Χανιά')).toBeVisible()
  })

  test('certifications and coverage: the snapshot stands in when the backend is down', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.down = true
    await fake.install(page)

    await gotoStable(page, '/certifications')
    await expect(page.locator('main li h2')).toHaveText([
      'DNV',
      'ABS',
      "Lloyd's Register",
      'Bureau Veritas',
      'ISO 9001:2015',
      'ISO 45001',
    ])
    await gotoStable(page, '/coverage')
    const permanent = page.locator('div', { has: page.getByRole('heading', { name: 'Permanent presence' }) }).last()
    await expect(permanent.getByRole('listitem')).toHaveText(['Piraeus', 'Elefsina', 'Perama', 'Salamina'])
  })

  test('a part filled in one language only still shows on the other site', async ({ page }) => {
    const fake = new FakeSupabase()
    fake.seed('spare_parts', [{ title_en: 'Generator AVR board', title_el: '', photos: [photo('q')] }])
    withFiles(fake, 'q')
    await fake.install(page)

    await gotoStable(page, '/el/spare-parts')
    await expect(page.getByText('Generator AVR board')).toBeVisible()
  })
})
