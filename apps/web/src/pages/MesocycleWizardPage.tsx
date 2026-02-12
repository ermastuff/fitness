import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type Mesocycle, type Session } from '../lib/api';
import { addDays, toInputDate } from '../lib/date';

type ColumnExercise = {
  id: string;
  exerciseId: string;
  setsTarget: number;
  mode: 'AUTO' | 'LOCK_LOAD' | 'LOCK_REPS';
  loadTarget: string;
};

type SessionColumn = {
  id: string;
  name: string;
  dayOfWeek: number;
  exercises: ColumnExercise[];
};

type DragState = {
  fromColumnId: string;
  fromIndex: number;
} | null;

type PressState = {
  columnId: string;
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  element: HTMLElement;
  timer: number | null;
};

type ActiveDrag = {
  fromColumnId: string;
  fromIndex: number;
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

const structureOptions: Array<Mesocycle['structure']> = ['THREE_ONE', 'FOUR_ONE', 'FIVE_ONE'];
const dayOptions = [
  { label: 'Lunedi', value: 1 },
  { label: 'Martedi', value: 2 },
  { label: 'Mercoledi', value: 3 },
  { label: 'Giovedi', value: 4 },
  { label: 'Venerdi', value: 5 },
  { label: 'Sabato', value: 6 },
  { label: 'Domenica', value: 0 },
];

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createColumn = (index: number): SessionColumn => ({
  id: newId(),
  name: `Session ${index + 1}`,
  dayOfWeek: 1,
  exercises: [],
});

const createExercise = (): ColumnExercise => ({
  id: newId(),
  exerciseId: '',
  setsTarget: 3,
  mode: 'AUTO',
  loadTarget: '',
});

const DRAG_HOLD_MS = 200;
const DRAG_MOVE_THRESHOLD = 6;

const MesocycleWizardPage = () => {
  const [structure, setStructure] = useState<Mesocycle['structure']>('FOUR_ONE');
  const [startDate] = useState(() => toInputDate(new Date()));
  const [mesocycleName, setMesocycleName] = useState('');
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [columns, setColumns] = useState<SessionColumn[]>([createColumn(0)]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dragOver, setDragOver] = useState<{ columnId: string; index: number } | null>(
    null,
  );
  const columnsRef = useRef(columns);
  const dragOverRef = useRef(dragOver);
  const pressRef = useRef<PressState | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const dragFrameRef = useRef<number | null>(null);

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: api.listExercises,
  });

  const lastHardBestsQuery = useQuery({
    queryKey: ['exercises', 'last-hard-bests'],
    queryFn: api.listLastHardBests,
  });

  const lastBestMap = useMemo(() => {
    const map = new Map<string, { weight: number; reps: number; e1rm: number }>();
    lastHardBestsQuery.data?.bests?.forEach((best) => {
      map.set(best.exerciseId, {
        weight: best.bestSetWeight,
        reps: best.bestSetReps,
        e1rm: best.bestSetE1rm,
      });
    });
    return map;
  }, [lastHardBestsQuery.data?.bests]);

  const createMesocycle = useMutation({
    mutationFn: () =>
      api.createMesocycle({
        startDate,
        structure,
        name: mesocycleName || undefined,
      }),
    onSuccess: (data) => setMesocycle(data.mesocycle),
  });

  const weekOne = useMemo(
    () => mesocycle?.weeks?.find((week) => week.weekIndex === 1) ?? null,
    [mesocycle],
  );

  const sessionsQuery = useQuery({
    queryKey: ['weeks', weekOne?.id, 'sessions'],
    queryFn: () => api.getWeekSessions(weekOne!.id),
    enabled: Boolean(weekOne?.id),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!mesocycle) {
        throw new Error('Mesocycle not created');
      }

      const counters = new Map<number, number>();
      const templates = columns.map((column) => {
        const next = (counters.get(column.dayOfWeek) ?? 0) + 1;
        counters.set(column.dayOfWeek, next);
        return {
          dayOfWeek: column.dayOfWeek,
          sessionName: column.name,
          sessionOrderInWeek: next,
          scheduledDate: toInputDate(addDays(new Date(startDate), column.dayOfWeek)),
        };
      });

      const created = await api.createSessionsTemplate(mesocycle.id, templates);
      const sessions = (created as { sessions: Session[] }).sessions ?? [];

      const findSession = (dayOfWeek: number, order: number) =>
        sessions.find(
          (session) =>
            session.dayOfWeek === dayOfWeek && session.sessionOrderInWeek === order,
        );

      counters.clear();
      for (const column of columns) {
        const next = (counters.get(column.dayOfWeek) ?? 0) + 1;
        counters.set(column.dayOfWeek, next);
        const session = findSession(column.dayOfWeek, next);
        if (!session) {
          continue;
        }

        const exercises = column.exercises.filter((exercise) => exercise.exerciseId);
        for (const [index, exercise] of exercises.entries()) {
          await api.addSessionExercise(session.id, {
            sessionId: session.id,
            exerciseId: exercise.exerciseId,
            orderIndex: index + 1,
            setsTarget: exercise.setsTarget,
            mode: 'AUTO',
            loadTarget: exercise.loadTarget === '' ? null : Number(exercise.loadTarget),
          });
        }
      }
    },
    onSuccess: () => sessionsQuery.refetch(),
  });

  const moveExercise = useCallback(
    (
      fromColumnId: string,
      fromIndex: number,
      toColumnId: string,
      toIndex: number,
    ) => {
    setColumns((prev) => {
      const next = prev.map((col) => ({
        ...col,
        exercises: [...col.exercises],
      }));
      const fromCol = next.find((col) => col.id === fromColumnId);
      const toCol = next.find((col) => col.id === toColumnId);
      if (!fromCol || !toCol) {
        return prev;
      }
      if (fromIndex < 0 || fromIndex >= fromCol.exercises.length) {
        return prev;
      }
      const [moved] = fromCol.exercises.splice(fromIndex, 1);
      if (!moved) {
        return prev;
      }
      let insertIndex = Math.max(0, Math.min(toIndex, toCol.exercises.length));
      if (fromColumnId === toColumnId && fromIndex < insertIndex) {
        insertIndex -= 1;
      }
      toCol.exercises.splice(insertIndex, 0, moved);
      return next;
    });
    },
    [],
  );

  const duplicateColumn = (index: number) => {
    setColumns((prev) => {
      const source = prev[index];
      if (!source) {
        return prev;
      }
      const copy: SessionColumn = {
        id: newId(),
        name: `${source.name} copy`,
        dayOfWeek: source.dayOfWeek,
        exercises: source.exercises.map((exercise) => ({
          ...exercise,
          id: newId(),
        })),
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    dragOverRef.current = dragOver;
  }, [dragOver]);

  const clearDragGhost = useCallback(() => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
    document.body.classList.remove('dragging');
  }, []);

  const clearPress = useCallback(() => {
    const press = pressRef.current;
    if (press?.timer) {
      window.clearTimeout(press.timer);
    }
    pressRef.current = null;
  }, []);

  const clearDrag = useCallback(() => {
    setDragState(null);
    setDragOver(null);
    activeDragRef.current = null;
    clearPress();
    clearDragGhost();
  }, [clearDragGhost, clearPress]);

  const startDrag = useCallback(() => {
    const press = pressRef.current;
    if (!press) {
      return;
    }
    const { element } = press;
    const rect = element.getBoundingClientRect();
    const offsetX = press.lastX - rect.left;
    const offsetY = press.lastY - rect.top;
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    document.body.classList.add('dragging');

    activeDragRef.current = {
      fromColumnId: press.columnId,
      fromIndex: press.index,
      pointerId: press.pointerId,
      offsetX,
      offsetY,
    };
    setDragState({ fromColumnId: press.columnId, fromIndex: press.index });
    setDragOver({ columnId: press.columnId, index: press.index });
    clearPress();
  }, [clearPress]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = activeDragRef.current;
      if (!active) {
        const press = pressRef.current;
        if (!press || event.pointerId !== press.pointerId) {
          return;
        }
        press.lastX = event.clientX;
        press.lastY = event.clientY;
        const dx = press.lastX - press.startX;
        const dy = press.lastY - press.startY;
        if (Math.hypot(dx, dy) > DRAG_MOVE_THRESHOLD) {
          clearPress();
        }
        return;
      }
      if (event.pointerId !== active.pointerId) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      const nextX = event.clientX - active.offsetX;
      const nextY = event.clientY - active.offsetY;
      if (dragGhostRef.current) {
        if (dragFrameRef.current !== null) {
          return;
        }
        dragFrameRef.current = requestAnimationFrame(() => {
          if (dragGhostRef.current) {
            dragGhostRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
          }
          dragFrameRef.current = null;
        });
      }

      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element) {
        setDragOver(null);
        return;
      }
      const card = element.closest<HTMLElement>('[data-card-id]');
      if (card) {
        const columnId = card.dataset.columnId ?? '';
        const index = Number(card.dataset.index ?? 0);
        if (columnId) {
          setDragOver({ columnId, index });
          return;
        }
      }
      const columnBody = element.closest<HTMLElement>('[data-column-body]');
      if (columnBody) {
        const columnId = columnBody.dataset.columnId ?? '';
        const column = columnsRef.current.find((item) => item.id === columnId);
        if (column) {
          setDragOver({ columnId, index: column.exercises.length });
          return;
        }
      }
      setDragOver(null);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const active = activeDragRef.current;
      if (!active || event.pointerId !== active.pointerId) {
        clearPress();
        return;
      }
      const target = dragOverRef.current;
      if (target) {
        moveExercise(active.fromColumnId, active.fromIndex, target.columnId, target.index);
      }
      clearDrag();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clearDrag, clearPress, moveExercise]);

  return (
    <div className="page wizard-page">
      <header className="page-header">
        <div>
          <h1>Mesocycle Wizard</h1>
          <p className="muted">Configura struttura, sessioni e esercizi.</p>
        </div>
      </header>

      <section className="card">
        <h2>1. Struttura mesociclo</h2>
        <div className="grid two">
          <label>
            Nome mesociclo
            <input
              className="input"
              value={mesocycleName}
              onChange={(event) => setMesocycleName(event.target.value)}
              placeholder="Es. Forza blocco 1"
            />
          </label>
          <label>
            Struttura
            <select
              className="input"
              value={structure}
              onChange={(event) => setStructure(event.target.value as Mesocycle['structure'])}
            >
              {structureOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace('_', '+')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => createMesocycle.mutate()}
          disabled={createMesocycle.isPending}
        >
          {createMesocycle.isPending ? 'Creating...' : 'Crea mesociclo'}
        </button>
        {mesocycle ? <p className="success-text">Mesociclo creato.</p> : null}
      </section>

      <section className="card">
        <div className="card-header">
          <h2>2. Sessioni settimanali</h2>
          <button
            className="ghost-button add-column"
            type="button"
            disabled={columns.length >= 7}
            onClick={() => setColumns((prev) => [...prev, createColumn(prev.length)])}
          >
            + Sessione
          </button>
        </div>
        {mesocycle ? (
          <div className="wizard-columns">
            {columns.map((column, colIndex) => (
              <div key={column.id} className="session-column">
                <div className="column-header">
                  <div className="column-title">
                    <input
                      className="input"
                      value={column.name}
                      onChange={(event) => {
                        const next = [...columns];
                        next[colIndex] = { ...column, name: event.target.value };
                        setColumns(next);
                      }}
                      placeholder="Nome sessione"
                    />
                    <select
                      className="input"
                      value={column.dayOfWeek}
                      onChange={(event) => {
                        const next = [...columns];
                        next[colIndex] = { ...column, dayOfWeek: Number(event.target.value) };
                        setColumns(next);
                      }}
                    >
                      {dayOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="column-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => duplicateColumn(colIndex)}
                    >
                      Duplica
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={columns.length <= 1}
                      onClick={() =>
                        setColumns((prev) => prev.filter((_, idx) => idx !== colIndex))
                      }
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>

                <div
                  className="column-body"
                  data-column-body
                  data-column-id={column.id}
                >
                  {column.exercises.map((exercise, exIndex) => {
                    const best = exercise.exerciseId
                      ? lastBestMap.get(exercise.exerciseId)
                      : null;
                    const isDragging =
                      dragState?.fromColumnId === column.id &&
                      dragState?.fromIndex === exIndex;
                    const showIndicator =
                      dragOver?.columnId === column.id && dragOver.index === exIndex;
                    return (
                      <Fragment key={exercise.id}>
                        {showIndicator ? <div className="drop-indicator" /> : null}
                        <div
                          className={`exercise-card ${isDragging ? 'dragging' : ''}`}
                          data-card-id={exercise.id}
                          data-column-id={column.id}
                          data-index={exIndex}
                        >
                          <div
                            className="drag-handle-rail"
                            role="button"
                            aria-label="Trascina esercizio"
                            onPointerDown={(event) => {
                              if (event.pointerType === 'mouse' && event.button !== 0) {
                                return;
                              }
                              event.preventDefault();
                              const element = event.currentTarget.closest<HTMLElement>(
                                '.exercise-card',
                              );
                              if (!element) {
                                return;
                              }
                              const press: PressState = {
                                columnId: column.id,
                                index: exIndex,
                                pointerId: event.pointerId,
                                startX: event.clientX,
                                startY: event.clientY,
                                lastX: event.clientX,
                                lastY: event.clientY,
                                element,
                                timer: window.setTimeout(() => startDrag(), DRAG_HOLD_MS),
                              };
                              pressRef.current = press;
                            }}
                          >
                            <div className="drag-handle-lines">
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                          <div className="exercise-content">
                            <select
                              className="input"
                              value={exercise.exerciseId}
                              onChange={(event) => {
                                const next = [...columns];
                                const nextExercises = [...column.exercises];
                                nextExercises[exIndex] = {
                                  ...exercise,
                                  exerciseId: event.target.value,
                                };
                                next[colIndex] = { ...column, exercises: nextExercises };
                                setColumns(next);
                              }}
                            >
                              <option value="">Seleziona esercizio</option>
                              {exercisesQuery.data?.exercises?.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                            {best ? (
                              <p className="muted small">
                                Last hard best: {best.weight} kg x {best.reps} reps (e1RM{' '}
                                {best.e1rm.toFixed(1)})
                              </p>
                            ) : null}
                            <div className="exercise-meta">
                              <label>
                                Sets
                                <input
                                  className="input"
                                  type="number"
                                  min={1}
                                  value={exercise.setsTarget}
                                  onChange={(event) => {
                                    const next = [...columns];
                                    const nextExercises = [...column.exercises];
                                    nextExercises[exIndex] = {
                                      ...exercise,
                                      setsTarget: Number(event.target.value),
                                    };
                                    next[colIndex] = { ...column, exercises: nextExercises };
                                    setColumns(next);
                                  }}
                                />
                              </label>
                              <label>
                                Load
                                <input
                                  className="input"
                                  type="number"
                                  value={exercise.loadTarget}
                                  onChange={(event) => {
                                    const next = [...columns];
                                    const nextExercises = [...column.exercises];
                                    nextExercises[exIndex] = {
                                      ...exercise,
                                      loadTarget: event.target.value,
                                    };
                                    next[colIndex] = { ...column, exercises: nextExercises };
                                    setColumns(next);
                                  }}
                                />
                              </label>
                            </div>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                const next = [...columns];
                                next[colIndex] = {
                                  ...column,
                                  exercises: column.exercises.filter((_, idx) => idx !== exIndex),
                                };
                                setColumns(next);
                              }}
                            >
                              Rimuovi
                            </button>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                  {dragOver?.columnId === column.id &&
                  dragOver.index === column.exercises.length ? (
                    <div className="drop-indicator" />
                  ) : null}
                  <button
                    className="secondary-button add-exercise"
                    type="button"
                    onClick={() => {
                      const next = [...columns];
                      next[colIndex] = {
                        ...column,
                        exercises: [...column.exercises, createExercise()],
                      };
                      setColumns(next);
                    }}
                  >
                    + Aggiungi esercizio
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Crea il mesociclo per continuare.</p>
        )}
        <button
          className="primary-button"
          type="button"
          onClick={() => savePlan.mutate()}
          disabled={!mesocycle || savePlan.isPending}
        >
          {savePlan.isPending ? 'Salvataggio...' : 'Salva scheda'}
        </button>
        {savePlan.isError ? (
          <p className="error-text">
            Errore: {(savePlan.error as any)?.error ?? 'Request failed'}
          </p>
        ) : null}
        {sessionsQuery.data?.sessions?.length ? (
          <p className="success-text">Sessioni salvate.</p>
        ) : null}
      </section>
    </div>
  );
};

export default MesocycleWizardPage;
