/**
 * ROVER as a flat 2D drawing, matching the story art: a cream head with a screen face,
 * gold foil body, orange fenders and a dish antenna. The screen face changes with `mood`.
 */
export type RoverMood = 'idle' | 'listening' | 'sending' | 'happy' | 'sad';

const SCREEN = '#7ff3ea';

function Face({ mood }: { mood: RoverMood }) {
  const eye = { stroke: SCREEN, strokeWidth: 4, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'listening':
      return <g>
        <circle cx="86" cy="42" r="5" fill={SCREEN} /><circle cx="112" cy="42" r="5" fill={SCREEN} />
        <circle cx="99" cy="57" r="3.5" {...eye} strokeWidth={3} />
      </g>;
    case 'sending':
    case 'happy':
      return <g>
        <path d="M79 45 q7 -9 14 0" {...eye} /><path d="M105 45 q7 -9 14 0" {...eye} />
        <path d="M87 54 q12 11 24 0 z" fill={SCREEN} />
        {mood === 'happy' && <g fill="#ffb3c7"><circle cx="78" cy="54" r="3.5" /><circle cx="120" cy="54" r="3.5" /></g>}
      </g>;
    case 'sad':
      return <g>
        <path d="M80 38 l11 4" {...eye} /><path d="M118 38 l-11 4" {...eye} />
        <circle cx="86" cy="47" r="3.5" fill={SCREEN} /><circle cx="112" cy="47" r="3.5" fill={SCREEN} />
        <path d="M90 60 q9 -7 18 0" {...eye} />
      </g>;
    default:
      return <g>
        <rect className="rover-blink" x="81" y="36" width="9" height="12" rx="4.5" fill={SCREEN} />
        <rect className="rover-blink" x="108" y="36" width="9" height="12" rx="4.5" fill={SCREEN} />
        <path d="M88 54 q11 9 22 0" {...eye} />
      </g>;
  }
}

export function RoverFigure({ mood = 'idle', className = '' }: { mood?: RoverMood; className?: string }) {
  return (
    <svg className={`rover-figure rover-figure--${mood} ${className}`} viewBox="0 0 220 180" role="img" aria-hidden="true">
      {/* Signal beam from the dish to the Moon while sending. */}
      <g className="rover-beam">
        <path d="M182 34 L214 4" stroke="#ffe08a" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 7" />
        <circle cx="214" cy="4" r="4" fill="#fff3c4" />
      </g>
      <g className="rover-body">
        {/* Dish antenna */}
        <path d="M170 98 L170 56" stroke="#8a8f9c" strokeWidth="4" />
        <path d="M150 52 Q170 16 196 30 Q186 58 150 52 Z" fill="#e8b65a" stroke="#9a6a1f" strokeWidth="2.5" />
        <path d="M160 50 L183 30 M168 51 L189 35 M155 46 L176 24" stroke="#b9852f" strokeWidth="1.5" />
        <circle className="rover-antenna-light" cx="182" cy="34" r="4" fill="#ffefb0" />
        {/* Neck and head */}
        <rect x="93" y="72" width="14" height="24" rx="3" fill="#d8a640" stroke="#8d641c" strokeWidth="2" />
        <rect x="64" y="14" width="72" height="62" rx="12" fill="#f6eedc" stroke="#7d7466" strokeWidth="3" />
        <rect x="72" y="22" width="56" height="46" rx="8" fill="#1f2a36" />
        <Face mood={mood} />
        {/* Gold foil body */}
        <path d="M24 98 H186 L180 128 H30 Z" fill="#e3b24f" stroke="#8d641c" strokeWidth="3" strokeLinejoin="round" />
        <path d="M40 100 L62 126 M70 100 L58 126 M96 100 L118 126 M126 100 L112 126 M152 100 L170 126" stroke="#f6d78a" strokeWidth="2" />
        <rect x="36" y="86" width="40" height="14" rx="3" fill="#f6eedc" stroke="#7d7466" strokeWidth="2" />
        {/* Fenders and wheels */}
        <g className="rover-wheel"><circle cx="58" cy="146" r="22" fill="#2b2f3a" /><circle cx="58" cy="146" r="9" fill="#a8adb8" /><path d="M58 128 V164 M40 146 H76" stroke="#555b69" strokeWidth="3" /></g>
        <g className="rover-wheel"><circle cx="156" cy="146" r="22" fill="#2b2f3a" /><circle cx="156" cy="146" r="9" fill="#a8adb8" /><path d="M156 128 V164 M138 146 H174" stroke="#555b69" strokeWidth="3" /></g>
        <path d="M30 140 Q34 116 60 116 Q84 116 88 132" fill="none" stroke="#d9773a" strokeWidth="9" strokeLinecap="round" />
        <path d="M128 132 Q132 116 156 116 Q182 116 186 140" fill="none" stroke="#d9773a" strokeWidth="9" strokeLinecap="round" />
      </g>
    </svg>
  );
}
