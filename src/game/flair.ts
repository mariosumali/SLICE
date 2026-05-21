import type { Point } from './types'
import importedManifest from './flair-imported.json'

export type FlairCategory = 'fruit' | 'character' | 'object' | 'symbol'

export type FlairAsset = {
  id: string
  name: string
  src: string
  category: FlairCategory
  /** Normalized polygon for slice math (-1..1 space). */
  points: [number, number][]
}

export type PlacedDecal = {
  src: string
  left: number
  top: number
  rotation: number
  scale: number
  opacity: number
  delay: number
}

type ImportedManifest = {
  assets: Array<{
    id: string
    name: string
    src: string
    category: string
    points: [number, number][]
  }>
}

/** CC0 / public-domain PNGs fetched via `npm run flair:pull`. */
const IMPORTED_FLAIR_ASSETS: FlairAsset[] = (
  (importedManifest as unknown as ImportedManifest).assets ?? []
).map((asset) => ({
    id: asset.id,
    name: asset.name,
    src: asset.src,
    category: asset.category as FlairCategory,
    points: asset.points,
  }),
)
const BUILTIN_FLAIR_ASSETS: FlairAsset[] = [
  {
    id: 'apple',
    name: 'Apple',
    src: '/flair/apple.svg',
    category: 'fruit',
    points: [
      [0, -0.95], [0.55, -0.82], [0.88, -0.42], [0.92, 0.05],
      [0.72, 0.62], [0.28, 0.95], [-0.28, 0.95], [-0.72, 0.62],
      [-0.92, 0.05], [-0.88, -0.42], [-0.55, -0.82],
    ],
  },
  {
    id: 'banana',
    name: 'Banana',
    src: '/flair/banana.svg',
    category: 'fruit',
    points: [
      [-0.95, 0.15], [-0.66, -0.48], [0.1, -0.78], [0.86, -0.44],
      [0.98, -0.12], [0.1, -0.25], [-0.55, 0.2], [-0.72, 0.58],
    ],
  },
  {
    id: 'cherry',
    name: 'Cherry',
    src: '/flair/cherry.svg',
    category: 'fruit',
    points: [
      [-0.12, -0.95], [0.12, -0.95], [0.72, -0.55], [0.95, 0.05],
      [0.82, 0.72], [0.35, 0.95], [-0.35, 0.95], [-0.82, 0.72],
      [-0.95, 0.05], [-0.72, -0.55],
    ],
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    src: '/flair/strawberry.svg',
    category: 'fruit',
    points: [
      [0, -1], [0.35, -0.82], [0.82, -0.35], [0.95, 0.25],
      [0.62, 0.88], [0, 0.95], [-0.62, 0.88], [-0.95, 0.25],
      [-0.82, -0.35], [-0.35, -0.82],
    ],
  },
  {
    id: 'orange',
    name: 'Orange',
    src: '/flair/orange.svg',
    category: 'fruit',
    points: [
      [0, -0.92], [0.65, -0.65], [0.92, 0], [0.65, 0.65],
      [0, 0.92], [-0.65, 0.65], [-0.92, 0], [-0.65, -0.65],
    ],
  },
  {
    id: 'ghost',
    name: 'Ghost',
    src: '/flair/ghost.svg',
    category: 'character',
    points: [
      [-0.72, -0.95], [0.72, -0.95], [0.95, -0.35], [0.95, 0.45],
      [0.72, 0.95], [0.48, 0.72], [0.24, 0.95], [0, 0.72],
      [-0.24, 0.95], [-0.48, 0.72], [-0.72, 0.95], [-0.95, 0.45],
      [-0.95, -0.35],
    ],
  },
  {
    id: 'cat',
    name: 'Cat',
    src: '/flair/cat.svg',
    category: 'character',
    points: [
      [-0.95, -0.35], [-0.72, -0.95], [-0.35, -0.72], [0, -0.55],
      [0.35, -0.72], [0.72, -0.95], [0.95, -0.35], [0.95, 0.55],
      [0.55, 0.95], [-0.55, 0.95], [-0.95, 0.55],
    ],
  },
  {
    id: 'alien',
    name: 'Alien',
    src: '/flair/alien.svg',
    category: 'character',
    points: [
      [-0.85, -0.55], [-0.55, -0.95], [0.55, -0.95], [0.85, -0.55],
      [0.95, 0.15], [0.72, 0.95], [-0.72, 0.95], [-0.95, 0.15],
    ],
  },
  {
    id: 'robot',
    name: 'Robot',
    src: '/flair/robot.svg',
    category: 'character',
    points: [
      [-0.85, -0.95], [0.85, -0.95], [0.95, -0.35], [0.95, 0.85],
      [-0.95, 0.85], [-0.95, -0.35],
    ],
  },
  {
    id: 'star',
    name: 'Star',
    src: '/flair/star.svg',
    category: 'symbol',
    points: [
      [0, -1], [0.22, -0.28], [0.95, -0.28], [0.35, 0.18],
      [0.58, 0.95], [0, 0.48], [-0.58, 0.95], [-0.35, 0.18],
      [-0.95, -0.28], [-0.22, -0.28],
    ],
  },
  {
    id: 'heart',
    name: 'Heart',
    src: '/flair/heart.svg',
    category: 'symbol',
    points: [
      [0, 0.92], [-0.92, 0.05], [-0.78, -0.62], [-0.3, -0.88],
      [0, -0.56], [0.3, -0.88], [0.78, -0.62], [0.92, 0.05],
    ],
  },
  {
    id: 'pizza',
    name: 'Pizza',
    src: '/flair/pizza.svg',
    category: 'object',
    points: [
      [0, -1], [0.92, 0.92], [0.22, 0.72], [-0.22, 0.72], [-0.92, 0.92],
    ],
  },
  {
    id: 'mushroom',
    name: 'Mushroom',
    src: '/flair/mushroom.svg',
    category: 'object',
    points: [
      [-0.95, 0.15], [-0.72, -0.55], [-0.35, -0.92], [0.35, -0.92],
      [0.72, -0.55], [0.95, 0.15], [0.55, 0.95], [-0.55, 0.95],
    ],
  },
  {
    id: 'rocket',
    name: 'Rocket',
    src: '/flair/rocket.svg',
    category: 'object',
    points: [
      [0, -1], [0.52, -0.36], [0.36, 0.55], [0.78, 1],
      [0.12, 0.78], [-0.12, 0.78], [-0.78, 1], [-0.36, 0.55], [-0.52, -0.36],
    ],
  },
  {
    id: 'lightning',
    name: 'Lightning',
    src: '/flair/lightning.svg',
    category: 'symbol',
    points: [
      [0.12, -1], [0.82, -1], [0.3, -0.12], [0.9, -0.12],
      [-0.1, 1], [0.04, 0.16], [-0.72, 0.16],
    ],
  },
]

export { IMPORTED_FLAIR_ASSETS }

export const FLAIR_ASSETS: FlairAsset[] = [...BUILTIN_FLAIR_ASSETS, ...IMPORTED_FLAIR_ASSETS]

export const FLAIR_SRCS = [...new Set(FLAIR_ASSETS.map((asset) => asset.src))]

export const pickImportedFlairAsset = (random: () => number): FlairAsset | null => {
  if (IMPORTED_FLAIR_ASSETS.length === 0) return null
  const index = Math.min(Math.floor(random() * IMPORTED_FLAIR_ASSETS.length), IMPORTED_FLAIR_ASSETS.length - 1)
  return IMPORTED_FLAIR_ASSETS[index]
}

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

/** Ambient stickers scattered around the viewport — changes each round. */
export const createRoundDecals = (seed: number, count = 7): PlacedDecal[] => {
  const random = mulberry32(seed ^ 987_654_321)
  const decals: PlacedDecal[] = []
  const used = new Set<number>()

  for (let i = 0; i < count; i++) {
    let assetIndex = Math.floor(random() * FLAIR_ASSETS.length)
    for (let attempt = 0; attempt < 6 && used.has(assetIndex); attempt++) {
      assetIndex = Math.floor(random() * FLAIR_ASSETS.length)
    }
    used.add(assetIndex)

    const zone = Math.floor(random() * 4)
    let left = 0
    let top = 0

    if (zone === 0) {
      left = random() * 18
      top = 8 + random() * 72
    } else if (zone === 1) {
      left = 82 + random() * 16
      top = 8 + random() * 72
    } else if (zone === 2) {
      left = 10 + random() * 80
      top = random() * 14
    } else {
      left = 10 + random() * 80
      top = 78 + random() * 16
    }

    decals.push({
      src: FLAIR_ASSETS[assetIndex].src,
      left,
      top,
      rotation: (random() - 0.5) * 70,
      scale: 0.55 + random() * 0.85,
      opacity: 0.06 + random() * 0.12,
      delay: random() * 4,
    })
  }

  return decals
}

export const pickFlairAsset = (random: () => number): FlairAsset => {
  const index = Math.min(Math.floor(random() * FLAIR_ASSETS.length), FLAIR_ASSETS.length - 1)
  return FLAIR_ASSETS[index]
}

export const transformFlairPoints = (
  points: [number, number][],
  cx: number,
  cy: number,
  baseScale: number,
  random: () => number,
): Point[] => {
  const angle = random() * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const sx = baseScale * (0.82 + random() * 0.32)
  const sy = baseScale * (0.82 + random() * 0.32)

  return points.map(([x, y]) => {
    const localX = x * sx
    const localY = y * sy
    return {
      x: cx + localX * cos - localY * sin,
      y: cy + localX * sin + localY * cos,
    }
  })
}
