export function SolarLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="12" fill="oklch(0.75 0.15 85)" />
      <path d="M20 8L22 13L27 13L23 17L25 22L20 19L15 22L17 17L13 13L18 13L20 8Z" fill="oklch(0.35 0 0)" />
      <text x="38" y="26" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="600" fill="oklch(0.35 0 0)">
        Skyvolts
      </text>
    </svg>
  )
}
