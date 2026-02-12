import { getStoredToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export type ApiError = {
  error: string;
  details?: unknown;
};

export type User = {
  id: string;
  email: string;
  name: string;
  unitKg: boolean;
  createdAt: string;
};

export type Week = {
  id: string;
  weekIndex: number;
  isDeload: boolean;
  weekType?: 'HARD' | 'DELOAD';
  rirTarget: number;
  startDate: string;
};

export type Mesocycle = {
  id: string;
  name?: string;
  startDate: string;
  structure: 'THREE_ONE' | 'FOUR_ONE' | 'FIVE_ONE';
  weeksTotal: number;
  active: boolean;
  weeks: Week[];
};

export type Exercise = {
  id: string;
  name: string;
  toolType: 'DUMBBELL' | 'BARBELL' | 'MACHINE';
  primaryMuscleGroupId: string;
  primaryMuscleGroup?: { id: string; name: string };
};

export type SessionExercise = {
  id: string;
  orderIndex: number;
  setsTarget: number;
  mode: 'AUTO' | 'LOCK_LOAD' | 'LOCK_REPS';
  loadTarget: number | null;
  repsTargetHint: number | null;
  exercise: Exercise;
  workoutSets?: { id: string; setIndex: number; loadUsed: number | null; repsDone: number | null }[];
  exerciseResult?: { rirLastSet: number | null; repsRef: number | null; notes: string | null };
};

export type PreviousSession = {
  id: string;
  weekId: string;
  sessionOrderInWeek: number;
  sessionExercises: {
    exerciseId: string;
    orderIndex: number;
    loadTarget: number | null;
    repsTargetHint: number | null;
    workoutSets: { setIndex: number; loadUsed: number | null; repsDone: number | null }[];
  }[];
};

export type TemplateSession = {
  id: string;
  weekId: string;
  sessionOrderInWeek: number;
  sessionExercises: {
    exerciseId: string;
    orderIndex: number;
    setsTarget: number;
  }[];
};

export type Session = {
  id: string;
  weekId: string;
  sessionName: string;
  dayOfWeek: number;
  sessionOrderInWeek: number;
  scheduledDate: string;
  completedAt: string | null;
  week?: Week;
  sessionExercises: SessionExercise[];
  sessionMuscleGroups?: {
    muscleGroupId: string;
    fatigue?: number;
    doms?: number;
    pump?: number;
    tendonPain?: number;
    deltaSets: number;
    perf: number;
    muscleGroup?: { id: string; name: string };
  }[];
};

export type ExerciseLastHardBest = {
  userId: string;
  exerciseId: string;
  sourceWeekId: string | null;
  bestSetWeight: number;
  bestSetReps: number;
  bestSetE1rm: number;
  updatedAt: string;
  exercise?: Exercise;
};

const request = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> => {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.auth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (json || { error: 'Request failed' }) as ApiError;
    throw error;
  }

  return json as T;
};

export const api = {
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: { email: string; password: string; name: string; unitKg: boolean }) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request<{ user: User }>('/me', { auth: true }),
  getActiveMesocycles: () =>
    request<{ mesocycles: Mesocycle[] }>('/mesocycles/active', { auth: true }),
  getPastMesocycles: () =>
    request<{ mesocycles: Mesocycle[] }>('/mesocycles/history', { auth: true }),
  createMesocycle: (payload: {
    startDate: string;
    structure: Mesocycle['structure'];
    name?: string;
  }) =>
    request<{ mesocycle: Mesocycle }>('/mesocycles', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    }),
  createSessionsTemplate: (mesocycleId: string, payload: any) =>
    request('/mesocycles/' + mesocycleId + '/sessions', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    }),
  getWeekSessions: (weekId: string) =>
    request<{ weekId: string; sessions: Session[] }>(`/weeks/${weekId}/sessions`, {
      auth: true,
    }),
  closeWeek: (weekId: string) =>
    request<{ weekId: string; updatedExercises: number; isHardWeek: boolean }>(
      `/weeks/${weekId}/close`,
      { method: 'POST', auth: true },
    ),
  getSession: (sessionId: string) =>
    request<{
      session: Session;
      previousSession: PreviousSession | null;
      templateSession: TemplateSession | null;
    }>(
      `/sessions/${sessionId}`,
      { auth: true },
    ),
  addSessionExercise: (sessionId: string, payload: any) =>
    request(`/sessions/${sessionId}/exercises`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    }),
  completeSession: (sessionId: string, payload: any) =>
    request(`/sessions/${sessionId}/complete`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    }),
  listExercises: () => request<{ exercises: Exercise[] }>('/exercises', { auth: true }),
  listLastHardBests: () =>
    request<{ bests: ExerciseLastHardBest[] }>('/exercises/last-hard-bests', {
      auth: true,
    }),
  getLastHardBest: (exerciseId: string) =>
    request<{ best: ExerciseLastHardBest | null }>(`/exercises/${exerciseId}/last-hard-best`, {
      auth: true,
    }),
  startMesocycleAfterDeload: (
    mesocycleId: string,
    payload: { choice: 'CONTINUE' | 'NEW'; startDate: string; structure?: Mesocycle['structure'] },
  ) =>
    request<{ mesocycle?: Mesocycle; copied?: boolean; closed?: boolean }>(
      `/mesocycles/${mesocycleId}/after-deload`,
      {
        method: 'POST',
        auth: true,
        body: JSON.stringify(payload),
      },
    ),
};
