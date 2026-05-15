import type { Point, ShapeInfo } from './types'

export const CANVAS_SIZE = 500

export const createShape = (level: number, seed: number): ShapeInfo => {
  const random = mulberry32(seed)
  const cx = CANVAS_SIZE / 2 + (random() - 0.5) * 40
  const cy = CANVAS_SIZE / 2 + (random() - 0.5) * 40
  const baseScale = 130 + Math.min(level, 12) * 6

  const blobCount = 2 + Math.floor(random() * 3)
  const blobs: { cx: number; cy: number; rx: number; ry: number; angle: number }[] = []

  for (let i = 0; i < blobCount; i++) {
    const dist = (0.3 + random() * 1.1) * baseScale
    const dir = random() * Math.PI * 2
    const elongation = 0.3 + random() * 0.9
    const size = (0.55 + random() * 0.75) * baseScale
    const rx = size
    const ry = size * elongation
    const angle = random() * Math.PI

    blobs.push({
      cx: cx + Math.cos(dir) * dist,
      cy: cy + Math.sin(dir) * dist,
      rx,
      ry,
      angle,
    })
  }

  const sampleCount = 72
  const fieldValues: number[] = new Array(sampleCount)
  const points: Point[] = []

  for (let i = 0; i < sampleCount; i++) {
    const theta = (Math.PI * 2 * i) / sampleCount
    const castDist = CANVAS_SIZE * 0.6

    let bestT = -1
    const steps = 200
    let wasInside = false

    for (let s = steps; s >= 0; s--) {
      const t = s / steps
      const px = cx + Math.cos(theta) * castDist * t
      const py = cy + Math.sin(theta) * castDist * t
      const inside = isInsideField(px, py, blobs)

      if (inside && !wasInside) {
        bestT = t
      }
      wasInside = inside
    }

    if (bestT >= 0) {
      fieldValues[i] = bestT * castDist
    } else {
      fieldValues[i] = 0
    }
  }

  const smoothed = smoothArray(fieldValues, 6)

  for (let i = 0; i < sampleCount; i++) {
    const theta = (Math.PI * 2 * i) / sampleCount
    const r = smoothed[i]
    if (r > 5) {
      points.push({
        x: cx + Math.cos(theta) * r,
        y: cy + Math.sin(theta) * r,
      })
    }
  }

  if (points.length < 10) {
    return createFallbackShape(cx, cy, baseScale, random)
  }

  const simplified = simplifyContour(points, 8)
  const fitted = fitToCanvas(simplified)
  const color = SHAPE_COLORS[Math.floor(random() * SHAPE_COLORS.length)]

  return { name: nameFromRandom(random), polygon: fitted, color }
}

const isInsideField = (
  px: number,
  py: number,
  blobs: { cx: number; cy: number; rx: number; ry: number; angle: number }[],
) => {
  let sum = 0
  for (const b of blobs) {
    const dx = px - b.cx
    const dy = py - b.cy
    const cos = Math.cos(-b.angle)
    const sin = Math.sin(-b.angle)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    const d2 = (lx * lx) / (b.rx * b.rx) + (ly * ly) / (b.ry * b.ry)
    sum += Math.exp(-d2 * 1.8)
  }
  return sum > 0.45
}

const smoothArray = (arr: number[], passes: number): number[] => {
  let result = [...arr]
  const n = arr.length
  for (let p = 0; p < passes; p++) {
    const next = new Array(n)
    for (let i = 0; i < n; i++) {
      const prev = result[(i - 1 + n) % n]
      const curr = result[i]
      const nxt = result[(i + 1) % n]
      next[i] = prev * 0.25 + curr * 0.5 + nxt * 0.25
    }
    result = next
  }
  return result
}

const simplifyContour = (points: Point[], minDist: number): Point[] => {
  if (points.length <= 3) return points
  const result: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1]
    const dx = points[i].x - last.x
    const dy = points[i].y - last.y
    if (dx * dx + dy * dy > minDist * minDist) {
      result.push(points[i])
    }
  }
  return result
}

const createFallbackShape = (
  cx: number,
  cy: number,
  baseScale: number,
  random: () => number,
): ShapeInfo => {
  const n = 48
  const polygon: Point[] = []
  for (let i = 0; i < n; i++) {
    const theta = (Math.PI * 2 * i) / n
    const r = baseScale * (0.6 + random() * 0.4)
    polygon.push({
      x: cx + Math.cos(theta) * r,
      y: cy + Math.sin(theta) * r,
    })
  }
  const color = SHAPE_COLORS[Math.floor(random() * SHAPE_COLORS.length)]
  return { name: nameFromRandom(random), polygon: fitToCanvas(polygon), color }
}

const SHAPE_COLORS = [
  '#E8FF47', '#47E8FF', '#FF47A3', '#47FF87',
  '#FF8C47', '#A347FF', '#47FFC8', '#FFD747', '#4787FF',
]

const SAFE_MARGIN = 70

const fitToCanvas = (polygon: Point[]): Point[] => {
  if (polygon.length === 0) return polygon
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of polygon) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const w = maxX - minX
  const h = maxY - minY
  const available = CANVAS_SIZE - SAFE_MARGIN * 2
  const scale = Math.min(1, available / Math.max(w, h))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const targetCx = CANVAS_SIZE / 2
  const targetCy = CANVAS_SIZE / 2
  return polygon.map((p) => ({
    x: (p.x - cx) * scale + targetCx,
    y: (p.y - cy) * scale + targetCy,
  }))
}

const ADJECTIVES = [
  'Wobbly', 'Squishy', 'Lumpy', 'Spiky', 'Blobby',
  'Curvy', 'Twisted', 'Chunky', 'Wiggly', 'Funky',
  'Gooey', 'Puffy', 'Stretchy', 'Wavy', 'Bouncy',
]

const NOUNS = [
  'Blob', 'Puddle', 'Cloud', 'Splat', 'Nugget',
  'Pebble', 'Dumpling', 'Amoeba', 'Lump', 'Droplet',
  'Splotch', 'Morph', 'Glob', 'Smudge', 'Squish',
]

const nameFromRandom = (random: () => number): string => {
  const adj = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(random() * NOUNS.length)]
  return `${adj} ${noun}`
}

export const createSeed = (round: number, level: number) =>
  Math.floor(Date.now() % 1_000_000) + round * 997 + level * 463

const mulberry32 = (seed: number) => {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
