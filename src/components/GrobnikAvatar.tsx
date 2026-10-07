// Процедурный «spooky-cute» персонаж: чиби-нежить, собирается из seed.
import { useMemo } from "react";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BODY_COLORS = ["#b9c8a4", "#b3a1d6", "#8fb8ad", "#d6c4b2", "#93a7c4", "#c9a6b8", "#a8c69f"];
const BELLY = "#efe6d0";

export function WeaponIcon({ id, x = 0, y = 0, s = 1 }: { id: string; x?: number; y?: number; s?: number }) {
  const g = (children: React.ReactNode) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>{children}</g>
  );
  switch (id) {
    case "candelabra":
      return g(<>
        <rect x="-3" y="0" width="6" height="34" rx="3" fill="#d9a441" stroke="#0a0612" strokeWidth="2.5" />
        <rect x="-13" y="6" width="6" height="14" rx="3" fill="#d9a441" stroke="#0a0612" strokeWidth="2.5" />
        <rect x="7" y="6" width="6" height="14" rx="3" fill="#d9a441" stroke="#0a0612" strokeWidth="2.5" />
        <ellipse cx="0" cy="-4" rx="3.5" ry="6" fill="#ffb03a" className="anim-flame" />
        <ellipse cx="-10" cy="2" rx="2.6" ry="4.6" fill="#ffb03a" className="anim-flame" />
        <ellipse cx="10" cy="2" rx="2.6" ry="4.6" fill="#ffb03a" className="anim-flame" />
      </>);
    case "pan":
      return g(<>
        <rect x="-3" y="6" width="6" height="26" rx="3" fill="#7a6a5a" stroke="#0a0612" strokeWidth="2.5" />
        <circle cx="0" cy="-4" r="13" fill="#4a4356" stroke="#0a0612" strokeWidth="2.5" />
        <circle cx="0" cy="-4" r="7" fill="#615872" />
      </>);
    case "scythe":
      return g(<>
        <rect x="-3" y="-16" width="6" height="50" rx="3" fill="#7a6a5a" stroke="#0a0612" strokeWidth="2.5" />
        <path d="M3 -16 C 26 -20, 34 -6, 30 8 C 26 -4, 14 -6, 3 -4 Z" fill="#c9cfd8" stroke="#0a0612" strokeWidth="2.5" />
      </>);
    case "bone_sword":
      return g(<>
        <rect x="-3" y="6" width="6" height="24" rx="3" fill="#7a6a5a" stroke="#0a0612" strokeWidth="2.5" />
        <path d="M0 -26 C 7 -18, 8 -4, 4 6 L -4 6 C -8 -4, -7 -18, 0 -26 Z" fill="#efe6d0" stroke="#0a0612" strokeWidth="2.5" />
        <circle cx="-5" cy="8" r="3.4" fill="#efe6d0" stroke="#0a0612" strokeWidth="2" />
        <circle cx="5" cy="8" r="3.4" fill="#efe6d0" stroke="#0a0612" strokeWidth="2" />
      </>);
    case "grave_hammer":
      return g(<>
        <rect x="-3" y="-10" width="6" height="44" rx="3" fill="#7a6a5a" stroke="#0a0612" strokeWidth="2.5" />
        <rect x="-15" y="-24" width="30" height="18" rx="5" fill="#8a93a6" stroke="#0a0612" strokeWidth="2.5" />
        <rect x="-15" y="-24" width="30" height="6" rx="3" fill="#aab3c4" />
      </>);
    case "singing_skull":
      return g(<>
        <rect x="-3" y="8" width="6" height="26" rx="3" fill="#7a6a5a" stroke="#0a0612" strokeWidth="2.5" />
        <ellipse cx="0" cy="-6" rx="13" ry="12" fill="#efe6d0" stroke="#0a0612" strokeWidth="2.5" />
        <circle cx="-5" cy="-8" r="3" fill="#0a0612" />
        <circle cx="5" cy="-8" r="3" fill="#0a0612" />
        <path d="M-4 1 Q 0 5 4 1" stroke="#0a0612" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M16 -14 q 4 -4 8 0 M17 -6 q 3 -3 6 0" stroke="#9d6bf3" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </>);
    default: // claws
      return g(<>
        <path d="M-8 0 q 3 10 1 16 M0 -2 q 3 12 1 18 M8 0 q 3 10 1 16" stroke="#efe6d0" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      </>);
  }
}

interface Props {
  seed: number;
  weaponId?: string;
  size?: number;
  flip?: boolean;
  dead?: boolean;
  className?: string;
}

export default function GrobnikAvatar({ seed, weaponId = "claws", size = 160, flip, dead, className }: Props) {
  const p = useMemo(() => {
    const r = mulberry32(seed || 1);
    return {
      body: BODY_COLORS[Math.floor(r() * BODY_COLORS.length)],
      eyes: Math.floor(r() * 4),
      mouth: Math.floor(r() * 3),
      acc: Math.floor(r() * 4),
      tall: r() < 0.5,
      blush: r() < 0.6,
    };
  }, [seed]);

  const bodyRy = p.tall ? 40 : 34;
  const bodyRx = p.tall ? 30 : 35;
  const cy = 96 - (p.tall ? 6 : 0);

  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {/* тень */}
      <ellipse cx="60" cy="138" rx="30" ry="7" fill="rgba(0,0,0,0.4)" />

      <g className={dead ? "anim-dead" : "anim-bob"} style={{ transformOrigin: "60px 100px" }}>
        {/* оружие за спиной-рукой */}
        <g transform="translate(96 84) rotate(12)">
          <WeaponIcon id={weaponId} />
        </g>

        {/* руки */}
        <ellipse cx={60 - bodyRx - 2} cy={cy + 4} rx="8" ry="12" fill={p.body} stroke="#0a0612" strokeWidth="3" />
        <ellipse cx={60 + bodyRx + 2} cy={cy + 4} rx="8" ry="12" fill={p.body} stroke="#0a0612" strokeWidth="3" />

        {/* тело */}
        <ellipse cx="60" cy={cy} rx={bodyRx} ry={bodyRy} fill={p.body} stroke="#0a0612" strokeWidth="3.5" />
        {/* животик */}
        <ellipse cx="60" cy={cy + bodyRy * 0.35} rx={bodyRx * 0.55} ry={bodyRy * 0.42} fill={BELLY} opacity="0.5" />
        {/* швы на теле */}
        <path d={`M ${60 - bodyRx * 0.5} ${cy + bodyRy * 0.25} l 8 3 m -2 -5 l 3 8 m 4 -6 l 6 3`} stroke="#0a0612" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />

        {/* аксессуар на голове */}
        {p.acc === 0 && (
          <g transform={`translate(60 ${cy - bodyRy - 4})`}>
            <rect x="-4" y="-12" width="8" height="14" rx="3" fill="#efe6d0" stroke="#0a0612" strokeWidth="2.5" />
            <ellipse cx="0" cy="-16" rx="4" ry="6.5" fill="#ffb03a" className="anim-flame" />
            <ellipse cx="0" cy="-15" rx="1.8" ry="3" fill="#ffe9b8" />
          </g>
        )}
        {p.acc === 1 && (
          <g transform={`translate(60 ${cy - bodyRy + 2})`}>
            <path d="M-20 0 Q -26 -14 -16 -18 Q -20 -8 -12 -2 Z" fill="#efe6d0" stroke="#0a0612" strokeWidth="2.5" />
            <path d="M20 0 Q 26 -14 16 -18 Q 20 -8 12 -2 Z" fill="#efe6d0" stroke="#0a0612" strokeWidth="2.5" />
          </g>
        )}
        {p.acc === 2 && (
          <g transform={`translate(60 ${cy - bodyRy - 2})`}>
            <path d="M-10 0 L 0 -12 L 10 0 L 0 -4 Z" fill="#9d6bf3" stroke="#0a0612" strokeWidth="2.5" />
            <circle cx="0" cy="-6" r="3" fill="#0a0612" />
          </g>
        )}
        {p.acc === 3 && (
          <g transform={`translate(60 ${cy - bodyRy + 1})`}>
            <path d="M-12 -2 l 6 -5 m -8 9 l 10 -7" stroke="#0a0612" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        )}

        {/* глаза */}
        {p.eyes === 0 && (
          <g stroke="#0a0612" strokeWidth="3" strokeLinecap="round">
            <path d={`M46 ${cy - 10} l 8 8 m 0 -8 l -8 8`} />
            <path d={`M66 ${cy - 10} l 8 8 m 0 -8 l -8 8`} />
          </g>
        )}
        {p.eyes === 1 && (
          <g>
            <circle cx="50" cy={cy - 6} r="6" fill="#0a0612" />
            <circle cx="70" cy={cy - 6} r="6" fill="#0a0612" />
            <circle cx="51.6" cy={cy - 8} r="2.2" fill="#ffb03a" />
            <circle cx="71.6" cy={cy - 8} r="2.2" fill="#ffb03a" />
          </g>
        )}
        {p.eyes === 2 && (
          <g>
            <circle cx="50" cy={cy - 6} r="7.5" fill="#0a0612" />
            <circle cx="51.8" cy={cy - 8.4} r="2.6" fill="#b7f05c" />
            <circle cx="70" cy={cy - 6} r="3.4" fill="#0a0612" />
          </g>
        )}
        {p.eyes === 3 && (
          <g>
            <path d={`M44 ${cy - 6} q 6 5 12 0`} stroke="#0a0612" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d={`M64 ${cy - 6} q 6 5 12 0`} stroke="#0a0612" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* рот */}
        {p.mouth === 0 && (
          <path d={`M50 ${cy + 8} q 10 7 20 0 m -16 -3 l 0 6 m 8 -6 l 0 6`} stroke="#0a0612" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
        {p.mouth === 1 && (
          <g>
            <path d={`M48 ${cy + 8} q 12 10 24 0`} stroke="#0a0612" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d={`M55 ${cy + 10} l 3 6 l 3 -5 Z`} fill="#fff" stroke="#0a0612" strokeWidth="1.6" />
          </g>
        )}
        {p.mouth === 2 && (
          <ellipse cx="60" cy={cy + 10} rx="5" ry="6.5" fill="#0a0612" />
        )}

        {/* румянец-могильная пыль */}
        {p.blush && (
          <g fill="#9d6bf3" opacity="0.35">
            <circle cx="42" cy={cy + 4} r="4.5" />
            <circle cx="78" cy={cy + 4} r="4.5" />
          </g>
        )}
      </g>
    </svg>
  );
}
