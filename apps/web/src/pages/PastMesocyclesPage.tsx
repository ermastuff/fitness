import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const PastMesocyclesPage = () => {
  const mesocyclesQuery = useQuery({
    queryKey: ['mesocycles', 'history'],
    queryFn: api.getPastMesocycles,
  });

  const mesocycles = mesocyclesQuery.data?.mesocycles ?? [];
  const [selectedMesocycleId, setSelectedMesocycleId] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMesocycleId && mesocycles.length > 0) {
      setSelectedMesocycleId(mesocycles[0].id);
    }
  }, [mesocycles, selectedMesocycleId]);

  const selectedMesocycle = useMemo(
    () => mesocycles.find((meso) => meso.id === selectedMesocycleId) ?? null,
    [mesocycles, selectedMesocycleId],
  );

  useEffect(() => {
    if (!selectedMesocycle) {
      setSelectedWeekId(null);
      return;
    }
    const firstWeek = [...selectedMesocycle.weeks].sort(
      (a, b) => a.weekIndex - b.weekIndex,
    )[0];
    setSelectedWeekId(firstWeek?.id ?? null);
  }, [selectedMesocycle]);

  const sessionsQuery = useQuery({
    queryKey: ['weeks', selectedWeekId, 'sessions'],
    queryFn: () => api.getWeekSessions(selectedWeekId!),
    enabled: Boolean(selectedWeekId),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Mesocicli passati</h1>
          <p className="muted">Consulta sessioni e settimane dei mesocicli conclusi.</p>
        </div>
      </header>

      <section className="card">
        <h2>Mesociclo</h2>
        {mesocyclesQuery.isLoading ? <p>Loading...</p> : null}
        {mesocycles.length === 0 ? (
          <p className="muted">Non ci sono mesocicli conclusi.</p>
        ) : (
          <label className="input-row">
            Seleziona
            <select
              className="input"
              value={selectedMesocycleId ?? ''}
              onChange={(event) => setSelectedMesocycleId(event.target.value)}
            >
              {mesocycles.map((meso) => (
                <option key={meso.id} value={meso.id}>
                  {meso.structure.replace('_', '+')}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selectedMesocycle ? (
        <section className="card">
          <div className="grid two">
            <div>
              <span className="muted">Struttura</span>
              <p className="stat">{selectedMesocycle.structure.replace('_', '+')}</p>
            </div>
            <div>
              <span className="muted">Settimane</span>
              <p className="stat">{selectedMesocycle.weeksTotal}</p>
            </div>
          </div>
        </section>
      ) : null}

      {selectedMesocycle?.weeks?.length ? (
        <section className="card">
          <div className="card-header">
            <h2>Sessioni della settimana</h2>
            <label className="input-row">
              Week
              <select
                className="input"
                value={selectedWeekId ?? ''}
                onChange={(event) => setSelectedWeekId(event.target.value)}
              >
                {selectedMesocycle.weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    Week {week.weekIndex}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {sessionsQuery.isLoading ? <p>Loading sessions...</p> : null}
          {sessionsQuery.data?.sessions?.length ? (
            <div className="list">
              {sessionsQuery.data.sessions.map((session) => (
                <Link key={session.id} className="list-item" to={`/session/${session.id}`}>
                  <div>
                    <h3>{session.sessionName}</h3>
                    <p className="muted">Day {session.dayOfWeek}</p>
                  </div>
                  <span className={session.completedAt ? 'badge done' : 'badge pending'}>
                    {session.completedAt ? 'Done' : 'Planned'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">Nessuna sessione per questa settimana.</p>
          )}
        </section>
      ) : null}
    </div>
  );
};

export default PastMesocyclesPage;
