import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();

app.use(express.json());

// Lazy singleton — constructed on first use so tests can set DATABASE_URL in beforeAll
let _prisma: PrismaClient | undefined;
const getPrisma = (): PrismaClient => {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
};

// Proxy lets callers (tests) use it as a normal PrismaClient while keeping construction lazy
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const instance = getPrisma();
    const val = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? (val as Function).bind(instance) : val;
  },
});

app.get('/health', async (_req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export { app };
