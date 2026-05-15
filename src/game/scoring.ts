import type { ScoreResult } from './types'

export const scoreSlice = (leftArea: number, rightArea: number): ScoreResult => {
  const totalArea = leftArea + rightArea
  const balance = totalArea === 0 ? 0 : (Math.min(leftArea, rightArea) / totalArea) * 100
  const accuracy = Math.max(0, 100 - Math.abs(50 - balance) * 2)
  const points = Math.round(accuracy * accuracy * 0.12)

  return {
    accuracy,
    balance,
    points,
    label: getScoreLabel(accuracy),
  }
}

export const getNextLevel = (round: number, streak: number) =>
  Math.max(1, Math.floor(round / 3) + 1 + Math.floor(streak / 4))

export const isStreakSlice = (accuracy: number) => accuracy >= 92

const getScoreLabel = (accuracy: number) => {
  if (accuracy >= 99) return 'Perfect Slice'
  if (accuracy >= 95) return 'So Close'
  if (accuracy >= 85) return 'Clean Cut'
  if (accuracy >= 70) return 'Not Bad'
  return 'Try Again'
}
