import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { gotoStable } from './helpers'
import { ADMIN, FakeSupabase, STRANGER } from './fakeSupabase'

/**
 * The admin panel, end to end in a real browser: signing in, uploading real
 * photos through the in-browser resize, saving, publishing, reordering,
 * deleting — against tests/fakeSupabase.ts, which mimics the database's
 * access rules so refusals are exercised as well as successes.
 */

/** 4096×2048 — stands in for a full-size phone photo. */
const BIG_PHOTO = 'earth.jpg'
/** 1200×630 — already under the 2000px cap. */
const SMALL_PHOTO = 'public/og-image.png'

async function signIn(page: Page, user = ADMIN) {
  await gotoStable(page, '/admin')
  await expect(page).toHaveURL(/\/admin\/login/)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

function seedWithFiles(fake: FakeSupabase, rows: Record<string, unknown>[]) {
  const png = { body: readFileSync(SMALL_PHOTO), contentType: 'image/png' }
  const made = fake.seed(
    'spare_parts',
    rows.map((row, i) => ({
      photos: [
        { full: `spare_parts/s${i}a.webp`, thumb: `spare_parts/s${i}a-thumb.webp`, w: 1200, h: 630 },
        { full: `spare_parts/s${i}b.webp`, thumb: `spare_parts/s${i}b-thumb.webp`, w: 1200, h: 630 },
      ],
      ...row,
    })),
  )
  for (const row of made) {
    for (const p of row.photos as { full: string; thumb: string }[]) {
      fake.files.set(p.full, png)
      fake.files.set(p.thumb, png)
    }
  }
  return made
}

test.describe('admin panel', () => {
  test.skip(({ viewport }) => viewport?.width !== 1366, 'behaviour is width-independent')

  let fake: FakeSupabase
  test.beforeEach(async ({ page }) => {
    fake = new FakeSupabase()
    await fake.install(page)
    // Every confirm() in the panel is a deliberate choice; tests accept them.
    page.on('dialog', (dialog) => void dialog.accept())
  })

  test('a wrong password is refused; the right one opens the spare parts list', async ({ page }) => {
    await signIn(page, { ...ADMIN, password: 'wrong' })
    await expect(page.getByRole('alert')).toHaveText('Invalid login credentials')

    await page.getByLabel('Password').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin\/spare-parts$/)
    await expect(page.getByRole('heading', { name: /Spare parts/ })).toBeVisible()
    await expect(page.getByText('No spare parts yet.')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })

  test('a signed-in account that is not an admin is told so, and shown no editor', async ({ page }) => {
    await signIn(page, STRANGER)
    await expect(page.getByRole('heading', { name: 'No admin access' })).toBeVisible()
    await expect(page.getByText(STRANGER.email)).toBeVisible()
    await expect(page.getByRole('link', { name: /Add spare part/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('adding a spare part: photos shrunk in the browser, stored, and live on the site', async ({ page }) => {
    await signIn(page)
    await page.getByRole('link', { name: '+ Add spare part' }).click()
    await expect(page.getByRole('heading', { name: 'New spare part' })).toBeVisible()

    await page.locator('input[type=file]').setInputFiles([BIG_PHOTO, SMALL_PHOTO])
    await expect(page.getByRole('img', { name: 'Photo 2' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Uploading…')).toHaveCount(0)

    // Nothing typed yet: the title is required.
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Fill this in, in at least one language.')).toBeVisible()

    // One language is enough, but the editor says what the other site will show.
    await page.getByRole('textbox', { name: 'What is it? (Greek)' }).fill('Πλακέτα ελέγχου drive')
    await expect(page.getByText('English is empty — the English site will show the Greek text.')).toBeVisible()
    await page.getByRole('textbox', { name: 'What is it? (English)' }).fill('Drive control board')
    await page.getByLabel('Manufacturer').fill('ABB')
    await page.getByLabel('Model / part number').fill('RMIO-01C')

    // Make the small photo the cover.
    await page.getByRole('button', { name: 'Move photo 2 earlier' }).click()

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/spare-parts$/)
    await expect(page.getByRole('status')).toHaveText('Saved “Drive control board”.')

    const [row] = fake.tables.spare_parts
    expect(row).toMatchObject({
      title_el: 'Πλακέτα ελέγχου drive',
      title_en: 'Drive control board',
      manufacturer: 'ABB',
      model: 'RMIO-01C',
      published: true,
    })
    const photos = row.photos as { full: string; thumb: string; w: number; h: number }[]
    // Cover first; the 4096×2048 photo came down to the 2000px cap, the
    // 1200px one was left at its own size.
    expect(photos.map((p) => [p.w, p.h])).toEqual([
      [1200, 630],
      [2000, 1000],
    ])
    expect(fake.files.size).toBe(4)
    for (const p of photos) {
      expect(p.full).toMatch(/^spare_parts\/.+\.(webp|jpg)$/)
      const full = fake.files.get(p.full)!
      expect(full.contentType).toMatch(/^image\/(webp|jpeg)$/)
    }
    // A 2000px re-encode of the big photo is a fraction of the original.
    const original = readFileSync(BIG_PHOTO).length
    expect(fake.files.get(photos[1].full)!.body.length).toBeLessThan(original / 2)
    expect(fake.files.get(photos[1].thumb)!.body.length).toBeLessThan(fake.files.get(photos[1].full)!.body.length)

    // And the public page shows it, straight from the database.
    await gotoStable(page, '/spare-parts')
    await expect(page.getByText('Drive control board')).toBeVisible()
    await expect
      .poll(() => page.locator('main li img').first().evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('closing a new item without saving deletes the photos it uploaded', async ({ page }) => {
    await signIn(page)
    await page.getByRole('link', { name: '+ Add spare part' }).click()
    await page.locator('input[type=file]').setInputFiles(SMALL_PHOTO)
    await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible({ timeout: 30_000 })
    expect(fake.files.size).toBe(2)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/admin\/spare-parts$/)
    await expect.poll(() => fake.files.size).toBe(0)
    expect(fake.tables.spare_parts).toHaveLength(0)
  })

  test('a photo taken off a saved item is deleted on save; deleting the item removes the rest', async ({ page }) => {
    const [part] = seedWithFiles(fake, [{ title_en: 'Soft starter' }])
    await signIn(page)
    await page.getByRole('link', { name: 'Soft starter' }).click()
    await expect(page.getByRole('heading', { name: 'Edit spare part' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove photo 1' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Saved “Soft starter”.')
    expect((fake.tables.spare_parts[0].photos as unknown[]).length).toBe(1)
    await expect.poll(() => [...fake.files.keys()].sort()).toEqual(['spare_parts/s0b-thumb.webp', 'spare_parts/s0b.webp'])

    await page.getByRole('link', { name: 'Soft starter' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('status')).toHaveText('Deleted “Soft starter”.')
    expect(fake.tables.spare_parts.find((r) => r.id === part.id)).toBeUndefined()
    await expect.poll(() => fake.files.size).toBe(0)
  })

  test('publishing and reordering from the list write through to the database', async ({ page }) => {
    seedWithFiles(fake, [{ title_en: 'First' }, { title_en: 'Second' }, { title_en: 'Third' }])
    await signIn(page)
    // Role, not CSS: each row also has an aria-hidden thumbnail link.
    const titles = page.getByRole('main').getByRole('list').getByRole('link')
    await expect(titles).toHaveText(['First', 'Second', 'Third'])

    await page.getByRole('button', { name: 'Move “Third” up' }).click()
    await expect(titles).toHaveText(['First', 'Third', 'Second'])
    await page.getByRole('button', { name: 'Published' }).first().click()
    await expect(page.getByRole('button', { name: 'Draft' })).toHaveCount(1)

    // Straight from the database, not the screen's own state.
    await page.reload()
    await expect(titles).toHaveText(['First', 'Third', 'Second'])
    expect(fake.tables.spare_parts.find((r) => r.title_en === 'First')!.published).toBe(false)

    // A draft disappears from the public page.
    await gotoStable(page, '/spare-parts')
    await expect(page.getByText('Third')).toBeVisible()
    await expect(page.getByText('First', { exact: true })).toHaveCount(0)
  })

  test('a write the database refuses is reported, not swallowed', async ({ page }) => {
    seedWithFiles(fake, [{ title_en: 'Board' }])
    await signIn(page)
    await expect(page.getByRole('link', { name: 'Board' })).toBeVisible()

    // Admin rights withdrawn mid-session: updates now match no rows.
    fake.admins.clear()
    await page.getByRole('button', { name: 'Published' }).click()
    await expect(page.getByRole('alert')).toHaveText('Could not save that change.')
    // The list reloads to what the database actually holds.
    await expect(page.getByRole('button', { name: 'Published' })).toBeVisible()
  })

  test('projects: the scope is a choice of the three service levels', async ({ page }) => {
    await signIn(page)
    await page.getByRole('link', { name: 'Projects' }).click()
    await expect(page.getByText('The first two published projects also appear on the home page.')).toBeVisible()
    await page.getByRole('link', { name: '+ Add project' }).click()
    await expect(page.getByLabel('Scope').locator('option')).toHaveText([
      'Component level',
      'Systems & automation',
      'Refit',
    ])
  })
})

test.describe('admin: capabilities', () => {
  test.skip(({ viewport }) => viewport?.width !== 1366, 'behaviour is width-independent')

  let fake: FakeSupabase
  test.beforeEach(async ({ page }) => {
    fake = new FakeSupabase()
    await fake.install(page)
    page.on('dialog', (dialog) => void dialog.accept())
  })

  async function openCapabilities(page: Page) {
    await signIn(page)
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capabilities' }).click()
  }

  test('makers are added, reordered and removed, and saved in that order', async ({ page }) => {
    fake.seed('capability_groups', [{ title_en: 'Navigation', title_el: 'Ναυσιπλοΐα', brands: ['Furuno', 'JRC'] }])
    await openCapabilities(page)
    // The list's second line is the makers — no thumbnails for groups.
    await expect(page.getByText('Furuno, JRC')).toBeVisible()
    await expect(page.locator('main li img')).toHaveCount(0)

    await page.getByRole('link', { name: 'Navigation' }).click()
    const makers = page.getByLabel('Makers')
    await makers.fill('Sperry Marine')
    await makers.press('Enter')
    // A pasted list adds each entry; one already there (in any case) is skipped.
    await makers.fill('Kelvin Hughes, furuno, Raytheon Anschütz')
    await makers.press('Enter')
    await expect(page.getByText('Already in the list: furuno.')).toBeVisible()

    await page.getByRole('button', { name: 'Move Sperry Marine up' }).click()
    await page.getByRole('button', { name: 'Remove JRC' }).click()
    // Typed but never confirmed with Enter: still meant, so still saved.
    await makers.fill('Tokyo Keiki')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('status')).toHaveText('Saved “Navigation”.')
    expect(fake.tables.capability_groups[0].brands).toEqual([
      'Furuno',
      'Sperry Marine',
      'Kelvin Hughes',
      'Raytheon Anschütz',
      'Tokyo Keiki',
    ])
  })

  test('a new group needs a name and at least one maker', async ({ page }) => {
    await openCapabilities(page)
    await page.getByRole('link', { name: '+ Add group' }).click()
    // Enter in the makers box adds a maker; it must not submit the form.
    await page.getByLabel('Makers').press('Enter')
    await expect(page.getByRole('heading', { name: 'New group' })).toBeVisible()

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Fill this in, in at least one language.')).toBeVisible()
    await expect(page.getByText('Add at least one maker.')).toBeVisible()

    await page.getByRole('textbox', { name: 'Group name (English)' }).fill('Navigation')
    await page.getByRole('textbox', { name: 'Group name (Greek)' }).fill('Ναυσιπλοΐα')
    await page.getByLabel('Makers').fill('Furuno')
    await page.getByLabel('Makers').press('Enter')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('status')).toHaveText('Saved “Navigation”.')
    const [row] = fake.tables.capability_groups
    expect(row).toMatchObject({ title_en: 'Navigation', title_el: 'Ναυσιπλοΐα', brands: ['Furuno'], published: true })
  })
})

test.describe('admin: certifications and coverage', () => {
  test.skip(({ viewport }) => viewport?.width !== 1366, 'behaviour is width-independent')

  let fake: FakeSupabase
  test.beforeEach(async ({ page }) => {
    fake = new FakeSupabase()
    await fake.install(page)
    page.on('dialog', (dialog) => void dialog.accept())
  })

  async function openSection(page: Page, name: string) {
    await signIn(page)
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name }).click()
  }

  test('a certification needs a name, which is the same in both languages', async ({ page }) => {
    fake.seed('certifications', [{ name: 'DNV', detail_en: 'Approved service supplier' }])
    await openSection(page, 'Certifications')
    // Listed by its name, with what it covers underneath.
    await expect(page.getByRole('link', { name: 'DNV' })).toBeVisible()
    await expect(page.getByText('Approved service supplier')).toBeVisible()

    await page.getByRole('link', { name: '+ Add certification' }).click()
    await page.getByRole('textbox', { name: 'What it covers (English)' }).fill('Recognised service supplier')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Fill this in.', { exact: true })).toBeVisible()

    await page.getByLabel('Name').fill('RINA')
    await expect(page.getByText('Fill this in.', { exact: true })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'What it covers (Greek)' }).fill('Αναγνωρισμένος πάροχος')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('status')).toHaveText('Saved “RINA”.')
    expect(fake.tables.certifications.find((r) => r.name === 'RINA')).toMatchObject({
      detail_en: 'Recognised service supplier',
      detail_el: 'Αναγνωρισμένος πάροχος',
      published: true,
    })
  })

  test('a port is renamed and moved to the other heading', async ({ page }) => {
    fake.seed('ports', [
      { title_en: 'Piraeus', title_el: 'Πειραιάς', tier: 'primary' },
      { title_en: 'Volos', title_el: 'Βόλος', tier: 'secondary' },
    ])
    await openSection(page, 'Coverage')
    await expect(page.getByText('The globe’s routes are a drawing')).toBeVisible()

    await page.getByRole('link', { name: 'Volos' }).click()
    // The choice reads as the page's own headings.
    await expect(page.getByLabel('Listed under').locator('option')).toHaveText(['Permanent presence', 'Regular coverage'])
    await page.getByLabel('Listed under').selectOption({ label: 'Permanent presence' })
    await page.getByRole('textbox', { name: 'Port (English)' }).fill('Volos (Port of)')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByRole('status')).toHaveText('Saved “Volos (Port of)”.')
    expect(fake.tables.ports.find((r) => r.title_el === 'Βόλος')).toMatchObject({ tier: 'primary', title_en: 'Volos (Port of)' })
  })
})

test.describe('admin layout', () => {
  test('sign-in, list and editor fit every screen without sideways scrolling', async ({ page }) => {
    const fake = new FakeSupabase()
    seedWithFiles(fake, [{ title_en: 'A board with a fairly long name to wrap', manufacturer: 'Schneider Electric', model: 'TSX-P57' }])
    await fake.install(page)

    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    await signIn(page)
    await expect(page.getByRole('link', { name: /A board with a fairly long name/ })).toBeVisible()
    expect(await overflow(), 'list').toBeLessThanOrEqual(0)

    await page.getByRole('link', { name: /A board with a fairly long name/ }).click()
    await expect(page.getByRole('heading', { name: 'Edit spare part' })).toBeVisible()
    expect(await overflow(), 'editor').toBeLessThanOrEqual(0)
  })
})
