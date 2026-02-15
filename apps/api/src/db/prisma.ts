import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

let prismaClient: PrismaClient | null = null;

const getPrismaClient = () => {
  if (prismaClient) {
    return prismaClient;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  const adapter = new PrismaPg({ connectionString });
  prismaClient = new PrismaClient({ adapter });
  return prismaClient;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient() as any;
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
