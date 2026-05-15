import { distance, normalize, polygonCentroid, scale } from './geometry'
import { WORLD_HEIGHT, WORLD_WIDTH } from './shapes'
import type { Particle, Point, Polygon, SliceLine, SliceResult } from './types'

type DrawOptions = {
  shape: Polygon
  dragLine: SliceLine | null
  result: SliceResult | null
  progress: number
  particles: Particle[]
}

export const drawGame = (context: CanvasRenderingContext2D, options: DrawOptions) => {
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  drawBackdrop(context)

  if (options.result) {
    drawSplitResult(context, options)
  } else {
    drawPolygon(context, options.shape, '#f8d36a', '#9a5d10', { x: 0, y: 0 })
  }

  if (options.dragLine) {
    drawSliceGuide(context, options.dragLine)
  }

  if (options.result) {
    drawParticles(context, options.particles, options.progress)
  }
}

export const createParticles = (line: SliceLine, count = 20): Particle[] => {
  const center = {
    x: (line.start.x + line.end.x) / 2,
    y: (line.start.y + line.end.y) / 2,
  }
  const lineVector = normalize({ x: line.end.x - line.start.x, y: line.end.y - line.start.y })
  const normal = { x: -lineVector.y, y: lineVector.x }

  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? 1 : -1
    const speed = 45 + (index % 7) * 12
    return {
      origin: {
        x: center.x + lineVector.x * (index - count / 2) * 10,
        y: center.y + lineVector.y * (index - count / 2) * 10,
      },
      velocity: scale(normal, side * speed),
      radius: 2 + (index % 4),
    }
  })
}

const drawBackdrop = (context: CanvasRenderingContext2D) => {
  const gradient = context.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  gradient.addColorStop(0, '#191326')
  gradient.addColorStop(0.55, '#271b3d')
  gradient.addColorStop(1, '#101827')
  context.fillStyle = gradient
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  context.save()
  context.globalAlpha = 0.16
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1
  for (let x = 80; x < WORLD_WIDTH; x += 80) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, WORLD_HEIGHT)
    context.stroke()
  }
  for (let y = 80; y < WORLD_HEIGHT; y += 80) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(WORLD_WIDTH, y)
    context.stroke()
  }
  context.restore()
}

const drawSplitResult = (context: CanvasRenderingContext2D, options: DrawOptions) => {
  if (!options.result) return

  const wholeCenter = polygonCentroid(options.shape)
  const eased = easeOutBack(options.progress)

  const drawHalf = (polygon: Polygon, fill: string, stroke: string) => {
    const center = polygonCentroid(polygon)
    const direction = normalize({
      x: center.x - wholeCenter.x,
      y: center.y - wholeCenter.y,
    })
    const fallback = options.dragLine
      ? normalize({ x: -(options.dragLine.end.y - options.dragLine.start.y), y: options.dragLine.end.x - options.dragLine.start.x })
      : { x: 1, y: 0 }
    const offsetDirection = distance(direction, { x: 0, y: 0 }) > 0 ? direction : fallback
    const offset = scale(offsetDirection, 92 * eased)
    drawPolygon(context, polygon, fill, stroke, offset)
  }

  drawHalf(options.result.left, '#ffd86f', '#9b6213')
  drawHalf(options.result.right, '#ff9f6f', '#89331e')
}

const drawPolygon = (
  context: CanvasRenderingContext2D,
  polygon: Polygon,
  fill: string,
  stroke: string,
  offset: Point,
) => {
  if (polygon.length === 0) return

  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.35)'
  context.shadowBlur = 24
  context.shadowOffsetY = 16
  context.beginPath()
  context.moveTo(polygon[0].x + offset.x, polygon[0].y + offset.y)
  for (const point of polygon.slice(1)) {
    context.lineTo(point.x + offset.x, point.y + offset.y)
  }
  context.closePath()
  context.fillStyle = fill
  context.fill()
  context.shadowColor = 'transparent'
  context.lineWidth = 6
  context.lineJoin = 'round'
  context.strokeStyle = stroke
  context.stroke()
  context.restore()
}

const drawSliceGuide = (context: CanvasRenderingContext2D, line: SliceLine) => {
  context.save()
  context.lineCap = 'round'
  context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  context.lineWidth = 7
  context.setLineDash([18, 14])
  context.beginPath()
  context.moveTo(line.start.x, line.start.y)
  context.lineTo(line.end.x, line.end.y)
  context.stroke()

  context.setLineDash([])
  context.strokeStyle = '#f4ff8a'
  context.lineWidth = 2
  context.stroke()
  context.restore()
}

const drawParticles = (context: CanvasRenderingContext2D, particles: Particle[], progress: number) => {
  context.save()
  context.globalAlpha = Math.max(0, 1 - progress)
  context.fillStyle = '#f4ff8a'
  for (const particle of particles) {
    context.beginPath()
    context.arc(
      particle.origin.x + particle.velocity.x * progress,
      particle.origin.y + particle.velocity.y * progress,
      particle.radius * (1 - progress * 0.35),
      0,
      Math.PI * 2,
    )
    context.fill()
  }
  context.restore()
}

const easeOutBack = (value: number) => {
  const clamped = Math.min(Math.max(value, 0), 1)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2)
}
