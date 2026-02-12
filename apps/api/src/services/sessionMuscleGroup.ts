import { prisma } from '../db/prisma';

type SessionMuscleGroupEntry = {
  muscleGroupId: string;
};

type SessionEntry = {
  id: string;
  sessionOrderInWeek: number;
  scheduledDate: Date;
  completedAt: Date | null;
  sessionMuscleGroups: SessionMuscleGroupEntry[];
};

type CheckInput = {
  weekId: string;
  sessionId: string;
  muscleGroupId: string;
};

export const isSecondOrLaterSameMuscleInWeekFromSessions = (
  sessions: SessionEntry[],
  sessionId: string,
  muscleGroupId: string,
) => {
  const ordered = [...sessions].sort((a, b) => {
    if (a.sessionOrderInWeek !== b.sessionOrderInWeek) {
      return a.sessionOrderInWeek - b.sessionOrderInWeek;
    }
    return a.scheduledDate.getTime() - b.scheduledDate.getTime();
  });

  const currentIndex = ordered.findIndex((session) => session.id === sessionId);
  if (currentIndex <= 0) {
    return false;
  }

  for (let i = 0; i < currentIndex; i += 1) {
    const session = ordered[i];
    if (!session.completedAt) {
      continue;
    }
    if (session.sessionMuscleGroups.some((item) => item.muscleGroupId === muscleGroupId)) {
      return true;
    }
  }

  return false;
};

export const isSecondOrLaterSameMuscleInWeek = async ({
  weekId,
  sessionId,
  muscleGroupId,
}: CheckInput) => {
  const sessions = await prisma.session.findMany({
    where: { weekId },
    select: {
      id: true,
      sessionOrderInWeek: true,
      scheduledDate: true,
      completedAt: true,
      sessionMuscleGroups: {
        where: { muscleGroupId },
        select: { muscleGroupId: true },
      },
    },
    orderBy: [{ sessionOrderInWeek: 'asc' }, { scheduledDate: 'asc' }],
  });

  return isSecondOrLaterSameMuscleInWeekFromSessions(sessions, sessionId, muscleGroupId);
};
