type MetricVariant = "panel" | "paper";
type MetricTone = "default" | "ready" | "warn";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  variant?: MetricVariant;
  progress?: number;
  tone?: MetricTone;
}

export function MetricCard({ label, value, detail, variant = "panel", progress, tone = "default" }: MetricCardProps) {
  const isPaper = variant === "paper";
  const baseClass = isPaper ? "admin-metric--paper" : "admin-metric";
  const toneClass = tone !== "default" ? `admin-metric--${tone}` : "";
  const className = [baseClass, toneClass].filter(Boolean).join(" ");

  const clamped = typeof progress === "number" ? Math.max(0, Math.min(100, Math.round(progress))) : undefined;
  const isComplete = clamped === 100;

  return (
    <article className={className}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {typeof clamped === "number" && (
        <div
          className={`metric-progress ${isPaper ? "metric-progress--paper" : ""} ${isComplete ? "is-complete" : ""}`}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} ${clamped}%`}
        >
          <span style={{ width: `${clamped}%` }} />
        </div>
      )}
      {detail && <small>{detail}</small>}
    </article>
  );
}
