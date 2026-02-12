import type { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set.');
  }
  return secret;
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded || typeof decoded === 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = decoded as JwtPayload;
    const userId = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = { id: String(userId), email };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
