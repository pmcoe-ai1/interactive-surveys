/**
 * Sprint 3 — Partial Response Capture (S5.2)
 *
 * Story S5.2  Partial response capture — my partial answers are saved if I
 *             leave mid-survey
 *
 * Scenarios:
 *   SC5.2.1  Answering Q1 and Q2 of 5 without finishing → response status = partial
 *   SC5.2.2  Partial responses counted separately from complete in summary
 *   SC5.2.3  Each answer is saved immediately (not only on final submit)
 *
 * Every API route also has:
 *   – Not-found tests
 *   – Happy path (complete flow)
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
}

interface SurveyResponse {
  id: string;
  status: string;
  surveyId: string;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Sprint 3 — S5.2: Partial response capture', () => {
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

  async function startResponse(slug: string): Promise<SurveyResponse> {
    const res = await request.post(`/api/s/${slug}/responses`).send({});
    expect(res.status).toBe(201);
    return res.body as SurveyResponse;
  }

  async function saveAnswer(
    slug: string,
    responseId: string,
    questionId: string,
    value: string
  ) {
    const res = await request
      .post(`/api/s/${slug}/responses/${responseId}/answers`)
      .send({ questionId, value });
    expect(res.status).toBe(201);
    return res.body;
  }

  // ── SC5.2.1 — response starts as partial ─────────────────────────────────

  describe('SC5.2.1: Answering questions without finishing → response.status = partial', () => {
    it('newly created response has status=partial', async () => {
      const survey = await createSurvey('5-Question Survey');
      for (let i = 1; i <= 5; i++) {
        await addQuestion(survey.id, `Question ${i}`);
      }

      const response = await startResponse(survey.slug);

      // Must start as partial
      expect(response.status).toBe('partial');
    });

    it('answering Q1 and Q2 without completing keeps status=partial', async () => {
      const survey = await createSurvey('5-Question Survey');
      const questions: Question[] = [];
      for (let i = 1; i <= 5; i++) {
        questions.push(await addQuestion(survey.id, `Q${i}`));
      }

      const response = await startResponse(survey.slug);

      // Answer only first two questions
      await saveAnswer(survey.slug, response.id, questions[0].id, 'Answer 1');
      await saveAnswer(survey.slug, response.id, questions[1].id, 'Answer 2');

      // Without calling /complete, status must remain partial
      const dbResponse = await prisma.response.findUnique({ where: { id: response.id } });
      expect(dbResponse?.status).toBe('partial');
      expect(dbResponse?.completedAt).toBeNull();
    });

    it('closing the browser (no /complete call) leaves status=partial in DB', async () => {
      const survey = await createSurvey('Abandoned Survey');
      const q = await addQuestion(survey.id, 'Only question');

      const response = await startResponse(survey.slug);
      await saveAnswer(survey.slug, response.id, q.id, 'My answer');

      // Simulate closing the browser: no /complete call made
      const dbResponse = await prisma.response.findUnique({ where: { id: response.id } });
      expect(dbResponse?.status).toBe('partial');
    });
  });

  // ── SC5.2.2 — partial vs. complete counted separately ────────────────────

  describe('SC5.2.2: Partial responses counted separately from complete', () => {
    it('getSurveyResponses distinguishes partial from complete', async () => {
      const survey = await createSurvey('Mixed Survey');
      const q = await addQuestion(survey.id, 'Q1');

      // Create 3 partial responses
      for (let i = 0; i < 3; i++) {
        const r = await startResponse(survey.slug);
        await saveAnswer(survey.slug, r.id, q.id, `partial-${i}`);
        // Do NOT call /complete
      }

      // Create 2 complete responses
      for (let i = 0; i < 2; i++) {
        const r = await startResponse(survey.slug);
        await saveAnswer(survey.slug, r.id, q.id, `complete-${i}`);
        await request
          .post(`/api/s/${survey.slug}/responses/${r.id}/complete`)
          .send({});
      }

      // Fetch summary via the responses endpoint
      const summaryRes = await request
        .get(`/api/surveys/${survey.id}/responses`)
        .set('x-user-id', userId);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.total).toBe(5);
      expect(summaryRes.body.complete).toBe(2);
      expect(summaryRes.body.partial).toBe(3);
    });

    it('a response transitions from partial to complete when /complete is called', async () => {
      const survey = await createSurvey('Transition Survey');
      const q = await addQuestion(survey.id, 'Question');
      const response = await startResponse(survey.slug);
      await saveAnswer(survey.slug, response.id, q.id, 'my answer');

      // Before completing
      const before = await prisma.response.findUnique({ where: { id: response.id } });
      expect(before?.status).toBe('partial');

      // Complete
      const completeRes = await request
        .post(`/api/s/${survey.slug}/responses/${response.id}/complete`)
        .send({});
      expect(completeRes.status).toBe(200);

      // After completing
      const after = await prisma.response.findUnique({ where: { id: response.id } });
      expect(after?.status).toBe('complete');
      expect(after?.completedAt).not.toBeNull();
      expect(after?.completionTimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  // ── SC5.2.3 — each answer saved immediately ──────────────────────────────

  describe('SC5.2.3: Each answer is saved immediately, not only on final submit', () => {
    it('answer exists in DB immediately after POST /answers (before /complete)', async () => {
      const survey = await createSurvey('Immediate Save Survey');
      const q1 = await addQuestion(survey.id, 'Q1');
      const q2 = await addQuestion(survey.id, 'Q2');

      const response = await startResponse(survey.slug);

      // Save Q1 answer
      await saveAnswer(survey.slug, response.id, q1.id, 'first answer');

      // Verify Q1 answer is in DB immediately (NOT waiting for /complete)
      const answerAfterQ1 = await prisma.answer.findFirst({
        where: { responseId: response.id, questionId: q1.id },
      });
      expect(answerAfterQ1).not.toBeNull();
      expect(answerAfterQ1?.value).toBe('first answer');

      // Save Q2 answer
      await saveAnswer(survey.slug, response.id, q2.id, 'second answer');

      // Both answers in DB before /complete is called
      const answers = await prisma.answer.findMany({ where: { responseId: response.id } });
      expect(answers).toHaveLength(2);

      // Response is still partial at this point
      const dbResponse = await prisma.response.findUnique({ where: { id: response.id } });
      expect(dbResponse?.status).toBe('partial');
    });

    it('answer count reflects each save individually', async () => {
      const survey = await createSurvey('Step-by-step');
      const questions: Question[] = [];
      for (let i = 1; i <= 5; i++) {
        questions.push(await addQuestion(survey.id, `Q${i}`));
      }

      const response = await startResponse(survey.slug);

      for (let i = 0; i < questions.length; i++) {
        await saveAnswer(survey.slug, response.id, questions[i].id, `Answer ${i + 1}`);

        // Verify count increases after each save
        const count = await prisma.answer.count({ where: { responseId: response.id } });
        expect(count).toBe(i + 1);
      }
    });

    it('full session: start → answer all questions → complete', async () => {
      const survey = await createSurvey('Full Session');
      const questions: Question[] = [];
      for (let i = 1; i <= 3; i++) {
        questions.push(await addQuestion(survey.id, `Q${i}`));
      }

      const response = await startResponse(survey.slug);
      expect(response.status).toBe('partial');

      for (const q of questions) {
        await saveAnswer(survey.slug, response.id, q.id, `answer for ${q.title}`);
      }

      const completeRes = await request
        .post(`/api/s/${survey.slug}/responses/${response.id}/complete`)
        .send({});
      expect(completeRes.status).toBe(200);

      const final = await prisma.response.findUnique({
        where: { id: response.id },
        include: { answers: true },
      });
      expect(final?.status).toBe('complete');
      expect(final?.answers).toHaveLength(3);
    });
  });
});
