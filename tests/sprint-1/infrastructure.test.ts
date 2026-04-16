/**
 * Sprint 1 – Infrastructure Tests
 * Scenarios: SC0.1.1, SC0.1.2, SC0.1.3, SC0.4.1, SC0.4.2
 *
 * Note: SC0.2.x (Railway provisioning) and SC0.3.x (Railway auto-deploy) are
 * cloud-infrastructure stories that cannot be exercised in automated unit tests.
 * SC0.2.3 (DATABASE_URL available) is covered here via the health-endpoint smoke test.
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import supertest from 'supertest';

// Import the Express app (no @/* aliases inside src/app.ts – safe to import here)
import { app, prisma as appPrisma } from '../../src/app';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any;
let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  const url = container.getConnectionUri();

  // Expose to child processes (prisma migrate deploy) and to the app's lazy PrismaClient
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
  // Disconnect the Express app's own prisma instance so handles are released
  await appPrisma.$disconnect();
  await container.stop();
}, 30_000);

afterEach(async () => {
  // CASCADE from users covers: accounts, sessions, surveys → questions, responses, etc.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, verification_tokens, survey_templates CASCADE'
  );
});

// ─── SC0.1.1 ──────────────────────────────────────────────────────────────────

describe('SC0.1.1 – Next.js 14 app with TypeScript, Prisma, and Tailwind CSS is created', () => {
  it('package.json lists next and tailwindcss as dependencies', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')
    );
    expect(pkg.dependencies).toHaveProperty('next');
    expect(pkg.dependencies).toHaveProperty('tailwindcss');
  });

  it('package.json lists prisma and typescript as devDependencies', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')
    );
    expect(pkg.devDependencies).toHaveProperty('prisma');
    expect(pkg.devDependencies).toHaveProperty('typescript');
  });

  it('prisma/schema.prisma exists with a postgresql datasource', () => {
    const schemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('provider = "postgresql"');
  });

  it('prisma/schema.prisma defines the core models (User, Survey, Question)', () => {
    const schema = fs.readFileSync(
      path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'),
      'utf-8'
    );
    expect(schema).toContain('model User');
    expect(schema).toContain('model Survey');
    expect(schema).toContain('model Question');
  });
});

// ─── SC0.1.2 ──────────────────────────────────────────────────────────────────

describe('SC0.1.2 – npm run dev starts on localhost:3000 with a hello world page', () => {
  it('package.json has a "dev" script that references next', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')
    );
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.dev).toContain('next');
  });

  it('next is listed as a dependency (not just devDependency)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8')
    );
    // next must be a production dep so Railway can run it
    expect(pkg.dependencies).toHaveProperty('next');
  });
});

// ─── SC0.1.3 ──────────────────────────────────────────────────────────────────

describe('SC0.1.3 – npx tsc --noEmit produces zero TypeScript errors', () => {
  it('tsconfig.json enables strict mode', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'tsconfig.json'), 'utf-8')
    );
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('tsconfig.json has @/* path alias pointing to ./src/*', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'tsconfig.json'), 'utf-8')
    );
    const paths = tsconfig.compilerOptions?.paths ?? {};
    expect(paths['@/*']).toBeDefined();
    expect(paths['@/*'][0]).toContain('src');
  });

  it('tsconfig.json specifies a modern compilation target', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'tsconfig.json'), 'utf-8')
    );
    // Target must be ES2017 or later for async/await without polyfills
    const target: string = tsconfig.compilerOptions.target ?? '';
    expect(target.toUpperCase()).toMatch(/^ES(2017|2018|2019|2020|2021|2022|2023|NEXT)/);
  });
});

// ─── SC0.4.1 ──────────────────────────────────────────────────────────────────

describe('SC0.4.1 – prisma migrate deploy executes before the app starts', () => {
  it('all required schema tables exist after migration', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    const names = rows.map((r) => r.tablename);

    const expected = [
      'accounts',
      'answers',
      'logic_rules',
      'question_options',
      'questions',
      'responses',
      'sessions',
      'surveys',
      'users',
      'verification_tokens',
    ];
    for (const table of expected) {
      expect(names).toContain(table);
    }
  });

  it('Express /health endpoint confirms the database is connected (SC0.2.3 smoke test)', async () => {
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });
});

// ─── SC0.4.2 ──────────────────────────────────────────────────────────────────

describe('SC0.4.2 – no new migrations: migration step completes instantly with no changes', () => {
  it('running prisma migrate deploy a second time exits without error', () => {
    // If there are no pending migrations the command still exits 0
    expect(() => {
      execSync('npx prisma migrate deploy', {
        cwd: PROJECT_ROOT,
        env: { ...process.env }, // DATABASE_URL already set in beforeAll
        stdio: 'pipe',
      });
    }).not.toThrow();
  });
});
