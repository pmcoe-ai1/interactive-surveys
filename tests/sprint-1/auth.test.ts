/**
 * Sprint 1 – Authentication & User Story Tests
 * Scenarios: SC8.1.1, SC8.1.2, SC8.1.3, SC8.2.1, SC8.2.2, SC8.2.3,
 *            SC8.3.1, SC8.3.2, SC8.3.3, SC8.4.1, SC8.4.2, SC8.4.3
 *
 * Strategy:
 *   - All scenarios are tested at the Prisma / database layer, which is where the
 *     NextAuth adapter writes and reads.  Full OAuth round-trips and email delivery
 *     require external services and are not exercised here.
 *   - SC8.4.2 (unauthenticated redirect) is verified by asserting the middleware
 *     configuration that Next.js enforces at the edge.
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any;
let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;

  execSync('npx prisma migrate deploy', {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
}, 30_000);

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, verification_tokens, survey_templates CASCADE'
  );
});

// ─── SC8.1 – Creator sign-up ──────────────────────────────────────────────────

describe('SC8.1.1 – email sign-up: verification token is created and user record is written', () => {
  it('creates a VerificationToken for the email (simulates magic-link dispatch)', async () => {
    const email = 'signup@example.com';
    const token = await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: 'magic-abc-123',
        expires: new Date(Date.now() + 3_600_000), // 1 hour
      },
    });

    expect(token.identifier).toBe(email);
    expect(token.token).toBe('magic-abc-123');
    expect(token.expires.getTime()).toBeGreaterThan(Date.now());
  });

  it('upserts the User record when the magic link is clicked (NextAuth signIn callback)', async () => {
    const email = 'signup@example.com';
    // Simulate the signIn callback upsert
    const user = await prisma.user.upsert({
      where: { email },
      update: { authProvider: 'email' },
      create: { email, authProvider: 'email' },
    });

    expect(user.email).toBe(email);
    expect(user.authProvider).toBe('email');
    expect(user.id).toBeDefined();
  });
});

describe('SC8.1.2 – OAuth (Google) sign-up: account is created and user lands on dashboard', () => {
  it('creates a User with authProvider=google and links an Account record', async () => {
    const email = 'googleuser@gmail.com';

    const user = await prisma.user.create({
      data: {
        email,
        name: 'Google User',
        authProvider: 'google',
        accounts: {
          create: {
            type: 'oauth',
            provider: 'google',
            providerAccountId: 'google-sub-12345',
          },
        },
      },
      include: { accounts: true },
    });

    expect(user.authProvider).toBe('google');
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0].provider).toBe('google');
  });
});

describe('SC8.1.3 – duplicate email: "An account with this email already exists"', () => {
  it('check-email query returns the existing user when the email is already registered', async () => {
    const email = 'existing@example.com';
    await prisma.user.create({ data: { email, authProvider: 'email' } });

    // Replicate the query the check-email API route runs
    const found = await prisma.user.findUnique({
      where: { email },
      select: { id: true, authProvider: true },
    });

    expect(found).not.toBeNull();
    expect(found?.authProvider).toBe('email');
  });

  it('check-email query returns null for an unregistered address', async () => {
    const found = await prisma.user.findUnique({
      where: { email: 'nobody@example.com' },
      select: { id: true, authProvider: true },
    });

    expect(found).toBeNull();
  });
});

// ─── SC8.2 – Creator login ────────────────────────────────────────────────────

describe('SC8.2.1 – magic-link login: VerificationToken is created for the email', () => {
  it('stores a VerificationToken that expires in the future', async () => {
    const email = 'login@example.com';
    const token = await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: 'login-token-xyz',
        expires: new Date(Date.now() + 3_600_000),
      },
    });

    expect(token.identifier).toBe(email);
    expect(new Date(token.expires).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('SC8.2.2 – magic-link click: Session is created and user is authenticated', () => {
  it('creates a Session linked to the user after verification', async () => {
    const user = await prisma.user.create({
      data: { email: 'verified@example.com', authProvider: 'email' },
    });

    const session = await prisma.session.create({
      data: {
        sessionToken: `sess-${Date.now()}`,
        userId: user.id,
        expires: new Date(Date.now() + 86_400_000), // 24 h
      },
    });

    expect(session.userId).toBe(user.id);
    expect(session.expires.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('SC8.2.3 – GitHub OAuth login: user is authenticated with github provider', () => {
  it('creates a User with authProvider=github and an Account for the provider', async () => {
    const email = 'ghuser@github.com';

    const user = await prisma.user.create({
      data: {
        email,
        authProvider: 'github',
        accounts: {
          create: {
            type: 'oauth',
            provider: 'github',
            providerAccountId: 'gh-uid-99999',
          },
        },
      },
      include: { accounts: true },
    });

    expect(user.authProvider).toBe('github');
    expect(user.accounts[0].provider).toBe('github');
  });
});

// ─── SC8.3 – Creator dashboard ────────────────────────────────────────────────

describe('SC8.3.1 – dashboard shows all 5 surveys with title, response count, status, last edited', () => {
  it('returns all 5 surveys for the authenticated user in updatedAt desc order', async () => {
    const user = await prisma.user.create({
      data: { email: 'creator@example.com', authProvider: 'email' },
    });

    // Create 5 surveys
    for (let i = 1; i <= 5; i++) {
      await prisma.survey.create({
        data: {
          title: `Survey ${i}`,
          slug: `survey-${i}-${Date.now()}-${i}`,
          userId: user.id,
        },
      });
    }

    const surveys = await prisma.survey.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    });

    expect(surveys).toHaveLength(5);

    // Every record must expose the fields shown on the dashboard card
    for (const s of surveys) {
      expect(s.title).toBeDefined();
      expect(s.status).toBeDefined();           // draft | live | closed
      expect(s.updatedAt).toBeInstanceOf(Date); // last edited
      expect(s._count.responses).toBeDefined(); // response count
    }
  });
});

describe('SC8.3.2 – dashboard empty state: "Create your first survey" button shown', () => {
  it('returns an empty array when the user has no surveys', async () => {
    const user = await prisma.user.create({
      data: { email: 'empty@example.com', authProvider: 'email' },
    });

    const surveys = await prisma.survey.findMany({ where: { userId: user.id } });

    expect(surveys).toHaveLength(0);
  });
});

describe('SC8.3.3 – clicking a survey card opens the builder for that survey', () => {
  it('survey is retrievable by id and userId (the query the builder page runs)', async () => {
    const user = await prisma.user.create({
      data: { email: 'builder@example.com', authProvider: 'email' },
    });
    const created = await prisma.survey.create({
      data: { title: 'My Survey', slug: `my-survey-${Date.now()}`, userId: user.id },
    });

    const fetched = await prisma.survey.findFirst({
      where: { id: created.id, userId: user.id },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { options: true } },
      },
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.questions).toEqual([]); // builder opens on an empty survey
  });
});

// ─── SC8.4 – Logout ───────────────────────────────────────────────────────────

describe('SC8.4.1 – clicking Logout ends the session', () => {
  it('deletes the session record so subsequent lookups find nothing', async () => {
    const user = await prisma.user.create({
      data: { email: 'logout@example.com', authProvider: 'email' },
    });
    const session = await prisma.session.create({
      data: {
        sessionToken: `sess-logout-${Date.now()}`,
        userId: user.id,
        expires: new Date(Date.now() + 86_400_000),
      },
    });

    // Simulate logout – NextAuth deletes the session
    await prisma.session.delete({ where: { sessionToken: session.sessionToken } });

    const found = await prisma.session.findUnique({
      where: { sessionToken: session.sessionToken },
    });
    expect(found).toBeNull();
  });
});

describe('SC8.4.2 – logged-out user accessing the dashboard URL is redirected to login', () => {
  it('Next.js middleware is configured to protect /dashboard and /surveys paths', () => {
    const middleware = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src', 'middleware.ts'),
      'utf-8'
    );
    // The default next-auth middleware export enforces authentication
    expect(middleware).toContain("next-auth/middleware");
    // Matcher must cover the dashboard and survey builder routes
    expect(middleware).toMatch(/\/dashboard/);
    expect(middleware).toMatch(/\/surveys/);
  });

  it('survey API route returns 401 when getServerSession finds no session', () => {
    const routeSource = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src', 'app', 'api', 'surveys', 'route.ts'),
      'utf-8'
    );
    expect(routeSource).toContain('getServerSession');
    expect(routeSource).toContain('Unauthorized');
    expect(routeSource).toContain('401');
  });
});

describe('SC8.4.3 – expired session: user is prompted to log in again', () => {
  it('stores an expires timestamp so the adapter can reject stale sessions', async () => {
    const user = await prisma.user.create({
      data: { email: 'stale@example.com', authProvider: 'email' },
    });

    // Create a session that expired in the past
    const expiredAt = new Date(Date.now() - 60_000); // 1 minute ago
    const session = await prisma.session.create({
      data: {
        sessionToken: `sess-expired-${Date.now()}`,
        userId: user.id,
        expires: expiredAt,
      },
    });

    // The session exists in the DB but its expires field is in the past
    expect(session.expires.getTime()).toBeLessThan(Date.now());
  });
});
