import { describe, expect, it } from 'vitest';
import { isSecondOrLaterSameMuscleInWeekFromSessions } from './sessionMuscleGroup';

const makeSession = ({
  id,
  order,
  scheduledDate,
  completed,
  muscleGroups,
}: {
  id: string;
  order: number;
  scheduledDate: string;
  completed: boolean;
  muscleGroups: string[];
}) => ({
  id,
  sessionOrderInWeek: order,
  scheduledDate: new Date(scheduledDate),
  completedAt: completed ? new Date(scheduledDate) : null,
  sessionMuscleGroups: muscleGroups.map((muscleGroupId) => ({ muscleGroupId })),
});

describe('isSecondOrLaterSameMuscleInWeekFromSessions', () => {
  it('returns true when a previous completed session hit the same muscle group', () => {
    const sessions = [
      makeSession({
        id: 'a',
        order: 1,
        scheduledDate: '2026-02-10',
        completed: true,
        muscleGroups: ['mg1'],
      }),
      makeSession({
        id: 'b',
        order: 2,
        scheduledDate: '2026-02-12',
        completed: false,
        muscleGroups: ['mg1'],
      }),
    ];

    expect(isSecondOrLaterSameMuscleInWeekFromSessions(sessions, 'b', 'mg1')).toBe(true);
  });

  it('returns false when previous session is not completed', () => {
    const sessions = [
      makeSession({
        id: 'a',
        order: 1,
        scheduledDate: '2026-02-10',
        completed: false,
        muscleGroups: ['mg1'],
      }),
      makeSession({
        id: 'b',
        order: 2,
        scheduledDate: '2026-02-12',
        completed: true,
        muscleGroups: ['mg1'],
      }),
    ];

    expect(isSecondOrLaterSameMuscleInWeekFromSessions(sessions, 'b', 'mg1')).toBe(false);
  });

  it('returns false when only later sessions hit the same muscle group', () => {
    const sessions = [
      makeSession({
        id: 'a',
        order: 1,
        scheduledDate: '2026-02-10',
        completed: true,
        muscleGroups: [],
      }),
      makeSession({
        id: 'b',
        order: 2,
        scheduledDate: '2026-02-12',
        completed: true,
        muscleGroups: [],
      }),
      makeSession({
        id: 'c',
        order: 3,
        scheduledDate: '2026-02-14',
        completed: true,
        muscleGroups: ['mg1'],
      }),
    ];

    expect(isSecondOrLaterSameMuscleInWeekFromSessions(sessions, 'b', 'mg1')).toBe(false);
  });

  it('uses scheduledDate as fallback ordering', () => {
    const sessions = [
      makeSession({
        id: 'a',
        order: 1,
        scheduledDate: '2026-02-12',
        completed: true,
        muscleGroups: ['mg1'],
      }),
      makeSession({
        id: 'b',
        order: 1,
        scheduledDate: '2026-02-10',
        completed: true,
        muscleGroups: [],
      }),
    ];

    expect(isSecondOrLaterSameMuscleInWeekFromSessions(sessions, 'a', 'mg1')).toBe(true);
  });
});
