import { itemStyle, getErrorMessage } from "../app/utils";

export function MetricRibbon({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="metric-ribbon">
      {items.map((item, index) => (
        <div className="metric-pill" key={item.label} style={itemStyle(index)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  return <p className="error-banner">{getErrorMessage(error)}</p>;
}

export function EmptyState({
  eyebrow,
  title,
  copy
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <section className="empty-state">
      <div className="empty-state__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {copy ? <p className="lead-copy">{copy}</p> : null}
      </div>
      <div aria-hidden="true" className="empty-state__art">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
