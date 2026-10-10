/**
 * One real HTML file per page and language, written into dist/ after the
 * Vite build (it runs as the last step of `npm run build`).
 *
 * Why: GitHub Pages has no rewrite rules. Before this, only / existed as a
 * file; every other address — /services, /el/coverage, … — was answered by
 * 404.html, which boots the app and lets the router draw the page. Visitors
 * never noticed, but the response carried a 404 status, and a search engine
 * does not index a page that says it does not exist: to Google the site was
 * one page. Link previews (WhatsApp, Facebook, LinkedIn — none of which run
 * JavaScript) also showed the home page's title for every link.
 *
 * Each page's file is the same app shell with that page's own <title>,
 * description, canonical URL, og: tags, hreflang set and <html lang> baked
 * in — the same values usePageMeta sets at runtime, from the same
 * dictionaries, so the two cannot disagree. GitHub Pages serves foo.html at
 * /foo with a 200, so the addresses stay exactly as they are.
 *
 * Each file also names what its page needs before it can draw: the page's
 * own chunk (routes are lazy — see src/lazyPages.ts) and the Inter faces for
 * its language. Without that, the browser discovers them only once the main
 * bundle has run, one round trip later. The chunk names come from Vite's
 * build manifest, which is deleted afterwards — it is not a page.
 *
 * Unknown addresses get 404.html, written here too, with the not-found
 * page's chunk rather than the home page's, and a genuine 404 status.
 *
 * Imports the dictionaries and routes straight from src/ — they are plain
 * TypeScript with nothing but erasable syntax, which Node strips itself.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { el } from '../src/i18n/dictionaries/el.ts'
import { en } from '../src/i18n/dictionaries/en.ts'
import { ROUTES } from '../src/routes.ts'

const DIST = new URL('../dist/', import.meta.url)
const DICTIONARIES = { en, el }
const LOCALES = { en: 'en_US', el: 'el_GR' }

/** The site's address, from the same CNAME file that tells Pages the domain. */
const ORIGIN = `https://${(await readFile(new URL('../public/CNAME', import.meta.url), 'utf8')).trim()}`

const MANIFEST_DIR = new URL('.vite/', DIST)
const manifest = JSON.parse(await readFile(new URL('manifest.json', MANIFEST_DIR), 'utf8'))

/** A manifest entry by its source file, or stops the build. */
function entry(source) {
  const found = manifest[source]
  if (!found) throw new Error(`prerender: ${source} is not in the Vite manifest`)
  return found
}

/** The source file behind each route key: home -> src/pages/Home.tsx. */
const pageSource = (key) => `src/pages/${key[0].toUpperCase()}${key.slice(1)}.tsx`

/** Inter faces to fetch up front. Greek pages still set the company name,
    figures and units in Latin, so they want both. */
const FONTS = {
  en: ['src/assets/fonts/inter-latin.woff2'],
  el: ['src/assets/fonts/inter-latin.woff2', 'src/assets/fonts/inter-greek.woff2'],
}

/** Faces only some pages need up front. The home page's intro curtain sets
    the company name in JetBrains Mono, and that name is the largest thing on
    the first screen — the paint Lighthouse times the page by. Its Latin
    letters cover the name in both languages. */
const PAGE_FONTS = {
  home: ['src/assets/fonts/jetbrains-mono-latin.woff2'],
}

/** <link>s for a page's chunk, everything it imports, and the language's
    fonts. Anything the template already loads is left out. */
function preloadsFor(template, source, lang, key) {
  const chunks = new Set()
  const visit = (id) => {
    const { file, imports = [] } = entry(id)
    if (chunks.has(file)) return
    chunks.add(file)
    imports.forEach(visit)
  }
  visit(source)
  const scripts = [...chunks]
    .filter((file) => !template.includes(`/${file}"`))
    .map((file) => `<link rel="modulepreload" crossorigin href="/${file}">`)
  const fonts = [...FONTS[lang], ...(PAGE_FONTS[key] ?? [])].map(
    (font) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${entry(font).file}">`,
  )
  return [...scripts, ...fonts].join('\n    ')
}

const withPreloads = (html, links) => replaceOnce(html, /\s*<\/head>/, `\n    ${links}\n  </head>`, '</head>')

/** Same scheme as src/i18n/localePath.ts: English bare, Greek under /el. */
const localePath = (lang, path) => (lang === 'en' ? path : path === '/' ? '/el' : `/el${path}`)

/** The file(s) that serve a URL path on GitHub Pages, which maps /foo to
    foo.html. /el is written twice: it is also the name of the folder the
    Greek pages live in, and serving el/index.html too means /el gets the
    right page whichever of the two Pages prefers. */
function filesFor(urlPath) {
  if (urlPath === '/') return ['index.html']
  if (urlPath === '/el') return ['el.html', 'el/index.html']
  return [`${urlPath.slice(1)}.html`]
}

const escape = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Replaces exactly one match of `pattern`, or stops the build: a template
    that no longer looks as expected must not ship pages with the wrong
    metadata quietly. */
function replaceOnce(html, pattern, replacement, what) {
  const matches = html.match(new RegExp(pattern.source, 'g'))
  if (matches?.length !== 1) {
    throw new Error(`prerender: expected one ${what} in dist/index.html, found ${matches?.length ?? 0}`)
  }
  return html.replace(pattern, replacement)
}

const metaTag = (attribute, key) => new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/>`)

function pageFor(template, lang, key, path) {
  const { title, description } = DICTIONARIES[lang].pageMeta[key]
  const url = `${ORIGIN}${localePath(lang, path)}`
  const alternates = [
    ['en', `${ORIGIN}${localePath('en', path)}`],
    ['el', `${ORIGIN}${localePath('el', path)}`],
    ['x-default', `${ORIGIN}${path}`],
  ]
    .map(([code, href]) => `<link rel="alternate" hreflang="${code}" href="${href}" />`)
    .join('\n    ')

  let html = template
  html = replaceOnce(html, /<html lang="[^"]*">/, `<html lang="${lang}">`, '<html lang>')
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`, '<title>')
  html = replaceOnce(html, metaTag('name', 'description'), `<meta name="description" content="${escape(description)}" />`, 'description')
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    // The hreflang set and og:locale ride along with the canonical: they are
    // absent from the template, and usePageMeta updates these same tags
    // rather than adding its own.
    `<link rel="canonical" href="${url}" />\n    ${alternates}\n    <meta property="og:locale" content="${LOCALES[lang]}" />`,
    'canonical',
  )
  html = replaceOnce(html, metaTag('property', 'og:url'), `<meta property="og:url" content="${url}" />`, 'og:url')
  html = replaceOnce(html, metaTag('property', 'og:title'), `<meta property="og:title" content="${escape(title)}" />`, 'og:title')
  html = replaceOnce(
    html,
    metaTag('property', 'og:description'),
    `<meta property="og:description" content="${escape(description)}" />`,
    'og:description',
  )
  return withPreloads(html, preloadsFor(template, pageSource(key), lang, key))
}

const template = await readFile(new URL('index.html', DIST), 'utf8')
let written = 0

for (const [key, path] of Object.entries(ROUTES)) {
  for (const lang of ['en', 'el']) {
    const html = pageFor(template, lang, key, path)
    for (const file of filesFor(localePath(lang, path))) {
      const target = new URL(file, DIST)
      await mkdir(dirname(fileURLToPath(target)), { recursive: true })
      await writeFile(target, html)
      written++
    }
  }
}

// The not-found page for every other address: the template's defaults, the
// not-found chunk. English fonts — the address carries no reliable language.
await writeFile(new URL('404.html', DIST), withPreloads(template, preloadsFor(template, 'src/pages/NotFound.tsx', 'en')))
written++

await rm(MANIFEST_DIR, { recursive: true })

console.log(`prerender: ${written} pages written for ${Object.keys(ROUTES).length} routes × 2 languages`)
