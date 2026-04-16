/**
 * Sprint 3 — Question Reorder (S1.4)
 *
 * Story S1.4  Reorder questions via drag-and-drop
 *
 * Scenarios:
 *   SC1.4.1  A, B, C → drag C above A → order becomes C, A, B
 *   SC1.4.2  Reload page after reorder → new order is preserved
 *   SC1.4.3  Survey with 1 question → reorder endpoint still works (no crash)
 *             (UI "no drag handle" is a visual concern only)
 *
 * Every API route also has:
 *   – Auth test          (no x-user-id → 401)
 *   – Not-found test     (nonexistent survey → 404)
 *   – Cross-ownership    (different user → 404)
 *   – Invalid input      (missing orderedIds → 400)
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

describe('Sprint 3 — S1.4: Question reorder via PUT /questions', () => {
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

  async function addQuestion(surveyId: string, title: string): Promise<Question> {
    const res = await request
      .post(`/api/surveys/${surveyId}/questions`)
      .set('x-user-id', userId)
      .send({ type: 'short_text', title });
    expect(res.status).toBe(201);
    return res.body.question as Question;
  }

  async function getQuestions(surveyId: string): Promise<Question[]> {
    const res = await request
      .get(`/api/surveys/${surveyId}/questions`)
      .set('x-user-id', userId);
    expect(res.status).toBe(200);
    return res.body as Question[];
  }

  async function reorderQuestions(surveyId: string, orderedIds: string[]) {
    return request
      .put(`/api/surveys/${surveyId}/questions`)
      .set('x-user-id', userId)
      .send({ orderedIds });
  }

  // ── SC1.4.1 — drag C above A: order becomes C, A, B ─────────────────────

  describe('SC1.4.1: Drag question C above A → order becomes C, A, B', () => {
    it('PUT /questions with [C, A, B] reorders questions correctly', async () => {
      const survey = await createSurvey('3-Question Survey');
      const qA = await addQuestion(survey.id, 'Question A');
      const qB = await addQuestion(survey.id, 'Question B');
      const qC = await addQuestion(survey.id, 'Question C');

      // Initial order: A(0), B(1), C(2)
      let questions = await getQuestions(survey.id);
      expect(questions[0].title).toBe('Question A');
      expect(questions[1].title).toBe('Question B');
      expect(questions[2].title).toBe('Question C');

      // Drag C to top: new order = [C, A, B]
      const reorderRes = await reorderQuestions(survey.id, [qC.id, qA.id, qB.id]);
      expect(reorderRes.status).toBe(200);
      expect(reorderRes.body.success).toBe(true);

      // Verify persisted order
      questions = await getQuestions(survey.id);
      expect(questions[0].title).toBe('Question C');
      expect(questions[0].order).toBe(0);
      expect(questions[1].title).toBe('Question A');
      expect(questions[1].order).toBe(1);
      expect(questions[2].title).toBe('Question B');
      expect(questions[2].order).toBe(2);
    });

    it('reorder to [B, C, A] assigns correct order values', async () => {
      const survey = await createSurvey('Reorder test');
      const qA = await addQuestion(survey.id, 'A');
      const qB = await addQuestion(survey.id, 'B');
      const qC = await addQuestion(survey.id, 'C');

      await reorderQuestions(survey.id, [qB.id, qC.id, qA.id]);

      const questions = await getQuestions(survey.id);
      expect(questions[0].id).toBe(qB.id);
      expect(questions[1].id).toBe(qC.id);
      expect(questions[2].id).toBe(qA.id);
    });
  });

  // ── SC1.4.2 — new order persists after reload ────────────────────────────

  describe('SC1.4.2: New order is preserved across re-fetches ("reload")', () => {
    it('order persisted in DB is reflected in subsequent GET requests', async () => {
      const survey = await createSurvey('Persistence test');
      const q1 = await addQuestion(survey.id, 'First');
      const q2 = await addQuestion(survey.id, 'Second');
      const q3 = await addQuestion(survey.id, 'Third');

      // Reverse the order
      await reorderQuestions(survey.id, [q3.id, q2.id, q1.id]);

      // Simulate a page reload: fetch questions again
      const afterReload = await getQuestions(survey.id);
      expect(afterReload[0].title).toBe('Third');
      expect(afterReload[1].title).toBe('Second');
      expect(afterReload[2].title).toBe('First');

      // Also verify directly in DB
      const dbQuestions = await prisma.question.findMany({
        where: { surveyId: survey.id },
        orderBy: { order: 'asc' },
      });
      expect(dbQuestions[0].id).toBe(q3.id);
      expect(dbQuestions[1].id).toBe(q2.id);
      expect(dbQuestions[2].id).toBe(q1.id);
    });

    it('reordering multiple times results in the latest order being preserved', async () => {
      const survey = await createSurvey('Multi-reorder');
      const q1 = await addQuestion(survey.id, 'Q1');
      const q2 = await addQuestion(survey.id, 'Q2');
      const q3 = await addQuestion(survey.id, 'Q3');

      // First reorder: [q2, q1, q3]
      await reorderQuestions(survey.id, [q2.id, q1.id, q3.id]);

      // Second reorder: [q3, q2, q1]
      await reorderQuestions(survey.id, [q3.id, q2.id, q1.id]);

      const questions = await getQuestions(survey.id);
      expect(questions[0].id).toBe(q3.id);
      expect(questions[1].id).toBe(q2.id);
      expect(questions[2].id).toBe(q1.id);
    });
  });

  // ── SC1.4.3 — single question: no drag handle (UI), API works ───────────

  describe('SC1.4.3: Survey with 1 question — reorder endpoint handles it gracefully', () => {
    it('PUT /questions with a single-element orderedIds succeeds', async () => {
      const survey = await createSurvey('Single-question survey');
      const q = await addQuestion(survey.id, 'Only question');

      const res = await reorderQuestions(survey.id, [q.id]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const questions = await getQuestions(survey.id);
      expect(questions).toHaveLength(1);
      expect(questions[0].order).toBe(0);
    });

    it('survey with 1 question still returns it correctly after a no-op reorder', async () => {
      const survey = await createSurvey('Single');
      const q = await addQuestion(survey.id, 'Sole question');

      // "reorder" a single question
      await reorderQuestions(survey.id, [q.id]);

      const questions = await getQuestions(survey.id);
      expect(questions).toHaveLength(1);
      expect(questions[0].id).toBe(q.id);
    });
  });

  // ── Auth & guard tests ────────────────────────────────────────────────────

  describe('Auth: PUT /questions without auth → 401', () => {
    it('returns 401 when x-user-id header is absent', async () => {
      const survey = await createSurvey();
      const q = await addQuestion(survey.id, 'Q');

      const res = await request
        .put(`/api/surveys/${survey.id}/questions`)
        .send({ orderedIds: [q.id] });

      expect(res.status).toBe(401);
    });
  });

  describe('Not-found: PUT /questions with nonexistent survey → 404', () => {
    it('returns 404 when the survey does not exist', async () => {
      const res = await request
        .put('/api/surveys/nonexistent-id/questions')
        .set('x-user-id', userId)
        .send({ orderedIds: ['some-id'] });

      expect(res.status).toBe(404);
    });
  });

  describe('Cross-ownership: PUT /questions by non-owner → 404', () => {
    it('returns 404 when a different user tries to reorder questions', async () => {
      const survey = await createSurvey('Owner survey');
      const q1 = await addQuestion(survey.id, 'Q1');
      const q2 = await addQuestion(survey.id, 'Q2');

      const otherUser = await createTestUser(prisma);

      const res = await request
        .put(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', otherUser.id)
        .send({ orderedIds: [q2.id, q1.id] });

      expect(res.status).toBe(404);

      // Order must be unchanged
      const questions = await getQuestions(survey.id);
      expect(questions[0].id).toBe(q1.id);
      expect(questions[1].id).toBe(q2.id);
    });
  });

  describe('Invalid input: PUT /questions without orderedIds → 400', () => {
    it('returns 400 when orderedIds is missing from body', async () => {
      const survey = await createSurvey();

      const res = await request
        .put(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when orderedIds is not an array', async () => {
      const survey = await createSurvey();

      const res = await request
        .put(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId)
        .send({ orderedIds: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });
});
