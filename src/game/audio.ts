let ctx: AudioContext | null = null

const sliceSoundUrls = Object.values(
  import.meta.glob('../assets/sound-effects/*.{mp3,wav,ogg,m4a,aac}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
) as string[]

const getCtx = () => {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export const playSlice = (_accuracy: number) => {
  const url = sliceSoundUrls[Math.floor(Math.random() * sliceSoundUrls.length)]
  if (!url) return

  const audio = new Audio(url)
  audio.volume = 0.85
  void audio.play().catch(() => {
    // Browser audio policies can reject playback if the user gesture is interrupted.
  })
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
