import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { computeWeekExerciseBests } from '../services/exerciseBests';

const router = Router();

const weekIdSchema = z.string().uuid();

router.get('/:id/sessions', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idResult = weekIdSchema.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid week id' });
  }

  const week = await prisma.week.findFirst({
    where: {
      id: idResult.data,
      mesocycle: { userId: req.user.id },
    },
    include: {
      sessions: {
        orderBy: [{ dayOfWeek: 'asc' }, { sessionOrderInWeek: 'asc' }],
      },
    },
  });

  if (!week) {
    return res.status(404).json({ error: 'Week not found' });
  }

  return res.json({ weekId: week.id, sessions: week.sessions });
});

router.post('/:id/close', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idResult = weekIdSchema.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid week id' });
  }

  const week = await prisma.week.findFirst({
    where: {
      id: idResult.data,
      mesocycle: { userId: req.user.id },
    },
    select: {
      id: true,
      weekType: true,
      isDeload: true,
      mesocycleId: true,
    },
  });

  if (!week) {
    return res.status(404).json({ error: 'Week not found' });
  }

  const pending = await prisma.session.count({
    where: { weekId: week.id, completedAt: null },
  });
  if (pending > 0) {
    return res.status(409).json({ error: 'Week has incomplete sessions' });
  }

  const result = await prisma.$transaction(async (tx) =>
    computeWeekExerciseBests(tx, req.user.id, week.id),
  );

  return res.json({ weekId: week.id, ...result });
});

export default router;
