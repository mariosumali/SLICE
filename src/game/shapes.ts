import type { Polygon } from './types'

export const WORLD_WIDTH = 1000
export const WORLD_HEIGHT = 720

export const createShape = (level: number, seed: number): Polygon => {
  const random = mulberry32(seed)
  const pointCount = Math.min(6 + Math.floor(level / 2), 12)
  const centerX = WORLD_WIDTH / 2 + (random() - 0.5) * 56
  const centerY = WORLD_HEIGHT / 2 + (random() - 0.5) * 44
  const baseRadius = 175 + Math.min(level, 12) * 8
  const angleOffset = random() * Math.PI * 2

  return Array.from({ length: pointCount }, (_, index) => {
    const angle = angleOffset + (Math.PI * 2 * index) / pointCount
    const wobble = 0.68 + random() * 0.48
    const stretchX = 1 + (random() - 0.5) * 0.18
    const stretchY = 1 + (random() - 0.5) * 0.18

    return {
      x: centerX + Math.cos(angle) * baseRadius * wobble * stretchX,
      y: centerY + Math.sin(angle) * baseRadius * wobble * stretchY,
    }
  })
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
