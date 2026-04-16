/**
 * Shared test-database helpers for Sprint 3 tests.
 *
 * • Starts a throwaway PostgreSQL container via Testcontainers
 * • Sets process.env.DATABASE_URL so Prisma picks it up
 * • Runs `prisma migrate deploy` against that container
 * • Returns a PrismaClient wired to the container
 * • Exposes cleanDatabase() to truncate tables between tests
 */

import path from 'path';
import { execSync } from 'child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../..');

export interface TestContext {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
}

/** Start the PostgreSQL container, run migrations, return context. */
export async function startTestDatabase(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:15-alpine').start();
  const dbUrl = container.getConnectionUri();

  process.env.DATABASE_URL = dbUrl;

  execSync('npx prisma migrate deploy', {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasourceUrl: dbUrl });

  return { container, prisma };
}

/** Disconnect and stop the container. */
export async function stopTestDatabase(ctx: TestContext): Promise<void> {
  await ctx.prisma.$disconnect();
  await ctx.container.stop();
}

/**
 * Truncate every table in dependency order so tests start with a clean DB.
 * Uses deleteMany() rather than TRUNCATE so Prisma handles FK cascade order.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.answer.deleteMany();
  await prisma.response.deleteMany();
  await prisma.logicRule.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.surveyTemplate.deleteMany();
}

/** Insert a minimal User row and return it. */
export async function createTestUser(
  prisma: PrismaClient,
  override: { email?: string; name?: string } = {}
) {
  return prisma.user.create({
    data: {
      email: override.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: override.name ?? null,
    },
  });
}
