import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { distance, splitPolygon } from './game/geometry'
import { createParticles, drawGame } from './game/render'
import { scoreSlice, getNextLevel, isStreakSlice } from './game/scoring'
import { createSeed, createShape, WORLD_HEIGHT, WORLD_WIDTH } from './game/shapes'
import type { Particle, Point, Polygon, ScoreResult, SliceLine, SliceResult } from './game/types'

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

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [round, setRound] = useState(1)
  const [level, setLevel] = useState(1)
  const [shape, setShape] = useState<Polygon>(() => createShape(1, createSeed(1, 1)))
  const [phase, setPhase] = useState<Phase>('ready')
  const [dragLine, setDragLine] = useState<SliceLine | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [animationProgress, setAnimationProgress] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [bestAccuracy, setBestAccuracy] = useState(() => readStoredNumber('slice-best-accuracy'))
  const [bestStreak, setBestStreak] = useState(() => readStoredNumber('slice-best-streak'))
  const [hint, setHint] = useState('Drag across the shape to slice it into 50/50.')

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return

    drawGame(context, {
      shape,
      dragLine,
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
    return () => window.cancelAnimationFrame(frameId)
  }, [result])

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase === 'result') return

    const point = toCanvasPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setPhase('dragging')
    setDragLine({ start: point, end: point })
    setHint('Release to cut the shape.')
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'dragging' || !dragLine) return

    setDragLine({
      start: dragLine.start,
      end: toCanvasPoint(event),
    })
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'dragging' || !dragLine) return

    const line = {
      start: dragLine.start,
      end: toCanvasPoint(event),
    }

    if (distance(line.start, line.end) < 24) {
      resetDrag('Make a longer slice across the shape.')
      return
    }

    const slice = splitPolygon(shape, line)
    if (!slice) {
      resetDrag('The line needs to cross through the whole shape.')
      return
    }

    const score = scoreSlice(slice.leftArea, slice.rightArea)
    const nextStreak = isStreakSlice(score.accuracy) ? streak + 1 : 0
    const nextBestAccuracy = Math.max(bestAccuracy, score.accuracy)
    const nextBestStreak = Math.max(bestStreak, nextStreak)

    window.localStorage.setItem('slice-best-accuracy', nextBestAccuracy.toFixed(2))
    window.localStorage.setItem('slice-best-streak', String(nextBestStreak))

    setPhase('result')
    setResult({ slice, score, line })
    setParticles(score.accuracy >= 85 ? createParticles(line) : [])
    setAnimationProgress(0)
    setStreak(nextStreak)
    setTotalScore((current) => current + score.points)
    setBestAccuracy(nextBestAccuracy)
    setBestStreak(nextBestStreak)
    setHint(`${score.label}: ${score.balance.toFixed(1)} / ${(100 - score.balance).toFixed(1)} by mass.`)
  }

  const startNextRound = () => {
    const nextRound = round + 1
    const nextLevel = getNextLevel(nextRound, streak)

    setRound(nextRound)
    setLevel(nextLevel)
    setShape(createShape(nextLevel, createSeed(nextRound, nextLevel)))
    setPhase('ready')
    setDragLine(null)
    setResult(null)
    setParticles([])
    setAnimationProgress(0)
    setHint('Drag across the shape to slice it into 50/50.')
  }

  const resetGame = () => {
    const freshLevel = 1
    const freshRound = 1
    setRound(freshRound)
    setLevel(freshLevel)
    setShape(createShape(freshLevel, createSeed(freshRound, freshLevel)))
    setPhase('ready')
    setDragLine(null)
    setResult(null)
    setParticles([])
    setAnimationProgress(0)
    setStreak(0)
    setTotalScore(0)
    setHint('Drag across the shape to slice it into 50/50.')
  }

  const resetDrag = (message: string) => {
    setPhase('ready')
    setDragLine(null)
    setHint(message)
  }

  const latestAccuracy = result ? `${result.score.accuracy.toFixed(1)}%` : '--'

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="game-title">
        <div>
          <p className="eyebrow">mass matters</p>
          <h1 id="game-title">SLICE</h1>
          <p className="intro">Cut the shape into two perfect halves. The closer to 50/50, the hotter your streak gets.</p>
        </div>
        <button className="ghost-button" type="button" onClick={resetGame}>
          Reset run
        </button>
      </section>

      <section className="stats-grid" aria-label="Run stats">
        <Stat label="Level" value={level} />
        <Stat label="Round" value={round} />
        <Stat label="Streak" value={streak} />
        <Stat label="Score" value={totalScore} />
        <Stat label="Last cut" value={latestAccuracy} />
        <Stat label="Best" value={bestAccuracy ? `${bestAccuracy.toFixed(1)}%` : '--'} />
      </section>

      <section className="game-card">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
          aria-label="SLICE game board"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => resetDrag('Slice cancelled. Try again.')}
        />

        <div className="game-overlay" aria-live="polite">
          <p>{hint}</p>
          {result ? (
            <div className="result-panel">
              <strong>{result.score.label}</strong>
              <span>{result.score.accuracy.toFixed(1)}% accuracy</span>
              <button type="button" onClick={startNextRound}>
                Next shape
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="footer-note">Best streak: {bestStreak}. Touch and mouse both work.</footer>
    </main>
  )
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <article className="stat-card">
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
)

const toCanvasPoint = (event: PointerEvent<HTMLCanvasElement>): Point => {
  const rect = event.currentTarget.getBoundingClientRect()

  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
  }
}

export default App
