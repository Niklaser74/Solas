/** Dimensas-logotyp: dimensionslinje med nod + ordmärke (Familjen Grotesk 600).
 *  Varianten "on light": grön platta, vita streck, grön nod. */

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo" aria-label="Dimensas">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-hidden="true">
        <rect width="48" height="48" rx="11" fill="var(--ds-accent)" />
        <path
          d="M13 16.5V31.5M35 16.5V31.5M13 24H35"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="24" cy="24" r="4.2" fill="var(--ds-accent)" stroke="#FFFFFF" strokeWidth="2.4" />
      </svg>
      <span className="logo-wordmark">Dimensas</span>
    </span>
  );
}
