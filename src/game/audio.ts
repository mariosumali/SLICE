let ctx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const getCtx = () => {
  if (!ctx) {
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
    ctx = new AudioContextClass()
  }

  return ctx
}

const runWhenReady = (play: (ac: AudioContext, now: number) => void) => {
  const ac = getCtx()
  const run = () => play(ac, ac.currentTime)

  if (ac.state === 'suspended') {
    void ac.resume().then(run).catch(() => {
      // Mobile browsers may reject audio until a user gesture unlocks the context.
    })
    return
  }

  run()
}

const getNoiseBuffer = (ac: AudioContext) => {
  if (noiseBuffer) return noiseBuffer

  const buffer = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }

  noiseBuffer = buffer
  return noiseBuffer
}

export const unlockAudio = () => {
  runWhenReady((ac, now) => {
    const source = ac.createBufferSource()
    source.buffer = ac.createBuffer(1, 1, ac.sampleRate)
    source.connect(ac.destination)
    source.start(now)
    source.stop(now)
  })
}

export const playSlice = (accuracy: number) => {
  runWhenReady((ac, now) => {
    const intensity = Math.min(Math.max(accuracy / 100, 0.45), 1)

    const noise = ac.createBufferSource()
    noise.buffer = getNoiseBuffer(ac)

    const filter = ac.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(500, now)
    filter.frequency.exponentialRampToValueAtTime(2200 + 900 * intensity, now + 0.12)

    const noiseGain = ac.createGain()
    noiseGain.gain.setValueAtTime(0.0001, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.18 + 0.1 * intensity, now + 0.015)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    const zing = ac.createOscillator()
    zing.type = 'triangle'
    zing.frequency.setValueAtTime(620, now)
    zing.frequency.exponentialRampToValueAtTime(1040 + 320 * intensity, now + 0.08)

    const zingGain = ac.createGain()
    zingGain.gain.setValueAtTime(0.07, now)
    zingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ac.destination)

    zing.connect(zingGain)
    zingGain.connect(ac.destination)

    noise.start(now)
    noise.stop(now + 0.22)
    zing.start(now)
    zing.stop(now + 0.14)
  })
}

export const playMiss = () => {
  runWhenReady((ac, now) => {
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
  })
}
