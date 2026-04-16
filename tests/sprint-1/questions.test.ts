/**
 * Sprint 1 – Question Type Tests
 * Scenarios: SC2.1.1, SC2.1.2, SC2.1.3,
 *            SC2.3.1, SC2.3.2, SC2.3.3,
 *            SC2.6.1, SC2.6.2, SC2.6.3,
 *            SC2.9.1, SC2.9.2, SC2.9.3
 *
 * Strategy:
 *   UI interactions (clicking, keyboard shortcuts, animations) are client-side
 *   behaviour.  These tests verify the database layer that backs each feature:
 *   correct question type is stored, required fields exist, and answers can be
 *   persisted in the expected format.
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const PROJECT_ROOT = require('path').resolve(__dirname, '../..');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any;
let prisma: PrismaClient;
let surveyId: string;
let userId: string;

function slug(): string {
  return 'test-' + Math.random().toString(36).slice(2, 10);
}

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

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `u-${Date.now()}@example.com`, authProvider: 'email' },
  });
  userId = user.id;

  const survey = await prisma.survey.create({
    data: { title: 'Test Survey', slug: slug(), userId },
  });
  surveyId = survey.id;
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, verification_tokens, survey_templates CASCADE'
  );
});

// ─── SC2.1 – Short text question ──────────────────────────────────────────────

describe('SC2.1.1 – respondent types an answer and presses Enter: answer is saved', () => {
  it('stores a text Answer linked to the short_text question and response', async () => {
    const question = await prisma.question.create({
      data: { surveyId, type: 'short_text', title: 'Your name?', order: 0 },
    });

    const response = await prisma.response.create({
      data: { surveyId, status: 'partial' },
    });

    const answer = await prisma.answer.create({
      data: {
        responseId: response.id,
        questionId: question.id,
        value: 'Jane Doe',
      },
    });

    expect(answer.value).toBe('Jane Doe');
    expect(answer.questionId).toBe(question.id);
    expect(answer.responseId).toBe(response.id);
  });

  it('completing the response transitions status to "complete" and sets completedAt', async () => {
    const response = await prisma.response.create({
      data: { surveyId, status: 'partial' },
    });

    const completed = await prisma.response.update({
      where: { id: response.id },
      data: { status: 'complete', completedAt: new Date() },
    });

    expect(completed.status).toBe('complete');
    expect(completed.completedAt).toBeInstanceOf(Date);
  });
});

describe('SC2.1.2 – email validation: respondent sees an error for an invalid email', () => {
  it('stores the email ValidationRule on the short_text question', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'short_text',
        title: 'Your email address?',
        order: 0,
        validation: 'email',
      },
    });

    expect(question.validation).toBe('email');
  });

  it('all ValidationRule enum values are stored in the schema', async () => {
    // Create one question per validation type to confirm the enum is fully supported
    const rules = ['none', 'email', 'url', 'number'] as const;
    for (const [idx, validation] of rules.entries()) {
      const q = await prisma.question.create({
        data: { surveyId, type: 'short_text', title: `Val ${validation}`, order: idx, validation },
      });
      expect(q.validation).toBe(validation);
    }
  });
});

describe('SC2.1.3 – placeholder text appears in the input field', () => {
  it('stores a non-null placeholder on the question', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'short_text',
        title: 'Describe your experience',
        order: 0,
        placeholder: 'e.g. It was great because…',
      },
    });

    expect(question.placeholder).toBe('e.g. It was great because…');
  });

  it('placeholder defaults to null when not provided', async () => {
    const question = await prisma.question.create({
      data: { surveyId, type: 'short_text', title: 'No placeholder', order: 0 },
    });

    expect(question.placeholder).toBeNull();
  });
});

// ─── SC2.3 – Single choice question ───────────────────────────────────────────

describe('SC2.3.1 – respondent clicks option B: it is selected and others are deselected', () => {
  it('creates a single_choice question with 4 QuestionOptions', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'single_choice',
        title: 'Favourite colour?',
        order: 0,
        options: {
          create: [
            { text: 'Red', order: 0 },
            { text: 'Blue', order: 1 },
            { text: 'Green', order: 2 },
            { text: 'Yellow', order: 3 },
          ],
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    expect(question.type).toBe('single_choice');
    expect(question.options).toHaveLength(4);
    expect(question.options[1].text).toBe('Blue'); // option B (index 1)
  });

  it('stores the selected option id in the Answer.selectedOptions JSON field', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'single_choice',
        title: 'Pick one',
        order: 0,
        options: { create: [{ text: 'A', order: 0 }, { text: 'B', order: 1 }] },
      },
      include: { options: true },
    });

    const response = await prisma.response.create({ data: { surveyId } });
    const optionB = question.options.find((o) => o.text === 'B')!;

    const answer = await prisma.answer.create({
      data: {
        responseId: response.id,
        questionId: question.id,
        selectedOptions: [optionB.id],
      },
    });

    expect(answer.selectedOptions).toEqual([optionB.id]);
  });
});

describe('SC2.3.2 – pressing number key 2 selects the second option (keyboard shortcut)', () => {
  it('each QuestionOption has an order field that maps to a keyboard index', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'single_choice',
        title: 'Which option?',
        order: 0,
        options: {
          create: [
            { text: 'Option 1', order: 0 },
            { text: 'Option 2', order: 1 },
            { text: 'Option 3', order: 2 },
          ],
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    // Keyboard shortcut "2" maps to order index 1 (zero-based)
    const keyTwoOption = question.options[1];
    expect(keyTwoOption.text).toBe('Option 2');
    expect(keyTwoOption.order).toBe(1);
  });
});

describe('SC2.3.3 – selecting "Other" reveals a text input for a custom answer', () => {
  it('allowOther=true is stored on the single_choice question', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'single_choice',
        title: 'How did you hear about us?',
        order: 0,
        allowOther: true,
        options: { create: [{ text: 'Friend', order: 0 }, { text: 'Ad', order: 1 }] },
      },
    });

    expect(question.allowOther).toBe(true);
  });

  it('custom "Other" text is saved in Answer.value alongside selectedOptions', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'single_choice',
        title: 'Pick',
        order: 0,
        allowOther: true,
        options: { create: [{ text: 'A', order: 0 }] },
      },
    });

    const response = await prisma.response.create({ data: { surveyId } });
    const answer = await prisma.answer.create({
      data: {
        responseId: response.id,
        questionId: question.id,
        value: 'Other: My custom answer',
        selectedOptions: ['other'],
      },
    });

    expect(answer.value).toContain('My custom answer');
  });
});

// ─── SC2.6 – Yes/No question ──────────────────────────────────────────────────

describe('SC2.6.1 – respondent clicks Yes: it is selected and highlighted', () => {
  it('creates a yes_no question and stores a "yes" answer', async () => {
    const question = await prisma.question.create({
      data: { surveyId, type: 'yes_no', title: 'Do you agree?', order: 0 },
    });

    const response = await prisma.response.create({ data: { surveyId } });
    const answer = await prisma.answer.create({
      data: { responseId: response.id, questionId: question.id, value: 'yes' },
    });

    expect(question.type).toBe('yes_no');
    expect(answer.value).toBe('yes');
  });
});

describe('SC2.6.2 – pressing Y or N on keyboard selects the corresponding option', () => {
  it('yes_no answer accepts "yes" or "no" string values (keyboard-mapped)', async () => {
    const question = await prisma.question.create({
      data: { surveyId, type: 'yes_no', title: 'Are you satisfied?', order: 0 },
    });

    const response = await prisma.response.create({ data: { surveyId } });

    const yesAnswer = await prisma.answer.create({
      data: { responseId: response.id, questionId: question.id, value: 'yes' },
    });
    expect(yesAnswer.value).toBe('yes');

    // Create a second response to test "no"
    const response2 = await prisma.response.create({ data: { surveyId } });
    const noAnswer = await prisma.answer.create({
      data: { responseId: response2.id, questionId: question.id, value: 'no' },
    });
    expect(noAnswer.value).toBe('no');
  });
});

describe('SC2.6.3 – changing mind from Yes to No: Yes is deselected, No is selected', () => {
  it('updating an answer value from "yes" to "no" reflects the new selection', async () => {
    const question = await prisma.question.create({
      data: { surveyId, type: 'yes_no', title: 'Like the product?', order: 0 },
    });

    const response = await prisma.response.create({ data: { surveyId } });

    // Initial selection: Yes
    const answer = await prisma.answer.create({
      data: { responseId: response.id, questionId: question.id, value: 'yes' },
    });
    expect(answer.value).toBe('yes');

    // Respondent changes to No – overwrite
    const updated = await prisma.answer.update({
      where: { id: answer.id },
      data: { value: 'no' },
    });
    expect(updated.value).toBe('no');
  });
});

// ─── SC2.9 – Welcome screen ───────────────────────────────────────────────────

describe('SC2.9.1 – respondent opens survey link and sees the welcome title, description, and Start button', () => {
  it('creates a welcome_screen question with title and description', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'welcome_screen',
        title: 'Welcome to our survey!',
        description: 'It only takes 2 minutes.',
        order: 0,
      },
    });

    expect(question.type).toBe('welcome_screen');
    expect(question.title).toBe('Welcome to our survey!');
    expect(question.description).toBe('It only takes 2 minutes.');
  });

  it('welcome_screen question is returned first when questions are ordered', async () => {
    // Add welcome screen at order 0 and a regular question at order 1
    await prisma.question.createMany({
      data: [
        { surveyId, type: 'welcome_screen', title: 'Welcome', order: 0 },
        { surveyId, type: 'short_text', title: 'Q1', order: 1 },
      ],
    });

    const questions = await prisma.question.findMany({
      where: { surveyId },
      orderBy: { order: 'asc' },
    });

    expect(questions[0].type).toBe('welcome_screen');
  });
});

describe('SC2.9.2 – welcome screen with a custom button label shows that label instead of "Start"', () => {
  it('stores a custom buttonLabel on the welcome_screen question', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'welcome_screen',
        title: 'Ready?',
        order: 0,
        buttonLabel: 'Begin the survey',
      },
    });

    expect(question.buttonLabel).toBe('Begin the survey');
  });

  it('buttonLabel defaults to null when not specified (UI uses "Start")', async () => {
    const question = await prisma.question.create({
      data: { surveyId, type: 'welcome_screen', title: 'Welcome', order: 0 },
    });

    expect(question.buttonLabel).toBeNull();
  });
});

describe('SC2.9.3 – clicking Start shows the first question with a smooth transition', () => {
  it('the welcome_screen is at order 0 and the first real question is at order 1', async () => {
    await prisma.question.createMany({
      data: [
        { surveyId, type: 'welcome_screen', title: 'Start screen', order: 0 },
        { surveyId, type: 'short_text', title: 'What is your name?', order: 1 },
        { surveyId, type: 'yes_no', title: 'Do you agree?', order: 2 },
      ],
    });

    const questions = await prisma.question.findMany({
      where: { surveyId },
      orderBy: { order: 'asc' },
    });

    // After clicking Start the UI advances to index 1
    expect(questions[0].type).toBe('welcome_screen');
    expect(questions[1].type).toBe('short_text');
    expect(questions[1].order).toBe(1);
  });

  it('survey can store a ctaUrl on the welcome_screen for a CTA button variant', async () => {
    const question = await prisma.question.create({
      data: {
        surveyId,
        type: 'welcome_screen',
        title: 'Take the survey',
        order: 0,
        buttonLabel: 'Start Now',
        ctaUrl: 'https://example.com/survey',
      },
    });

    expect(question.buttonLabel).toBe('Start Now');
    expect(question.ctaUrl).toBe('https://example.com/survey');
  });
});
