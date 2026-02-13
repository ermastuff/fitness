import { Router } from 'express';
import { z } from 'zod';
import { MesocycleStructure, RecordSource } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { computeWeekExerciseBests } from '../services/exerciseBests.js';

const router = Router();

const createMesocycleSchema = z.object({
  startDate: z.coerce.date(),
  structure: z.nativeEnum(MesocycleStructure),
  name: z.string().trim().min(1).max(80).optional(),
});

const sessionTemplateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  sessionName: z.string().trim().min(1),
  sessionOrderInWeek: z.number().int().min(1),
  scheduledDate: z.coerce.date(),
});

const sessionTemplatesSchema = z.array(sessionTemplateSchema).min(1);

const afterDeloadSchema = z.object({
  choice: z.enum(['CONTINUE', 'NEW']),
  startDate: z.coerce.date(),
  structure: z.nativeEnum(MesocycleStructure).optional(),
});

const rampMap: Record<MesocycleStructure, number[]> = {
  THREE_ONE: [3, 2, 1, 5],
  FOUR_ONE: [3, 2, 2, 1, 5],
  FIVE_ONE: [3, 3, 2, 2, 1, 5],
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

router.post('/', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = createMesocycleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const { startDate, structure, name } = result.data;
  const ramp = rampMap[structure];

  const weeksData = ramp.map((rirTarget, index) => {
    const weekIndex = index + 1;
    const isDeload = index === ramp.length - 1;
    return {
      weekIndex,
      isDeload,
      weekType: isDeload ? 'DELOAD' : 'HARD',
      rirTarget,
      startDate: addDays(startDate, (weekIndex - 1) * 7),
    };
  });

  const mesocycle = await prisma.mesocycle.create({
    data: {
      userId: req.user.id,
      name: name ?? 'Mesociclo',
      startDate,
      structure,
      weeksTotal: ramp.length,
      active: true,
      source: RecordSource.USER,
      weeks: {
        create: weeksData,
      },
    },
    include: {
      weeks: {
        orderBy: { weekIndex: 'asc' },
      },
    },
  });

  return res.status(201).json({ mesocycle });
});

router.get('/active', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const mesocycles = await prisma.mesocycle.findMany({
    where: { userId: req.user.id, active: true },
    orderBy: { createdAt: 'desc' },
    include: {
      weeks: {
        orderBy: { weekIndex: 'asc' },
      },
    },
  });

  return res.json({ mesocycles });
});

router.get('/history', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const mesocycles = await prisma.mesocycle.findMany({
    where: { userId: req.user.id, active: false },
    orderBy: { createdAt: 'desc' },
    include: {
      weeks: {
        orderBy: { weekIndex: 'asc' },
      },
    },
  });

  return res.json({ mesocycles });
});

router.post('/:id/sessions', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const templatesResult = sessionTemplatesSchema.safeParse(req.body);
  if (!templatesResult.success) {
    return res.status(400).json({ error: 'Invalid input', details: templatesResult.error.flatten() });
  }

  const mesocycle = await prisma.mesocycle.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      weeks: {
        orderBy: { weekIndex: 'asc' },
      },
      sessions: {
        where: { week: { weekIndex: 1 } },
        select: { id: true },
      },
    },
  });

  if (!mesocycle) {
    return res.status(404).json({ error: 'Mesocycle not found' });
  }

  if (mesocycle.sessions.length > 0) {
    return res.status(409).json({ error: 'Sessions already exist for week 1' });
  }

  const templates = templatesResult.data;
  const sessionsData = mesocycle.weeks.flatMap((week) =>
    templates.map((template) => ({
      mesocycleId: mesocycle.id,
      weekId: week.id,
      dayOfWeek: template.dayOfWeek,
      sessionName: template.sessionName,
      sessionOrderInWeek: template.sessionOrderInWeek,
      scheduledDate: addDays(template.scheduledDate, (week.weekIndex - 1) * 7),
      source: RecordSource.USER,
    })),
  );

  await prisma.session.createMany({ data: sessionsData });

  const weekOneSessions = await prisma.session.findMany({
    where: { weekId: mesocycle.weeks[0]?.id },
    orderBy: [{ dayOfWeek: 'asc' }, { sessionOrderInWeek: 'asc' }],
  });

  return res.status(201).json({
    created: sessionsData.length,
    templateWeek: mesocycle.weeks[0],
    sessions: weekOneSessions,
  });
});

router.post('/:id/after-deload', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = afterDeloadSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: 'Invalid input', details: payload.error.flatten() });
  }

  const current = await prisma.mesocycle.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      weeks: {
        orderBy: { weekIndex: 'asc' },
      },
      sessions: {
        where: { week: { weekIndex: 1 } },
        include: {
          sessionExercises: true,
        },
      },
    },
  });

  if (!current) {
    return res.status(404).json({ error: 'Mesocycle not found' });
  }

  const deloadWeek = [...current.weeks]
    .filter((week) => week.weekType === 'DELOAD' || week.isDeload)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];

  if (!deloadWeek) {
    return res.status(409).json({ error: 'Deload week not found for mesocycle' });
  }

  const pendingDeload = await prisma.session.count({
    where: { weekId: deloadWeek.id, completedAt: null },
  });
  if (pendingDeload > 0) {
    return res.status(409).json({ error: 'Deload week has incomplete sessions' });
  }

  const lastHardWeek = [...current.weeks]
    .filter((week) => week.weekIndex < deloadWeek.weekIndex && week.weekType === 'HARD')
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];

  if (!lastHardWeek) {
    return res.status(409).json({ error: 'No hard week found before deload' });
  }

  const { choice, startDate } = payload.data;
  const structure = payload.data.structure ?? current.structure;
  const ramp = rampMap[structure];

  const weeksData = ramp.map((rirTarget, index) => {
    const weekIndex = index + 1;
    const isDeload = index === ramp.length - 1;
    return {
      weekIndex,
      isDeload,
      weekType: isDeload ? 'DELOAD' : 'HARD',
      rirTarget,
      startDate: addDays(startDate, (weekIndex - 1) * 7),
    };
  });

  const result = await prisma.$transaction(async (tx) => {
    await computeWeekExerciseBests(tx, req.user.id, lastHardWeek.id);

    await tx.mesocycle.updateMany({
      where: { id: current.id },
      data: { active: false },
    });

    if (choice === 'NEW') {
      return { closed: true };
    }

    const newMesocycle = await tx.mesocycle.create({
      data: {
        userId: req.user.id,
        name: current.name,
        startDate,
        structure,
        weeksTotal: ramp.length,
        active: true,
        source: RecordSource.USER,
        weeks: {
          create: weeksData,
        },
      },
      include: {
        weeks: {
          orderBy: { weekIndex: 'asc' },
        },
      },
    });

    const templateSessions = current.sessions;
    if (templateSessions.length === 0) {
      return { mesocycle: newMesocycle, copied: false };
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const sessionsData = newMesocycle.weeks.flatMap((week) =>
      templateSessions.map((template) => {
        const offsetDays = Math.round(
          (new Date(template.scheduledDate).getTime() - current.startDate.getTime()) /
            dayMs,
        );
        return {
          mesocycleId: newMesocycle.id,
          weekId: week.id,
          dayOfWeek: template.dayOfWeek,
          sessionName: template.sessionName,
          sessionOrderInWeek: template.sessionOrderInWeek,
          scheduledDate: addDays(startDate, offsetDays + (week.weekIndex - 1) * 7),
          source: RecordSource.USER,
        };
      }),
    );

    await tx.session.createMany({ data: sessionsData });

    const weekSessions = await tx.session.findMany({
      where: { mesocycleId: newMesocycle.id },
      include: { week: true },
      orderBy: [{ dayOfWeek: 'asc' }, { sessionOrderInWeek: 'asc' }],
    });

    const sessionsByKey = new Map<string, { id: string; weekIndex: number }[]>();
    weekSessions.forEach((session) => {
      const key = `${session.dayOfWeek}:${session.sessionOrderInWeek}`;
      const list = sessionsByKey.get(key) ?? [];
      list.push({ id: session.id, weekIndex: session.week.weekIndex });
      sessionsByKey.set(key, list);
    });

    for (const template of templateSessions) {
      const key = `${template.dayOfWeek}:${template.sessionOrderInWeek}`;
      const targets = sessionsByKey.get(key) ?? [];
      if (targets.length === 0) {
        continue;
      }

      for (const sessionExercise of template.sessionExercises) {
        const createRows = targets.map((target) => ({
          sessionId: target.id,
          exerciseId: sessionExercise.exerciseId,
          orderIndex: sessionExercise.orderIndex,
          setsTarget: sessionExercise.setsTarget,
          autoVolumeEnabled: sessionExercise.autoVolumeEnabled,
          exerciseRole: sessionExercise.exerciseRole,
          minSets: sessionExercise.minSets,
          maxSets: sessionExercise.maxSets,
          jointStress: sessionExercise.jointStress,
          mode: sessionExercise.mode,
          loadTarget: sessionExercise.loadTarget,
          repsTargetHint: sessionExercise.repsTargetHint,
        }));

        if (createRows.length > 0) {
          await tx.sessionExercise.createMany({ data: createRows });
        }
      }
    }

    return { mesocycle: newMesocycle, copied: true };
  });

  return res.status(201).json(result);
});

export default router;
