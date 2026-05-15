export type Point = {
  x: number
  y: number
}

export type Polygon = Point[]

export type SliceLine = {
  start: Point
  end: Point
}

export type SliceResult = {
  left: Polygon
  right: Polygon
  leftArea: number
  rightArea: number
}

export type ScoreResult = {
  accuracy: number
  balance: number
  label: string
  points: number
}

export type Particle = {
  origin: Point
  velocity: Point
  radius: number
}
