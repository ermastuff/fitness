import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import ExerciseCard from '../components/ExerciseCard';
import SetEditor, { type SetEntry } from '../components/SetEditor';
import FeedbackPanel, { type FeedbackEntry, type MuscleGroup } from '../components/FeedbackPanel';
import { computeSeriesTarget, type SeriesTargetConfig } from '@fitness-forge/shared';
import { api, type PreviousSession, type SessionExercise } from '../lib/api';

type ExerciseInputState = {
  sets: SetEntry[];
  rirLastSet: number | '';
  notes: string;
  autoSetCount: number;
};

const getStepRange = (toolType: SessionExercise['exercise']['toolType']) => {
  if (toolType === 'DUMBBELL') {
    return { min: 1, max: 2.5, overstepUnit: 1.5 };
  }
  return { min: 2.5, max: 5, overstepUnit: 2.5 };
};

const SERIES_TARGET_CONFIG: SeriesTargetConfig = {
  minRepsByTool: { DUMBBELL: 5, MACHINE: 5, BARBELL: 3 },
  maxRepDropPerWeek: 3,
  maxRepIncreasePerWeek: 5,
  maxIntensity: 0.92,
  weightQuantization: 0.5,
  maxRepsScan: 30,
  removeRepsIfClamped: true,
};

const WorkoutSessionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => api.getSession(id!),
    enabled: Boolean(id),
  });

  const mesocycleQuery = useQuery({
    queryKey: ['mesocycles', 'active'],
    queryFn: api.getActiveMesocycles,
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: api.listExercises,
  });

  const lastHardBestsQuery = useQuery({
    queryKey: ['exercises', 'last-hard-bests'],
    queryFn: api.listLastHardBests,
  });

  const lastHardBestByExercise = useMemo(() => {
    const map = new Map<string, { weight: number; reps: number }>();
    lastHardBestsQuery.data?.bests?.forEach((best) => {
      map.set(best.exerciseId, {
        weight: best.bestSetWeight,
        reps: best.bestSetReps,
      });
    });
    return map;
  }, [lastHardBestsQuery.data?.bests]);

  const [exerciseState, setExerciseState] = useState<Record<string, ExerciseInputState>>({});
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const muscleGroups: MuscleGroup[] = useMemo(() => {
    const session = sessionQuery.data?.session;
    if (!session) {
      return [];
    }
    const exerciseMap = new Map(
      exercisesQuery.data?.exercises?.map((exercise) => [exercise.id, exercise]) ?? [],
    );
    const unique = new Map<string, MuscleGroup>();
    const exercises = session.sessionExercises ?? [];
    exercises.forEach((exercise) => {
      const catalog = exerciseMap.get(exercise.exercise.id);
      const id = catalog?.primaryMuscleGroupId ?? exercise.exercise.primaryMuscleGroupId;
      if (!id || unique.has(id)) {
        return;
      }
      const name = catalog?.primaryMuscleGroup?.name ?? `Distretto ${unique.size + 1}`;
      unique.set(id, { id, name });
    });
    return Array.from(unique.values());
  }, [sessionQuery.data?.session, exercisesQuery.data?.exercises]);

  useEffect(() => {
    const session = sessionQuery.data?.session;
    if (!session) {
      return;
    }
    const prev = sessionQuery.data?.previousSession;
    const template = sessionQuery.data?.templateSession;
    const isDeload = Boolean(session.week?.isDeload);
    const prevMap = new Map<string, PreviousSession['sessionExercises'][number]>();
    prev?.sessionExercises?.forEach((exercise) => {
      prevMap.set(`${exercise.exerciseId}:${exercise.orderIndex}`, exercise);
    });
    const templateMap = new Map<string, number>();
    template?.sessionExercises?.forEach((exercise) => {
      templateMap.set(`${exercise.exerciseId}:${exercise.orderIndex}`, exercise.setsTarget);
    });
    const next: Record<string, ExerciseInputState> = {};
    const exercises = session.sessionExercises ?? [];
    exercises.forEach((exercise) => {
      const prevExercise = prevMap.get(
        `${exercise.exercise.id}:${exercise.orderIndex}`,
      );
      const prevSetsCount = prevExercise?.workoutSets?.length ?? 0;
      const templateSets =
        templateMap.get(`${exercise.exercise.id}:${exercise.orderIndex}`) ??
        exercise.setsTarget;
      const targetSets = isDeload ? templateSets : exercise.setsTarget;
      const sortedSets = [...(exercise.workoutSets ?? [])].sort(
        (a, b) => a.setIndex - b.setIndex,
      );
      const hasRecordedSets = sortedSets.length > 0;
      const sets = hasRecordedSets
        ? sortedSets.map((set) => ({
            loadUsed: set.loadUsed ?? '',
            repsDone: set.repsDone ?? '',
          }))
        : Array.from({ length: targetSets }, (_, idx) => {
            const prevSet = prevExercise?.workoutSets?.find(
              (set) => set.setIndex === idx + 1,
            );
            if (!prevSet && prevSetsCount > 0 && idx >= prevSetsCount) {
              return { loadUsed: '', repsDone: '' };
            }
            if (isDeload) {
              if (prevSet && typeof prevSet.loadUsed === 'number') {
                const deloadLoad = Math.round(prevSet.loadUsed * 0.9);
                return {
                  loadUsed: deloadLoad,
                  repsDone: prevSet.repsDone ?? '',
                };
              }
              if (
                prevSetsCount === 0 &&
                typeof prevExercise?.loadTarget === 'number'
              ) {
                return {
                  loadUsed: Math.round(prevExercise.loadTarget * 0.9),
                  repsDone: prevExercise.repsTargetHint ?? '',
                };
              }
              return { loadUsed: '', repsDone: '' };
            }
            const baseSet =
              typeof prevSet?.loadUsed === 'number' && typeof prevSet?.repsDone === 'number'
                ? { weight: prevSet.loadUsed, reps: prevSet.repsDone }
                : prevSetsCount === 0 &&
                    typeof exercise.loadTarget === 'number' &&
                    typeof exercise.repsTargetHint === 'number'
                  ? { weight: exercise.loadTarget, reps: exercise.repsTargetHint }
                  : null;

            if (baseSet) {
              const target = computeSeriesTarget(baseSet, null, {
                toolType: exercise.exercise.toolType,
                ...SERIES_TARGET_CONFIG,
              });
              return {
                loadUsed: target.weightTarget,
                repsDone: target.repsTarget === null ? '' : target.repsTarget,
              };
            }

            return { loadUsed: exercise.loadTarget ?? '', repsDone: exercise.repsTargetHint ?? '' };
          });
      next[exercise.id] = {
        sets,
        rirLastSet: exercise.exerciseResult?.rirLastSet ?? '',
        notes: exercise.exerciseResult?.notes ?? '',
        autoSetCount: prevSetsCount > 0 ? prevSetsCount : targetSets,
      };
    });
    setExerciseState(next);
    setSelectedWeekId(session.weekId);
  }, [
    sessionQuery.data?.session,
    sessionQuery.data?.previousSession,
    sessionQuery.data?.templateSession,
  ]);

  useEffect(() => {
    const session = sessionQuery.data?.session;
    if (!session || muscleGroups.length === 0) {
      return;
    }
    if (session.sessionMuscleGroups?.length) {
      setFeedback(
        session.sessionMuscleGroups.map((group) => ({
          muscleGroupId: group.muscleGroupId,
          fatigue: group.fatigue ?? 3,
          doms: group.doms ?? 3,
          pump: group.pump ?? 3,
          tendonPain: group.tendonPain ?? 3,
        })),
      );
      return;
    }
    setFeedback(
      muscleGroups.map((group) => ({
        muscleGroupId: group.id,
        fatigue: 3,
        doms: 3,
        pump: 3,
        tendonPain: 3,
      })),
    );
  }, [muscleGroups, sessionQuery.data?.session]);

  const previousSetsMap = useMemo(() => {
    const prev = sessionQuery.data?.previousSession;
    const map = new Map<string, PreviousSession['sessionExercises'][number]>();
    prev?.sessionExercises?.forEach((exercise) => {
      map.set(`${exercise.exerciseId}:${exercise.orderIndex}`, exercise);
    });
    return map;
  }, [sessionQuery.data?.previousSession]);

  const weeks = useMemo(() => {
    const active = mesocycleQuery.data?.mesocycles?.[0];
    if (!active?.weeks) {
      return [];
    }
    return [...active.weeks].sort((a, b) => a.weekIndex - b.weekIndex);
  }, [mesocycleQuery.data?.mesocycles]);

  const weekSessionsQuery = useQuery({
    queryKey: ['weeks', selectedWeekId, 'sessions'],
    queryFn: () => api.getWeekSessions(selectedWeekId!),
    enabled: Boolean(selectedWeekId),
  });

  const completeMutation = useMutation({
    mutationFn: (payload: any) => api.completeSession(id!, payload),
    onSuccess: async () => {
      if (!session?.weekId) {
        navigate('/next-targets');
        return;
      }
      const data = await queryClient.fetchQuery({
        queryKey: ['weeks', session.weekId, 'sessions'],
        queryFn: () => api.getWeekSessions(session.weekId),
      });

      const sorted = [...data.sessions].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) {
          return a.dayOfWeek - b.dayOfWeek;
        }
        if (a.sessionOrderInWeek !== b.sessionOrderInWeek) {
          return a.sessionOrderInWeek - b.sessionOrderInWeek;
        }
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });

      const currentIndex = sorted.findIndex((item) => item.id === session.id);
      const next = sorted
        .slice(currentIndex + 1)
        .find((item) => item.completedAt === null);

      if (next) {
        navigate(`/session/${next.id}`);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['mesocycles', 'active'] });
        await queryClient.invalidateQueries({ queryKey: ['weeks'] });
        navigate('/dashboard');
      }
    },
  });

  const session = sessionQuery.data?.session;

  useEffect(() => {
    if (!session) {
      return;
    }
    if (!selectedWeekId || selectedWeekId === session.weekId) {
      return;
    }
    if (!weekSessionsQuery.data?.sessions?.length) {
      return;
    }
    const matching = weekSessionsQuery.data.sessions.find(
      (item) =>
        item.dayOfWeek === session.dayOfWeek &&
        item.sessionOrderInWeek === session.sessionOrderInWeek,
    );
    const nextSession = matching ?? weekSessionsQuery.data.sessions[0];
    if (nextSession && nextSession.id !== session.id) {
      navigate(`/session/${nextSession.id}`);
    }
  }, [navigate, selectedWeekId, session, weekSessionsQuery.data?.sessions]);

  if (sessionQuery.isLoading) {
    return <div className="page">Loading session...</div>;
  }
  if (sessionQuery.isError) {
    return (
      <div className="page">
        Errore: {(sessionQuery.error as any)?.error ?? 'Request failed'}
      </div>
    );
  }

  if (!session) {
    return <div className="page">Session not found.</div>;
  }

  const sessionExercises = session.sessionExercises ?? [];
  const isReadOnly = Boolean(session.completedAt);

  const handleSubmit = () => {
    if (sessionExercises.length === 0) {
      return;
    }
    if (isReadOnly) {
      return;
    }
    const exercisesPayload = sessionExercises.map((exercise) => {
      const state = exerciseState[exercise.id];
      return {
        sessionExerciseId: exercise.id,
        sets: state?.sets?.map((set) => ({
          loadUsed: set.loadUsed === '' ? null : Number(set.loadUsed),
          repsDone: set.repsDone === '' ? null : Number(set.repsDone),
        })),
        rirLastSet: state?.rirLastSet === '' ? null : Number(state?.rirLastSet),
        notes: state?.notes || null,
      };
    });
    completeMutation.mutate({
      exercises: exercisesPayload,
      muscleGroupFeedback: feedback,
    });
  };

  return (
    <div className="page workout-page">
      <header className="page-header">
        <div>
          <h1>{session.sessionName}</h1>
          <p className="muted">
            Sets target, carichi e feedback per la sessione selezionata.
          </p>
        </div>
        <div className="stack">
          {weeks.length > 0 ? (
            <label className="input-row">
              Week
              <select
                className="input"
                value={selectedWeekId ?? ''}
                onChange={(event) => setSelectedWeekId(event.target.value)}
              >
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    Week {week.weekIndex}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {weekSessionsQuery.data?.sessions?.length ? (
            <label className="input-row">
              Sessione
              <select
                className="input"
                value={session.id}
                onChange={(event) => navigate(`/session/${event.target.value}`)}
              >
                {weekSessionsQuery.data.sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sessionName} (Day {item.dayOfWeek})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={handleSubmit}
          disabled={sessionExercises.length === 0 || isReadOnly}
        >
          {isReadOnly ? 'Sessione completata' : 'Completa sessione'}
        </button>
      </header>

      {sessionExercises.length === 0 ? (
        <section className="card">
          <h2>Nessun esercizio in questa sessione</h2>
          <p className="muted">
            Aggiungi esercizi dal Mesocycle Wizard (step 3) oppure seleziona una
            sessione che li ha già.
          </p>
        </section>
      ) : null}

      <div className="stack">
        {sessionExercises.map((exercise: SessionExercise) => {
          const state = exerciseState[exercise.id];
          const stepRange = getStepRange(exercise.exercise.toolType);
          const isDeload = Boolean(session.week?.isDeload);
          const isWeekOne = session.week?.weekIndex === 1;
          const prevExercise = previousSetsMap.get(
            `${exercise.exercise.id}:${exercise.orderIndex}`,
          );
          const prevSetsCount = prevExercise?.workoutSets?.length ?? 0;
          const lastHardBest = isWeekOne
            ? lastHardBestByExercise.get(exercise.exercise.id)
            : null;
          const prevSets =
            prevExercise?.workoutSets?.map((set) => ({
              loadUsed: set.loadUsed,
              repsDone: set.repsDone,
            })) ?? [];
          return (
                <ExerciseCard
                  key={exercise.id}
                  title={exercise.exercise.name}
                  subtitle={`Mode: ${exercise.mode}`}
                  metrics={[
                    { label: 'RIR target', value: session.week?.rirTarget ?? '-' },
                  ]}
                >
                  {state ? (
                    <>
                      <p className="muted small">
                        {isDeload
                          ? 'Deload: carico ~90% rispetto alla settimana precedente.'
                          : `Zona reps fisse: +${stepRange.min}-${stepRange.max} kg. Fuori range: ricalcolo e1RM.`}
                      </p>
                      {lastHardBest ? (
                        <p className="muted small">
                          Last hard best: {lastHardBest.weight} kg x {lastHardBest.reps} reps
                        </p>
                      ) : null}
                  <SetEditor
                    sets={state.sets}
                    disabled={isReadOnly}
                    prevSets={prevSets}
                    onChange={(next, meta) => {
                      if (!state) {
                        return;
                      }
                      let updatedSets = next;
                      if (meta?.field === 'loadUsed') {
                        if (meta.index >= state.autoSetCount) {
                          setExerciseState({
                            ...exerciseState,
                            [exercise.id]: { ...state, sets: updatedSets },
                          });
                          return;
                        }
                        const nextLoad = next[meta.index]?.loadUsed ?? '';
                        if (typeof nextLoad === 'number') {
                          const prevSet = prevExercise?.workoutSets?.find(
                            (set) => set.setIndex === meta.index + 1,
                          );
                          const baseSet =
                            typeof prevSet?.loadUsed === 'number' &&
                            typeof prevSet?.repsDone === 'number'
                              ? { weight: prevSet.loadUsed, reps: prevSet.repsDone }
                              : prevSetsCount === 0 &&
                                  typeof exercise.loadTarget === 'number' &&
                                  typeof exercise.repsTargetHint === 'number'
                                ? { weight: exercise.loadTarget, reps: exercise.repsTargetHint }
                                : null;

                          if (baseSet) {
                            const target = computeSeriesTarget(baseSet, nextLoad, {
                              toolType: exercise.exercise.toolType,
                              ...SERIES_TARGET_CONFIG,
                            });
                            updatedSets = next.map((set, idx) =>
                              idx === meta.index
                                ? {
                                    ...set,
                                    repsDone:
                                      target.repsTarget === null ? '' : target.repsTarget,
                                  }
                                : set,
                            );
                          }
                        }
                      }
                      setExerciseState({
                        ...exerciseState,
                        [exercise.id]: { ...state, sets: updatedSets },
                      });
                    }}
                  />
                  <label className="input-row">
                    RIR last set
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={10}
                      value={state.rirLastSet}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        setExerciseState({
                          ...exerciseState,
                          [exercise.id]: {
                            ...state,
                            rirLastSet:
                              event.target.value === '' ? '' : Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="input-row">
                    Notes
                    <input
                      className="input"
                      value={state.notes}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        setExerciseState({
                          ...exerciseState,
                          [exercise.id]: { ...state, notes: event.target.value },
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
            </ExerciseCard>
          );
        })}
      </div>

      <FeedbackPanel
        muscleGroups={muscleGroups}
        value={feedback}
        onChange={setFeedback}
        disabled={isReadOnly}
      />

      {completeMutation.isError ? (
        <p className="error-text">
          Errore: {(completeMutation.error as any)?.error ?? 'Request failed'}
        </p>
      ) : null}
    </div>
  );
};

export default WorkoutSessionPage;
