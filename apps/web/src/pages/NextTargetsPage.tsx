import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ExerciseCard from '../components/ExerciseCard';
import { api } from '../lib/api';

const NextTargetsPage = () => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const mesocycleQuery = useQuery({
    queryKey: ['mesocycles', 'active'],
    queryFn: api.getActiveMesocycles,
  });

  const activeMesocycle = mesocycleQuery.data?.mesocycles?.[0];
  const currentWeek = useMemo(() => {
    if (!activeMesocycle) {
      return null;
    }
    const now = new Date();
    const sorted = [...activeMesocycle.weeks].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    return (
      sorted.find((week) => {
        const start = new Date(week.startDate);
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        return now >= start && now < end;
      }) ??
      sorted[sorted.length - 1] ??
      null
    );
  }, [activeMesocycle]);

  const sessionsQuery = useQuery({
    queryKey: ['weeks', currentWeek?.id, 'sessions'],
    queryFn: () => api.getWeekSessions(currentWeek!.id),
    enabled: Boolean(currentWeek?.id),
  });

  const sessionQuery = useQuery({
    queryKey: ['sessions', selectedSessionId],
    queryFn: () => api.getSession(selectedSessionId),
    enabled: Boolean(selectedSessionId),
  });

  const session = sessionQuery.data?.session;

  return (
    <div className="page next-targets-page">
      <header className="page-header">
        <div>
          <h1>Next Targets</h1>
          <p className="muted">Delta sets e target aggiornati dopo la sessione.</p>
        </div>
      </header>

      <section className="card">
        <label>
          Seleziona sessione
          <select
            className="input"
            value={selectedSessionId}
            onChange={(event) => setSelectedSessionId(event.target.value)}
          >
            <option value="">Select session</option>
            {sessionsQuery.data?.sessions?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sessionName} (Day {item.dayOfWeek})
              </option>
            ))}
          </select>
        </label>
      </section>

      {session ? (
        <>
          <section className="card">
            <h2>Delta sets distretti</h2>
            {session.sessionMuscleGroups?.length ? (
              <div className="grid two">
                {session.sessionMuscleGroups.map((group) => (
                  <div key={group.muscleGroupId} className="delta-card">
                    <span className="muted">
                      {group.muscleGroup?.name ?? group.muscleGroupId}
                    </span>
                    <p className="stat">
                      {group.deltaSets > 0 ? `+${group.deltaSets}` : group.deltaSets}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Nessun delta set disponibile per questa sessione.</p>
            )}
          </section>

          <section className="card">
            <h2>Targets esercizi</h2>
            <div className="stack">
              {session.sessionExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  title={exercise.exercise.name}
                  subtitle={`Mode ${exercise.mode}`}
                  metrics={[
                    { label: 'Sets', value: exercise.setsTarget },
                    { label: 'Load', value: exercise.loadTarget ?? '-' },
                    { label: 'Reps', value: exercise.repsTargetHint ?? '-' },
                  ]}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="muted">Seleziona una sessione per visualizzare i target.</p>
      )}
    </div>
  );
};

export default NextTargetsPage;
