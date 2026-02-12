import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { HealthCheckSchema } from '@fitness-forge/shared';
import authRouter from './routes/auth';
import { authMiddleware } from './middleware/auth';
import { prisma } from './db/prisma';
import mesocyclesRouter from './routes/mesocycles';
import sessionsRouter from './routes/sessions';
import weeksRouter from './routes/weeks';
import exercisesRouter from './routes/exercises';

dotenv.config();

const app = express();

const originEnv = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS ?? '';
const allowAll = originEnv.trim() === '*';
const allowedOrigins = originEnv
  ? originEnv.split(',').map((value) => value.trim()).filter(Boolean)
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: allowAll ? true : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  const payload = HealthCheckSchema.parse({ status: 'ok' });
  res.json(payload);
});

app.use('/auth', authRouter);
app.use('/mesocycles', authMiddleware, mesocyclesRouter);
app.use('/sessions', authMiddleware, sessionsRouter);
app.use('/weeks', authMiddleware, weeksRouter);
app.use('/exercises', authMiddleware, exercisesRouter);

app.get('/me', authMiddleware, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      unitKg: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user });
});

export default app;
