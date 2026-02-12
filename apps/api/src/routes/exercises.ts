import { Router } from 'express';
import { prisma } from '../db/prisma';
import { z } from 'zod';

const router = Router();

router.get('/', async (_req, res) => {
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
    include: {
      primaryMuscleGroup: true,
    },
  });

  return res.json({ exercises });
});

router.get('/last-hard-bests', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const bests = await prisma.exerciseLastHardBest.findMany({
    where: { userId: req.user.id },
    include: {
      exercise: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({ bests });
});

router.get('/:id/last-hard-best', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid exercise id' });
  }

  const best = await prisma.exerciseLastHardBest.findUnique({
    where: {
      userId_exerciseId: {
        userId: req.user.id,
        exerciseId: idResult.data,
      },
    },
    include: {
      exercise: true,
    },
  });

  if (!best) {
    return res.json({ best: null });
  }

  return res.json({ best });
});

export default router;
