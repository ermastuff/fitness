import { Router } from 'express';
import { z } from 'zod';
import { ProgressionEntityType, RecordSource, SessionExerciseMode } from '@prisma/client';
import { prisma } from '../db/prisma';
import { computeExerciseTargets, computePerfSessionFromNumbers } from '../services/trainingEngine';
import {
  aggregateWeeklyFeedback,
  applyPainOverride,
  applySmoothing,
  computeDeltaFromMatrix,
  filterCandidatesForDelta,
  selectAutoVolumeCandidate,
} from '../services/autoVolume';
import { computeWeekExerciseBests } from '../services/exerciseBests';

const router = Router();

const createSessionExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().min(1),
  setsTarget: z.number().int().min(1),
  mode: z.nativeEnum(SessionExerciseMode),
  loadTarget: z.number().nullable().optional(),
  repsTargetHint: z.number().int().min(1).nullable().optional(),
});

const completeSessionSchema = z.object({
  exercises: z
    .array(
      z.object({
        sessionExerciseId: z.string().uuid(),
        sets: z
          .array(
            z.object({
              loadUsed: z.number().nullable(),
              repsDone: z.number().int().nullable(),
            }),
          )
          .min(1),
        rirLastSet: z.number().int().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .min(1),
  muscleGroupFeedback: z
    .array(
      z.object({
        muscleGroupId: z.string().uuid(),
        fatigue: z.number().int().min(1).max(5),
        doms: z.number().int().min(1).max(5),
        pump: z.number().int().min(1).max(5),
        tendonPain: z.number().int().min(1).max(5),
      }),
    )
    .min(1),
});

router.post('/:id/exercises', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = createSessionExerciseSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const session = await prisma.session.findFirst({
    where: {
      id: req.params.id,
      mesocycle: { userId: req.user.id },
    },
    include: {
      week: true,
    },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id: result.data.exerciseId },
  });

  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const sessionExercise = await tx.sessionExercise.create({
        data: {
          sessionId: session.id,
          exerciseId: result.data.exerciseId,
          orderIndex: result.data.orderIndex,
          setsTarget: result.data.setsTarget,
          mode: result.data.mode,
          loadTarget: result.data.loadTarget ?? null,
          repsTargetHint: result.data.repsTargetHint ?? null,
        },
      });

      if (session.week.weekIndex === 1) {
        const siblingSessions = await tx.session.findMany({
          where: {
            mesocycleId: session.mesocycleId,
            dayOfWeek: session.dayOfWeek,
            sessionOrderInWeek: session.sessionOrderInWeek,
            week: { weekIndex: { gt: 1 } },
          },
          select: { id: true },
        });

        if (siblingSessions.length > 0) {
          const existing = await tx.sessionExercise.findMany({
            where: {
              sessionId: { in: siblingSessions.map((item) => item.id) },
              orderIndex: result.data.orderIndex,
            },
            select: { sessionId: true },
          });

          const existingIds = new Set(existing.map((item) => item.sessionId));
          const toCreate = siblingSessions
            .filter((item) => !existingIds.has(item.id))
            .map((item) => ({
              sessionId: item.id,
              exerciseId: result.data.exerciseId,
              orderIndex: result.data.orderIndex,
              setsTarget: result.data.setsTarget,
              mode: result.data.mode,
              loadTarget: result.data.loadTarget ?? null,
              repsTargetHint: result.data.repsTargetHint ?? null,
            }));

          if (toCreate.length > 0) {
            await tx.sessionExercise.createMany({ data: toCreate });
          }
        }
      }

      return sessionExercise;
    });

    return res.status(201).json({ sessionExercise: created });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Exercise order already exists in session' });
    }
    throw error;
  }
});

router.post('/:id/complete', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = completeSessionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const session = await prisma.session.findFirst({
    where: {
      id: req.params.id,
      mesocycle: { userId: req.user.id },
    },
    include: {
      week: true,
      mesocycle: true,
      sessionExercises: {
        include: {
          exercise: true,
          workoutSets: true,
          exerciseResult: true,
        },
      },
    },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.completedAt) {
    return res.status(409).json({ error: 'Session already completed' });
  }

  const exerciseInputs = result.data.exercises;
  const feedbackInputs = result.data.muscleGroupFeedback;

  if (
    session.sessionExercises.some(
      (item) => item.workoutSets.length > 0 || item.exerciseResult,
    )
  ) {
    return res
      .status(409)
      .json({ error: 'Workout data already exists for this session' });
  }

  const sessionExerciseIds = new Set(session.sessionExercises.map((item) => item.id));
  const payloadIds = new Set(exerciseInputs.map((item) => item.sessionExerciseId));
  if (payloadIds.size !== exerciseInputs.length) {
    return res.status(400).json({ error: 'Duplicate sessionExerciseId in payload' });
  }
  for (const input of exerciseInputs) {
    if (!sessionExerciseIds.has(input.sessionExerciseId)) {
      return res.status(400).json({ error: 'sessionExerciseId does not belong to session' });
    }
  }

  const muscleGroupIds = new Set(feedbackInputs.map((item) => item.muscleGroupId));
  if (muscleGroupIds.size !== feedbackInputs.length) {
    return res.status(400).json({ error: 'Duplicate muscleGroupId in payload' });
  }

  const now = new Date();

  const response = await prisma.$transaction(async (tx) => {
    const workoutSetsData: {
      sessionExerciseId: string;
      setIndex: number;
      loadUsed: number | null;
      repsDone: number | null;
    }[] = [];

    const exercisePerformance = new Map<
      string,
      { avgLoad: number; repsRef: number | null; rirLastSet: number | null }
    >();
    const setsByMuscleGroup = new Map<string, number>();

    for (const input of exerciseInputs) {
      const sessionExercise = session.sessionExercises.find(
        (item) => item.id === input.sessionExerciseId,
      );
      if (!sessionExercise) {
        throw new Error('Session exercise not found');
      }

      if (sessionExercise.workoutSets.length > 0) {
        throw new Error('Workout sets already exist for this session exercise');
      }

      input.sets.forEach((set, idx) => {
        workoutSetsData.push({
          sessionExerciseId: input.sessionExerciseId,
          setIndex: idx + 1,
          loadUsed: set.loadUsed ?? null,
          repsDone: set.repsDone ?? null,
        });
      });

      const groupId = sessionExercise.exercise.primaryMuscleGroupId;
      const prevSets = setsByMuscleGroup.get(groupId) ?? 0;
      setsByMuscleGroup.set(groupId, prevSets + input.sets.length);

      const repsValues = input.sets
        .map((set) => set.repsDone)
        .filter((value): value is number => typeof value === 'number');
      const repsRef = repsValues.length > 0 ? Math.min(...repsValues) : null;

      const loadValues = input.sets
        .map((set) => set.loadUsed)
        .filter((value): value is number => typeof value === 'number');
      const avgLoad =
        loadValues.length > 0
          ? loadValues.reduce((sum, value) => sum + value, 0) / loadValues.length
          : sessionExercise.loadTarget ?? 0;

      await tx.exerciseResult.upsert({
        where: { sessionExerciseId: input.sessionExerciseId },
        update: {
          rirLastSet: input.rirLastSet ?? null,
          repsRef,
          notes: input.notes ?? null,
        },
        create: {
          sessionExerciseId: input.sessionExerciseId,
          rirLastSet: input.rirLastSet ?? null,
          repsRef,
          notes: input.notes ?? null,
        },
      });

      exercisePerformance.set(input.sessionExerciseId, {
        avgLoad,
        repsRef,
        rirLastSet: input.rirLastSet ?? null,
      });
    }

    if (workoutSetsData.length > 0) {
      await tx.workoutSet.createMany({ data: workoutSetsData });
    }

    await tx.session.update({
      where: { id: session.id },
      data: { completedAt: now },
    });

    const logs: {
      userId: string;
      mesocycleId: string;
      weekId: string;
      sessionId: string | null;
      entityType: ProgressionEntityType;
      entityId: string;
      prevValue: unknown;
      newValue: unknown;
      reason: string;
      source: RecordSource;
    }[] = [];

    const sessionExercises = session.sessionExercises.map((item) => ({ ...item }));
    const originalSetsTarget = new Map(
      session.sessionExercises.map((item) => [item.id, item.setsTarget]),
    );

    const propagateTargetsToFuture = async (
      sessionExercise: (typeof sessionExercises)[number],
      nextValue: { loadTarget: number | null; repsTargetHint: number | null; setsTarget: number },
    ) => {
      const futureExercises = await tx.sessionExercise.findMany({
        where: {
          exerciseId: sessionExercise.exerciseId,
          orderIndex: sessionExercise.orderIndex,
          session: {
            mesocycleId: session.mesocycleId,
            dayOfWeek: session.dayOfWeek,
            sessionOrderInWeek: session.sessionOrderInWeek,
            completedAt: null,
            week: {
              weekIndex: { gt: session.week.weekIndex },
            },
          },
        },
        select: {
          id: true,
          loadTarget: true,
          repsTargetHint: true,
          setsTarget: true,
          sessionId: true,
          session: {
            select: {
              weekId: true,
            },
          },
        },
      });

      for (const future of futureExercises) {
        if (
          future.loadTarget === nextValue.loadTarget &&
          future.repsTargetHint === nextValue.repsTargetHint &&
          future.setsTarget === nextValue.setsTarget
        ) {
          continue;
        }

        await tx.sessionExercise.update({
          where: { id: future.id },
          data: nextValue,
        });

        logs.push({
          userId: req.user.id,
          mesocycleId: session.mesocycleId,
          weekId: future.session.weekId,
          sessionId: future.sessionId,
          entityType: ProgressionEntityType.EXERCISE,
          entityId: future.id,
          prevValue: {
            loadTarget: future.loadTarget,
            repsTargetHint: future.repsTargetHint,
            setsTarget: future.setsTarget,
          },
          newValue: nextValue,
          reason: 'targets_propagation',
          source: RecordSource.USER,
        });
      }
    };

    let previousSession: null | {
      sessionExercises: {
        exercise: { primaryMuscleGroupId: string; toolType: string };
        workoutSets: { loadUsed: number | null }[];
        exerciseResult: { repsRef: number | null } | null;
      }[];
    } = null;

    if (session.week.weekIndex > 1) {
      previousSession = await tx.session.findFirst({
        where: {
          mesocycleId: session.mesocycleId,
          week: { weekIndex: session.week.weekIndex - 1 },
          sessionOrderInWeek: session.sessionOrderInWeek,
        },
        include: {
          sessionExercises: {
            include: {
              exercise: true,
              workoutSets: true,
              exerciseResult: true,
            },
          },
        },
      });
    }

    const computeScoreForMuscleGroup = (
      sessionData:
        | null
        | {
            sessionExercises: {
              exercise: { primaryMuscleGroupId: string };
              workoutSets: { loadUsed: number | null }[];
              exerciseResult: { repsRef: number | null } | null;
            }[];
          },
      muscleGroupId: string,
    ) => {
      if (!sessionData) {
        return 0;
      }
      const relevant = sessionData.sessionExercises.filter(
        (item) => item.exercise.primaryMuscleGroupId === muscleGroupId,
      );
      if (relevant.length === 0) {
        return 0;
      }

      const scores = relevant.map((item) => {
        const loadValues = item.workoutSets
          .map((set) => set.loadUsed)
          .filter((value): value is number => typeof value === 'number');
        const avgLoad =
          loadValues.length > 0
            ? loadValues.reduce((sum, value) => sum + value, 0) / loadValues.length
            : 0;
        const repsRef = item.exerciseResult?.repsRef ?? 0;
        return avgLoad * repsRef;
      });

      return scores.reduce((sum, value) => sum + value, 0) / scores.length;
    };

    const computeScoreFromCurrent = (muscleGroupId: string) => {
      const relevant = sessionExercises.filter(
        (item) => item.exercise.primaryMuscleGroupId === muscleGroupId,
      );
      if (relevant.length === 0) {
        return 0;
      }

      const scores = relevant.map((item) => {
        const perf = exercisePerformance.get(item.id);
        const avgLoad = perf?.avgLoad ?? item.loadTarget ?? 0;
        const repsRef = perf?.repsRef ?? item.repsTargetHint ?? 0;
        return avgLoad * repsRef;
      });

      return scores.reduce((sum, value) => sum + value, 0) / scores.length;
    };

    for (const feedback of feedbackInputs) {
      const currentScore = computeScoreFromCurrent(feedback.muscleGroupId);
      const prevScore = computeScoreForMuscleGroup(previousSession, feedback.muscleGroupId);
      const perf = computePerfSessionFromNumbers(currentScore, prevScore);

      const exercisesForGroup = sessionExercises
        .filter((item) => item.exercise.primaryMuscleGroupId === feedback.muscleGroupId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const setsTargetSession = exercisesForGroup.reduce(
        (sum, item) => sum + item.setsTarget,
        0,
      );
      const actualSets = setsByMuscleGroup.get(feedback.muscleGroupId);

      const existing = await tx.sessionMuscleGroup.findUnique({
        where: {
          sessionId_muscleGroupId: {
            sessionId: session.id,
            muscleGroupId: feedback.muscleGroupId,
          },
        },
      });

      const payload = {
        sessionId: session.id,
        muscleGroupId: feedback.muscleGroupId,
        fatigue: feedback.fatigue,
        doms: feedback.doms,
        pump: feedback.pump,
        tendonPain: feedback.tendonPain,
        perf,
        deltaSets: 0,
        setsTargetSession: actualSets ?? setsTargetSession,
      };

      await tx.sessionMuscleGroup.upsert({
        where: {
          sessionId_muscleGroupId: {
            sessionId: session.id,
            muscleGroupId: feedback.muscleGroupId,
          },
        },
        update: payload,
        create: payload,
      });

      logs.push({
        userId: req.user.id,
        mesocycleId: session.mesocycleId,
        weekId: session.weekId,
        sessionId: session.id,
        entityType: ProgressionEntityType.MUSCLE_GROUP_SESSION,
        entityId: feedback.muscleGroupId,
        prevValue: existing
          ? {
              fatigue: existing.fatigue,
              doms: existing.doms,
              pump: existing.pump,
              tendonPain: existing.tendonPain,
              perf: existing.perf,
              deltaSets: existing.deltaSets,
              setsTargetSession: existing.setsTargetSession,
            }
          : null,
        newValue: payload,
        reason: 'session_feedback',
        source: RecordSource.USER,
      });
    }

    const weekComplete =
      (await tx.session.count({
        where: { weekId: session.weekId, completedAt: null },
      })) === 0;

    if (weekComplete) {
      const weeklyFeedback = await tx.sessionMuscleGroup.findMany({
        where: { session: { weekId: session.weekId } },
        select: {
          muscleGroupId: true,
          fatigue: true,
          doms: true,
          pump: true,
          tendonPain: true,
          setsTargetSession: true,
        },
      });

      const grouped = new Map<
        string,
        { sets: number; fatigue: number; doms: number; pump: number; tendonPain: number }[]
      >();

      weeklyFeedback.forEach((entry) => {
        const list = grouped.get(entry.muscleGroupId) ?? [];
        list.push({
          sets: entry.setsTargetSession,
          fatigue: entry.fatigue,
          doms: entry.doms,
          pump: entry.pump,
          tendonPain: entry.tendonPain,
        });
        grouped.set(entry.muscleGroupId, list);
      });

      for (const [muscleGroupId, entries] of grouped) {
        const aggregated = aggregateWeeklyFeedback(entries);
        const deltaMatrix = computeDeltaFromMatrix(
          aggregated.fatigueEff,
          aggregated.pumpWeek,
        );
        const painAdjusted = applyPainOverride(deltaMatrix, aggregated.painWeek);
        const deltaPre = painAdjusted.delta;

        const state = await tx.muscleGroupAutoVolumeState.findUnique({
          where: {
            mesocycleId_muscleGroupId: {
              mesocycleId: session.mesocycleId,
              muscleGroupId,
            },
          },
        });

        const smoothing = applySmoothing(deltaPre, state);

        await tx.muscleGroupAutoVolumeState.upsert({
          where: {
            mesocycleId_muscleGroupId: {
              mesocycleId: session.mesocycleId,
              muscleGroupId,
            },
          },
          create: {
            mesocycleId: session.mesocycleId,
            muscleGroupId,
            lastDeltaSign: smoothing.state.lastDeltaSign,
            consecutiveCount: smoothing.state.consecutiveCount,
            updatedAt: now,
          },
          update: {
            lastDeltaSign: smoothing.state.lastDeltaSign,
            consecutiveCount: smoothing.state.consecutiveCount,
            updatedAt: now,
          },
        });

        const deltaFinal = smoothing.deltaFinal;

        await tx.sessionMuscleGroup.updateMany({
          where: {
            muscleGroupId,
            session: { weekId: session.weekId },
          },
          data: {
            deltaSets: deltaFinal,
          },
        });

        if (deltaFinal !== 0) {
          const candidates = await tx.sessionExercise.findMany({
            where: {
              session: { weekId: session.weekId },
              exercise: { primaryMuscleGroupId: muscleGroupId },
              autoVolumeEnabled: true,
            },
            select: {
              id: true,
              exerciseId: true,
              orderIndex: true,
              setsTarget: true,
              minSets: true,
              maxSets: true,
              exerciseRole: true,
              jointStress: true,
              lastAutoVolumeAdjustedAt: true,
              session: {
                select: {
                  dayOfWeek: true,
                  sessionOrderInWeek: true,
                },
              },
            },
          });

          const filtered = filterCandidatesForDelta(candidates, deltaFinal);

          const chosen = selectAutoVolumeCandidate(
            filtered,
            deltaFinal,
            aggregated.painWeek,
          );

          if (chosen) {
            const nextSetsTarget = chosen.setsTarget + deltaFinal;

            await tx.sessionExercise.update({
              where: { id: chosen.id },
              data: {
                setsTarget: nextSetsTarget,
                lastAutoVolumeAdjustedAt: now,
                lastAutoVolumeAdjustedDirection: Math.sign(deltaFinal),
              },
            });

            await tx.sessionExercise.updateMany({
              where: {
                exerciseId: chosen.exerciseId,
                orderIndex: chosen.orderIndex,
                session: {
                  mesocycleId: session.mesocycleId,
                  dayOfWeek: chosen.session.dayOfWeek,
                  sessionOrderInWeek: chosen.session.sessionOrderInWeek,
                  completedAt: null,
                  week: { weekIndex: { gt: session.week.weekIndex } },
                },
              },
              data: {
                setsTarget: nextSetsTarget,
                lastAutoVolumeAdjustedAt: now,
                lastAutoVolumeAdjustedDirection: Math.sign(deltaFinal),
              },
            });

            const localExercise = sessionExercises.find((item) => item.id === chosen.id);
            if (localExercise) {
              localExercise.setsTarget = nextSetsTarget;
            }

            logs.push({
              userId: req.user.id,
              mesocycleId: session.mesocycleId,
              weekId: session.weekId,
              sessionId: session.id,
              entityType: ProgressionEntityType.EXERCISE,
              entityId: chosen.id,
              prevValue: { setsTarget: chosen.setsTarget },
              newValue: { setsTarget: nextSetsTarget },
              reason: 'auto_volume_delta',
              source: RecordSource.USER,
            });
          }
        }
      }

      await computeWeekExerciseBests(tx, req.user.id, session.weekId);
    }

    const targetUpdates: {
      sessionExerciseId: string;
      loadTarget: number;
      repsTargetHint: number;
      suggestionText: string | null;
    }[] = [];

    for (const sessionExercise of sessionExercises) {
      const perf = exercisePerformance.get(sessionExercise.id);
      const repsRefPrev = perf?.repsRef ?? sessionExercise.repsTargetHint ?? null;
      const prevSetsTarget = originalSetsTarget.get(sessionExercise.id) ?? sessionExercise.setsTarget;
      const setsChanged = sessionExercise.setsTarget !== prevSetsTarget;

      if (!repsRefPrev || repsRefPrev <= 0) {
        if (setsChanged) {
          await tx.sessionExercise.update({
            where: { id: sessionExercise.id },
            data: { setsTarget: sessionExercise.setsTarget },
          });

          await propagateTargetsToFuture(sessionExercise, {
            loadTarget: sessionExercise.loadTarget,
            repsTargetHint: sessionExercise.repsTargetHint,
            setsTarget: sessionExercise.setsTarget,
          });
        }
        continue;
      }

      const loadPrev = sessionExercise.loadTarget ?? perf?.avgLoad ?? 0;

      const targetResult = computeExerciseTargets({
        toolType: sessionExercise.exercise.toolType,
        loadPrev,
        repsRefPrev,
        setsPrev: sessionExercise.setsTarget,
        loadChosen: sessionExercise.loadTarget ?? undefined,
      });

      const targetsChanged =
        targetResult.loadTarget !== sessionExercise.loadTarget ||
        targetResult.repsTargetHint !== sessionExercise.repsTargetHint;

      if (targetsChanged || setsChanged) {
        const prevValue = {
          loadTarget: sessionExercise.loadTarget,
          repsTargetHint: sessionExercise.repsTargetHint,
          setsTarget: prevSetsTarget,
        };
        sessionExercise.loadTarget = targetResult.loadTarget;
        sessionExercise.repsTargetHint = targetResult.repsTargetHint;

        await tx.sessionExercise.update({
          where: { id: sessionExercise.id },
          data: {
            loadTarget: sessionExercise.loadTarget,
            repsTargetHint: sessionExercise.repsTargetHint,
            setsTarget: sessionExercise.setsTarget,
          },
        });

        if (targetsChanged) {
          logs.push({
            userId: req.user.id,
            mesocycleId: session.mesocycleId,
            weekId: session.weekId,
            sessionId: session.id,
            entityType: ProgressionEntityType.EXERCISE,
            entityId: sessionExercise.id,
            prevValue,
            newValue: {
              loadTarget: sessionExercise.loadTarget,
              repsTargetHint: sessionExercise.repsTargetHint,
              setsTarget: sessionExercise.setsTarget,
            },
            reason: 'targets_update',
            source: RecordSource.USER,
          });
        }

        await propagateTargetsToFuture(sessionExercise, {
          loadTarget: sessionExercise.loadTarget,
          repsTargetHint: sessionExercise.repsTargetHint,
          setsTarget: sessionExercise.setsTarget,
        });
      }

      targetUpdates.push({
        sessionExerciseId: sessionExercise.id,
        ...targetResult,
      });
    }

    if (logs.length > 0) {
      await tx.progressionLog.createMany({ data: logs });
    }

    return {
      completedAt: now,
      targetUpdates,
    };
  });

  return res.json(response);
});

router.get('/:id', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = await prisma.session.findFirst({
    where: {
      id: req.params.id,
      mesocycle: { userId: req.user.id },
    },
    include: {
      week: true,
      sessionExercises: {
        orderBy: { orderIndex: 'asc' },
        include: {
          exercise: true,
          exerciseResult: true,
          workoutSets: true,
        },
      },
      sessionMuscleGroups: {
        include: {
          muscleGroup: true,
        },
      },
    },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  let previousSession: null | {
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
  } = null;

  if (session.week.weekIndex > 1) {
    previousSession = await prisma.session.findFirst({
      where: {
        mesocycleId: session.mesocycleId,
        week: { weekIndex: session.week.weekIndex - 1 },
        sessionOrderInWeek: session.sessionOrderInWeek,
      },
      select: {
        id: true,
        weekId: true,
        sessionOrderInWeek: true,
        sessionExercises: {
          orderBy: { orderIndex: 'asc' },
          select: {
            exerciseId: true,
            orderIndex: true,
            loadTarget: true,
            repsTargetHint: true,
            workoutSets: {
              orderBy: { setIndex: 'asc' },
              select: {
                setIndex: true,
                loadUsed: true,
                repsDone: true,
              },
            },
          },
        },
      },
    });
  }

  let templateSession: null | {
    id: string;
    weekId: string;
    sessionOrderInWeek: number;
    sessionExercises: { exerciseId: string; orderIndex: number; setsTarget: number }[];
  } = null;

  if (session.week.isDeload) {
    templateSession = await prisma.session.findFirst({
      where: {
        mesocycleId: session.mesocycleId,
        week: { weekIndex: 1 },
        dayOfWeek: session.dayOfWeek,
        sessionOrderInWeek: session.sessionOrderInWeek,
      },
      select: {
        id: true,
        weekId: true,
        sessionOrderInWeek: true,
        sessionExercises: {
          orderBy: { orderIndex: 'asc' },
          select: {
            exerciseId: true,
            orderIndex: true,
            setsTarget: true,
          },
        },
      },
    });
  }

  return res.json({ session, previousSession, templateSession });
});

export default router;
