/**
 * Sprint 3 — Authorization Bypass Fix (D2.1)
 *
 * Story:  D2.1  Fix authorization bypass in question update/delete
 *
 * Scenarios:
 *   D2.1.1  PATCH /api/surveys/B/questions/Q (Q belongs to survey A) → 404
 *   D2.1.2  DELETE /api/surveys/B/questions/Q (Q belongs to survey A) → 404
 *   D2.1.3  PATCH /api/surveys/A/questions/Q as a different authenticated user → 404
 *
 * Every route also has:
 *   – Auth test        (no x-user-id header → 401)
 *   – Not-found test   (survey or question ID does not exist → 404)
 *   – Cross-ownership  (different user, own survey B, tries to touch Q in survey A → 404)
 *   – Happy path       (correct owner, correct survey → 200)
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

interface Question {
  id: string;
  title: string;
  order: number;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Sprint 3 — D2.1: Authorization bypass fix (question update/delete)', () => {
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
    const user = await createTestUser(prisma);
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

  async function addQuestion(
    surveyId: string,
    data: Record<string, unknown> = {}
  ): Promise<Question> {
    const res = await request
      .post(`/api/surveys/${surveyId}/questions`)
      .set('x-user-id', userId)
      .send({ type: 'short_text', title: 'Question', ...data });
    expect(res.status).toBe(201);
    return res.body.question as Question;
  }

  // ── D2.1.1 — PATCH with wrong survey ID ─────────────────────────────────

  describe('SC D2.1.1: PATCH /surveys/B/questions/Q where Q belongs to survey A → 404', () => {
    it('happy path: PATCH with correct survey and owner returns 200', async () => {
      const survey = await createSurvey('Survey A');
      const question = await addQuestion(survey.id, { title: 'Original' });

      const res = await request
        .patch(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('returns 404 when question Q belongs to survey A but URL uses survey B', async () => {
      // Create two surveys owned by the same user
      const surveyA = await createSurvey('Survey A');
      const surveyB = await createSurvey('Survey B');

      // Create question Q in survey A
      const questionInA = await addQuestion(surveyA.id, { title: 'Question in A' });

      // PATCH /surveys/B/questions/Q — Q does NOT belong to B
      const res = await request
        .patch(`/api/surveys/${surveyB.id}/questions/${questionInA.id}`)
        .set('x-user-id', userId)
        .send({ title: 'Sneaky update' });

      // Must reject with 404, NOT silently succeed
      expect(res.status).toBe(404);
    });

    it('auth: PATCH without x-user-id → 401', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id);

      const res = await request
        .patch(`/api/surveys/${survey.id}/questions/${question.id}`)
        .send({ title: 'No auth' });

      expect(res.status).toBe(401);
    });

    it('not-found: PATCH with nonexistent survey ID → 404', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id);

      const res = await request
        .patch(`/api/surveys/nonexistent-survey-id/questions/${question.id}`)
        .set('x-user-id', userId)
        .send({ title: 'Ghost survey' });

      expect(res.status).toBe(404);
    });

    it('not-found: PATCH with nonexistent question ID → 404', async () => {
      const survey = await createSurvey();

      const res = await request
        .patch(`/api/surveys/${survey.id}/questions/nonexistent-qid`)
        .set('x-user-id', userId)
        .send({ title: 'Ghost question' });

      expect(res.status).toBe(404);
    });
  });

  // ── D2.1.2 — DELETE with wrong survey ID ────────────────────────────────

  describe('SC D2.1.2: DELETE /surveys/B/questions/Q where Q belongs to survey A → 404', () => {
    it('happy path: DELETE with correct survey and owner returns 200', async () => {
      const survey = await createSurvey('Survey A');
      const question = await addQuestion(survey.id, { title: 'To delete' });

      const res = await request
        .delete(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when question Q belongs to survey A but URL uses survey B', async () => {
      const surveyA = await createSurvey('Survey A');
      const surveyB = await createSurvey('Survey B');

      const questionInA = await addQuestion(surveyA.id, { title: 'Question in A' });

      // DELETE /surveys/B/questions/Q — Q does NOT belong to B
      const res = await request
        .delete(`/api/surveys/${surveyB.id}/questions/${questionInA.id}`)
        .set('x-user-id', userId);

      // Must reject with 404, NOT silently delete
      expect(res.status).toBe(404);

      // Verify the question was NOT actually deleted
      const stillExists = await prisma.question.findUnique({
        where: { id: questionInA.id },
      });
      expect(stillExists).not.toBeNull();
    });

    it('auth: DELETE without x-user-id → 401', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id);

      const res = await request
        .delete(`/api/surveys/${survey.id}/questions/${question.id}`);

      expect(res.status).toBe(401);
    });

    it('not-found: DELETE with nonexistent survey ID → 404', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id);

      const res = await request
        .delete(`/api/surveys/nonexistent-survey/questions/${question.id}`)
        .set('x-user-id', userId);

      expect(res.status).toBe(404);
    });

    it('not-found: DELETE with nonexistent question ID → 404', async () => {
      const survey = await createSurvey();

      const res = await request
        .delete(`/api/surveys/${survey.id}/questions/nonexistent-qid`)
        .set('x-user-id', userId);

      expect(res.status).toBe(404);
    });
  });

  // ── D2.1.3 — PATCH by different authenticated user ───────────────────────

  describe('SC D2.1.3: PATCH /surveys/A/questions/Q as a different authenticated user → 404', () => {
    it('returns 404 when authenticated user does not own the survey', async () => {
      // User1 creates survey A with question Q
      const surveyA = await createSurvey('Survey A (user1)');
      const questionInA = await addQuestion(surveyA.id, { title: 'User1 question' });

      // User2 is a different user
      const user2 = await createTestUser(prisma);

      // User2 tries to PATCH the question — user2 does not own survey A
      const res = await request
        .patch(`/api/surveys/${surveyA.id}/questions/${questionInA.id}`)
        .set('x-user-id', user2.id)
        .send({ title: 'Hostile update' });

      // Must be 404 — never leak ownership information
      expect(res.status).toBe(404);

      // Verify the question was NOT modified
      const unchanged = await prisma.question.findUnique({
        where: { id: questionInA.id },
      });
      expect(unchanged?.title).toBe('User1 question');
    });

    it('returns 404 when different user tries to DELETE a question they do not own', async () => {
      const surveyA = await createSurvey('Survey A (user1)');
      const questionInA = await addQuestion(surveyA.id, { title: 'User1 question' });

      const user2 = await createTestUser(prisma);

      const res = await request
        .delete(`/api/surveys/${surveyA.id}/questions/${questionInA.id}`)
        .set('x-user-id', user2.id);

      expect(res.status).toBe(404);

      // Verify the question still exists
      const stillExists = await prisma.question.findUnique({ where: { id: questionInA.id } });
      expect(stillExists).not.toBeNull();
    });

    it('a user cannot PATCH a question from another survey even by owning a different survey', async () => {
      // User1 owns survey A (question Q) AND survey B
      const surveyA = await createSurvey('Survey A');
      const surveyB = await createSurvey('Survey B');
      const questionInA = await addQuestion(surveyA.id, { title: 'In A' });

      // Add a question to B so B is valid
      await addQuestion(surveyB.id, { title: 'In B' });

      // Attempt to PATCH Q (in A) via URL for survey B
      // Even though the same user owns both surveys, this should fail
      const res = await request
        .patch(`/api/surveys/${surveyB.id}/questions/${questionInA.id}`)
        .set('x-user-id', userId)
        .send({ title: 'Cross-survey exploit' });

      expect(res.status).toBe(404);
    });
  });
});
