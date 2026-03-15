import type { StatsResponse } from "@repo/types";

import { useStats } from "./use-stats";

import "./stats-view.css";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});

const formatDay = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00Z`);

  return dayFormatter.format(date);
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "rgba(18, 18, 18, 0.82)",
  high: "rgba(18, 18, 18, 0.54)",
  medium: "rgba(18, 18, 18, 0.32)",
  low: "rgba(18, 18, 18, 0.16)",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

type TotalsProps = Readonly<{
  totals: StatsResponse["totals"] | null;
}>;

const StatsTotals = ({ totals }: TotalsProps) => {
  const isLoading = totals === null;

  return (
    <section className="stats-view__total">
      <p className="stats-view__total-label">Total Events</p>
      <p
        className={`stats-view__total-value${isLoading ? "stats-view__skeleton" : ""}`}
      >
        {isLoading ? "--" : totals.events.toLocaleString()}
      </p>
    </section>
  );
};

type ActivityProps = Readonly<{
  recentActivity: StatsResponse["recentActivity"] | null;
}>;

const StatsActivity = ({ recentActivity }: ActivityProps) => {
  const isLoading = recentActivity === null;
  const maxCount = isLoading
    ? 1
    : Math.max(...recentActivity.map((d) => d.count), 1);

  const items = isLoading
    ? Array.from({ length: 7 }, (_, i) => ({
        date: "",
        count: 0,
        key: `skeleton-${String(i)}`,
      }))
    : recentActivity.map((d) => ({ ...d, key: d.date }));

  return (
    <section className="stats-view__activity">
      <h2 className="stats-view__section-title">7-Day Activity</h2>
      <div
        className="stats-view__activity-chart"
        role="img"
        aria-label={
          isLoading
            ? "Loading activity chart"
            : `7-day activity chart. ${recentActivity.map((d) => `${formatDay(d.date)}: ${String(d.count)}`).join(", ")}`
        }
      >
        {items.map((item) => (
          <div className="stats-view__activity-column" key={item.key}>
            <div
              className={`stats-view__activity-bar${isLoading ? "stats-view__skeleton" : ""}`}
              style={
                {
                  "--bar-pct": (item.count / maxCount) * 100,
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>
      <div className="stats-view__activity-labels" aria-hidden="true">
        {items.map((item) => (
          <div key={item.key}>
            <div className="stats-view__activity-day">
              {isLoading ? "--" : formatDay(item.date)}
            </div>
            <div className="stats-view__activity-count">
              {isLoading ? "" : item.count}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

type CategoriesProps = Readonly<{
  byCategory: StatsResponse["byCategory"] | null;
}>;

const StatsCategories = ({ byCategory }: CategoriesProps) => {
  const isLoading = byCategory === null;

  const entries = isLoading
    ? []
    : Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => ({ category, count }));

  const maxCount = isLoading ? 1 : Math.max(...entries.map((e) => e.count), 1);

  return (
    <section className="stats-view__categories">
      <h2 className="stats-view__section-title">By Category</h2>
      <div className="stats-view__category-rows">
        {isLoading
          ? Array.from({ length: 9 }, (_, i) => (
              <div
                className="stats-view__category-row"
                key={`skeleton-${String(i)}`}
              >
                <span className="stats-view__category-label stats-view__skeleton">
                  --
                </span>
                <div className="stats-view__category-bar-track">
                  <div
                    className="stats-view__category-bar-fill stats-view__skeleton"
                    style={{ "--bar-pct": 0 } as React.CSSProperties}
                  />
                </div>
                <span className="stats-view__category-count stats-view__skeleton">
                  --
                </span>
              </div>
            ))
          : entries.map((entry) => (
              <div className="stats-view__category-row" key={entry.category}>
                <span className="stats-view__category-label">
                  {entry.category}
                </span>
                <div className="stats-view__category-bar-track">
                  <div
                    className="stats-view__category-bar-fill"
                    style={
                      {
                        "--bar-pct": (entry.count / maxCount) * 100,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <span className="stats-view__category-count">
                  {entry.count}
                </span>
              </div>
            ))}
      </div>
    </section>
  );
};

type SeverityProps = Readonly<{
  bySeverity: StatsResponse["bySeverity"] | null;
}>;

const StatsSeverity = ({ bySeverity }: SeverityProps) => {
  const isLoading = bySeverity === null;

  return (
    <section className="stats-view__severity">
      <h2 className="stats-view__section-title">By Severity</h2>
      <div className="stats-view__severity-items">
        {SEVERITY_ORDER.map((severity) => (
          <div
            className="stats-view__severity-item"
            key={severity}
            style={
              {
                "--severity-color": SEVERITY_COLORS[severity],
              } as React.CSSProperties
            }
          >
            <div className="stats-view__severity-label">{severity}</div>
            <div
              className={`stats-view__severity-value${isLoading ? "stats-view__skeleton" : ""}`}
            >
              {isLoading ? "--" : bySeverity[severity]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const StatsError = () => (
  <div className="stats-view__error">
    <p className="stats-view__error-title">Signal Lost</p>
    <p className="stats-view__error-message">Failed to load statistics</p>
  </div>
);

export const StatsView = () => {
  const { data, status } = useStats();

  return (
    <section aria-labelledby="stats-title" className="stats-view">
      <article className="stats-view__panel" aria-busy={status === "loading"}>
        <header>
          <p className="stats-view__eyebrow">System Analytics</p>
          <h1 className="stats-view__title" id="stats-title">
            Event Statistics
          </h1>
        </header>

        <div className="stats-view__grid">
          {status === "error" ? (
            <StatsError />
          ) : (
            <>
              <StatsTotals totals={data?.totals ?? null} />
              <StatsActivity recentActivity={data?.recentActivity ?? null} />
              <StatsCategories byCategory={data?.byCategory ?? null} />
              <StatsSeverity bySeverity={data?.bySeverity ?? null} />
            </>
          )}
        </div>
      </article>
    </section>
  );
};
