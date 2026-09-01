export function PlanCraftLoader({
  title = "Crafting your personalized learning plan",
  detail = "Scoring your evidence and matching catalog courses to the gaps that remain.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <section className="plan-craft" aria-busy="true" aria-live="polite">
      <div className="plan-craft-stage">
        <span className="transition-spinner" aria-hidden="true" />
        <div className="plan-craft-copy">
          <span className="tag tag-lime">Learning plan</span>
          <h1>{title}</h1>
          <p>{detail}</p>
        </div>
        <div className="transition-track" aria-hidden="true">
          <span />
        </div>
      </div>
      <div className="plan-craft-skeleton" aria-hidden="true">
        <div className="loading-panel loading-panel-main">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton-list">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </div>
        <div className="loading-panel loading-panel-side">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-metric" />
          <div className="skeleton skeleton-metric short" />
          <div className="skeleton skeleton-copy short" />
        </div>
      </div>
    </section>
  );
}
