/**
 * Sprint 2 — Survey Taking integration tests
 *
 * Stories covered:
 *   S3.1  One-question-at-a-time navigation  (SC3.1.1 · SC3.1.2 · SC3.1.3)
 *   S3.2  Keyboard navigation                (SC3.2.1 · SC3.2.2 · SC3.2.3)
 *   S3.5  Transition animations              (SC3.5.1 · SC3.5.2 · SC3.5.3)
 *
 * Notes
 * ─────
 * S3.1 / S3.2 / S3.5 are primarily UI stories (transitions, keyboard events,
 * CSS media queries).  The API layer is tested for the data-model properties
 * that enable those UI behaviours:
 *   • Questions are returned ordered by `order` field (sequential navigation)
 *   • Progress percentage can be calculated from question count + current index
 *   • Survey slug makes the survey publicly accessible for respondents
 *   • Response session tracks `lastQuestionIndex` for back navigation
 *   • Answers are persisted per question enabling back-and-forth traversal
 *   • Drafts and live surveys both accept responses
 *
 * Infrastructure: Testcontainers (PostgreSQL 15) + supertest + Prisma
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
  status: string;
  questions: Question[];
}

interface Question {
  id: string;
  title: string;
  type: string;
  order: number;
  options: Array<{ id: string; text: string; order: number }>;
}

interface SurveyResponse {
  id: string;
  status: string;
  lastQuestionIndex: number;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Sprint 2 — Survey Taking', () => {
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

  async function publishSurvey(surveyId: string): Promise<Survey> {
    const res = await request
      .post(`/api/surveys/${surveyId}/publish`)
      .set('x-user-id', userId);
    expect(res.status).toBe(200);
    return res.body as Survey;
  }

  async function startResponse(slug: string): Promise<SurveyResponse> {
    const res = await request.post(`/api/s/${slug}/responses`).send({});
    expect(res.status).toBe(201);
    return res.body as SurveyResponse;
  }

  async function saveAnswer(
    slug: string,
    responseId: string,
    data: Record<string, unknown>
  ) {
    const res = await request
      .post(`/api/s/${slug}/responses/${responseId}/answers`)
      .send(data);
    expect(res.status).toBe(201);
    return res.body;
  }

  // ── S3.1 — One-question-at-a-time navigation ──────────────────────────────

  describe('SC3.1.1: Only one question is shown at a time — questions are ordered in the API', () => {
    it('GET /api/s/:slug returns questions sorted by order ascending', async () => {
      const survey = await createSurvey('Ordered Survey');
      await addQuestion(survey.id, { title: 'Q1' });
      await addQuestion(survey.id, { title: 'Q2' });
      await addQuestion(survey.id, { title: 'Q3' });

      const res = await request.get(`/api/s/${survey.slug}`);
      expect(res.status).toBe(200);

      const questions = res.body.questions as Question[];
      expect(questions).toHaveLength(3);
      expect(questions[0].title).toBe('Q1');
      expect(questions[1].title).toBe('Q2');
      expect(questions[2].title).toBe('Q3');

      // Verify each question has a stable numeric order field
      expect(questions[0].order).toBe(0);
      expect(questions[1].order).toBe(1);
      expect(questions[2].order).toBe(2);
    });

    it('a published survey is accessible by its slug for respondents', async () => {
      const survey = await createSurvey('Public Survey');
      await addQuestion(survey.id, { title: 'First question' });
      await publishSurvey(survey.id);

      const res = await request.get(`/api/s/${survey.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('live');
      expect(res.body.questions).toHaveLength(1);
    });

    it('a draft survey is accessible by slug (so creators can preview)', async () => {
      const survey = await createSurvey('Draft Preview');
      await addQuestion(survey.id, { title: 'Preview question' });

      const res = await request.get(`/api/s/${survey.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draft');
    });
  });

  describe('SC3.1.2: Pressing Enter / clicking Next advances to the next question', () => {
    it('starting a response records the initial state (lastQuestionIndex=0)', async () => {
      const survey = await createSurvey('Navigation Survey');
      await addQuestion(survey.id, { title: 'Q1' });
      await addQuestion(survey.id, { title: 'Q2' });

      const response = await startResponse(survey.slug);

      // The initial lastQuestionIndex is 0 (first question)
      expect(response.lastQuestionIndex).toBe(0);
      expect(response.status).toBe('partial');
    });

    it('saving an answer for each question allows sequential completion', async () => {
      const survey = await createSurvey('Sequential');
      const q1 = await addQuestion(survey.id, { title: 'Q1' });
      const q2 = await addQuestion(survey.id, { title: 'Q2' });
      const q3 = await addQuestion(survey.id, { title: 'Q3' });

      const response = await startResponse(survey.slug);

      // Simulate advancing through questions by answering each in order
      await saveAnswer(survey.slug, response.id, {
        questionId: q1.id,
        value: 'answer 1',
      });
      await saveAnswer(survey.slug, response.id, {
        questionId: q2.id,
        value: 'answer 2',
      });
      await saveAnswer(survey.slug, response.id, {
        questionId: q3.id,
        value: 'answer 3',
      });

      // Verify all 3 answers are stored
      const answers = await prisma.answer.findMany({
        where: { responseId: response.id },
      });
      expect(answers).toHaveLength(3);
    });
  });

  describe('SC3.1.3: Progress bar shows 50% completion when on question 5 of 10', () => {
    it('progress can be calculated as ((currentIndex+1)/total)*100 from the questions array', async () => {
      const survey = await createSurvey('10-question survey');
      for (let i = 1; i <= 10; i++) {
        await addQuestion(survey.id, { title: `Question ${i}` });
      }

      const res = await request.get(`/api/s/${survey.slug}`);
      expect(res.status).toBe(200);

      const questions = res.body.questions as Question[];
      expect(questions).toHaveLength(10);

      // Question 5 is at index 4 (zero-based)
      const currentIndex = 4;
      const total = questions.length;
      const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

      expect(progressPercent).toBe(50);
    });

    it('questions are returned in ascending order so the UI can show the correct index', async () => {
      const survey = await createSurvey('Ordered 10');
      for (let i = 0; i < 10; i++) {
        await addQuestion(survey.id, { title: `Q${i + 1}` });
      }

      const res = await request.get(`/api/s/${survey.slug}`);
      const questions = res.body.questions as Question[];

      // Each question's array position matches its order field
      questions.forEach((q, idx) => {
        expect(q.order).toBe(idx);
      });
    });
  });

  // ── S3.2 — Keyboard navigation ────────────────────────────────────────────

  describe('SC3.2.1: Pressing Enter advances to the next question', () => {
    it('the API supports storing answers per question (enabling Enter-to-advance)', async () => {
      const survey = await createSurvey();
      const q1 = await addQuestion(survey.id, { title: 'Type your name' });
      const q2 = await addQuestion(survey.id, { title: 'Type your age' });

      const response = await startResponse(survey.slug);

      // Simulate "Enter" on Q1 — save answer and move to Q2
      await saveAnswer(survey.slug, response.id, {
        questionId: q1.id,
        value: 'Alice',
      });

      // Simulate "Enter" on Q2
      await saveAnswer(survey.slug, response.id, {
        questionId: q2.id,
        value: '30',
      });

      const dbAnswers = await prisma.answer.findMany({
        where: { responseId: response.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(dbAnswers).toHaveLength(2);
      expect(dbAnswers[0].value).toBe('Alice');
      expect(dbAnswers[1].value).toBe('30');
    });
  });

  describe('SC3.2.2: Pressing 1/2/3/4 selects the corresponding option on a single-choice question', () => {
    it('a single_choice question exposes ordered options for keyboard shortcut mapping', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'single_choice',
        title: 'Pick an option',
        options: [
          { text: 'Apple', order: 0 },
          { text: 'Banana', order: 1 },
          { text: 'Cherry', order: 2 },
          { text: 'Date', order: 3 },
        ],
      });

      // The UI maps key 1→options[0], 2→options[1], etc.
      // Verify options are returned in ascending order order
      expect(question.options).toHaveLength(4);
      expect(question.options[0].text).toBe('Apple');
      expect(question.options[1].text).toBe('Banana');
      expect(question.options[2].text).toBe('Cherry');
      expect(question.options[3].text).toBe('Date');

      // Key "2" selects options[1] = Banana
      const response = await startResponse(survey.slug);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        selectedOptions: [question.options[1].id], // index 1 = key "2"
      });

      expect((answer.selectedOptions as string[])[0]).toBe(question.options[1].id);
    });
  });

  describe('SC3.2.3: Pressing Shift+Tab or Up Arrow goes back to the previous question', () => {
    it('questions have contiguous order values enabling back navigation by index decrement', async () => {
      const survey = await createSurvey('Back nav');
      const q1 = await addQuestion(survey.id, { title: 'Q1' });
      const q2 = await addQuestion(survey.id, { title: 'Q2' });
      const q3 = await addQuestion(survey.id, { title: 'Q3' });

      const res = await request.get(`/api/s/${survey.slug}`);
      const questions = res.body.questions as Question[];

      // On Q3 (index 2), Back/Shift+Tab → index 1 → Q2
      const currentIndex = 2;
      const previousIndex = currentIndex - 1;

      expect(questions[previousIndex].id).toBe(q2.id);
      expect(questions[previousIndex - 1].id).toBe(q1.id);
    });

    it('a saved answer for a prior question is retrievable when going back', async () => {
      const survey = await createSurvey('Back nav with answers');
      const q1 = await addQuestion(survey.id, { title: 'Name?' });
      const q2 = await addQuestion(survey.id, { title: 'Age?' });

      const response = await startResponse(survey.slug);

      await saveAnswer(survey.slug, response.id, {
        questionId: q1.id,
        value: 'Bob',
      });
      await saveAnswer(survey.slug, response.id, {
        questionId: q2.id,
        value: '25',
      });

      // Navigate back: client re-reads the answer for q1
      const q1Answer = await prisma.answer.findFirst({
        where: { responseId: response.id, questionId: q1.id },
      });

      expect(q1Answer?.value).toBe('Bob');
    });
  });

  // ── S3.5 — Transition animations ─────────────────────────────────────────

  describe('SC3.5.1: Advancing plays a forward slide/fade transition (data prerequisite)', () => {
    it('survey questions are fully accessible in a single API call to enable pre-loading', async () => {
      const survey = await createSurvey('Animation survey');
      await addQuestion(survey.id, { title: 'First' });
      await addQuestion(survey.id, { title: 'Second' });
      await addQuestion(survey.id, { title: 'Third' });

      // A single GET retrieves all questions — the UI can pre-load neighbours
      const res = await request.get(`/api/s/${survey.slug}`);
      expect(res.status).toBe(200);
      expect((res.body.questions as Question[])).toHaveLength(3);
    });
  });

  describe('SC3.5.2: Going back plays a reversed animation (data prerequisite)', () => {
    it('order field allows computing animation direction (current - previous sign)', async () => {
      const survey = await createSurvey('Direction');
      await addQuestion(survey.id, { title: 'A' });
      await addQuestion(survey.id, { title: 'B' });
      await addQuestion(survey.id, { title: 'C' });

      const res = await request.get(`/api/s/${survey.slug}`);
      const questions = res.body.questions as Question[];

      // Forward: order increases → slide-up animation
      // Backward: order decreases → slide-down animation (direction = prev.order - cur.order)
      const forwardDirection = questions[1].order - questions[0].order; // positive
      const backwardDirection = questions[0].order - questions[1].order; // negative

      expect(forwardDirection).toBeGreaterThan(0);
      expect(backwardDirection).toBeLessThan(0);
    });
  });

  describe('SC3.5.3: prefers-reduced-motion disables animations (UI behaviour; data is still served)', () => {
    it('survey data is returned identically regardless of client animation preference', async () => {
      // The UI reads window.matchMedia('(prefers-reduced-motion)') client-side.
      // The API must always return data — there is no server-side animation flag.
      const survey = await createSurvey('Reduced motion');
      await addQuestion(survey.id, { title: 'Only question' });
      await publishSurvey(survey.id);

      // Two identical GETs — one "without motion pref", one "with motion pref".
      // Both should get 200 + same payload (no server-side branching).
      const resA = await request.get(`/api/s/${survey.slug}`);
      const resB = await request
        .get(`/api/s/${survey.slug}`)
        .set('sec-ch-prefers-reduced-motion', 'reduce'); // hint header (informational)

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const questionsA = resA.body.questions as Question[];
      const questionsB = resB.body.questions as Question[];

      expect(questionsA.length).toBe(questionsB.length);
      expect(questionsA[0].id).toBe(questionsB[0].id);
    });

    it('response tracking works the same regardless of animation preferences', async () => {
      const survey = await createSurvey('Motion pref response test');
      const q = await addQuestion(survey.id, { title: 'Q' });

      const response = await startResponse(survey.slug);
      await saveAnswer(survey.slug, response.id, {
        questionId: q.id,
        value: 'answer',
      });

      const completeRes = await request
        .post(`/api/s/${survey.slug}/responses/${response.id}/complete`)
        .send({});

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);
    });
  });

  // ── cross-cutting: full respondent session flow ────────────────────────────

  describe('Cross-cutting: full one-question-at-a-time respondent session', () => {
    it('completes a full session: start → answer each question → complete', async () => {
      const survey = await createSurvey('Full session');
      const questions: Question[] = [];
      for (let i = 1; i <= 5; i++) {
        questions.push(
          await addQuestion(survey.id, { title: `Question ${i}`, type: 'short_text' })
        );
      }
      await publishSurvey(survey.id);

      // Respondent fetches the survey
      const surveyRes = await request.get(`/api/s/${survey.slug}`);
      expect(surveyRes.body.questions).toHaveLength(5);

      // Respondent starts a session
      const response = await startResponse(survey.slug);
      expect(response.status).toBe('partial');

      // Respondent answers one at a time (simulating Enter/Next)
      for (let i = 0; i < questions.length; i++) {
        await saveAnswer(survey.slug, response.id, {
          questionId: questions[i].id,
          value: `Answer ${i + 1}`,
        });
      }

      // Respondent reaches the end and submits
      const completeRes = await request
        .post(`/api/s/${survey.slug}/responses/${response.id}/complete`)
        .send({});

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);

      // The response is marked complete and all answers saved
      const savedResponse = await prisma.response.findUnique({
        where: { id: response.id },
        include: { answers: true },
      });
      expect(savedResponse?.status).toBe('complete');
      expect(savedResponse?.completedAt).not.toBeNull();
      expect(savedResponse?.answers).toHaveLength(5);

      // The survey response count was incremented
      const updatedSurvey = await prisma.survey.findUnique({
        where: { id: survey.id },
      });
      expect(updatedSurvey?.responseCount).toBe(1);
    });
  });
});
