/**
 * Sprint 3 — Anonymous and Identified Responses (S5.3)
 *
 * Story S5.3  Anonymous and identified responses — capture respondent identity
 *             when available
 *
 * Scenarios:
 *   SC5.3.1  Logged-in user takes a survey → response.userId = their user ID
 *   SC5.3.2  Anonymous visitor takes a survey → response.userId = null
 *   SC5.3.3  Two users submit the same survey → each response listed separately
 *             with its respondent identity (or "Anonymous")
 *
 * Every API route also has:
 *   – Not-found tests
 *   – Happy path
 */

import supertest from 'supertest';
import { PrismaClient } from '@prisma/client';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { startTestDatabase, stopTestDatabase, cleanDatabase, createTestUser } from './helpers/setup';
import { buildApp } from './helpers/app';

// ─── types ───────────────────────────────────────────────────────────────────

interface Survey {
  id: string;
  slug: string;
}

interface SurveyResponse {
  id: string;
  status: string;
  userId: string | null;
}

interface SummaryResponse {
  survey: { id: string };
  responses: Array<{
    id: string;
    status: string;
    userId: string | null;
    user: { id: string; name: string | null; email: string } | null;
  }>;
  total: number;
  complete: number;
  partial: number;
  completionRate: number;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Sprint 3 — S5.3: Anonymous and identified responses', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let request: ReturnType<typeof supertest>;
  let userId: string; // survey creator

  beforeAll(async () => {
    const ctx = await startTestDatabase();
    container = ctx.container;
    prisma = ctx.prisma;
    request = supertest(buildApp(prisma));
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase({ container, prisma });
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const creator = await createTestUser(prisma, { email: 'creator@example.com' });
    userId = creator.id;
  });

  // ── request helpers ────────────────────────────────────────────────────────

  async function createSurvey(title = 'Survey'): Promise<Survey> {
    const res = await request
      .post('/api/surveys')
      .set('x-user-id', userId)
      .send({ title });
    expect(res.status).toBe(201);
    return res.body as Survey;
  }

  async function addQuestion(surveyId: string): Promise<{ id: string }> {
    const res = await request
      .post(`/api/surveys/${surveyId}/questions`)
      .set('x-user-id', userId)
      .send({ type: 'short_text', title: 'Question' });
    expect(res.status).toBe(201);
    return res.body.question as { id: string };
  }

  // ── SC5.3.1 — logged-in user → response linked to userId ────────────────

  describe('SC5.3.1: Logged-in user response is linked to their user ID', () => {
    it('response.userId matches the authenticated respondent', async () => {
      const survey = await createSurvey('Identified Survey');
      const respondent = await createTestUser(prisma, { email: 'respondent@example.com' });

      // Respondent takes the survey (authenticated via x-user-id)
      const res = await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-user-id', respondent.id)
        .send({});

      expect(res.status).toBe(201);
      const response = res.body as SurveyResponse;
      expect(response.userId).toBe(respondent.id);

      // Verify directly in DB
      const dbResponse = await prisma.response.findUnique({ where: { id: response.id } });
      expect(dbResponse?.userId).toBe(respondent.id);
    });

    it('the creator and respondent can be different users', async () => {
      const survey = await createSurvey('Creator vs Respondent');
      const respondent = await createTestUser(prisma, { email: 'other@example.com' });

      const res = await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-user-id', respondent.id)
        .send({});

      expect(res.status).toBe(201);
      const dbResponse = await prisma.response.findUnique({ where: { id: res.body.id } });

      // userId is the respondent, not the survey creator
      expect(dbResponse?.userId).toBe(respondent.id);
      expect(dbResponse?.userId).not.toBe(userId);
    });
  });

  // ── SC5.3.2 — anonymous visitor → userId = null ──────────────────────────

  describe('SC5.3.2: Anonymous visitor response has null userId', () => {
    it('response.userId is null when no x-user-id header is provided', async () => {
      const survey = await createSurvey('Anonymous Survey');

      // No auth header — anonymous respondent
      const res = await request
        .post(`/api/s/${survey.slug}/responses`)
        .send({});

      expect(res.status).toBe(201);
      const response = res.body as SurveyResponse;
      expect(response.userId).toBeNull();

      const dbResponse = await prisma.response.findUnique({ where: { id: response.id } });
      expect(dbResponse?.userId).toBeNull();
    });

    it('anonymous response still captures browser fingerprint', async () => {
      const survey = await createSurvey('Fingerprint Survey');

      const res = await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-browser-fingerprint', 'fp-anon-123')
        .send({});

      expect(res.status).toBe(201);
      const dbResponse = await prisma.response.findUnique({ where: { id: res.body.id } });
      expect(dbResponse?.userId).toBeNull();
      expect(dbResponse?.browserFingerprint).toBe('fp-anon-123');
    });
  });

  // ── SC5.3.3 — two users' responses listed separately ────────────────────

  describe('SC5.3.3: Two users listed separately with identity or "Anonymous"', () => {
    it('two identified responses have distinct userId values', async () => {
      const survey = await createSurvey('Two Respondents');
      await addQuestion(survey.id);

      const respondent1 = await createTestUser(prisma, { email: 'r1@example.com', name: 'Alice' });
      const respondent2 = await createTestUser(prisma, { email: 'r2@example.com', name: 'Bob' });

      // Both respondents submit
      const r1Res = await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-user-id', respondent1.id)
        .send({});
      expect(r1Res.status).toBe(201);

      const r2Res = await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-user-id', respondent2.id)
        .send({});
      expect(r2Res.status).toBe(201);

      // Summary shows two responses with different user IDs
      const summaryRes = await request
        .get(`/api/surveys/${survey.id}/responses`)
        .set('x-user-id', userId);
      expect(summaryRes.status).toBe(200);

      const summary = summaryRes.body as SummaryResponse;
      expect(summary.total).toBe(2);

      const userIds = summary.responses.map((r) => r.userId).sort();
      expect(userIds).toContain(respondent1.id);
      expect(userIds).toContain(respondent2.id);
    });

    it('summary response includes user profile for identified respondents', async () => {
      const survey = await createSurvey('Named Respondent Survey');
      const respondent = await createTestUser(prisma, {
        email: 'named@example.com',
        name: 'Charlie',
      });

      await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-user-id', respondent.id)
        .send({});

      const summaryRes = await request
        .get(`/api/surveys/${survey.id}/responses`)
        .set('x-user-id', userId);

      const summary = summaryRes.body as SummaryResponse;
      const r = summary.responses[0];

      // user profile is included for identified respondent
      expect(r.user).not.toBeNull();
      expect(r.user?.email).toBe('named@example.com');
      expect(r.user?.name).toBe('Charlie');
    });

    it('summary response has null user for anonymous respondents', async () => {
      const survey = await createSurvey('Mixed Identity Survey');

      // Anonymous response
      await request.post(`/api/s/${survey.slug}/responses`).send({});

      const summaryRes = await request
        .get(`/api/surveys/${survey.id}/responses`)
        .set('x-user-id', userId);

      const summary = summaryRes.body as SummaryResponse;
      const r = summary.responses[0];

      // user is null for anonymous respondent
      expect(r.userId).toBeNull();
      expect(r.user).toBeNull();
    });

    it('mix of anonymous and identified responses are all listed', async () => {
      const survey = await createSurvey('Mixed Survey');
      const respondent = await createTestUser(prisma, { email: 'known@example.com' });

      // One anonymous
      await request.post(`/api/s/${survey.slug}/responses`).send({});
      // One identified
      await request
        .post(`/api/s/${survey.slug}/responses`)
        .set('x-user-id', respondent.id)
        .send({});

      const summaryRes = await request
        .get(`/api/surveys/${survey.id}/responses`)
        .set('x-user-id', userId);

      const summary = summaryRes.body as SummaryResponse;
      expect(summary.total).toBe(2);

      const identities = summary.responses.map((r) => (r.userId ? 'identified' : 'anonymous'));
      expect(identities).toContain('identified');
      expect(identities).toContain('anonymous');
    });
  });
});
