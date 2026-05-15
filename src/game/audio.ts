let ctx: AudioContext | null = null

const getCtx = () => {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export const playSlice = (accuracy: number) => {
  const ac = getCtx()
  const now = ac.currentTime

  const duration = 0.2
  const samples = Math.floor(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, samples, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < samples; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples, 3)
  }

  const noise = ac.createBufferSource()
  noise.buffer = buffer

  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(3200, now)
  bp.frequency.exponentialRampToValueAtTime(500, now + duration)
  bp.Q.value = 1.8

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.28, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(bp)
  bp.connect(gain)
  gain.connect(ac.destination)
  noise.start(now)
  noise.stop(now + duration)

  if (accuracy >= 85) {
    const baseFreq = accuracy >= 99 ? 1047 : accuracy >= 95 ? 880 : 660
    const tones = accuracy >= 95 ? [baseFreq, baseFreq * 1.5] : [baseFreq]

    tones.forEach((freq, i) => {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const g = ac.createGain()
      const start = now + 0.06 + i * 0.08
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.12, start + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.45)

      osc.connect(g)
      g.connect(ac.destination)
      osc.start(start)
      osc.stop(start + 0.45)
    })
  }
}

export const playMiss = () => {
  const ac = getCtx()
  const now = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, now)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.15)
}
