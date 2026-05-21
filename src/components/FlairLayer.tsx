import type { PlacedDecal } from '../game/flair'

type FlairLayerProps = {
  decals: PlacedDecal[]
}

export function FlairLayer({ decals }: FlairLayerProps) {
  return (
    <div className="flair-layer" aria-hidden="true">
      {decals.map((decal, index) => (
        <img
          key={`${decal.src}-${index}`}
          className="flair-sticker"
          src={decal.src}
          alt=""
          draggable={false}
          style={{
            left: `${decal.left}%`,
            top: `${decal.top}%`,
            ['--flair-rotate' as string]: `${decal.rotation}deg`,
            ['--flair-scale' as string]: String(decal.scale),
            ['--flair-opacity' as string]: String(decal.opacity),
            ['--flair-delay' as string]: `${decal.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
