import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { playSlice, playMiss } from './game/audio'
import { distance, splitPolygon } from './game/geometry'
import { createParticles, drawGame } from './game/render'
import { scoreSlice, getNextLevel, isStreakSlice } from './game/scoring'
import { createSeed, createShape, CANVAS_SIZE } from './game/shapes'
import type { Particle, Point, ScoreResult, ShapeInfo, SliceLine, SliceResult } from './game/types'

type Phase = 'ready' | 'dragging' | 'result'

type RoundResult = {
  slice: SliceResult
  score: ScoreResult
  line: SliceLine
}

const readStoredNumber = (key: string) => {
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) ? value : 0
}

type AccentStyle = CSSProperties & {
  '--accent-color': string
  '--accent-glow': string
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [round, setRound] = useState(1)
  const [shape, setShape] = useState<ShapeInfo>(() => createShape(1, createSeed(1, 1)))
  const [phase, setPhase] = useState<Phase>('ready')
  const [dragLine, setDragLine] = useState<SliceLine | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [animationProgress, setAnimationProgress] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestAccuracy, setBestAccuracy] = useState(() => readStoredNumber('slice-best-accuracy'))
  const [bestStreak, setBestStreak] = useState(() => readStoredNumber('slice-best-streak'))
  const [barAnimated, setBarAnimated] = useState(false)
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([])

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return

    drawGame(context, {
      shape: shape.polygon,
      shapeColor: shape.color,
      shapeStyle: shape.renderStyle,
      dragLine: result?.line ?? dragLine,
      result: result?.slice ?? null,
      progress: animationProgress,
      particles,
    })
  }, [animationProgress, dragLine, particles, result, shape])

  useEffect(() => {
    if (!result) return

    const startedAt = performance.now()
    let frameId = 0

    const tick = (time: number) => {
      const progress = Math.min((time - startedAt) / 900, 1)
      setAnimationProgress(progress)
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)
    const barTimer = setTimeout(() => setBarAnimated(true), 100)

    return () => {
      window.cancelAnimationFrame(frameId)
      clearTimeout(barTimer)
    }
  }, [result])

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase === 'result') return

    const point = toCanvasPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setPhase('dragging')
    setDragLine({ start: point, end: point })
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'dragging' || !dragLine) return
    setDragLine({ start: dragLine.start, end: toCanvasPoint(event) })
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'dragging' || !dragLine) return

    const line = { start: dragLine.start, end: toCanvasPoint(event) }

    if (distance(line.start, line.end) < 18) {
      playMiss()
      resetDrag()
      return
    }

    const slice = splitPolygon(shape.polygon, line)
    if (!slice) {
      playMiss()
      resetDrag()
      return
    }

    const score = scoreSlice(slice.leftArea, slice.rightArea)
    playSlice(score.accuracy)

    const nextStreak = isStreakSlice(score.accuracy) ? streak + 1 : 0
    const nextBestAccuracy = Math.max(bestAccuracy, score.accuracy)
    const nextBestStreak = Math.max(bestStreak, nextStreak)

    window.localStorage.setItem('slice-best-accuracy', nextBestAccuracy.toFixed(2))
    window.localStorage.setItem('slice-best-streak', String(nextBestStreak))

    setPhase('result')
    setResult({ slice, score, line })
    setParticles(score.accuracy >= 85 ? createParticles(line) : [])
    setAnimationProgress(0)
    setBarAnimated(false)
    setStreak(nextStreak)
    setBestAccuracy(nextBestAccuracy)
    setBestStreak(nextBestStreak)
    setAccuracyHistory((prev) => [...prev, score.accuracy])
  }

  const startNextRound = () => {
    const nextRound = round + 1
    const nextLevel = getNextLevel(nextRound, streak)
    setRound(nextRound)
    setShape(createShape(nextLevel, createSeed(nextRound, nextLevel)))
    setPhase('ready')
    setDragLine(null)
    setResult(null)
    setParticles([])
    setAnimationProgress(0)
    setBarAnimated(false)
  }

  const resetDrag = () => {
    setPhase('ready')
    setDragLine(null)
  }

  const balance = result?.score.balance ?? 0
  const offBy = result ? Math.abs(result.score.balance - 50).toFixed(1) : null
  const avgAccuracy =
    accuracyHistory.length > 0
      ? (accuracyHistory.reduce((a, b) => a + b, 0) / accuracyHistory.length).toFixed(1)
      : null
  const accentStyle: AccentStyle = {
    '--accent-color': shape.color,
    '--accent-glow': hexToRgba(shape.color, 0.28),
  }

  return (
    <main className="app-shell" style={accentStyle}>
      <div className="glow-bg" />

      <header className="brand-header" aria-label="SLICE">
        <img className="brand-mark" src="/logo.svg" alt="" aria-hidden="true" />
        <h1>SLICE</h1>
      </header>

      <div className="game-area">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          aria-label="SLICE game board"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={resetDrag}
        />
        {phase === 'ready' && (
          <div className="drag-hint">— drag across to cut —</div>
        )}
      </div>

      {phase === 'result' && result && (
        <div className="score-panel">
          <div className="grade-label">{result.score.label}</div>

          <div className="split-display">
            <div className="piece">
              <div className="split-number">{balance.toFixed(1)}%</div>
              <div className="piece-label">PIECE A</div>
            </div>
            <div className="split-divider">
              <div className="line" />
              <div className="vs">vs</div>
              <div className="line" />
            </div>
            <div className="piece">
              <div className="split-number">{(100 - balance).toFixed(1)}%</div>
              <div className="piece-label">PIECE B</div>
            </div>
          </div>

          <div className="split-bar">
            <div
              className="split-bar-fill"
              style={{
                width: barAnimated ? `${balance}%` : '0%',
              }}
            />
            <div className="split-bar-marker" />
          </div>
          <div className="off-by">off by {offBy}%</div>

          <button className="btn-next" type="button" onClick={startNextRound}>
            Next Shape
          </button>
        </div>
      )}

      {accuracyHistory.length > 0 && phase !== 'dragging' && (
        <div className="stats-bar">
          <div className="stat">
            <div className="stat-value">{accuracyHistory.length}</div>
            <div className="stat-label">PLAYED</div>
          </div>
          <div className="stat">
            <div className="stat-value">{avgAccuracy}%</div>
            <div className="stat-label">AVG</div>
          </div>
          <div className="stat">
            <div className="stat-value">{streak}</div>
            <div className="stat-label">STREAK</div>
          </div>
          <div className="stat">
            <div className="stat-value">{bestStreak}</div>
            <div className="stat-label">BEST</div>
          </div>
        </div>
      )}
    </main>
  )
}

const toCanvasPoint = (event: PointerEvent<HTMLCanvasElement>): Point => {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
  }
}

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default App
