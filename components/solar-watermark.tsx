"use client"

export function SolarWatermark() {
  return (
    <svg
      className="fixed inset-0 h-full w-full opacity-5 pointer-events-none"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="solarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#2d7a5f", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#1e5a45", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {/* Solar Panel Pattern */}
      <g fill="url(#solarGradient)">
        <circle cx="100" cy="100" r="60" opacity="0.3" />
        <path d="M 100 50 L 130 70 L 130 130 L 100 150 L 70 130 L 70 70 Z" opacity="0.4" />
        {/* Sun rays */}
        <line x1="100" y1="20" x2="100" y2="40" strokeWidth="2" stroke="url(#solarGradient)" opacity="0.3" />
        <line x1="100" y1="160" x2="100" y2="180" strokeWidth="2" stroke="url(#solarGradient)" opacity="0.3" />
        <line x1="20" y1="100" x2="40" y2="100" strokeWidth="2" stroke="url(#solarGradient)" opacity="0.3" />
        <line x1="160" y1="100" x2="180" y2="100" strokeWidth="2" stroke="url(#solarGradient)" opacity="0.3" />
      </g>
    </svg>
  )
}
