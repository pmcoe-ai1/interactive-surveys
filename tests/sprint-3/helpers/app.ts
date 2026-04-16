/**
 * Self-contained Express application for Sprint 3 integration tests.
 *
 * Mirrors the Next.js API routes with all Sprint 3 fixes applied:
 *
 *   D2.1  PATCH/DELETE question verifies the question belongs to the target survey
 *         (not just that the user owns a survey with that ID)
 *   D2.4  POST answers / complete returns 404 (not 400) when the response ID is missing
 *   D2.5  POST /api/s/:slug/responses wraps DB call in try/catch → 500 on errors
 *   S1.4  PUT /api/surveys/:id/questions reorders questions by orderedIds array
 *   S5.3  POST /api/s/:slug/responses captures userId from x-user-id header
 *   S6.1  GET /api/surveys/:id/responses returns summary stats (total/complete/partial/rate)
 *
 * Auth is replaced by a simple `x-user-id` header so tests remain stateless.
 */

import express, { Express, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

// ─── helpers ─────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

async function getNextOrder(prisma: PrismaClient, surveyId: string): Promise<number> {
  const last = await prisma.question.findFirst({
    where: { surveyId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

function getUserId(req: Request): string | null {
  return (req.headers['x-user-id'] as string) ?? null;
}

function requireAuth(req: Request, res: Response): string | null {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return uid;
}

// ─── app factory ─────────────────────────────────────────────────────────────

export function buildApp(prisma: PrismaClient): Express {
  const app = express();
  app.use(express.json());

  // ── surveys ──────────────────────────────────────────────────────────────

  /** POST /api/surveys — create survey */
  app.post('/api/surveys', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { title, description } = req.body as { title?: string; description?: string };
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const survey = await prisma.survey.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        slug: generateSlug(title),
        userId,
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    return res.status(201).json(survey);
  });

  /** GET /api/surveys — list own surveys */
  app.get('/api/surveys', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const surveys = await prisma.survey.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    });
    return res.json(surveys);
  });

  /** GET /api/surveys/:id — get one survey (owner only) */
  app.get('/api/surveys/:id', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    return res.json(survey);
  });

  /** POST /api/surveys/:id/publish — make survey live */
  app.post('/api/surveys/:id/publish', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
      include: { _count: { select: { questions: true } } },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    if (survey._count.questions === 0) {
      return res.status(400).json({ error: 'Add at least one question before publishing' });
    }

    const updated = await prisma.survey.update({
      where: { id: req.params.id },
      data: { status: 'live' },
    });

    return res.json(updated);
  });

  // ── questions ────────────────────────────────────────────────────────────

  type OptionInput = { text: string; order: number };

  /** GET /api/surveys/:id/questions — list questions */
  app.get('/api/surveys/:id/questions', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({ where: { id: req.params.id, userId } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const questions = await prisma.question.findMany({
      where: { surveyId: req.params.id },
      orderBy: { order: 'asc' },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    return res.json(questions);
  });

  /** POST /api/surveys/:id/questions — add question */
  app.post('/api/surveys/:id/questions', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({ where: { id: req.params.id, userId } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const body = req.body as Record<string, unknown>;
    if (!body.type) {
      return res.status(400).json({ error: 'Question type is required' });
    }

    const order = await getNextOrder(prisma, req.params.id);
    const totalBefore = await prisma.question.count({ where: { surveyId: req.params.id } });

    const question = await prisma.question.create({
      data: {
        surveyId: req.params.id,
        type: body.type as string,
        title: (body.title as string) ?? 'Untitled question',
        description: (body.description as string) ?? null,
        required: (body.required as boolean) ?? false,
        order,
        placeholder: (body.placeholder as string) ?? null,
        validation: (body.validation as string) ?? 'none',
        charLimit: (body.charLimit as number) ?? null,
        minSelections: (body.minSelections as number) ?? null,
        maxSelections: (body.maxSelections as number) ?? null,
        ratingStyle: (body.ratingStyle as string) ?? null,
        ratingMax: (body.ratingMax as number) ?? 5,
        searchable: (body.searchable as boolean) ?? false,
        allowOther: (body.allowOther as boolean) ?? false,
        buttonLabel: (body.buttonLabel as string) ?? null,
        ctaUrl: (body.ctaUrl as string) ?? null,
        options:
          Array.isArray(body.options) && (body.options as unknown[]).length > 0
            ? {
                create: (body.options as OptionInput[]).map((o) => ({
                  text: o.text,
                  order: o.order,
                })),
              }
            : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });

    const HIGH = 12;
    return res.status(201).json({
      question,
      warning:
        totalBefore >= HIGH
          ? `Surveys with more than ${HIGH} questions have lower completion rates`
          : null,
    });
  });

  /**
   * PATCH /api/surveys/:id/questions/:qid — update question
   *
   * D2.1 fix: verifies that the question belongs to THIS survey (not just any
   * survey owned by the user). Cross-survey question manipulation → 404.
   */
  app.patch('/api/surveys/:id/questions/:qid', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    // Verify survey ownership
    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    // D2.1: also verify the question belongs to THIS survey
    const existing = await prisma.question.findFirst({
      where: { id: req.params.qid, surveyId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Survey not found' });

    const { options, ...rest } = req.body as { options?: OptionInput[] } & Record<string, unknown>;

    try {
      const question = await prisma.question.update({
        where: { id: req.params.qid },
        data: {
          ...rest,
          ...(options !== undefined
            ? {
                options: {
                  deleteMany: {},
                  create: options.map((o) => ({ text: o.text, order: o.order })),
                },
              }
            : {}),
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });

      await prisma.survey.update({ where: { id: req.params.id }, data: {} });
      return res.json(question);
    } catch {
      return res.status(400).json({ error: 'Failed to update question' });
    }
  });

  /**
   * DELETE /api/surveys/:id/questions/:qid — delete question
   *
   * D2.1 fix: verifies that the question belongs to THIS survey.
   */
  app.delete('/api/surveys/:id/questions/:qid', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    // Verify survey ownership
    const survey = await prisma.survey.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    // D2.1: also verify the question belongs to THIS survey
    const existing = await prisma.question.findFirst({
      where: { id: req.params.qid, surveyId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Survey not found' });

    await prisma.question.delete({ where: { id: req.params.qid } });

    // Re-index remaining questions
    const remaining = await prisma.question.findMany({
      where: { surveyId: req.params.id },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((q, idx) =>
        prisma.question.update({ where: { id: q.id }, data: { order: idx } })
      )
    );

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });
    return res.json({ success: true });
  });

  /**
   * PUT /api/surveys/:id/questions — reorder questions (S1.4)
   *
   * Body: { orderedIds: string[] }
   * Each ID is assigned order = its array index.
   */
  app.put('/api/surveys/:id/questions', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({ where: { id: req.params.id, userId } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const { orderedIds } = req.body as { orderedIds?: unknown };
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }

    await Promise.all(
      (orderedIds as string[]).map((id, idx) =>
        prisma.question.update({ where: { id }, data: { order: idx } })
      )
    );

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });
    return res.json({ success: true });
  });

  /** POST /api/surveys/:id/questions/:qid/duplicate */
  app.post('/api/surveys/:id/questions/:qid/duplicate', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({ where: { id: req.params.id, userId } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const source = await prisma.question.findFirst({
      where: { id: req.params.qid, surveyId: req.params.id },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!source) return res.status(404).json({ error: 'Question not found' });

    const nextOrder = await getNextOrder(prisma, req.params.id);

    const copy = await prisma.question.create({
      data: {
        surveyId: req.params.id,
        type: source.type,
        title: `${source.title} (copy)`,
        description: source.description,
        required: source.required,
        order: nextOrder,
        placeholder: source.placeholder,
        validation: source.validation,
        charLimit: source.charLimit,
        minSelections: source.minSelections,
        maxSelections: source.maxSelections,
        ratingStyle: source.ratingStyle,
        ratingMax: source.ratingMax,
        searchable: source.searchable,
        allowOther: source.allowOther,
        buttonLabel: source.buttonLabel,
        ctaUrl: source.ctaUrl,
        options:
          source.options.length > 0
            ? { create: source.options.map((o) => ({ text: o.text, order: o.order })) }
            : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    await prisma.survey.update({ where: { id: req.params.id }, data: {} });
    return res.status(201).json(copy);
  });

  // ── public survey (respondent) ────────────────────────────────────────────

  /** GET /api/s/:slug — fetch survey by slug (public) */
  app.get('/api/s/:slug', async (req, res) => {
    const survey = await prisma.survey.findUnique({
      where: { slug: req.params.slug },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    return res.json(survey);
  });

  /**
   * POST /api/s/:slug/responses — start a response session
   *
   * D2.5 fix: wrapped in try/catch → 500 JSON body on DB errors (not a crash)
   * S5.3 fix: captures userId from x-user-id header (null for anonymous)
   */
  app.post('/api/s/:slug/responses', async (req, res) => {
    const survey = await prisma.survey.findUnique({ where: { slug: req.params.slug } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    if (survey.status !== 'live' && survey.status !== 'draft') {
      return res.status(403).json({ error: 'Survey is closed' });
    }

    const fingerprint =
      (req.headers['x-browser-fingerprint'] as string) ??
      (req.body as { fingerprint?: string })?.fingerprint ??
      null;

    // S5.3: capture authenticated user if present; anonymous → null
    const userId = (req.headers['x-user-id'] as string) ?? null;

    // D2.5: wrap creation in try/catch to return 500 instead of crashing
    try {
      const response = await prisma.response.create({
        data: {
          surveyId: survey.id,
          browserFingerprint: fingerprint,
          startedAt: new Date(),
          userId: userId || null,
        },
      });

      return res.status(201).json(response);
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/s/:slug/responses/:rid/answers — save one answer
   *
   * D2.4 fix: returns 404 (not 400) when the response record does not exist.
   */
  app.post('/api/s/:slug/responses/:rid/answers', async (req, res) => {
    const body = req.body as {
      questionId?: string;
      value?: unknown;
      selectedOptions?: unknown;
      numericValue?: unknown;
      dateValue?: unknown;
    };

    if (!body.questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    // D2.4: verify the response exists before attempting to save an answer
    const response = await prisma.response.findUnique({ where: { id: req.params.rid } });
    if (!response) return res.status(404).json({ error: 'Response not found' });

    try {
      const answer = await prisma.answer.create({
        data: {
          responseId: req.params.rid,
          questionId: body.questionId,
          value: typeof body.value === 'string' ? body.value : null,
          selectedOptions: Array.isArray(body.selectedOptions)
            ? (body.selectedOptions as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          numericValue: typeof body.numericValue === 'number' ? body.numericValue : null,
          dateValue: typeof body.dateValue === 'string' ? new Date(body.dateValue) : null,
        },
      });

      return res.status(201).json(answer);
    } catch {
      return res.status(400).json({ error: 'Failed to save answer' });
    }
  });

  /**
   * POST /api/s/:slug/responses/:rid/complete — mark response complete
   *
   * D2.4 fix: returns 404 (not 400) when the response record does not exist.
   */
  app.post('/api/s/:slug/responses/:rid/complete', async (req, res) => {
    // D2.4: verify response exists
    const response = await prisma.response.findUnique({
      where: { id: req.params.rid },
      select: { startedAt: true, surveyId: true },
    });

    if (!response) return res.status(404).json({ error: 'Response not found' });

    const completionTimeSeconds = Math.round(
      (Date.now() - response.startedAt.getTime()) / 1000
    );

    await prisma.response.update({
      where: { id: req.params.rid },
      data: {
        status: 'complete',
        completedAt: new Date(),
        completionTimeSeconds,
      },
    });

    await prisma.survey.update({
      where: { id: response.surveyId },
      data: { responseCount: { increment: 1 } },
    });

    return res.json({ success: true });
  });

  /**
   * GET /api/surveys/:id/responses — response summary (S6.1)
   *
   * Owner-only. Returns: { survey, responses[], total, complete, partial, completionRate }
   */
  app.get('/api/surveys/:id/responses', async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const survey = await prisma.survey.findFirst({ where: { id: req.params.id, userId } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const responses = await prisma.response.findMany({
      where: { surveyId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { answers: true } },
      },
    });

    const total = responses.length;
    const complete = responses.filter((r) => r.status === 'complete').length;
    const partial = total - complete;
    const completionRate = total > 0 ? Math.round((complete / total) * 100) : 0;

    return res.json({ survey, responses, total, complete, partial, completionRate });
  });

  return app;
}
