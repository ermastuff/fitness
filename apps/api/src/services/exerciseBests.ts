import { estimateE1rmStrengthLevel } from '@fitness-forge/shared';
import type { Prisma, WeekType } from '@prisma/client';

type PrismaClientLike = Prisma.TransactionClient;

type ComputeResult = {
  weekId: string;
  isHardWeek: boolean;
  updatedExercises: number;
};

const resolveHardWeek = (weekType: WeekType | null | undefined, isDeload?: boolean) => {
  if (weekType) {
    return weekType === 'HARD';
  }
  return !isDeload;
};

export const computeWeekExerciseBests = async (
  tx: PrismaClientLike,
  userId: string,
  weekId: string,
): Promise<ComputeResult> => {
  const week = await tx.week.findFirst({
    where: {
      id: weekId,
      mesocycle: { userId },
    },
    select: {
      id: true,
      weekType: true,
      isDeload: true,
    },
  });

  if (!week) {
    throw new Error('Week not found');
  }

  const isHardWeek = resolveHardWeek(week.weekType, week.isDeload);
  if (!isHardWeek) {
    return { weekId, isHardWeek, updatedExercises: 0 };
  }

  const sets = await tx.workoutSet.findMany({
    where: {
      sessionExercise: {
        session: {
          weekId,
          mesocycle: { userId },
        },
      },
    },
    select: {
      id: true,
      loadUsed: true,
      repsDone: true,
      sessionExercise: {
        select: {
          exerciseId: true,
        },
      },
    },
  });

  const bestByExercise = new Map<
    string,
    { weight: number; reps: number; e1rm: number; setId: string }
  >();

  for (const set of sets) {
    if (typeof set.loadUsed !== 'number' || typeof set.repsDone !== 'number') {
      continue;
    }
    if (set.loadUsed <= 0 || set.repsDone < 1) {
      continue;
    }

    const e1rm = estimateE1rmStrengthLevel(set.loadUsed, set.repsDone);
    const existing = bestByExercise.get(set.sessionExercise.exerciseId);

    if (!existing) {
      bestByExercise.set(set.sessionExercise.exerciseId, {
        weight: set.loadUsed,
        reps: set.repsDone,
        e1rm,
        setId: set.id,
      });
      continue;
    }

    if (e1rm > existing.e1rm) {
      bestByExercise.set(set.sessionExercise.exerciseId, {
        weight: set.loadUsed,
        reps: set.repsDone,
        e1rm,
        setId: set.id,
      });
      continue;
    }

    if (e1rm === existing.e1rm) {
      if (set.loadUsed > existing.weight) {
        bestByExercise.set(set.sessionExercise.exerciseId, {
          weight: set.loadUsed,
          reps: set.repsDone,
          e1rm,
          setId: set.id,
        });
        continue;
      }
      if (set.loadUsed === existing.weight && set.repsDone > existing.reps) {
        bestByExercise.set(set.sessionExercise.exerciseId, {
          weight: set.loadUsed,
          reps: set.repsDone,
          e1rm,
          setId: set.id,
        });
      }
    }
  }

  const now = new Date();
  let updatedExercises = 0;

  for (const [exerciseId, best] of bestByExercise) {
    updatedExercises += 1;
    await tx.exerciseWeekBest.upsert({
      where: {
        userId_exerciseId_weekId: {
          userId,
          exerciseId,
          weekId,
        },
      },
      create: {
        userId,
        exerciseId,
        weekId,
        bestSetWeight: best.weight,
        bestSetReps: best.reps,
        bestSetE1rm: best.e1rm,
        bestSetId: best.setId,
        computedAt: now,
      },
      update: {
        bestSetWeight: best.weight,
        bestSetReps: best.reps,
        bestSetE1rm: best.e1rm,
        bestSetId: best.setId,
        computedAt: now,
      },
    });

    await tx.exerciseLastHardBest.upsert({
      where: {
        userId_exerciseId: {
          userId,
          exerciseId,
        },
      },
      create: {
        userId,
        exerciseId,
        sourceWeekId: weekId,
        bestSetWeight: best.weight,
        bestSetReps: best.reps,
        bestSetE1rm: best.e1rm,
        updatedAt: now,
      },
      update: {
        sourceWeekId: weekId,
        bestSetWeight: best.weight,
        bestSetReps: best.reps,
        bestSetE1rm: best.e1rm,
        updatedAt: now,
      },
    });
  }

  return { weekId, isHardWeek, updatedExercises };
};
