import type { Point, ShapeInfo, ShapeRenderStyle } from './types'

export const CANVAS_SIZE = 500

export const createShape = (level: number, seed: number): ShapeInfo => {
  const random = mulberry32(seed)
  const cx = CANVAS_SIZE / 2 + (random() - 0.5) * 40
  const cy = CANVAS_SIZE / 2 + (random() - 0.5) * 40
  const baseScale = 130 + Math.min(level, 12) * 6

  const templateChance = 0.48
  const concavityChance = Math.min(0.3 + level * 0.035, 0.55) * 0.65
  const shapeRoll = random()

  if (shapeRoll < templateChance) {
    return createTemplateShape(cx, cy, baseScale, random)
  }

  if (shapeRoll < templateChance + concavityChance) {
    return createConcaveShape(cx, cy, baseScale, random)
  }

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
  const renderStyle = randomRenderStyle(random)

  return { name: nameFromRandom(random), polygon: fitted, color, renderStyle }
}

type NormalizedPoint = [number, number]

type ConcaveTemplate = {
  name: string
  points: NormalizedPoint[]
}

const CONCAVE_TEMPLATES: ConcaveTemplate[] = [
  {
    name: 'Notched H',
    points: [
      [-1, -1], [-0.44, -1], [-0.44, -0.27], [0.44, -0.27],
      [0.44, -1], [1, -1], [1, 1], [0.44, 1],
      [0.44, 0.27], [-0.44, 0.27], [-0.44, 1], [-1, 1],
    ],
  },
  {
    name: 'Bent Comb',
    points: [
      [-1, -1], [1, -1], [1, -0.62], [-0.52, -0.62],
      [-0.52, -0.36], [0.78, -0.36], [0.78, -0.08],
      [-0.52, -0.08], [-0.52, 0.2], [0.92, 0.2],
      [0.92, 0.48], [-0.52, 0.48], [-0.52, 1], [-1, 1],
    ],
  },
  {
    name: 'Crooked C',
    points: [
      [1, -1], [-1, -1], [-1, 1], [1, 1],
      [1, 0.42], [-0.32, 0.42], [-0.32, -0.42], [1, -0.42],
    ],
  },
  {
    name: 'Jagged Key',
    points: [
      [-1, -0.32], [-0.24, -0.32], [-0.24, -0.78], [0.34, -0.78],
      [0.34, -0.4], [0.76, -0.74], [1, -0.44], [0.58, 0],
      [1, 0.44], [0.76, 0.74], [0.34, 0.4], [0.34, 0.78],
      [-0.24, 0.78], [-0.24, 0.32], [-1, 0.32],
    ],
  },
  {
    name: 'Cracked Staple',
    points: [
      [-1, -1], [1, -1], [1, 1], [0.5, 1],
      [0.5, -0.48], [0.2, -0.48], [0.2, 0.82],
      [-0.2, 0.82], [-0.2, -0.48], [-0.5, -0.48],
      [-0.5, 1], [-1, 1],
    ],
  },
]

type ShapeTemplate = {
  name: string
  build: () => NormalizedPoint[]
}

const fromPoints = (name: string, points: NormalizedPoint[]): ShapeTemplate => ({
  name,
  build: () => points,
})

const fromGrid = (name: string, rows: string[]): ShapeTemplate => ({
  name,
  build: () => cellsToPolygon(rows),
})

const fromBuild = (name: string, build: () => NormalizedPoint[]): ShapeTemplate => ({ name, build })

const REGULAR_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromBuild('Triangle', () => regularPolygon(3)),
  fromPoints('Right Triangle', [[-0.9, 0.9], [-0.9, -0.9], [0.95, 0.9]]),
  fromPoints('Isosceles Triangle', [[0, -1], [0.95, 0.85], [-0.95, 0.85]]),
  fromPoints('Scalene Triangle', [[-0.95, 0.78], [-0.26, -0.96], [0.9, 0.56]]),
  fromBuild('Square', () => rectPolygon(1.85, 1.85)),
  fromBuild('Diamond', () => regularPolygon(4, 1, 0)),
  fromBuild('Rectangle', () => rectPolygon(1.9, 1.15)),
  fromBuild('Wide Rectangle', () => rectPolygon(2.2, 0.75)),
  fromBuild('Tall Rectangle', () => rectPolygon(0.75, 2.2)),
  fromBuild('Pentagon', () => regularPolygon(5)),
  fromBuild('Hexagon', () => regularPolygon(6)),
  fromBuild('Heptagon', () => regularPolygon(7)),
  fromBuild('Octagon', () => regularPolygon(8)),
  fromBuild('Decagon', () => regularPolygon(10)),
  fromBuild('Dodecagon', () => regularPolygon(12)),
  fromBuild('Circle-ish 24-gon', () => regularPolygon(24)),
  fromBuild('Oval', () => ellipsePolygon(32, 1.15, 0.72)),
  fromBuild('Capsule', () => capsulePolygon(16, 1.95, 0.8)),
  fromPoints('Trapezoid', [[-0.72, -0.9], [0.72, -0.9], [1, 0.9], [-1, 0.9]]),
  fromPoints('Parallelogram', [[-0.62, -0.9], [1, -0.9], [0.62, 0.9], [-1, 0.9]]),
  fromPoints('Kite', [[0, -1], [0.82, -0.08], [0, 1], [-0.52, -0.08]]),
  fromPoints('Rhombus', [[0, -1], [0.9, 0], [0, 1], [-0.9, 0]]),
]

const CLASSIC_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromGrid('Plus Sign', ['..##..', '..##..', '######', '######', '..##..', '..##..']),
  fromGrid('Cross', ['##..##', '.####.', '..##..', '.####.', '##..##']),
  fromGrid('T Shape', ['#######', '..###..', '..###..', '..###..', '..###..']),
  fromGrid('L Shape', ['##....', '##....', '##....', '##....', '######']),
  fromGrid('H Shape', ['##..##', '##..##', '######', '######', '##..##', '##..##']),
  fromGrid('U Shape', ['##..##', '##..##', '##..##', '##..##', '######']),
  fromGrid('C Shape', ['######', '##....', '##....', '##....', '######']),
  fromGrid('E Shape', ['######', '##....', '#####.', '##....', '######']),
  fromGrid('F Shape', ['######', '##....', '#####.', '##....', '##....']),
  fromGrid('Z Shape', ['######', '...##.', '..##..', '.##...', '######']),
  fromPoints('Chevron', [[-1, -0.72], [-0.54, -1], [0, -0.16], [0.54, -1], [1, -0.72], [0, 1]]),
  fromPoints('Arrow Left', [[-1, 0], [-0.25, -0.86], [-0.25, -0.35], [1, -0.35], [1, 0.35], [-0.25, 0.35], [-0.25, 0.86]]),
  fromPoints('Arrow Right', [[1, 0], [0.25, -0.86], [0.25, -0.35], [-1, -0.35], [-1, 0.35], [0.25, 0.35], [0.25, 0.86]]),
  fromPoints('Double Arrow', [[-1, 0], [-0.52, -0.7], [-0.52, -0.28], [0.52, -0.28], [0.52, -0.7], [1, 0], [0.52, 0.7], [0.52, 0.28], [-0.52, 0.28], [-0.52, 0.7]]),
  fromBuild('Star', () => starPolygon(6, 0.45, 1)),
  fromBuild('Burst Star', () => starPolygon(12, 0.55, 1)),
  fromPoints('Crescent', [[0.82, -1], [0.1, -0.76], [-0.38, -0.3], [-0.5, 0.25], [-0.22, 0.78], [0.5, 1], [0.2, 0.52], [0.12, 0.12], [0.22, -0.36]]),
  fromPoints('Pac-Man', [[0, -1], [0.72, -0.7], [0.15, 0], [0.72, 0.7], [0, 1], [-0.72, 0.7], [-1, 0], [-0.72, -0.7]]),
  fromGrid('Spiral Block', ['######', '##....', '##.###', '##.#.#', '##...#', '######']),
  fromGrid('Zigzag Block', ['##....', '####..', '..####', '....##']),
  fromGrid('Stair Step Shape', ['##....', '###...', '####..', '#####.', '######']),
  fromGrid('Comb', ['######', '##.##.', '##.##.', '##.##.', '##.##.']),
  fromGrid('Fork', ['##.##.##', '##.##.##', '########', '...##...', '...##...']),
  fromGrid('Wrench Shape', ['###...#', '####.##', '..###..', '..###..', '.##.###', '#...###']),
  fromGrid('Key Shape', ['####....', '######..', '####.###', '######..', '####....']),
]

const SYMBOL_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromGrid('Pi', ['#######', '..#.#..', '..#.#..', '..#.#..', '.##.##.']),
  fromGrid('Sigma', ['#######', '##.....', '.###...', '...###.', '##.....', '#######']),
  fromGrid('Omega', ['.#####.', '##...##', '##...##', '##...##', '.##.##.', '###.###']),
  fromGrid('Lambda', ['...##..', '..####.', '..####.', '.##..##', '.##..##', '##....#']),
  fromPoints('Delta', [[0, -1], [1, 1], [-1, 1]]),
  fromGrid('Infinity Loop', ['##...##', '###.###', '.#####.', '###.###', '##...##']),
  fromPoints('Heart', [[0, 0.92], [-0.92, 0.05], [-0.78, -0.62], [-0.3, -0.88], [0, -0.56], [0.3, -0.88], [0.78, -0.62], [0.92, 0.05]]),
  fromPoints('Lightning Bolt', [[0.12, -1], [0.82, -1], [0.3, -0.12], [0.9, -0.12], [-0.1, 1], [0.04, 0.16], [-0.72, 0.16]]),
  fromGrid('Music Note', ['...###', '...###', '...###', '...###', '######', '######', '###...']),
  fromGrid('Question Mark', ['.####.', '##..##', '...##.', '..##..', '..##..', '..###.']),
  fromGrid('Exclamation Mark', ['..##..', '..##..', '..##..', '..##..', '.####.']),
  fromGrid('Hashtag', ['.##.##.', '#######', '.##.##.', '#######', '.##.##.']),
  fromGrid('Asterisk', ['##..##', '.####.', '..##..', '.####.', '##..##']),
  fromGrid('Bracket', ['#####', '##...', '##...', '##...', '#####']),
  fromGrid('Curly Brace', ['..####', '..##..', '###...', '..##..', '..####']),
  fromPoints('Shield', [[0, -1], [0.9, -0.62], [0.72, 0.38], [0, 1], [-0.72, 0.38], [-0.9, -0.62]]),
  fromPoints('Crown', [[-1, 0.85], [-0.86, -0.58], [-0.34, 0.05], [0, -0.82], [0.34, 0.05], [0.86, -0.58], [1, 0.85]]),
  fromBuild('Target Silhouette', () => regularPolygon(20)),
  fromGrid('Trophy Silhouette', ['.#####.', '#######', '.#####.', '..###..', '.#####.', '#######']),
]

const WAVE_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromBuild('Sine Wave Ribbon', () => waveRibbon(2, 0.36, 0.22, 32)),
  fromBuild('Ocean Wave', () => waveRibbon(1.25, 0.55, 0.27, 32)),
  fromBuild('Double Wave', () => waveRibbon(3, 0.28, 0.2, 36)),
  fromBuild('Ripple Strip', () => waveRibbon(4, 0.18, 0.16, 40)),
  fromGrid('Dripping Blob', ['.#####.', '#######', '#######', '##.###.', '##..#..', '#......']),
  fromBuild('Splash', () => starPolygon(9, 0.42, 1)),
  fromPoints('Flame', [[0, -1], [0.46, -0.38], [0.34, 0.08], [0.86, 0.4], [0.28, 1], [-0.34, 0.84], [-0.72, 0.28], [-0.34, -0.14], [-0.52, -0.64]]),
  fromPoints('Leaf', [[0, -1], [0.78, -0.58], [1, 0], [0.68, 0.62], [0, 1], [-0.68, 0.62], [-1, 0], [-0.78, -0.58]]),
  fromBuild('Petal', () => ellipsePolygon(20, 0.72, 1.18)),
  fromGrid('Cloud', ['..###...', '.######.', '########', '########', '.######.']),
  fromPoints('Moon Crescent', [[0.82, -1], [0.08, -0.72], [-0.42, -0.22], [-0.48, 0.32], [-0.08, 0.82], [0.68, 1], [0.28, 0.52], [0.16, 0.05], [0.28, -0.42]]),
  fromBuild('Torn Paper Strip', () => jaggedStrip(14)),
  fromBuild('Sawtooth Wave', () => sawtoothRibbon(8)),
  fromPoints('Ribbon Twist', [[-1, -0.5], [-0.22, -0.82], [0.22, -0.22], [1, -0.42], [0.28, 0.82], [-0.22, 0.22], [-1, 0.5]]),
  fromPoints('Banana Curve', [[-0.95, 0.15], [-0.66, -0.48], [0.1, -0.78], [0.86, -0.44], [0.98, -0.12], [0.1, -0.25], [-0.55, 0.2], [-0.72, 0.58]]),
  fromBuild('Snake Curve', () => waveRibbon(2.25, 0.42, 0.18, 38)),
]

const CHARACTER_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromGrid('Smiley Face', ['..###..', '.#####.', '#######', '#######', '##...##', '.#####.', '..###..']),
  fromGrid('Frowny Face', ['..###..', '.#####.', '#######', '#.....#', '#######', '.#####.', '..###..']),
  fromGrid('Ghost', ['..###..', '.#####.', '#######', '#######', '#######', '##.##.#']),
  fromGrid('Skull Silhouette', ['.#####.', '#######', '#######', '.#####.', '..###..', '.#####.']),
  fromGrid('Cat Head', ['#.....#', '##...##', '#######', '#######', '.#####.']),
  fromGrid('Bunny Head', ['.##.##.', '.##.##.', '.#####.', '#######', '.#####.']),
  fromGrid('Alien Head', ['.#####.', '#######', '#######', '.#####.', '..###..']),
  fromGrid('Robot Head', ['..#..', '#####', '#####', '#####', '.###.']),
  fromGrid('Mushroom', ['..###..', '.#####.', '#######', '..###..', '..###..']),
  fromGrid('Fish', ['..####.', '.######', '#######', '.######', '..####.', '##.....']),
  fromGrid('Bird', ['..##...', '.####..', '######.', '.######', '..###..']),
  fromGrid('Butterfly', ['##...##', '###.###', '.#####.', '.#####.', '###.###', '##...##']),
  fromBuild('Turtle Shell', () => regularPolygon(10)),
  fromGrid('Crab Shape', ['##...##', '.#####.', '#######', '#######', '##...##']),
  fromGrid('Octopus Blob', ['.#####.', '#######', '#######', '#.#.#.#', '#.#.#.#']),
]

const OBJECT_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromGrid('House', ['..##..', '.####.', '######', '.####.', '.####.']),
  fromGrid('Castle Tower', ['#.#.#', '#####', '#####', '#####', '#####']),
  fromPoints('Rocket', [[0, -1], [0.52, -0.36], [0.36, 0.55], [0.78, 1], [0.12, 0.78], [-0.12, 0.78], [-0.78, 1], [-0.36, 0.55], [-0.52, -0.36]]),
  fromGrid('Boat', ['...##..', '..####.', '.######', '#######']),
  fromPoints('Anchor', [[0, -1], [0.26, -0.72], [0.12, -0.5], [0.12, 0.35], [0.68, 0.12], [0.92, 0.46], [0.35, 0.95], [0, 0.62], [-0.35, 0.95], [-0.92, 0.46], [-0.68, 0.12], [-0.12, 0.35], [-0.12, -0.5], [-0.26, -0.72]]),
  fromPoints('Sword', [[0, -1], [0.18, 0.38], [0.72, 0.52], [0.44, 0.78], [0.12, 0.62], [0.08, 1], [-0.08, 1], [-0.12, 0.62], [-0.44, 0.78], [-0.72, 0.52], [-0.18, 0.38]]),
  fromGrid('Axe', ['..###.', '.####.', '..###.', '..##..', '..##..', '..##..']),
  fromGrid('Hammer', ['######', '..##..', '..##..', '..##..', '..##..']),
  fromBuild('Gear Cog', () => starPolygon(12, 0.72, 1)),
  fromGrid('Puzzle Piece', ['.#####.', '#######', '###.###', '#######', '.###...', '.#####.']),
  fromGrid('Bottle', ['..##..', '..##..', '.####.', '.####.', '.####.', '.####.']),
  fromGrid('Cup', ['######', '.####.', '.####.', '..##..', '.####.']),
  fromGrid('Mug', ['####..', '####.#', '######', '####.#', '####..']),
  fromGrid('Keyhole', ['.###.', '#####', '.###.', '..#..', '.###.']),
  fromGrid('Lock', ['.###.', '##.##', '#####', '#####']),
  fromGrid('Bell', ['..#..', '.###.', '#####', '#####', '.###.']),
  fromGrid('Camera', ['.##...', '######', '######', '######', '.####.']),
  fromGrid('Game Controller', ['..##..', '.####.', '######', '######', '##..##']),
  fromPoints('Pizza Slice', [[0, -1], [0.92, 0.92], [0.22, 0.72], [-0.22, 0.72], [-0.92, 0.92]]),
  fromBuild('Donut Silhouette', () => regularPolygon(22)),
  fromGrid('Apple', ['..##..', '.####.', '######', '######', '.####.']),
  fromGrid('Car', ['..###..', '.#####.', '#######', '#######']),
  fromPoints('Plane', [[0, -1], [0.22, -0.1], [1, 0.16], [0.25, 0.34], [0.12, 1], [-0.12, 1], [-0.25, 0.34], [-1, 0.16], [-0.22, -0.1]]),
  fromGrid('Tree', ['..#..', '.###.', '#####', '..#..', '..#..']),
  fromPoints('Mountain Range', [[-1, 0.9], [-0.62, -0.2], [-0.35, 0.18], [0.05, -0.82], [0.38, 0.08], [0.66, -0.32], [1, 0.9]]),
]

const HARD_TEMPLATE_SHAPES: ShapeTemplate[] = [
  fromGrid('Maze Block', ['######', '##...#', '#.##.#', '#.#..#', '#...##', '######']),
  fromGrid('Deep Notched Rectangle', ['########', '###..###', '##....##', '###..###', '########']),
  fromGrid('Double H', ['##.##.##', '##.##.##', '########', '##.##.##', '##.##.##']),
  fromGrid('Broken Plus', ['..##..', '######', '###...', '######', '..##..']),
  fromGrid('Offset Stairs', ['##....', '###...', '.###..', '..###.', '...###']),
  fromBuild('Asymmetric Gear', () => asymmetricStar(13)),
  fromGrid('Jagged Crown', ['#.#.#.#', '#######', '.#####.']),
  fromGrid('Spiral Corridor', ['#######', '##....#', '##.##.#', '##.#..#', '##...##', '#######']),
  fromGrid('Nested C Silhouette', ['#######', '##.....', '##.####', '##.##..', '##.####', '##.....', '#######']),
  fromGrid('Four Prong Fork', ['#.#.#.#', '#.#.#.#', '#######', '...#...', '...#...']),
  fromGrid('Bat Shape', ['##...##', '###.###', '.#####.', '..###..']),
  fromGrid('Crab Claw', ['###.###', '#######', '..###..', '..###..']),
  fromGrid('Tetris S', ['..####', '####..', '####..']),
  fromGrid('Tetris Z', ['####..', '..####', '..####']),
  fromGrid('Tetris J', ['##....', '##....', '######']),
  fromGrid('Tetris L', ['....##', '....##', '######']),
  fromGrid('Tetris T', ['######', '..##..', '..##..']),
  fromGrid('Tetris Long Bar', ['########']),
  fromGrid('Hollow Box Silhouette', ['######', '##....', '##....', '##....', '######']),
  fromGrid('Grid Glyph', ['###.##', '.#####', '.##...', '.#####', '##.###']),
]

const TEMPLATE_SHAPES: ShapeTemplate[] = [
  ...REGULAR_TEMPLATE_SHAPES,
  ...CLASSIC_TEMPLATE_SHAPES,
  ...SYMBOL_TEMPLATE_SHAPES,
  ...WAVE_TEMPLATE_SHAPES,
  ...CHARACTER_TEMPLATE_SHAPES,
  ...OBJECT_TEMPLATE_SHAPES,
  ...HARD_TEMPLATE_SHAPES,
]

const AXIS_SYMMETRY_REDUCTION = 0.5
const SYMMETRY_EPSILON = 0.001
const templateSymmetryCache = new WeakMap<ShapeTemplate, boolean>()
let asymmetricTemplateCache: ShapeTemplate[] | null = null

const createTemplateShape = (
  cx: number,
  cy: number,
  baseScale: number,
  random: () => number,
): ShapeInfo => {
  const template = selectTemplate(random)
  const points = template.build()

  if (points.length < 3) {
    return createFallbackShape(cx, cy, baseScale, random)
  }

  const angle = random() * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const sx = baseScale * (0.82 + random() * 0.32)
  const sy = baseScale * (0.82 + random() * 0.32)
  const polygon = points.map(([x, y]) => {
    const localX = x * sx
    const localY = y * sy

    return {
      x: cx + localX * cos - localY * sin,
      y: cy + localX * sin + localY * cos,
    }
  })
  const color = SHAPE_COLORS[Math.floor(random() * SHAPE_COLORS.length)]

  return {
    name: template.name,
    polygon: fitToCanvas(polygon),
    color,
    renderStyle: randomRenderStyle(random),
  }
}

const selectTemplate = (random: () => number): ShapeTemplate => {
  const template = pickTemplate(TEMPLATE_SHAPES, random)

  if (!hasAxisSymmetry(template) || random() >= AXIS_SYMMETRY_REDUCTION) {
    return template
  }

  const asymmetricTemplates = getAsymmetricTemplates()
  return asymmetricTemplates.length > 0 ? pickTemplate(asymmetricTemplates, random) : template
}

const pickTemplate = (templates: ShapeTemplate[], random: () => number): ShapeTemplate => {
  const index = Math.min(Math.floor(random() * templates.length), templates.length - 1)
  return templates[index]
}

const getAsymmetricTemplates = (): ShapeTemplate[] => {
  asymmetricTemplateCache ??= TEMPLATE_SHAPES.filter((template) => !hasAxisSymmetry(template))
  return asymmetricTemplateCache
}

const hasAxisSymmetry = (template: ShapeTemplate): boolean => {
  const cached = templateSymmetryCache.get(template)
  if (cached !== undefined) return cached

  const symmetric = hasReflectionAxis(template.build())
  templateSymmetryCache.set(template, symmetric)
  return symmetric
}

const hasReflectionAxis = (points: NormalizedPoint[]): boolean => {
  if (points.length < 3) return false

  const center = normalizedCentroid(points)
  const candidateAxes = symmetryAxisCandidates(points, center)

  return candidateAxes.some(([dx, dy]) => isSymmetricAcrossAxis(points, center, dx, dy))
}

const symmetryAxisCandidates = (
  points: NormalizedPoint[],
  [cx, cy]: NormalizedPoint,
): NormalizedPoint[] => {
  const candidates: NormalizedPoint[] = []
  const seen = new Set<string>()
  const addCandidate = (dx: number, dy: number) => {
    const length = Math.hypot(dx, dy)
    if (length < SYMMETRY_EPSILON) return

    let nx = dx / length
    let ny = dy / length

    if (nx < -SYMMETRY_EPSILON || (Math.abs(nx) <= SYMMETRY_EPSILON && ny < 0)) {
      nx *= -1
      ny *= -1
    }

    const key = `${Math.round(nx / SYMMETRY_EPSILON)},${Math.round(ny / SYMMETRY_EPSILON)}`
    if (!seen.has(key)) {
      seen.add(key)
      candidates.push([nx, ny])
    }
  }

  for (const [x, y] of points) {
    addCandidate(x - cx, y - cy)
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const [ax, ay] = points[i]
      const [bx, by] = points[j]
      addCandidate(ay - by, bx - ax)
    }
  }

  return candidates
}

const isSymmetricAcrossAxis = (
  points: NormalizedPoint[],
  [cx, cy]: NormalizedPoint,
  dx: number,
  dy: number,
): boolean =>
  points.every(([x, y]) => {
    const localX = x - cx
    const localY = y - cy
    const projection = localX * dx + localY * dy
    const reflected: NormalizedPoint = [
      cx + 2 * projection * dx - localX,
      cy + 2 * projection * dy - localY,
    ]

    return points.some(([candidateX, candidateY]) =>
      distanceSquared(reflected, [candidateX, candidateY]) <= SYMMETRY_EPSILON * SYMMETRY_EPSILON,
    )
  })

const normalizedCentroid = (points: NormalizedPoint[]): NormalizedPoint => {
  let area = 0
  let x = 0
  let y = 0

  for (let index = 0; index < points.length; index++) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const cross = current[0] * next[1] - next[0] * current[1]
    area += cross
    x += (current[0] + next[0]) * cross
    y += (current[1] + next[1]) * cross
  }

  if (Math.abs(area) < SYMMETRY_EPSILON) {
    const total = points.reduce<NormalizedPoint>(
      ([sumX, sumY], [pointX, pointY]) => [sumX + pointX, sumY + pointY],
      [0, 0],
    )
    return [total[0] / points.length, total[1] / points.length]
  }

  return [x / (3 * area), y / (3 * area)]
}

const distanceSquared = ([ax, ay]: NormalizedPoint, [bx, by]: NormalizedPoint): number => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

const createConcaveShape = (
  cx: number,
  cy: number,
  baseScale: number,
  random: () => number,
): ShapeInfo => {
  const template = CONCAVE_TEMPLATES[Math.floor(random() * CONCAVE_TEMPLATES.length)]
  const angle = random() * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const sx = baseScale * (0.78 + random() * 0.28)
  const sy = baseScale * (0.78 + random() * 0.28)
  const jitter = 0.035
  const renderStyle = randomRenderStyle(random)

  const polygon = template.points.map(([x, y]) => {
    const localX = (x + (random() - 0.5) * jitter) * sx
    const localY = (y + (random() - 0.5) * jitter) * sy

    return {
      x: cx + localX * cos - localY * sin,
      y: cy + localX * sin + localY * cos,
    }
  })
  const color = SHAPE_COLORS[Math.floor(random() * SHAPE_COLORS.length)]

  return {
    name: template.name,
    polygon: fitToCanvas(polygon),
    color,
    renderStyle,
  }
}

const regularPolygon = (sides: number, radius = 1, rotation = -Math.PI / 2): NormalizedPoint[] =>
  Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })

const rectPolygon = (width: number, height: number): NormalizedPoint[] => {
  const x = width / 2
  const y = height / 2
  return [[-x, -y], [x, -y], [x, y], [-x, y]]
}

const ellipsePolygon = (segments: number, width: number, height: number): NormalizedPoint[] =>
  Array.from({ length: segments }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segments
    return [Math.cos(angle) * width, Math.sin(angle) * height]
  })

const capsulePolygon = (segments: number, width: number, height: number): NormalizedPoint[] => {
  const capRadius = height / 2
  const straight = width / 2 - capRadius
  const points: NormalizedPoint[] = []

  for (let i = 0; i <= segments; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / segments
    points.push([straight + Math.cos(angle) * capRadius, Math.sin(angle) * capRadius])
  }

  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI / 2 + (Math.PI * i) / segments
    points.push([-straight + Math.cos(angle) * capRadius, Math.sin(angle) * capRadius])
  }

  return points
}

const starPolygon = (points: number, innerRadius: number, outerRadius: number): NormalizedPoint[] =>
  Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = -Math.PI / 2 + (Math.PI * index) / points
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })

const asymmetricStar = (points: number): NormalizedPoint[] =>
  Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? 0.85 + (index % 5) * 0.04 : 0.42 + (index % 3) * 0.07
    const angle = -Math.PI / 2 + (Math.PI * index) / points
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })

const waveRibbon = (
  waves: number,
  amplitude: number,
  thickness: number,
  samples: number,
): NormalizedPoint[] => {
  const top: NormalizedPoint[] = []
  const bottom: NormalizedPoint[] = []

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const x = -1 + t * 2
    const y = Math.sin(t * Math.PI * 2 * waves) * amplitude
    top.push([x, y - thickness])
    bottom.unshift([x, y + thickness])
  }

  return [...top, ...bottom]
}

const sawtoothRibbon = (teeth: number): NormalizedPoint[] => {
  const top: NormalizedPoint[] = []
  const bottom: NormalizedPoint[] = []

  for (let i = 0; i <= teeth; i++) {
    const x = -1 + (i / teeth) * 2
    const y = i % 2 === 0 ? -0.35 : 0.35
    top.push([x, y - 0.2])
    bottom.unshift([x, y + 0.2])
  }

  return [...top, ...bottom]
}

const jaggedStrip = (segments: number): NormalizedPoint[] => {
  const top: NormalizedPoint[] = []
  const bottom: NormalizedPoint[] = []

  for (let i = 0; i <= segments; i++) {
    const x = -1 + (i / segments) * 2
    top.push([x, -0.45 + ((i * 17) % 5) * 0.05])
    bottom.unshift([x, 0.45 - ((i * 11) % 5) * 0.05])
  }

  return [...top, ...bottom]
}

const cellsToPolygon = (rows: string[]): NormalizedPoint[] => {
  const height = rows.length
  const width = Math.max(...rows.map((row) => row.length))
  const filled = new Set<string>()

  rows.forEach((row, y) => {
    row.padEnd(width, '.').split('').forEach((cell, x) => {
      if (cell !== '.' && cell !== ' ') {
        filled.add(`${x},${y}`)
      }
    })
  })

  const hasCell = (x: number, y: number) => filled.has(`${x},${y}`)
  const edges = new Map<string, [number, number]>()
  const key = (x: number, y: number) => `${x},${y}`
  const addEdge = (fromX: number, fromY: number, toX: number, toY: number) => {
    edges.set(key(fromX, fromY), [toX, toY])
  }

  for (const cell of filled) {
    const [x, y] = cell.split(',').map(Number)

    if (!hasCell(x, y - 1)) addEdge(x, y, x + 1, y)
    if (!hasCell(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1)
    if (!hasCell(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1)
    if (!hasCell(x - 1, y)) addEdge(x, y + 1, x, y)
  }

  const start = [...edges.keys()]
    .map((edgeKey) => edgeKey.split(',').map(Number) as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]

  if (!start) return []

  const gridPoints: NormalizedPoint[] = []
  const startKey = key(start[0], start[1])
  let currentKey = startKey

  for (let i = 0; i <= edges.size; i++) {
    const [x, y] = currentKey.split(',').map(Number)
    gridPoints.push([x, y])
    const next = edges.get(currentKey)

    if (!next) break

    const nextKey = key(next[0], next[1])
    if (nextKey === startKey) break
    currentKey = nextKey
  }

  const simplified = removeColinearPoints(gridPoints)
  const maxDimension = Math.max(width, height)

  return simplified.map(([x, y]) => [
    (x - width / 2) / (maxDimension / 2),
    (y - height / 2) / (maxDimension / 2),
  ])
}

const removeColinearPoints = (points: NormalizedPoint[]): NormalizedPoint[] => {
  if (points.length <= 3) return points

  return points.filter((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const dx1 = point[0] - prev[0]
    const dy1 = point[1] - prev[1]
    const dx2 = next[0] - point[0]
    const dy2 = next[1] - point[1]

    return Math.abs(dx1 * dy2 - dy1 * dx2) > 0.0001
  })
}

const randomRenderStyle = (random: () => number): ShapeRenderStyle =>
  random() < 0.5 ? 'smooth' : 'sharp'

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
  return {
    name: nameFromRandom(random),
    polygon: fitToCanvas(polygon),
    color,
    renderStyle: randomRenderStyle(random),
  }
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
