type MuscleGroup = {
  id: string;
  name: string;
};

type FeedbackEntry = {
  muscleGroupId: string;
  fatigue: number;
  doms: number;
  pump: number;
  tendonPain: number;
};

type FeedbackPanelProps = {
  muscleGroups: MuscleGroup[];
  value: FeedbackEntry[];
  onChange: (next: FeedbackEntry[]) => void;
  disabled?: boolean;
};

const scoreOptions = [1, 2, 3, 4, 5];

const FeedbackPanel = ({ muscleGroups, value, onChange, disabled = false }: FeedbackPanelProps) => {
  const updateFeedback = (
    muscleGroupId: string,
    field: keyof Omit<FeedbackEntry, 'muscleGroupId'>,
    nextValue: number,
  ) => {
    if (disabled) {
      return;
    }
    const existing = value.find((item) => item.muscleGroupId === muscleGroupId);
    const base =
      existing ?? { muscleGroupId, fatigue: 3, doms: 3, pump: 3, tendonPain: 3 };
    const next = value.filter((item) => item.muscleGroupId !== muscleGroupId);
    next.push({ ...base, [field]: nextValue });
    onChange(next);
  };

  return (
    <div className="card feedback-panel">
      <h3>Feedback distretti</h3>
      <div className="feedback-list">
        {muscleGroups.map((group) => {
          const current = value.find((item) => item.muscleGroupId === group.id) ?? {
            muscleGroupId: group.id,
            fatigue: 3,
            doms: 3,
            pump: 3,
            tendonPain: 3,
          };
          return (
            <div key={group.id} className="feedback-row">
              <div>
                <p className="feedback-title">{group.name}</p>
                <span className="muted">FATIGUE / DOMS / PUMP / TENDON</span>
              </div>
              <div className="feedback-inputs">
                {(['fatigue', 'doms', 'pump', 'tendonPain'] as const).map((field) => (
                  <label key={field} className="feedback-select">
                    {field.toUpperCase()}
                    <select
                      value={current[field]}
                      disabled={disabled}
                      onChange={(event) =>
                        updateFeedback(group.id, field, Number(event.target.value))
                      }
                    >
                      {scoreOptions.map((score) => (
                        <option key={score} value={score}>
                          {score}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export type { FeedbackEntry, MuscleGroup };
export default FeedbackPanel;
