import { useState, useRef, useEffect, useCallback } from "react";

// ─── Polygon Math ──────────────────────────────────────────────────────────────

const polyArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(a) / 2;
};

const polyCentroid = (pts) => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

const segIntersect = (a, b, p1, p2) => {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const ex = p2[0]-p1[0], ey = p2[1]-p1[1];
  const cross = dx*ey - dy*ex;
  if (Math.abs(cross) < 1e-10) return null;
  const t = ((p1[0]-a[0])*ey - (p1[1]-a[1])*ex) / cross;
  const u = ((p1[0]-a[0])*dy - (p1[1]-a[1])*dx) / cross;
  if (t >= -1e-9 && t <= 1+1e-9 && u >= 0 && u <= 1)
    return [a[0]+t*dx, a[1]+t*dy];
  return null;
};

const slicePoly = (poly, lp1, lp2) => {
  const dx = lp2[0]-lp1[0], dy = lp2[1]-lp1[1];
  const L = Math.sqrt(dx*dx+dy*dy) || 1;
  const E = 4000;
  const ep1 = [lp1[0]-dx/L*E, lp1[1]-dy/L*E];
  const ep2 = [lp1[0]+dx/L*E, lp1[1]+dy/L*E];
  const sideOf = (p) => (ep2[0]-ep1[0])*(p[1]-ep1[1]) - (ep2[1]-ep1[1])*(p[0]-ep1[0]) >= 0;
  const A = [], B = [];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], n = poly[(i+1) % poly.length];
    const cs = sideOf(c), ns = sideOf(n);
    (cs ? A : B).push(c);
    if (cs !== ns) {
      const pt = segIntersect(c, n, ep1, ep2);
      if (pt) { A.push(pt); B.push(pt); }
    }
  }
  return A.length >= 3 && B.length >= 3 ? [A, B] : null;
};

const pts2svg = (pts) => pts.map(p => p.join(",")).join(" ");

// ─── Shape Library ────────────────────────────────────────────────────────────

const SHAPES = [
  { name: "PENTAGON", pts: [[250,68],[440,206],[372,430],[128,430],[60,206]] },
  { name: "HEXAGON",  pts: [[250,58],[420,154],[420,346],[250,442],[80,346],[80,154]] },
  { name: "L-SHAPE",  pts: [[100,80],[265,80],[265,248],[420,248],[420,435],[100,435]] },
  { name: "CROSS",    pts: [[178,80],[322,80],[322,178],[420,178],[420,322],[322,322],[322,420],[178,420],[178,322],[80,322],[80,178],[178,178]] },
  { name: "ARROW",    pts: [[250,55],[435,228],[330,228],[330,435],[170,435],[170,228],[65,228]] },
  { name: "DIAMOND",  pts: [[250,55],[445,250],[250,445],[55,250]] },
  { name: "T-SHAPE",  pts: [[60,80],[440,80],[440,230],[310,230],[310,430],[190,430],[190,230],[60,230]] },
];

// ─── Grade Logic ──────────────────────────────────────────────────────────────

const getGrade = (score) => {
  const p = Math.min(score, 100 - score);
  if (p >= 49.5) return { label: "✦  PERFECT  ✦", color: "#00FF87" };
  if (p >= 48.0) return { label: "CLEAN SLICE",   color: "#E8FF47" };
  if (p >= 45.0) return { label: "SHARP!",         color: "#FFB347" };
  if (p >= 40.0) return { label: "NOT BAD",         color: "#FF8C42" };
  return               { label: "MISS",             color: "#FF3D71" };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SliceGame() {
  const [shapeIdx, setShapeIdx] = useState(0);
  const [gameState, setGameState] = useState("idle"); // idle | drawing | animating | scored
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [halves, setHalves] = useState(null);
  const [score, setScore] = useState(null);
  const [spread, setSpread] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
  const [stats, setStats] = useState({ played: 0, wins: 0, streak: 0, best: 0 });
  const svgRef = useRef(null);
  const shape = SHAPES[shapeIdx];

  // Inject fonts
  useEffect(() => {
    const el = document.createElement("link");
    el.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap";
    el.rel = "stylesheet";
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return [250, 250];
    const r = svg.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return [
      (src.clientX - r.left) * 500 / r.width,
      (src.clientY - r.top) * 500 / r.height,
    ];
  }, []);

  const onPointerDown = (e) => {
    if (gameState !== "idle") return;
    e.preventDefault();
    const pt = getSVGPoint(e);
    setDragStart(pt);
    setDragEnd(pt);
    setGameState("drawing");
  };

  const onPointerMove = (e) => {
    if (gameState !== "drawing") return;
    e.preventDefault();
    setDragEnd(getSVGPoint(e));
  };

  const onPointerUp = () => {
    if (gameState !== "drawing" || !dragStart || !dragEnd) return;
    const dist = Math.hypot(dragEnd[0]-dragStart[0], dragEnd[1]-dragStart[1]);
    if (dist < 18) { setGameState("idle"); return; }

    const result = slicePoly(shape.pts, dragStart, dragEnd);
    if (!result) {
      setGameState("idle");
      setMissFlash(true);
      setTimeout(() => setMissFlash(false), 700);
      setDragStart(null); setDragEnd(null);
      return;
    }

    const [h1, h2] = result;
    const a1 = polyArea(h1), a2 = polyArea(h2);
    const ratio = (Math.min(a1, a2) / (a1+a2)) * 100;

    setHalves([h1, h2]);
    setScore(ratio);
    setGameState("animating");

    requestAnimationFrame(() => requestAnimationFrame(() => setSpread(true)));

    setTimeout(() => {
      setGameState("scored");
      setStats(prev => {
        const win = ratio >= 48;
        const streak = win ? prev.streak + 1 : 0;
        return {
          played: prev.played + 1,
          wins: prev.wins + (win ? 1 : 0),
          streak,
          best: Math.max(prev.best, streak),
        };
      });
    }, 1300);
  };

  const reset = () => {
    setGameState("idle");
    setDragStart(null); setDragEnd(null);
    setHalves(null); setScore(null); setSpread(false);
    setShapeIdx(i => (i + 1) % SHAPES.length);
  };

  // Animation offsets
  const c1 = halves ? polyCentroid(halves[0]) : [250, 250];
  const c2 = halves ? polyCentroid(halves[1]) : [250, 250];
  const SPREAD = 0.6;
  const tx1 = spread ? (c1[0]-250)*SPREAD : 0;
  const ty1 = spread ? (c1[1]-250)*SPREAD : 0;
  const tx2 = spread ? (c2[0]-250)*SPREAD : 0;
  const ty2 = spread ? (c2[1]-250)*SPREAD : 0;
  const rz1 = spread ? (c1[0] > 250 ? 11 : -11) : 0;
  const rz2 = spread ? (c2[0] > 250 ? 11 : -11) : 0;

  const grade = score != null ? getGrade(score) : null;
  const s1 = score != null ? score.toFixed(1) : "--";
  const s2 = score != null ? (100 - score).toFixed(1) : "--";
  const off = score != null ? Math.abs(score - 50).toFixed(1) : null;
  const winPct = stats.played > 0 ? Math.round(stats.wins / stats.played * 100) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#FFF",
      padding: "24px 16px",
      userSelect: "none",
      WebkitUserSelect: "none",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes flashMiss {
          0%, 100% { fill: #E8FF47; }
          40%, 60% { fill: #FF3D71; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.04; }
          50% { opacity: 0.09; }
        }
        .miss-flash { animation: flashMiss 0.35s ease 2; }
        .score-reveal { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.85s both; }
        .btn-next {
          background: transparent;
          border: 1px solid #2C2C2C;
          color: #777;
          padding: 11px 28px;
          letter-spacing: 4px;
          font-size: 11px;
          cursor: pointer;
          font-family: 'DM Mono', monospace;
          transition: border-color 0.2s, color 0.2s;
        }
        .btn-next:hover { border-color: #E8FF47; color: #E8FF47; }
      `}</style>

      {/* Ambient glow behind canvas */}
      <div style={{
        position: "absolute",
        width: "500px", height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,255,71,0.055) 0%, transparent 65%)",
        animation: "pulseGlow 4s ease-in-out infinite",
        pointerEvents: "none",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
      }}/>

      {/* ── LOGO ── */}
      <div style={{ textAlign: "center", marginBottom: "2px", position: "relative", zIndex: 1 }}>
        <div style={{
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: "clamp(56px, 14vw, 84px)",
          letterSpacing: "18px",
          lineHeight: 1,
          color: "#FFF",
          textShadow: "0 0 80px rgba(232,255,71,0.22)",
          marginRight: "-18px", // visual centering of letter-spacing
        }}>SLICE</div>
        <div style={{ fontSize: "10px", letterSpacing: "6px", color: "#2A2A2A", marginTop: "-4px" }}>
          SPLIT IT PERFECTLY IN HALF
        </div>
      </div>

      {/* ── SHAPE LABEL ── */}
      <div style={{ fontSize: "10px", letterSpacing: "5px", color: "#2A2A2A", margin: "14px 0 20px", position: "relative", zIndex: 1 }}>
        {shape.name} &nbsp;·&nbsp; {shapeIdx+1} OF {SHAPES.length}
      </div>

      {/* ── SVG CANVAS ── */}
      <div style={{
        position: "relative",
        width: "min(88vw, 400px)",
        aspectRatio: "1 / 1",
        cursor: gameState === "idle" ? "crosshair" : "none",
        flexShrink: 0,
        zIndex: 1,
      }}>
        <svg
          ref={svgRef}
          viewBox="0 0 500 500"
          style={{ width: "100%", height: "100%", overflow: "visible", display: "block" }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        >
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M50 0 L0 0 0 50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <filter id="shapeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="rgba(0,0,0,0.7)"/>
            </filter>
            <filter id="lineglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Measurement grid */}
          <rect width="500" height="500" fill="url(#grid)"/>

          {/* Center target */}
          <line x1="238" y1="250" x2="262" y2="250" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          <line x1="250" y1="238" x2="250" y2="262" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          <circle cx="250" cy="250" r="3" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

          {/* ── Original shape (idle / drawing) ── */}
          {(gameState === "idle" || gameState === "drawing") && (
            <polygon
              points={pts2svg(shape.pts)}
              fill="#E8FF47"
              filter="url(#shapeShadow)"
              className={missFlash ? "miss-flash" : ""}
            />
          )}

          {/* ── Cut line being drawn ── */}
          {gameState === "drawing" && dragStart && dragEnd && (
            <>
              {/* Glow halo */}
              <line
                x1={dragStart[0]} y1={dragStart[1]}
                x2={dragEnd[0]} y2={dragEnd[1]}
                stroke="rgba(255,255,255,0.12)" strokeWidth="10" strokeLinecap="round"
              />
              {/* Main dashed line */}
              <line
                x1={dragStart[0]} y1={dragStart[1]}
                x2={dragEnd[0]} y2={dragEnd[1]}
                stroke="#FFF" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="12 7"
                filter="url(#lineglow)"
              />
              {/* Endpoint dots */}
              <circle cx={dragStart[0]} cy={dragStart[1]} r="5" fill="#FF3D71"/>
              <circle cx={dragEnd[0]}   cy={dragEnd[1]}   r="5" fill="#FF3D71"/>
            </>
          )}

          {/* ── Sliced halves ── */}
          {halves && (
            <>
              <polygon
                points={pts2svg(halves[0])}
                fill="#E8FF47"
                filter="url(#shapeShadow)"
                style={{
                  transition: "transform 1.05s cubic-bezier(0.22,1,0.36,1)",
                  transform: `translate(${tx1}px, ${ty1}px) rotate(${rz1}deg)`,
                  transformOrigin: "50% 50%",
                  transformBox: "fill-box",
                }}
              />
              <polygon
                points={pts2svg(halves[1])}
                fill="#E8FF47"
                filter="url(#shapeShadow)"
                style={{
                  transition: "transform 1.05s cubic-bezier(0.22,1,0.36,1)",
                  transform: `translate(${tx2}px, ${ty2}px) rotate(${rz2}deg)`,
                  transformOrigin: "50% 50%",
                  transformBox: "fill-box",
                }}
              />
              {/* Cut reveal line */}
              {dragStart && dragEnd && (
                <line
                  x1={dragStart[0]} y1={dragStart[1]}
                  x2={dragEnd[0]} y2={dragEnd[1]}
                  stroke="#FF3D71" strokeWidth="1.5" strokeLinecap="round"
                  filter="url(#lineglow)"
                  style={{
                    opacity: spread ? 0 : 1,
                    transition: "opacity 0.4s ease 0.65s",
                  }}
                />
              )}
            </>
          )}
        </svg>

        {/* Drag hint */}
        {gameState === "idle" && (
          <div style={{
            position: "absolute",
            bottom: "-30px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "10px",
            letterSpacing: "3px",
            color: "#2A2A2A",
            whiteSpace: "nowrap",
          }}>
            — drag across to cut —
          </div>
        )}
      </div>

      {/* ── SCORE PANEL ── */}
      {(gameState === "scored" || gameState === "animating") && score != null && (
        <div className="score-reveal" style={{ textAlign: "center", marginTop: "52px", zIndex: 1 }}>
          {/* Grade */}
          <div style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif",
            fontSize: "clamp(30px, 7vw, 44px)",
            letterSpacing: "8px",
            color: grade.color,
            textShadow: `0 0 28px ${grade.color}45`,
            marginBottom: "18px",
            marginRight: "-8px",
          }}>
            {grade.label}
          </div>

          {/* Ratio numbers */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            marginBottom: "14px",
          }}>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                fontSize: "clamp(46px, 11vw, 64px)",
                lineHeight: 1,
                color: "#FFF",
              }}>{s1}%</div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#383838" }}>PIECE A</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
              <div style={{ height: "38px", width: "1px", background: "#1E1E1E" }}/>
              <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#333" }}>vs</div>
              <div style={{ height: "38px", width: "1px", background: "#1E1E1E" }}/>
            </div>

            <div style={{ textAlign: "left" }}>
              <div style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                fontSize: "clamp(46px, 11vw, 64px)",
                lineHeight: 1,
                color: "#FFF",
              }}>{s2}%</div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#383838" }}>PIECE B</div>
            </div>
          </div>

          {/* Split bar */}
          <div style={{
            position: "relative",
            width: "270px",
            height: "6px",
            background: "#151515",
            borderRadius: "3px",
            overflow: "hidden",
            margin: "0 auto 8px",
          }}>
            <div style={{
              position: "absolute",
              left: 0, top: 0, height: "100%",
              width: gameState === "scored" ? `${score}%` : "0%",
              background: grade.color,
              borderRadius: "3px",
              transition: "width 1s cubic-bezier(0.22,1,0.36,1) 0.1s",
            }}/>
            {/* 50% marker */}
            <div style={{
              position: "absolute",
              top: 0, height: "100%",
              left: "50%", transform: "translateX(-50%)",
              width: "2px",
              background: "rgba(255,255,255,0.2)",
            }}/>
          </div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#333", marginBottom: "26px" }}>
            off by {off}%
          </div>

          {/* Next button */}
          <button className="btn-next" onClick={reset}>
            NEXT SHAPE →
          </button>
        </div>
      )}

      {/* ── STATS BAR ── */}
      {gameState !== "drawing" && gameState !== "animating" && stats.played > 0 && (
        <div style={{
          display: "flex",
          gap: "32px",
          marginTop: gameState === "scored" ? "28px" : "48px",
          justifyContent: "center",
          zIndex: 1,
          animation: "fadeUp 0.4s ease both",
        }}>
          {[
            { label: "PLAYED", val: stats.played },
            { label: "WIN %",  val: `${winPct}%` },
            { label: "STREAK", val: stats.streak },
            { label: "BEST",   val: stats.best },
          ].map(({ label, val }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                fontSize: "22px",
                color: "#FFF",
                lineHeight: 1,
              }}>{val}</div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#2A2A2A", marginTop: "3px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
