import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Mesocycle } from '../lib/api';
import { addDays, toInputDate } from '../lib/date';

const DashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mesocycleQuery = useQuery({
    queryKey: ['mesocycles', 'active'],
    queryFn: api.getActiveMesocycles,
  });

  const activeMesocycle = mesocycleQuery.data?.mesocycles?.[0];

  const baseWeek = useMemo(() => {
    if (!activeMesocycle) {
      return null;
    }
    const now = new Date();
    const sorted = [...activeMesocycle.weeks].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    const firstWeek = sorted[0];
    if (!firstWeek) {
      return null;
    }
    if (now < new Date(firstWeek.startDate)) {
      return firstWeek;
    }
    const found = sorted.find((week) => {
      const start = new Date(week.startDate);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return now >= start && now < end;
    });
    return found ?? sorted[sorted.length - 1] ?? null;
  }, [activeMesocycle]);

  const [weekId, setWeekId] = useState<string | null>(null);
  const [afterDeloadStartDate, setAfterDeloadStartDate] = useState(() =>
    toInputDate(addDays(new Date(), 1)),
  );
  const [afterDeloadStructure, setAfterDeloadStructure] =
    useState<Mesocycle['structure']>('FOUR_ONE');

  useEffect(() => {
    if (baseWeek?.id && !weekId) {
      setWeekId(baseWeek.id);
    }
  }, [baseWeek?.id, weekId]);

  const selectedWeek = useMemo(() => {
    if (!activeMesocycle || !weekId) {
      return baseWeek;
    }
    return activeMesocycle.weeks.find((week) => week.id === weekId) ?? baseWeek;
  }, [activeMesocycle, baseWeek, weekId]);

  const sessionsQuery = useQuery({
    queryKey: ['weeks', weekId, 'sessions'],
    queryFn: () => api.getWeekSessions(weekId!),
    enabled: Boolean(weekId),
  });

  useEffect(() => {
    if (!activeMesocycle || !sessionsQuery.data?.sessions?.length || !selectedWeek) {
      return;
    }
    const allCompleted = sessionsQuery.data.sessions.every((session) => session.completedAt);
    if (!allCompleted) {
      return;
    }
    const nextWeek = activeMesocycle.weeks.find(
      (week) => week.weekIndex === selectedWeek.weekIndex + 1,
    );
    if (nextWeek && nextWeek.id !== weekId) {
      setWeekId(nextWeek.id);
    }
  }, [activeMesocycle, selectedWeek, sessionsQuery.data?.sessions, weekId]);

  useEffect(() => {
    if (!selectedWeek) {
      return;
    }
    const start = new Date(selectedWeek.startDate);
    setAfterDeloadStartDate(toInputDate(addDays(start, 7)));
  }, [selectedWeek?.startDate]);

  useEffect(() => {
    if (!activeMesocycle) {
      return;
    }
    setAfterDeloadStructure(activeMesocycle.structure);
  }, [activeMesocycle?.structure]);

  const afterDeloadMutation = useMutation({
    mutationFn: (choice: 'CONTINUE' | 'NEW') =>
      api.startMesocycleAfterDeload(activeMesocycle!.id, {
        choice,
        startDate: afterDeloadStartDate,
        structure: afterDeloadStructure,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mesocycles'] });
      if (variables === 'NEW') {
        navigate('/wizard');
        return;
      }
      if (data.mesocycle) {
        setWeekId(data.mesocycle.weeks?.[0]?.id ?? null);
      }
    },
  });

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Panoramica del mesociclo attivo e sessioni.</p>
        </div>
        <Link className="primary-button" to="/wizard">
          Nuovo mesociclo
        </Link>
      </header>

      <section className="card">
        <h2>Mesociclo attivo</h2>
        {mesocycleQuery.isLoading ? <p>Loading...</p> : null}
        {activeMesocycle ? (
          <div className="grid">
            <div>
              <span className="muted">Struttura</span>
              <p className="stat">{activeMesocycle.structure.replace('_', '+')}</p>
            </div>
            <div>
              <span className="muted">Settimana</span>
              <p className="stat">
                {selectedWeek ? `#${selectedWeek.weekIndex}` : 'N/A'} / {activeMesocycle.weeksTotal}
              </p>
            </div>
            <div>
              <span className="muted">RIR Target</span>
              <p className="stat">{selectedWeek?.rirTarget ?? '-'}</p>
            </div>
          </div>
        ) : (
          <p className="muted">Nessun mesociclo attivo. Crea il primo.</p>
        )}
      </section>

      {activeMesocycle && selectedWeek ? (
        <section className="card">
          <h2>Fine deload</h2>
          {selectedWeek.isDeload ? (
            sessionsQuery.data?.sessions?.every((session) => session.completedAt) ? (
              <>
                <p className="muted">
                  Hai completato il deload. Scegli come proseguire il prossimo mesociclo.
                </p>
                <label>
                  Struttura
                  <select
                    className="input"
                    value={afterDeloadStructure}
                    onChange={(event) =>
                      setAfterDeloadStructure(event.target.value as Mesocycle['structure'])
                    }
                  >
                    <option value="THREE_ONE">3+1</option>
                    <option value="FOUR_ONE">4+1</option>
                    <option value="FIVE_ONE">5+1</option>
                  </select>
                </label>
                <div className="stack">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => afterDeloadMutation.mutate('CONTINUE')}
                    disabled={afterDeloadMutation.isPending}
                  >
                    Continua stessa scheda
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => afterDeloadMutation.mutate('NEW')}
                    disabled={afterDeloadMutation.isPending}
                  >
                    Nuovo mesociclo da zero
                  </button>
                </div>
                {afterDeloadMutation.isError ? (
                  <p className="error-text">
                    Errore: {(afterDeloadMutation.error as any)?.error ?? 'Request failed'}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="muted">
                Completa tutte le sessioni della settimana di deload per proseguire.
              </p>
            )
          ) : (
            <p className="muted">La scelta è disponibile solo a fine deload.</p>
          )}
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <h2>Sessioni della settimana</h2>
          {selectedWeek ? <span className="pill">Week {selectedWeek.weekIndex}</span> : null}
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
          <p className="muted">Nessuna sessione configurata per questa settimana.</p>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
