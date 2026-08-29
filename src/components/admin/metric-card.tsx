export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article className="admin-metric"><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}
