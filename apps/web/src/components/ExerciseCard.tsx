import type { ReactNode } from 'react';

type ExerciseCardProps = {
  title: string;
  subtitle?: string;
  metrics?: Array<{ label: string; value: string | number | null }>;
  children?: ReactNode;
};

const ExerciseCard = ({ title, subtitle, metrics, children }: ExerciseCardProps) => {
  return (
    <article className="card exercise-card">
      <header className="card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
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
