import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();

// Instantiate lazily so tests can set DATABASE_URL in beforeAll before the first query
let _prismaClient: PrismaClient | undefined;
function getClient(): PrismaClient {
  if (!_prismaClient) {
    _prismaClient = new PrismaClient();
  }
  return _prismaClient;
}

// Proxy forwards all property accesses to the lazily-created client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: PrismaClient = new Proxy({} as any, {
    get(_target, prop: string | symbol) {
      const client = getClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (client as any)[prop];
      return typeof val === 'function'
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (val as any).bind(client)
        : val;
    },
  }
);

app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await getClient().$queryRaw`SELECT 1`;
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
