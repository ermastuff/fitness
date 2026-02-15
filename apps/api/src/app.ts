import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import { prisma } from './db/prisma.js';
import mesocyclesRouter from './routes/mesocycles.js';
import sessionsRouter from './routes/sessions.js';
import weeksRouter from './routes/weeks.js';
import exercisesRouter from './routes/exercises.js';

dotenv.config();

const app = express();

const originEnv = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS ?? '';
const allowAll = originEnv.trim() === '*';
const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();
const allowedOrigins = originEnv
  ? originEnv.split(',').map((value) => normalizeOrigin(value)).filter(Boolean)
  : ['http://localhost:3000'];
const allowedOriginSet = new Set(allowedOrigins);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (allowAll || !requestOrigin) {
        callback(null, true);
        return;
      }

      const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
      callback(null, allowedOriginSet.has(normalizedRequestOrigin));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'fitness-api', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error:', err);
  const message = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message });
});

export default app;
