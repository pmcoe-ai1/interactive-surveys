/**
 * Sprint 3 — Response Summary Overview (S6.1)
 *
 * Story S6.1  Response summary overview — see how many people responded and
 *             the completion rate
 *
 * Scenarios:
 *   SC6.1.1  10 complete + 3 partial → "10 responses", "77% completion rate"
 *   SC6.1.2  Results page lists responses with timestamp and complete/partial status
 *   SC6.1.3  Survey with no responses → "No responses yet" + share link
 *             (API level: total=0, completionRate=0)
 *
 * Every API route also has:
 *   – Auth test         (no x-user-id → 401)
 *   – Not-found test    (nonexistent survey → 404)
 *   – Cross-ownership   (different user → 404)
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
  title: string;
}

interface ResponseItem {
  id: string;
  status: 'partial' | 'complete';
  createdAt: string;
  userId: string | null;
  user: { id: string; name: string | null; email: string } | null;
  _count: { answers: number };
}

interface SummaryBody {
  survey: Survey;
  responses: ResponseItem[];
  total: number;
  complete: number;
  partial: number;
  completionRate: number;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Sprint 3 — S6.1: Response summary overview', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let request: ReturnType<typeof supertest>;
  let userId: string;

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
    const user = await createTestUser(prisma, { email: 'creator@test.com' });
    userId = user.id;
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

  /** Create a response, optionally completing it. */
  async function createResponse(survey: Survey, complete: boolean): Promise<string> {
    const startRes = await request.post(`/api/s/${survey.slug}/responses`).send({});
    expect(startRes.status).toBe(201);
    const rid: string = startRes.body.id;

    if (complete) {
      const completeRes = await request
        .post(`/api/s/${survey.slug}/responses/${rid}/complete`)
        .send({});
      expect(completeRes.status).toBe(200);
    }
    return rid;
  }

  async function getSummary(surveyId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await request
      .get(`/api/surveys/${surveyId}/responses`)
      .set('x-user-id', userId);
    return { status: res.status, body: res.body as SummaryBody };
  }

  // ── SC6.1.1 — 10 complete + 3 partial → 77% ─────────────────────────────

  describe('SC6.1.1: 10 complete + 3 partial → total=13, completionRate=77%', () => {
    it('returns correct totals and completion rate for mixed responses', async () => {
      const survey = await createSurvey('Stats Survey');
      await addQuestion(survey.id);

      // Create 10 complete responses
      for (let i = 0; i < 10; i++) {
        await createResponse(survey, true);
      }
      // Create 3 partial responses
      for (let i = 0; i < 3; i++) {
        await createResponse(survey, false);
      }

      const { status, body } = await getSummary(survey.id);

      expect(status).toBe(200);
      expect(body.total).toBe(13);
      expect(body.complete).toBe(10);
      expect(body.partial).toBe(3);
      // Math.round(10/13 * 100) = Math.round(76.9...) = 77
      expect(body.completionRate).toBe(77);
    });

    it('completionRate is 0 when no responses exist', async () => {
      const survey = await createSurvey('Empty');

      const { body } = await getSummary(survey.id);
      expect(body.total).toBe(0);
      expect(body.completionRate).toBe(0);
    });

    it('completionRate is 100% when all responses are complete', async () => {
      const survey = await createSurvey('All Complete');
      await addQuestion(survey.id);

      for (let i = 0; i < 5; i++) {
        await createResponse(survey, true);
      }

      const { body } = await getSummary(survey.id);
      expect(body.total).toBe(5);
      expect(body.complete).toBe(5);
      expect(body.partial).toBe(0);
      expect(body.completionRate).toBe(100);
    });

    it('completionRate is 0% when all responses are partial', async () => {
      const survey = await createSurvey('All Partial');
      await addQuestion(survey.id);

      for (let i = 0; i < 4; i++) {
        await createResponse(survey, false);
      }

      const { body } = await getSummary(survey.id);
      expect(body.total).toBe(4);
      expect(body.complete).toBe(0);
      expect(body.partial).toBe(4);
      expect(body.completionRate).toBe(0);
    });
  });

  // ── SC6.1.2 — response list with timestamp and status ───────────────────

  describe('SC6.1.2: Response list includes timestamp and complete/partial status', () => {
    it('each response has a createdAt timestamp and a status field', async () => {
      const survey = await createSurvey('Timestamped');
      await addQuestion(survey.id);

      await createResponse(survey, true);
      await createResponse(survey, false);

      const { body } = await getSummary(survey.id);

      expect(body.responses).toHaveLength(2);

      for (const r of body.responses) {
        expect(r.createdAt).toBeDefined();
        // createdAt must be a valid ISO date string
        expect(() => new Date(r.createdAt)).not.toThrow();
        expect(new Date(r.createdAt).getTime()).toBeGreaterThan(0);
        // status must be one of the two values
        expect(['partial', 'complete']).toContain(r.status);
      }
    });

    it('responses are returned in descending createdAt order', async () => {
      const survey = await createSurvey('Ordered Responses');
      await addQuestion(survey.id);

      for (let i = 0; i < 3; i++) {
        await createResponse(survey, false);
      }

      const { body } = await getSummary(survey.id);
      const timestamps = body.responses.map((r) => new Date(r.createdAt).getTime());

      // Each subsequent timestamp should be ≤ the previous (descending)
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
      }
    });

    it('each response includes answer count', async () => {
      const survey = await createSurvey('Answer Count');
      const q = await addQuestion(survey.id);

      const rid = await createResponse(survey, false);

      // Save an answer
      await request
        .post(`/api/s/${survey.slug}/responses/${rid}/answers`)
        .send({ questionId: q.id, value: 'test' });

      const { body } = await getSummary(survey.id);
      expect(body.responses[0]._count.answers).toBe(1);
    });

    it('response correctly shows complete status after calling /complete', async () => {
      const survey = await createSurvey('Status Display');
      await addQuestion(survey.id);

      const rid = await createResponse(survey, true); // complete
      await createResponse(survey, false); // partial

      const { body } = await getSummary(survey.id);
      // Most recent first — but both should be present
      const statuses = body.responses.map((r) => r.status);
      expect(statuses).toContain('complete');
      expect(statuses).toContain('partial');

      const completedResponse = body.responses.find((r) => r.id === rid);
      expect(completedResponse?.status).toBe('complete');
    });
  });

  // ── SC6.1.3 — no responses → total=0, show share link ───────────────────

  describe('SC6.1.3: Survey with no responses → total=0 (UI shows "No responses yet")', () => {
    it('returns total=0 and empty responses array for a new survey', async () => {
      const survey = await createSurvey('Fresh Survey');

      const { status, body } = await getSummary(survey.id);

      expect(status).toBe(200);
      expect(body.total).toBe(0);
      expect(body.complete).toBe(0);
      expect(body.partial).toBe(0);
      expect(body.completionRate).toBe(0);
      expect(body.responses).toHaveLength(0);
    });

    it('survey object is included in the response for zero-response surveys', async () => {
      const survey = await createSurvey('No Responses Yet');

      const { body } = await getSummary(survey.id);

      // Survey data must be present so the UI can show a share link
      expect(body.survey).toBeDefined();
      expect(body.survey.id).toBe(survey.id);
      expect(body.survey.title).toBe('No Responses Yet');
    });
  });

  // ── Auth & guard tests ────────────────────────────────────────────────────

  describe('Auth: GET /responses without auth → 401', () => {
    it('returns 401 when x-user-id header is absent', async () => {
      const survey = await createSurvey();

      const res = await request.get(`/api/surveys/${survey.id}/responses`);
      expect(res.status).toBe(401);
    });
  });

  describe('Not-found: GET /responses for nonexistent survey → 404', () => {
    it('returns 404 when the survey does not exist', async () => {
      const res = await request
        .get('/api/surveys/nonexistent-survey-id/responses')
        .set('x-user-id', userId);

      expect(res.status).toBe(404);
    });
  });

  describe('Cross-ownership: GET /responses for another user\'s survey → 404', () => {
    it('returns 404 when a different user tries to view response summary', async () => {
      const survey = await createSurvey('Owner Survey');
      await addQuestion(survey.id);
      await createResponse(survey, true);

      const otherUser = await createTestUser(prisma, { email: 'other@test.com' });

      const res = await request
        .get(`/api/surveys/${survey.id}/responses`)
        .set('x-user-id', otherUser.id);

      // Must not leak another user's response data
      expect(res.status).toBe(404);
    });
  });
});
