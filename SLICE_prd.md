# SLICE — Product Requirements Document

> *Draw a line. Split it in two. Get as close to 50/50 as you can.*

---

## 1. Overview

**SLICE** is a browser-based precision puzzle game where players receive a random 2D shape and must slice it into two equal halves by mass with a single drag. It rewards spatial intuition and geometric estimation — no math required, just feel.

### Differentiators from Cutle
| Feature | Cutle | SLICE |
|---|---|---|
| Mode | Daily only (1 attempt/day) | Arcade + Daily + Challenge |
| Feedback | Ratio display | Ratio + split animation + grade |
| Shapes | Organic / blob | Geometric + organic library |
| Score system | Win / loss | Precision grade (PERFECT → MISS) |
| Sound | None | Slice SFX + spatial audio |
| Multiplayer | No | Async leaderboard (v2) |

---

## 2. Core Game Loop

```
┌─────────────────────────────────────────────┐
│  Shape appears centered on canvas           │
│  Player drags mouse/finger across shape     │
│  Release → polygon clip math fires          │
│  Halves animate apart (spread + rotate)     │
│  Score calculated → grade displayed         │
│  "Next Shape" or new game                   │
└─────────────────────────────────────────────┘
```

### Input Model
- **Desktop:** Click and drag across the shape; release to slice
- **Mobile:** Touch and drag; lift finger to slice
- Line extends infinitely — only the intersection with the shape matters
- If the drag line misses the shape entirely → shape flashes red, retry

---

## 3. Scoring System

### Formula
```
smaller_area / total_area × 100 = ratio (always ≤ 50)
```

| Grade | Range | Label |
|---|---|---|
| ✦ PERFECT | ≥ 49.5% | gold glow + particle burst |
| CLEAN SLICE | ≥ 48.0% | neon yellow |
| SHARP! | ≥ 45.0% | amber |
| NOT BAD | ≥ 40.0% | orange |
| MISS | < 40.0% | red |

### Display
- Both ratio values shown large (e.g. `47.3% vs 52.7%`)
- Centered bar showing the actual split with a 50% target marker
- "Off by X.X%" delta beneath the bar
- Streak tracker in Arcade mode

---

## 4. Shape Library

### Tier 1 — Convex (beginner-friendly)
Pentagon, Hexagon, Diamond, Circle-approx (24-gon), Triangle, Parallelogram

### Tier 2 — Simple Concave
L-Shape, T-Shape, Arrow, Plus/Cross, Chevron, Star (6-point)

### Tier 3 — Complex
Irregular polygon (5–9 random vertices), Pac-Man, Crescent, Comb

### Procedural Generation (v1.1)
- Random convex hull from Poisson-disc sampled points
- Constrained area variance: all shapes ±15% of target area
- Difficulty rating 1–5 based on asymmetry score

---

## 5. Game Modes

### Arcade Mode (MVP)
- Infinite shapes, one attempt each
- Running accuracy average displayed
- Best streak persisted to localStorage
- Shape cycles through preset library

### Daily Challenge (v1)
- One shape per day, seeded by date (same shape for all players)
- Share result card (ratio + grade, no exact numbers)
- Emoji share format: `SLICE 🔪 Day 47 — CLEAN SLICE 48.2%`

### Precision Mode (v1.1)
- 10 shapes in a row, cumulative accuracy score
- Timer adds pressure: 30s/shape
- Combo multiplier for consecutive 48%+ slices

### Head-to-Head (v2)
- Real-time room codes, same shape shown to both players
- Winner: whoever gets closer to 50%

---

## 6. Visual Design

### Aesthetic
Dark surgical/arcade. Near-black `#0A0A0A` background with grain overlay. Shapes in **electric neon yellow** `#E8FF47`. Cut line in white with pink `#FF3D71` endpoints. Score in white. Grade glows in grade color.

### Typography
- **Logo + numerics:** Bebas Neue (condensed, 0-apology big)
- **Labels + UI:** DM Mono (monospace precision, evoking measurement)

### Key Animations
| Moment | Animation |
|---|---|
| Shape load | Fade in + slight scale from 0.95 |
| Drawing cut line | Dashed white line with glow, pink endpoint dots |
| Slice | Line flashes → halves translate + rotate outward |
| Grade reveal | Fade up from 10px below, 0.9s delay |
| Score bar | Width animates from 0 → actual% over 1s |
| PERFECT | Particle burst from cut line endpoints |
| Miss (no intersection) | Shape flashes red 2× |

### SVG Rendering
- Shapes rendered as SVG `<polygon>` elements
- Drop shadow filter applied to shape for lift
- Grid overlay at 4% opacity in SVG canvas (measurement board feel)
- Center crosshair at `(250, 250)` as subtle targeting aid

---

## 7. Sound Design

All audio via Web Audio API (no assets required):

| Event | Sound |
|---|---|
| Drawing cut line | Subtle high-frequency whisper (filtered noise) |
| Slice | Sharp whoosh + mechanical "thwack" |
| PERFECT | Clean three-note ascending chime |
| Miss | Low dull thud |
| Score reveal | Score number "ticks" up with typewriter-style clicks |

Volume respects `prefers-reduced-motion` and includes mute toggle.

---

## 8. Technical Architecture

### Stack
```
Next.js 15 (App Router) + React 19
TypeScript
Zustand — game state (current shape, scores, streaks)
Framer Motion — piece spread animation
SVG polygon math — pure TypeScript utilities
Web Audio API — sound synthesis
Vercel — deployment
```

### Polygon Math (core)
```typescript
// Signed area (shoelace formula)
// Infinite-line × polygon edge intersection (parametric)
// Half-plane classification → split polygon into A and B
// Centroid calculation → translation offset for spread animation
```

### File Structure
```
/app
  /page.tsx          — root game view
  /daily/page.tsx    — daily challenge
/components
  /SliceCanvas.tsx   — SVG + drag input handler
  /ScorePanel.tsx    — grade + ratio display
  /ShapeLibrary.tsx  — shape definitions + procedural gen
/lib
  /polygon.ts        — slice, area, centroid math
  /audio.ts          — Web Audio synthesis
  /shapes.ts         — shape constant definitions
/store
  /gameStore.ts      — Zustand state
```

---

## 9. Milestones

| Milestone | Scope |
|---|---|
| **MVP (Week 1–2)** | Arcade mode, 10 shapes, slice + score, mobile-ready |
| **v1.0 (Week 3–4)** | Daily challenge, share card, sound, 20 shapes |
| **v1.1 (Month 2)** | Precision Mode, procedural shapes, leaderboard |
| **v2.0 (Month 3+)** | Head-to-Head, accounts, shape editor |

---

## 10. Success Metrics
- D1 retention ≥ 35% (daily mode hook)
- Session length ≥ 5 shapes in Arcade
- Share rate ≥ 15% of daily completions
- "PERFECT" rate < 5% (difficulty calibration target)