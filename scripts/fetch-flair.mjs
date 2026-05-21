#!/usr/bin/env node
/**
 * Download CC0 / public-domain images from Openverse into public/flair/imported/.
 *
 * Usage:
 *   node scripts/fetch-flair.mjs --category fruit --count 10
 *   node scripts/fetch-flair.mjs --target 150 --mix
 *   node scripts/fetch-flair.mjs --category character_ip --target 150
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  ALL_FLAIR_QUERIES,
  FLAIR_QUERIES,
  OPENVERSE_API,
  OPENVERSE_LICENSES,
  inferCategory,
} from './flair-config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMPORT_DIR = path.join(ROOT, 'public/flair/imported')
const META_PATH = path.join(IMPORT_DIR, 'sources.json')
const URLS_PATH = path.join(ROOT, 'scripts/flair-urls.json')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'asset'

const shuffle = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const options = {
    category: 'fruit',
    count: 2,
    target: null,
    query: null,
    all: false,
    mix: false,
    urls: false,
    perQuery: 1,
    pages: 2,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--category') options.category = args[++i] ?? options.category
    else if (arg === '--count') options.count = Number(args[++i] ?? options.count)
    else if (arg === '--target') options.target = Number(args[++i] ?? options.target)
    else if (arg === '--query') options.query = args[++i] ?? null
    else if (arg === '--all') options.all = true
    else if (arg === '--mix') options.mix = true
    else if (arg === '--urls') options.urls = true
    else if (arg === '--per-query') options.perQuery = Number(args[++i] ?? options.perQuery)
    else if (arg === '--pages') options.pages = Number(args[++i] ?? options.pages)
  }

  return options
}

const searchOpenverse = async (query, page = 1, pageSize = 20) => {
  const params = new URLSearchParams({
    q: query.trim(),
    license: OPENVERSE_LICENSES,
    page: String(page),
    page_size: String(pageSize),
  })

  const response = await fetch(`${OPENVERSE_API}?${params}`, {
    headers: { 'User-Agent': 'SLICE-game-flair-fetch/1.0 (local dev tool)' },
  })

  if (!response.ok) {
    throw new Error(`Openverse search failed (${response.status}) for "${query}"`)
  }

  const payload = await response.json()
  return payload.results ?? []
}

const IMAGE_EXT = /\.(png|jpe?g|webp)(\?|$)/i

const scoreResult = (item, query) => {
  const title = `${item.title ?? ''}`.toLowerCase()
  const haystack = `${title} ${query}`.toLowerCase()
  let score = 0
  if (item.url?.toLowerCase().includes('.png')) score += 3
  if (/clipart|icon|illustration|silhouette|vector|sticker|emoji|cartoon|character|mascot/.test(haystack)) {
    score += 5
  }
  if (/photo|photograph|pest|disease|herbarium|specimen|scan|specimen sheet/.test(haystack)) score -= 4
  const width = item.width ?? 0
  const height = item.height ?? 0
  const maxSide = Math.max(width, height)
  if (maxSide <= 1400) score += 2
  if (maxSide >= 3600) score -= 1
  return score
}

const pickResults = (results, usedUrls, query, limit = 1) =>
  [...results]
    .filter((item) => {
      if (!item.url || usedUrls.has(item.url)) return false
      if (!IMAGE_EXT.test(item.url)) return false
      const width = item.width ?? 0
      const height = item.height ?? 0
      if (width < 160 || height < 160) return false
      if (width > 5200 || height > 5200) return false
      const ratio = width / Math.max(height, 1)
      return ratio >= 0.35 && ratio <= 2.8
    })
    .sort((a, b) => scoreResult(b, query) - scoreResult(a, query))
    .slice(0, limit)

const downloadImage = async (url, destPath) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SLICE-game-flair-fetch/1.0 (local dev tool)' },
  })

  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 4_000) {
    throw new Error(`File too small (${buffer.length} bytes): ${url}`)
  }

  await sharp(buffer)
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toFile(destPath)

  const stat = await fs.stat(destPath)
  return stat.size
}

const loadMeta = async () => {
  try {
    const raw = await fs.readFile(META_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { items: [] }
  }
}

const saveMeta = async (meta) => {
  await fs.writeFile(META_PATH, `${JSON.stringify(meta, null, 2)}\n`)
}

const loadUrlList = async () => {
  try {
    const raw = await fs.readFile(URLS_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const importFromUrls = async (meta, usedUrls, usedIds) => {
  const entries = await loadUrlList()
  let downloaded = 0

  for (const entry of entries) {
    if (!entry?.url) continue
    if (usedUrls.has(entry.url)) continue

    const baseName = slugify(entry.name || 'imported')
    let id = baseName
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${baseName}-${suffix++}`
    }

    const fileName = `${id}.png`
    const filePath = path.join(IMPORT_DIR, fileName)

    try {
      const bytes = await downloadImage(entry.url, filePath)
      meta.items.push({
        id,
        name: entry.name || id,
        fileName,
        category: entry.category || 'character',
        sourceUrl: entry.url,
        landingUrl: entry.landingUrl ?? entry.url,
        license: entry.license ?? 'manual',
        creator: entry.creator ?? null,
        query: 'manual-url',
        bytes,
        fetchedAt: new Date().toISOString(),
      })
      usedUrls.add(entry.url)
      usedIds.add(id)
      downloaded++
      console.log(`✓ ${fileName} ← manual url`)
    } catch (error) {
      console.warn(`✗ ${entry.url}: ${error.message}`)
    }
  }

  return downloaded
}

const buildQueryList = (options) => {
  if (options.query) return [options.query]
  if (options.mix) return shuffle(ALL_FLAIR_QUERIES)
  if (options.all) return shuffle(ALL_FLAIR_QUERIES)
  if (FLAIR_QUERIES[options.category]) return shuffle(FLAIR_QUERIES[options.category])
  throw new Error(`Unknown category "${options.category}".`)
}

const downloadMatch = async (match, query, options, meta, usedUrls, usedIds) => {
  const baseName = slugify(match.title || query)
  let id = baseName
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${baseName}-${suffix++}`
  }

  const fileName = `${id}.png`
  const filePath = path.join(IMPORT_DIR, fileName)
  const bytes = await downloadImage(match.url, filePath)
  const category =
    options.query != null
      ? inferCategory(query)
      : options.mix || options.all
        ? inferCategory(query)
        : FLAIR_QUERIES[options.category]
          ? options.category === 'character_ip' || options.category === 'character'
            ? 'character'
            : options.category
          : inferCategory(query)

  meta.items.push({
    id,
    name: match.title?.trim() || query,
    fileName,
    category: category === 'character_ip' ? 'character' : category,
    sourceUrl: match.url,
    landingUrl: match.foreign_landing_url,
    license: match.license,
    creator: match.creator,
    query,
    bytes,
    fetchedAt: new Date().toISOString(),
  })

  usedUrls.add(match.url)
  usedIds.add(id)
  console.log(`✓ ${fileName} ← ${query} (${match.license})`)
  return 1
}

const main = async () => {
  const options = parseArgs()
  await fs.mkdir(IMPORT_DIR, { recursive: true })

  const meta = await loadMeta()
  const usedUrls = new Set(meta.items.map((item) => item.sourceUrl))
  const usedIds = new Set(meta.items.map((item) => item.id))

  if (options.urls) {
    const downloaded = await importFromUrls(meta, usedUrls, usedIds)
    await saveMeta(meta)
    console.log(`\nImported ${downloaded} image(s) from scripts/flair-urls.json`)
    console.log('Next: npm run flair:trace')
    return
  }

  const queries = buildQueryList(options)
  const stopAt = options.target ?? null
  let downloaded = 0

  for (const query of queries) {
    if (stopAt != null && meta.items.length >= stopAt) break
    if (stopAt == null && downloaded >= options.count && !options.all && !options.mix && !options.query) {
      break
    }

    for (let page = 1; page <= options.pages; page++) {
      if (stopAt != null && meta.items.length >= stopAt) break

      let results = []
      try {
        results = await searchOpenverse(query, page, 20)
      } catch (error) {
        console.warn(`Skipping "${query}" page ${page}: ${error.message}`)
        await sleep(300)
        break
      }

      if (results.length === 0) break

      const matches = pickResults(results, usedUrls, query, options.perQuery)
      if (matches.length === 0) continue

      for (const match of matches) {
        if (stopAt != null && meta.items.length >= stopAt) break

        try {
          downloaded += await downloadMatch(match, query, options, meta, usedUrls, usedIds)
          await saveMeta(meta)
        } catch (error) {
          console.warn(`✗ ${query}: ${error.message}`)
        }

        await sleep(320)
      }

      await sleep(250)
    }
  }

  console.log(`\nDownloaded ${downloaded} new image(s). Total catalog: ${meta.items.length}`)
  console.log('Next: npm run flair:trace')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
