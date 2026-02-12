type SetEntry = {
  loadUsed: number | '';
  repsDone: number | '';
};

type SetEditorProps = {
  sets: SetEntry[];
  onChange: (next: SetEntry[], meta?: { index: number; field: keyof SetEntry }) => void;
  disabled?: boolean;
  prevSets?: { loadUsed: number | null; repsDone: number | null }[];
};

const SetEditor = ({ sets, onChange, disabled = false, prevSets = [] }: SetEditorProps) => {
  const updateSet = (index: number, field: keyof SetEntry, value: number | '') => {
    const next = [...sets];
    next[index] = { ...next[index], [field]: value };
    onChange(next, { index, field });
  };

  const addSet = () => onChange([...sets, { loadUsed: '', repsDone: '' }]);
  const removeSet = (index: number) => onChange(sets.filter((_, idx) => idx !== index));

  return (
    <div className="set-editor">
      {sets.map((set, index) => (
        <div key={index} className="set-row">
          <span className="set-label">Set {index + 1}</span>
          <input
            className="input"
            type="number"
            placeholder="Load"
            value={set.loadUsed}
            disabled={disabled}
            onChange={(event) =>
              updateSet(
                index,
                'loadUsed',
                event.target.value === '' ? '' : Number(event.target.value),
              )
            }
          />
          <input
            className="input"
            type="number"
            placeholder="Reps"
            value={set.repsDone}
            disabled={disabled}
            onChange={(event) =>
              updateSet(
                index,
                'repsDone',
                event.target.value === '' ? '' : Number(event.target.value),
              )
            }
          />
          <button
            className="ghost-button"
            type="button"
            onClick={() => removeSet(index)}
            disabled={disabled}
          >
            Remove
          </button>
          {prevSets?.[index] ? (
            <span className="set-prev muted small">
              Prev: {prevSets[index]?.loadUsed ?? '-'}kg x {prevSets[index]?.repsDone ?? '-'} reps
            </span>
          ) : null}
        </div>
      ))}
      <button className="secondary-button" type="button" onClick={addSet} disabled={disabled}>
        Add set
      </button>
    </div>
  );
};

export type { SetEntry };
export default SetEditor;
