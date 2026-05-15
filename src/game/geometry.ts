import type { Point, Polygon, SliceLine, SliceResult } from './types'

const EPSILON = 0.0001

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })

export const scale = (point: Point, amount: number): Point => ({
  x: point.x * amount,
  y: point.y * amount,
})

export const normalize = (point: Point): Point => {
  const length = Math.hypot(point.x, point.y)
  return length < EPSILON ? { x: 0, y: 0 } : { x: point.x / length, y: point.y / length }
}

export const sideOfLine = (line: SliceLine, point: Point) =>
  (line.end.x - line.start.x) * (point.y - line.start.y) -
  (line.end.y - line.start.y) * (point.x - line.start.x)

export const polygonArea = (polygon: Polygon) => Math.abs(signedArea(polygon))

export const signedArea = (polygon: Polygon) => {
  let area = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    area += current.x * next.y - next.x * current.y
  }

  return area / 2
}

export const polygonCentroid = (polygon: Polygon): Point => {
  const area = signedArea(polygon)

  if (Math.abs(area) < EPSILON) {
    const total = polygon.reduce<Point>((sum, point) => add(sum, point), { x: 0, y: 0 })
    return scale(total, 1 / Math.max(polygon.length, 1))
  }

  let x = 0
  let y = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const cross = current.x * next.y - next.x * current.y
    x += (current.x + next.x) * cross
    y += (current.y + next.y) * cross
  }

  return {
    x: x / (6 * area),
    y: y / (6 * area),
  }
}

export const splitPolygon = (polygon: Polygon, line: SliceLine): SliceResult | null => {
  const positive: Polygon = []
  const negative: Polygon = []

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const currentSide = sideOfLine(line, current)
    const nextSide = sideOfLine(line, next)

    if (currentSide >= -EPSILON) {
      pushUnique(positive, current)
    }
    if (currentSide <= EPSILON) {
      pushUnique(negative, current)
    }

    if ((currentSide > EPSILON && nextSide < -EPSILON) || (currentSide < -EPSILON && nextSide > EPSILON)) {
      const intersection = segmentLineIntersection(current, next, line)
      if (intersection) {
        pushUnique(positive, intersection)
        pushUnique(negative, intersection)
      }
    }
  }

  const leftArea = polygonArea(positive)
  const rightArea = polygonArea(negative)

  if (positive.length < 3 || negative.length < 3 || leftArea < 1 || rightArea < 1) {
    return null
  }

  return {
    left: positive,
    right: negative,
    leftArea,
    rightArea,
  }
}

const segmentLineIntersection = (a: Point, b: Point, line: SliceLine): Point | null => {
  const segment = { x: b.x - a.x, y: b.y - a.y }
  const cutter = { x: line.end.x - line.start.x, y: line.end.y - line.start.y }
  const denominator = segment.x * cutter.y - segment.y * cutter.x

  if (Math.abs(denominator) < EPSILON) {
    return null
  }

  const relative = { x: line.start.x - a.x, y: line.start.y - a.y }
  const t = (relative.x * cutter.y - relative.y * cutter.x) / denominator

  return {
    x: a.x + segment.x * t,
    y: a.y + segment.y * t,
  }
}

const pushUnique = (polygon: Polygon, point: Point) => {
  const last = polygon.at(-1)
  if (!last || distance(last, point) > EPSILON) {
    polygon.push(point)
  }
}
