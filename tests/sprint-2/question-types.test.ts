/**
 * Sprint 2 — Question Types integration tests
 *
 * Stories covered:
 *   S2.2  Long text question      (SC2.2.1 · SC2.2.2 · SC2.2.3)
 *   S2.4  Multiple choice         (SC2.4.1 · SC2.4.2 · SC2.4.3)
 *   S2.5  Rating / scale          (SC2.5.1 · SC2.5.2 · SC2.5.3)
 *   S2.7  Dropdown question       (SC2.7.1 · SC2.7.2 · SC2.7.3)
 *
 * Infrastructure: Testcontainers (PostgreSQL 15) + supertest + Prisma
 */

import supertest from 'supertest';
import { PrismaClient } from '@prisma/client';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { startTestDatabase, stopTestDatabase, cleanDatabase, createTestUser } from './helpers/setup';
import { buildApp } from './helpers/app';

// ─── shared types ─────────────────────────────────────────────────────────────

interface Survey {
  id: string;
  slug: string;
  status: string;
}

interface Question {
  id: string;
  title: string;
  type: string;
  charLimit: number | null;
  minSelections: number | null;
  maxSelections: number | null;
  ratingStyle: string | null;
  ratingMax: number | null;
  searchable: boolean;
  options: Array<{ id: string; text: string; order: number }>;
}

interface Response {
  id: string;
  status: string;
}

interface Answer {
  id: string;
  value: string | null;
  numericValue: number | null;
  selectedOptions: unknown;
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe('Sprint 2 — Question Types', () => {
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
    data: Record<string, unknown>
  ): Promise<Question> {
    const res = await request
      .post(`/api/surveys/${surveyId}/questions`)
      .set('x-user-id', userId)
      .send(data);
    expect(res.status).toBe(201);
    return res.body.question as Question;
  }

  async function publishSurvey(surveyId: string): Promise<void> {
    const res = await request
      .post(`/api/surveys/${surveyId}/publish`)
      .set('x-user-id', userId);
    expect(res.status).toBe(200);
  }

  async function startResponse(slug: string): Promise<Response> {
    const res = await request.post(`/api/s/${slug}/responses`).send({});
    expect(res.status).toBe(201);
    return res.body as Response;
  }

  async function saveAnswer(
    slug: string,
    responseId: string,
    data: Record<string, unknown>
  ): Promise<Answer> {
    const res = await request
      .post(`/api/s/${slug}/responses/${responseId}/answers`)
      .send(data);
    expect(res.status).toBe(201);
    return res.body as Answer;
  }

  // ── S2.2 — Long text question ─────────────────────────────────────────────

  describe('SC2.2.1: Long text question supports multi-line input', () => {
    it('creates a long_text question and returns type=long_text', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Tell us your story',
      });

      expect(question.type).toBe('long_text');
    });

    it('long_text question has no charLimit by default', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Open feedback',
      });

      expect(question.charLimit).toBeNull();
    });
  });

  describe('SC2.2.2: A 500-character limit is stored and surfaced to the respondent', () => {
    it('charLimit=500 is persisted on the question record', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Detailed feedback',
        charLimit: 500,
      });

      expect(question.charLimit).toBe(500);
    });

    it('the charLimit is readable from GET /questions', async () => {
      const survey = await createSurvey();
      await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Limited',
        charLimit: 250,
      });

      const res = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      expect(res.status).toBe(200);
      expect((res.body as Question[])[0].charLimit).toBe(250);
    });
  });

  describe('SC2.2.3: A long text question with no limit accepts answers of any length', () => {
    it('saves a 600-character answer without error', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Unlimited text',
      });
      // Draft surveys accept responses
      const response = await startResponse(survey.slug);

      const longText = 'A'.repeat(600);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        value: longText,
      });

      expect(answer.value).toBe(longText);
      expect(answer.value!.length).toBe(600);
    });

    it('saves a 2000-character answer without error', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Very long feedback',
      });
      const response = await startResponse(survey.slug);

      const veryLong = 'B'.repeat(2000);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        value: veryLong,
      });

      expect(answer.value?.length).toBe(2000);
    });
  });

  // ── S2.4 — Multiple choice question ──────────────────────────────────────

  describe('SC2.4.1: A respondent can select 3 options for a multiple choice question', () => {
    it('saves an answer with selectedOptions containing all 3 chosen values', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'multiple_choice',
        title: 'Pick your favourites',
        options: [
          { text: 'Pizza', order: 0 },
          { text: 'Sushi', order: 1 },
          { text: 'Tacos', order: 2 },
          { text: 'Ramen', order: 3 },
        ],
      });

      const response = await startResponse(survey.slug);

      const selectedIds = question.options.slice(0, 3).map((o) => o.id);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        selectedOptions: selectedIds,
      });

      expect(Array.isArray(answer.selectedOptions)).toBe(true);
      expect((answer.selectedOptions as string[]).length).toBe(3);
    });
  });

  describe('SC2.4.2: maxSelections is stored so the UI can enforce "Select at most N"', () => {
    it('creates a multiple_choice question with maxSelections=2 persisted', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'multiple_choice',
        title: 'Choose up to 2',
        maxSelections: 2,
        options: [
          { text: 'A', order: 0 },
          { text: 'B', order: 1 },
          { text: 'C', order: 2 },
        ],
      });

      expect(question.maxSelections).toBe(2);
    });

    it('the maxSelections value is readable from GET /questions', async () => {
      const survey = await createSurvey();
      await addQuestion(survey.id, {
        type: 'multiple_choice',
        title: 'Constrained choice',
        maxSelections: 3,
        options: [
          { text: 'X', order: 0 },
          { text: 'Y', order: 1 },
          { text: 'Z', order: 2 },
          { text: 'W', order: 3 },
        ],
      });

      const res = await request
        .get(`/api/surveys/${survey.id}/questions`)
        .set('x-user-id', userId);

      expect((res.body as Question[])[0].maxSelections).toBe(3);
    });
  });

  describe('SC2.4.3: minSelections is stored so the UI can enforce "Select at least N"', () => {
    it('creates a multiple_choice question with minSelections=1 persisted', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'multiple_choice',
        title: 'At least one',
        minSelections: 1,
        options: [
          { text: 'Option A', order: 0 },
          { text: 'Option B', order: 1 },
        ],
      });

      expect(question.minSelections).toBe(1);
    });

    it('creates a question with both minSelections and maxSelections', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'multiple_choice',
        title: 'Range constraint',
        minSelections: 2,
        maxSelections: 4,
        options: [
          { text: 'A', order: 0 },
          { text: 'B', order: 1 },
          { text: 'C', order: 2 },
          { text: 'D', order: 3 },
          { text: 'E', order: 4 },
        ],
      });

      expect(question.minSelections).toBe(2);
      expect(question.maxSelections).toBe(4);
    });
  });

  // ── S2.5 — Rating / scale question ────────────────────────────────────────

  describe('SC2.5.1: Clicking the 4th star on a 5-star rating saves numericValue=4', () => {
    it('saves a star-rating answer with numericValue=4', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'rating',
        title: 'Rate your experience',
        ratingStyle: 'stars',
        ratingMax: 5,
      });

      const response = await startResponse(survey.slug);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        numericValue: 4,
      });

      expect(answer.numericValue).toBe(4);
    });

    it('the ratingStyle=stars and ratingMax=5 are stored on the question', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'rating',
        title: 'Star rating',
        ratingStyle: 'stars',
        ratingMax: 5,
      });

      expect(question.ratingStyle).toBe('stars');
      expect(question.ratingMax).toBe(5);
    });
  });

  describe('SC2.5.2: Clicking 7 on a 1-10 numeric scale saves numericValue=7', () => {
    it('saves a numeric-scale answer with numericValue=7', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'rating',
        title: 'How likely are you to recommend us?',
        ratingStyle: 'numeric',
        ratingMax: 10,
      });

      const response = await startResponse(survey.slug);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        numericValue: 7,
      });

      expect(answer.numericValue).toBe(7);
    });

    it('ratingMax=10 is persisted on the numeric scale question', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'rating',
        title: 'NPS score',
        ratingStyle: 'numeric',
        ratingMax: 10,
      });

      expect(question.ratingMax).toBe(10);
    });
  });

  describe('SC2.5.3: Hovering over a star shows a preview highlight (ratingStyle stored)', () => {
    it('creates a rating question with ratingStyle=emoji and stores it', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'rating',
        title: 'Emoji sentiment',
        ratingStyle: 'emoji',
        ratingMax: 5,
      });

      // The ratingStyle is the data the UI reads to decide which component to render
      expect(question.ratingStyle).toBe('emoji');
    });

    it('each ratingStyle variant (stars/numeric/emoji) is stored correctly', async () => {
      const survey = await createSurvey();

      for (const style of ['stars', 'numeric', 'emoji'] as const) {
        const q = await addQuestion(survey.id, {
          type: 'rating',
          title: `Rating (${style})`,
          ratingStyle: style,
        });
        expect(q.ratingStyle).toBe(style);
      }
    });
  });

  // ── S2.7 — Dropdown question ───────────────────────────────────────────────

  describe('SC2.7.1: A dropdown with many options stores all of them', () => {
    it('creates a dropdown question with 50 options and all are persisted', async () => {
      const survey = await createSurvey();
      const fiftyOptions = Array.from({ length: 50 }, (_, i) => ({
        text: `Option ${i + 1}`,
        order: i,
      }));

      const question = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Select a country',
        options: fiftyOptions,
      });

      expect(question.options).toHaveLength(50);
      expect(question.options[0].text).toBe('Option 1');
      expect(question.options[49].text).toBe('Option 50');
    });

    it('options are returned in insertion order', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Pick a region',
        options: [
          { text: 'North', order: 0 },
          { text: 'South', order: 1 },
          { text: 'East', order: 2 },
          { text: 'West', order: 3 },
        ],
      });

      const texts = question.options.map((o) => o.text);
      expect(texts).toEqual(['North', 'South', 'East', 'West']);
    });
  });

  describe('SC2.7.2: A dropdown with 10+ options can be made searchable', () => {
    it('creates a dropdown question with searchable=true persisted', async () => {
      const survey = await createSurvey();
      const tenOptions = Array.from({ length: 12 }, (_, i) => ({
        text: `Item ${i + 1}`,
        order: i,
      }));

      const question = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Searchable dropdown',
        searchable: true,
        options: tenOptions,
      });

      expect(question.searchable).toBe(true);
    });

    it('a non-searchable dropdown has searchable=false', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Plain dropdown',
        options: [
          { text: 'Yes', order: 0 },
          { text: 'No', order: 1 },
        ],
      });

      expect(question.searchable).toBe(false);
    });
  });

  describe('SC2.7.3: Selecting a dropdown option closes the dropdown and stores the value', () => {
    it('saves an answer with the selected option value', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Choose a plan',
        options: [
          { text: 'Basic', order: 0 },
          { text: 'Pro', order: 1 },
          { text: 'Enterprise', order: 2 },
        ],
      });

      const response = await startResponse(survey.slug);

      // The selected value is stored in `selectedOptions` (JSON array with one item)
      const selectedOption = question.options[1]; // 'Pro'
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        selectedOptions: [selectedOption.id],
      });

      expect(Array.isArray(answer.selectedOptions)).toBe(true);
      expect((answer.selectedOptions as string[])[0]).toBe(selectedOption.id);
    });

    it('saves a dropdown answer using the option text as value', async () => {
      const survey = await createSurvey();
      const question = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Preferred contact',
        options: [
          { text: 'Email', order: 0 },
          { text: 'Phone', order: 1 },
          { text: 'Chat', order: 2 },
        ],
      });

      const response = await startResponse(survey.slug);
      const answer = await saveAnswer(survey.slug, response.id, {
        questionId: question.id,
        value: 'Email',
      });

      expect(answer.value).toBe('Email');
    });
  });

  // ── cross-cutting: response completion with mixed question types ────────────

  describe('Cross-cutting: completing a response with mixed question types', () => {
    it('allows completing a response after saving answers to multiple question types', async () => {
      const survey = await createSurvey('Mixed types survey');

      const textQ = await addQuestion(survey.id, {
        type: 'long_text',
        title: 'Comments',
      });
      const ratingQ = await addQuestion(survey.id, {
        type: 'rating',
        title: 'Rating',
        ratingStyle: 'stars',
        ratingMax: 5,
      });
      const dropdownQ = await addQuestion(survey.id, {
        type: 'dropdown',
        title: 'Plan',
        options: [
          { text: 'Basic', order: 0 },
          { text: 'Pro', order: 1 },
        ],
      });

      const response = await startResponse(survey.slug);

      await saveAnswer(survey.slug, response.id, {
        questionId: textQ.id,
        value: 'Great product!',
      });
      await saveAnswer(survey.slug, response.id, {
        questionId: ratingQ.id,
        numericValue: 5,
      });
      await saveAnswer(survey.slug, response.id, {
        questionId: dropdownQ.id,
        value: 'Pro',
      });

      const completeRes = await request
        .post(`/api/s/${survey.slug}/responses/${response.id}/complete`)
        .send({});

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);

      // Verify the response is marked complete in the DB
      const saved = await prisma.response.findUnique({
        where: { id: response.id },
        include: { answers: true },
      });

      expect(saved?.status).toBe('complete');
      expect(saved?.answers).toHaveLength(3);
    });
  });
});
