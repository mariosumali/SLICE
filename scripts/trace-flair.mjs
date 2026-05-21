#!/usr/bin/env node
/**
 * Trace alpha silhouettes from imported PNGs and write src/game/flair-imported.json.
 *
 * Usage: node scripts/trace-flair.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMPORT_DIR = path.join(ROOT, 'public/flair/imported')
const META_PATH = path.join(IMPORT_DIR, 'sources.json')
const OUTPUT_PATH = path.join(ROOT, 'src/game/flair-imported.json')

const ALPHA_THRESHOLD = 40
const TRACE_SIZE = 220
const MIN_POINTS = 4
const MAX_POINTS = 56

const loadMeta = async () => {
  try {
    return JSON.parse(await fs.readFile(META_PATH, 'utf8'))
  } catch {
    return { items: [] }
  }
}

const traceContour = (mask, width, height) => {
  const index = (x, y) => y * width + x
  const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[index(x, y)]

  let start = null
  for (let y = 0; y < height && !start; y++) {
    for (let x = 0; x < width; x++) {
      if (solid(x, y)) {
        start = { x, y }
        break
      }
    }
  }

  if (!start) return []

  const neighbors = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ]

  const contour = []
  let current = start
  let previousDir = 0
  const maxSteps = width * height * 4

  for (let step = 0; step < maxSteps; step++) {
    contour.push({ x: current.x, y: current.y })

    let found = false
    for (let offset = 0; offset < 8; offset++) {
      const dir = (previousDir + offset + 5) % 8
      const [dx, dy] = neighbors[dir]
      const next = { x: current.x + dx, y: current.y + dy }
      if (solid(next.x, next.y)) {
        current = next
        previousDir = dir
        found = true
        break
      }
    }

    if (!found) break
    if (current.x === start.x && current.y === start.y && contour.length > 8) break
  }

  return contour
}

const simplify = (points, tolerance = 2.4) => {
  if (points.length <= MIN_POINTS) return points

  const sqTolerance = tolerance * tolerance
  const distanceToSegment = (point, start, end) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    if (dx === 0 && dy === 0) {
      const px = point.x - start.x
      const py = point.y - start.y
      return px * px + py * py
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
    )
    const projX = start.x + t * dx
    const projY = start.y + t * dy
    const ox = point.x - projX
    const oy = point.y - projY
    return ox * ox + oy * oy
  }

  const rdp = (startIndex, endIndex, kept) => {
    let maxDist = 0
    let index = -1
    const start = points[startIndex]
    const end = points[endIndex]

    for (let i = startIndex + 1; i < endIndex; i++) {
      const dist = distanceToSegment(points[i], start, end)
      if (dist > maxDist) {
        maxDist = dist
        index = i
      }
    }

    if (maxDist > sqTolerance) {
      rdp(startIndex, index, kept)
      kept.add(index)
      rdp(index, endIndex, kept)
    }
  }

  const kept = new Set([0, points.length - 1])
  rdp(0, points.length - 1, kept)
  const simplified = [...kept].sort((a, b) => a - b).map((index) => points[index])

  if (simplified.length > MAX_POINTS) {
    const stride = Math.ceil(simplified.length / MAX_POINTS)
    return simplified.filter((_, index) => index % stride === 0)
  }

  return simplified
}

const normalizePoints = (points, width, height) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const scale = Math.max(maxX - minX, maxY - minY) / 2 || 1

  return points.map((point) => {
    const x = (point.x - cx) / scale
    const y = (point.y - cy) / scale
    return [Number(x.toFixed(3)), Number(y.toFixed(3))]
  })
}

const removeBackground = (data, width, height, channels) => {
  let transparentCount = 0
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] < 20) transparentCount++
  }

  if (transparentCount / (width * height) > 0.12) {
    return
  }

  const sample = (x, y) => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }

  const corners = [
    sample(0, 0),
    sample(width - 1, 0),
    sample(0, height - 1),
    sample(width - 1, height - 1),
  ]

  const bg = corners.reduce(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
    [0, 0, 0],
  ).map((value) => value / corners.length)

  const threshold = 42
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const dr = data[i] - bg[0]
      const dg = data[i + 1] - bg[1]
      const db = data[i + 2] - bg[2]
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)
      const alphaIndex = i + 3
      if (dist <= threshold) {
        data[alphaIndex] = 0
      } else if (data[alphaIndex] < 20) {
        data[alphaIndex] = 255
      }
    }
  }
}

const polygonFromAlphaBounds = (mask, width, height) => {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No opaque pixels found')
  }

  const pad = 1
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad)
  maxY = Math.min(height - 1, maxY + pad)

  const w = maxX - minX
  const h = maxY - minY
  const r = Math.min(w, h) * 0.14

  const points = [
    { x: minX + r, y: minY },
    { x: maxX - r, y: minY },
    { x: maxX, y: minY + r },
    { x: maxX, y: maxY - r },
    { x: maxX - r, y: maxY },
    { x: minX + r, y: maxY },
    { x: minX, y: maxY - r },
    { x: minX, y: minY + r },
  ]

  return normalizePoints(points, width, height)
}

const traceImage = async (filePath) => {
  const pipeline = sharp(filePath)
    .ensureAlpha()
    .resize(TRACE_SIZE, TRACE_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true })

  removeBackground(data, info.width, info.height, info.channels)

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png({ compressionLevel: 9 })
    .toFile(filePath)

  const mask = new Uint8Array(info.width * info.height)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * info.channels + 3] >= ALPHA_THRESHOLD ? 1 : 0
  }

  const contour = traceContour(mask, info.width, info.height)

  if (contour.length >= MIN_POINTS) {
    const simplified = simplify(contour, 1.6)
    if (simplified.length >= MIN_POINTS) {
      return normalizePoints(simplified, info.width, info.height)
    }
  }

  return polygonFromAlphaBounds(mask, info.width, info.height)
}

const main = async () => {
  const meta = await loadMeta()
  const assets = []

  for (const item of meta.items) {
    const filePath = path.join(IMPORT_DIR, item.fileName)
    try {
      await fs.access(filePath)
      const points = await traceImage(filePath)
      assets.push({
        id: item.id,
        name: item.name,
        src: `/flair/imported/${item.fileName}`,
        category: item.category,
        points,
      })
      console.log(`✓ traced ${item.fileName} (${points.length} pts)`)
    } catch (error) {
      console.warn(`✗ ${item.fileName}: ${error.message}`)
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    assets,
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`\nWrote ${assets.length} asset(s) to src/game/flair-imported.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
