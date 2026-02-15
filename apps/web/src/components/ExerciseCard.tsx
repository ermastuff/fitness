import type { ReactNode } from 'react';

type ExerciseCardProps = {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  metrics?: Array<{ label: string; value: string | number | null }>;
  children?: ReactNode;
};

const ExerciseCard = ({ title, subtitle, headerRight, metrics, children }: ExerciseCardProps) => {
  return (
    <article className="card exercise-panel">
      <header className="card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {headerRight}
      </header>
      {metrics ? (
        <div className="metric-row">
          {metrics.map((metric) => (
            <div key={metric.label} className="metric">
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">{metric.value ?? '-'}</span>
            </div>
          ))}
        </div>
      ) : null}
      {children ? <div className="card-body">{children}</div> : null}
    </article>
  );
};

export default ExerciseCard;
