import { distance, normalize, polygonCentroid, scale } from './geometry'
import type { Particle, Point, Polygon, SliceLine, SliceResult } from './types'

const CANVAS_SIZE = 500

type DrawOptions = {
  shape: Polygon
  shapeColor: string
  dragLine: SliceLine | null
  result: SliceResult | null
  progress: number
  particles: Particle[]
}

export const drawGame = (context: CanvasRenderingContext2D, options: DrawOptions) => {
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  drawBackdrop(context)

  if (options.result) {
    drawSplitResult(context, options)
  } else {
    drawShape(context, options.shape, options.shapeColor, { x: 0, y: 0 })
  }

  if (options.dragLine) {
    drawSliceGuide(context, options.dragLine)
  }

  if (options.result) {
    drawParticles(context, options.particles, options.progress)
  }
}

export const createParticles = (line: SliceLine, count = 30): Particle[] => {
  const center = {
    x: (line.start.x + line.end.x) / 2,
    y: (line.start.y + line.end.y) / 2,
  }
  const lineVector = normalize({ x: line.end.x - line.start.x, y: line.end.y - line.start.y })
  const normal = { x: -lineVector.y, y: lineVector.x }

  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? 1 : -1
    const speed = 40 + (index % 7) * 10
    return {
      origin: {
        x: center.x + lineVector.x * (index - count / 2) * 8,
        y: center.y + lineVector.y * (index - count / 2) * 8,
      },
      velocity: scale(normal, side * speed),
      radius: 1.5 + (index % 3),
    }
  })
}

const drawBackdrop = (context: CanvasRenderingContext2D) => {
  context.fillStyle = '#0a0a0a'
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  context.save()
  context.strokeStyle = 'rgba(255, 255, 255, 0.03)'
  context.lineWidth = 1
  for (let x = 50; x < CANVAS_SIZE; x += 50) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, CANVAS_SIZE)
    context.stroke()
  }
  for (let y = 50; y < CANVAS_SIZE; y += 50) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(CANVAS_SIZE, y)
    context.stroke()
  }
  context.restore()

  const cx = CANVAS_SIZE / 2
  const cy = CANVAS_SIZE / 2
  context.save()
  context.strokeStyle = 'rgba(255, 255, 255, 0.07)'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(cx - 12, cy)
  context.lineTo(cx + 12, cy)
  context.stroke()
  context.beginPath()
  context.moveTo(cx, cy - 12)
  context.lineTo(cx, cy + 12)
  context.stroke()
  context.beginPath()
  context.arc(cx, cy, 3, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

const drawSplitResult = (context: CanvasRenderingContext2D, options: DrawOptions) => {
  if (!options.result) return

  const wholeCenter = polygonCentroid(options.shape)
  const eased = easeOutBack(options.progress)

  const drawHalf = (polygon: Polygon, fill: string) => {
    const center = polygonCentroid(polygon)
    const direction = normalize({
      x: center.x - wholeCenter.x,
      y: center.y - wholeCenter.y,
    })
    const fallback = options.dragLine
      ? normalize({ x: -(options.dragLine.end.y - options.dragLine.start.y), y: options.dragLine.end.x - options.dragLine.start.x })
      : { x: 1, y: 0 }
    const offsetDirection = distance(direction, { x: 0, y: 0 }) > 0 ? direction : fallback
    const offset = scale(offsetDirection, 30 * eased)
    drawShape(context, polygon, fill, offset)
  }

  drawHalf(options.result.left, options.shapeColor)
  drawHalf(options.result.right, options.shapeColor)
}

const tracePath = (context: CanvasRenderingContext2D, polygon: Polygon, offset: Point) => {
  if (polygon.length < 3) return

  const n = polygon.length
  context.beginPath()

  const mx = (polygon[n - 1].x + polygon[0].x) / 2 + offset.x
  const my = (polygon[n - 1].y + polygon[0].y) / 2 + offset.y
  context.moveTo(mx, my)

  for (let i = 0; i < n; i++) {
    const cp = polygon[i]
    const next = polygon[(i + 1) % n]
    context.quadraticCurveTo(
      cp.x + offset.x,
      cp.y + offset.y,
      (cp.x + next.x) / 2 + offset.x,
      (cp.y + next.y) / 2 + offset.y,
    )
  }

  context.closePath()
}

const drawShape = (
  context: CanvasRenderingContext2D,
  polygon: Polygon,
  fill: string,
  offset: Point,
) => {
  if (polygon.length === 0) return

  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.7)'
  context.shadowBlur = 24
  context.shadowOffsetY = 8
  tracePath(context, polygon, offset)
  context.fillStyle = fill
  context.fill()
  context.restore()
}

const drawSliceGuide = (context: CanvasRenderingContext2D, line: SliceLine) => {
  context.save()

  context.lineCap = 'round'
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  context.lineWidth = 10
  context.beginPath()
  context.moveTo(line.start.x, line.start.y)
  context.lineTo(line.end.x, line.end.y)
  context.stroke()

  context.strokeStyle = '#fff'
  context.lineWidth = 2
  context.setLineDash([12, 7])
  context.beginPath()
  context.moveTo(line.start.x, line.start.y)
  context.lineTo(line.end.x, line.end.y)
  context.stroke()
  context.setLineDash([])

  context.fillStyle = '#FF3D71'
  context.beginPath()
  context.arc(line.start.x, line.start.y, 4, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.arc(line.end.x, line.end.y, 4, 0, Math.PI * 2)
  context.fill()

  context.restore()
}

const PARTICLE_COLORS = ['#E8FF47', '#ffffff', '#FFB347', '#E8FF47']

const drawParticles = (context: CanvasRenderingContext2D, particles: Particle[], progress: number) => {
  context.save()
  context.globalAlpha = Math.max(0, 1 - progress)
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i]
    context.fillStyle = PARTICLE_COLORS[i % PARTICLE_COLORS.length]
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
