/**
 * Sprint 2 — Question Builder integration tests
 *
 * Stories covered:
 *   S1.3  Edit question inline   (SC1.3.1 · SC1.3.2 · SC1.3.3)
 *   S1.5  Delete question        (SC1.5.1 · SC1.5.2 · SC1.5.3)
 *   S1.6  Duplicate question     (SC1.6.1 · SC1.6.2 · SC1.6.3)
 *   S1.8  Publish survey         (SC1.8.1 · SC1.8.2 · SC1.8.3)
 *
 * Infrastructure: Testcontainers (PostgreSQL 15) + supertest + Prisma
 */

import supertest from 'supertest';
import { PrismaClient } from '@prisma/client';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { startTestDatabase, stopTestDatabase, cleanDatabase, createTestUser } from './helpers/setup';
import { buildApp } from './helpers/app';

// ─── types used across helpers ───────────────────────────────────────────────

interface Survey {
  id: string;
  slug: string;
  status: string;
}

interface Question {
  id: string;
  title: string;
  type: string;
  order: number;
  charLimit: number | null;
  minSelections: number | null;
  maxSelections: number | null;
  options: Array<{ id: string; text: string; order: number }>;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Sprint 2 — Question Builder', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let request: ReturnType<typeof supertest>;
  let userId: string;

  // ── lifecycle ──────────────────────────────────────────────────────────────

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

  async function createSurvey(title = 'Test Survey'): Promise<Survey> {
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
      .send({ type: 'short_text', title: 'Untitled', ...data });
    expect(res.status).toBe(201);
    return res.body.question as Question;
  }

  // ── S1.3 — Edit question inline ────────────────────────────────────────────

  describe('SC1.3.1: Clicking a question text makes it editable and changes are saved', () => {
    it('PATCH /questions/:qid updates the question title and returns the updated resource', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, { title: 'Original title' });

      const res = await request
        .patch(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId)
        .send({ title: 'Edited title' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(question.id);
      expect(res.body.title).toBe('Edited title');
    });
  });

  describe('SC1.3.2: Adding/removing/reordering options updates in real-time', () => {
    it('PATCH with a new options array replaces existing options', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'single_choice',
        title: 'Pick one',
        options: [
          { text: 'Alpha', order: 0 },
          { text: 'Beta', order: 1 },
        ],
      });

      const res = await request
        .patch(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId)
        .send({
          options: [
            { text: 'Alpha', order: 0 },
            { text: 'Beta', order: 1 },
            { text: 'Gamma', order: 2 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.options).toHaveLength(3);
      const texts: string[] = res.body.options.map((o: { text: string }) => o.text);
      expect(texts).toContain('Gamma');
    });

    it('PATCH removing an option reduces the option count', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'multiple_choice',
        title: 'Pick some',
        options: [
          { text: 'X', order: 0 },
          { text: 'Y', order: 1 },
          { text: 'Z', order: 2 },
        ],
      });

      const res = await request
        .patch(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId)
        .send({
          options: [
            { text: 'X', order: 0 },
            { text: 'Z', order: 1 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.options).toHaveLength(2);
      const texts: string[] = res.body.options.map((o: { text: string }) => o.text);
      expect(texts).not.toContain('Y');
    });
  });

  describe('SC1.3.3: Clicking outside or pressing Escape saves the edit automatically', () => {
    it('a subsequent GET returns the PATCH-ed title (edit is persisted)', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, { title: 'Old text' });

      await request
        .patch(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId)
        .send({ title: 'Auto-saved text' });

      const getRes = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      expect(getRes.status).toBe(200);
      expect((getRes.body as Question[])[0].title).toBe('Auto-saved text');
    });
  });

  // ── S1.5 — Delete question ─────────────────────────────────────────────────

  describe('SC1.5.1: Clicking delete and confirming removes the question', () => {
    it('DELETE /questions/:qid returns success and the question is no longer in GET', async () => {
      const survey = await createSurvey();
      const q1 = await addQuestion(survey.id, { title: 'To delete' });
      const q2 = await addQuestion(survey.id, { title: 'To keep' });

      const delRes = await request
        .delete(`/api/surveys/${survey.id}/questions/${q1.id}`)
        .set('x-user-id', userId);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const getRes = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      const ids: string[] = (getRes.body as Question[]).map((q) => q.id);
      expect(ids).not.toContain(q1.id);
      expect(ids).toContain(q2.id);
    });

    it('remaining questions are re-indexed starting from 0 after a deletion', async () => {
      const survey = await createSurvey();
      const q1 = await addQuestion(survey.id, { title: 'First' });
      await addQuestion(survey.id, { title: 'Second' });
      const q3 = await addQuestion(survey.id, { title: 'Third' });

      await request
        .delete(`/api/surveys/${survey.id}/questions/${q1.id}`)
        .set('x-user-id', userId);

      const getRes = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      const orders: number[] = (getRes.body as Question[]).map((q) => q.order);
      expect(orders).toEqual([0, 1]);

      // q3 was order=2, now re-indexed to 1
      const q3Updated = (getRes.body as Question[]).find((q) => q.id === q3.id);
      expect(q3Updated?.order).toBe(1);
    });
  });

  describe('SC1.5.2: Deleting the only question shows an empty state', () => {
    it('GET /questions returns an empty array after deleting the last question', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id);

      await request
        .delete(`/api/surveys/${survey.id}/questions/${question.id}`)
        .set('x-user-id', userId);

      const getRes = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(0);
    });
  });

  describe('SC1.5.3: Cancelling the confirmation dialog does not remove the question', () => {
    it('question still exists when DELETE is never called (cancel scenario)', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, { title: 'Do not delete me' });

      // Simulate "cancel" — we simply skip the DELETE request
      const getRes = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      expect(getRes.status).toBe(200);
      const ids: string[] = (getRes.body as Question[]).map((q) => q.id);
      expect(ids).toContain(question.id);
    });
  });

  // ── S1.6 — Duplicate question ──────────────────────────────────────────────

  describe('SC1.6.1: Duplicating copies the type, text, and options', () => {
    it('POST /duplicate returns a copy with the same type, title root, and options', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'single_choice',
        title: 'Favourite colour?',
        options: [
          { text: 'Red', order: 0 },
          { text: 'Blue', order: 1 },
          { text: 'Green', order: 2 },
        ],
      });

      const res = await request
        .post(`/api/surveys/${survey.id}/questions/${question.id}/duplicate`)
        .set('x-user-id', userId);

      expect(res.status).toBe(201);
      const copy = res.body as Question;

      // Different ID but same type
      expect(copy.id).not.toBe(question.id);
      expect(copy.type).toBe('single_choice');

      // Options are copied (same texts, same count)
      expect(copy.options).toHaveLength(3);
      const copyTexts = copy.options.map((o) => o.text);
      expect(copyTexts).toContain('Red');
      expect(copyTexts).toContain('Blue');
      expect(copyTexts).toContain('Green');
    });

    it('the duplicated question appears in the questions list', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, { title: 'Original' });

      await request
        .post(`/api/surveys/${survey.id}/questions/${question.id}/duplicate`)
        .set('x-user-id', userId);

      const getRes = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      expect(getRes.body).toHaveLength(2);
    });
  });

  describe('SC1.6.2: Duplicating a question with conditional logic does NOT copy the logic rules', () => {
    it('the duplicated question has no logic rules in the database', async () => {
      const survey = await createSurvey();
      const q1 = await addQuestion(survey.id, { title: 'Source question' });
      const q2 = await addQuestion(survey.id, { title: 'Target question' });

      // Insert a logic rule connecting q1 → q2 directly via Prisma
      await prisma.logicRule.create({
        data: {
          type: 'skip_to',
          conditionValue: 'yes',
          surveyId: survey.id,
          sourceQuestionId: q1.id,
          targetQuestionId: q2.id,
        },
      });

      const dupRes = await request
        .post(`/api/surveys/${survey.id}/questions/${q1.id}/duplicate`)
        .set('x-user-id', userId);

      expect(dupRes.status).toBe(201);
      const copyId: string = dupRes.body.id;

      // The copy must not have any logic rules (neither as source nor target)
      const rulesAsSource = await prisma.logicRule.findMany({
        where: { sourceQuestionId: copyId },
      });
      const rulesAsTarget = await prisma.logicRule.findMany({
        where: { targetQuestionId: copyId },
      });

      expect(rulesAsSource).toHaveLength(0);
      expect(rulesAsTarget).toHaveLength(0);
    });
  });

  describe('SC1.6.3: The duplicated question title is suffixed with "(copy)"', () => {
    it('POST /duplicate returns a question whose title ends with " (copy)"', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, { title: 'What is your name?' });

      const res = await request
        .post(`/api/surveys/${survey.id}/questions/${question.id}/duplicate`)
        .set('x-user-id', userId);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('What is your name? (copy)');
    });

    it('duplicating a copy appends another "(copy)" suffix', async () => {
      const survey = await createSurvey();
      const original = await addQuestion(survey.id, { title: 'Q' });

      const firstDup = await request
        .post(`/api/surveys/${survey.id}/questions/${original.id}/duplicate`)
        .set('x-user-id', userId);

      const secondDup = await request
        .post(`/api/surveys/${survey.id}/questions/${firstDup.body.id}/duplicate`)
        .set('x-user-id', userId);

      expect(secondDup.status).toBe(201);
      expect(secondDup.body.title).toBe('Q (copy) (copy)');
    });
  });

  // ── S1.8 — Publish survey ──────────────────────────────────────────────────

  describe('SC1.8.1: Publishing a survey with questions makes it live with a shareable link', () => {
    it('POST /publish returns status=live and a non-empty slug', async () => {
      const survey = await createSurvey('My Public Survey');
      await addQuestion(survey.id, { title: 'Rate us' });

      const res = await request
        .post(`/api/surveys/${survey.id}/publish`)
        .set('x-user-id', userId);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('live');
      expect(typeof res.body.slug).toBe('string');
      expect(res.body.slug.length).toBeGreaterThan(0);
    });

    it('the published survey is accessible by its slug', async () => {
      const survey = await createSurvey('Accessible Survey');
      await addQuestion(survey.id);

      await request
        .post(`/api/surveys/${survey.id}/publish`)
        .set('x-user-id', userId);

      const slugRes = await request.get(`/api/s/${survey.slug}`);
      expect(slugRes.status).toBe(200);
      expect(slugRes.body.status).toBe('live');
    });
  });

  describe('SC1.8.2: Trying to publish a survey with no questions returns an error', () => {
    it('POST /publish returns 400 with the expected error message', async () => {
      const survey = await createSurvey('Empty Survey');

      const res = await request
        .post(`/api/surveys/${survey.id}/publish`)
        .set('x-user-id', userId);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Add at least one question before publishing/i);
    });
  });

  describe('SC1.8.3: Republishing after edits pushes changes live again', () => {
    it('POST /publish on an already-live survey succeeds and status stays live', async () => {
      const survey = await createSurvey();
      await addQuestion(survey.id, { title: 'Q1' });

      // First publish
      const first = await request
        .post(`/api/surveys/${survey.id}/publish`)
        .set('x-user-id', userId);
      expect(first.body.status).toBe('live');

      // Simulate edit: add another question
      await addQuestion(survey.id, { title: 'Q2 — added after first publish' });

      // Republish
      const second = await request
        .post(`/api/surveys/${survey.id}/publish`)
        .set('x-user-id', userId);

      expect(second.status).toBe(200);
      expect(second.body.status).toBe('live');
    });
  });
});
